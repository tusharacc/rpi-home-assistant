# Architect — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.po.md`

## System Design

```
systemd (deskos-kiosk.service)
  └─ Electron main process (packages/electron/dist/main.js)
       ├─ BrowserWindow (fullscreen, frameless — kiosk parity)
       │    └─ loads http://localhost:3001  (existing DeskOS React frontend,
       │       served by the existing, UNCHANGED Express backend —
       │       deskos-backend.service continues exactly as today)
       │    └─ preload.js: contextBridge exposes window.deskosElectron.*
       │       (showEmbeddedView / hideEmbeddedView / isElectron)
       │
       └─ BrowserView registry (Map<viewId, BrowserView>)
            ├─ 'news-the-hindu'  → persist:epaper-the-hindu, epaper.thehindu.com
            └─ 'news-livemint'   → persist:epaper-livemint,  epaper.livemint.com
```

The backend (`packages/backend`) and its systemd unit are **untouched** by this migration — Electron is
a new consumer of the same served frontend, not a replacement for the backend. This directly satisfies
PO Functional Requirement 1 and the Backwards-Compatibility note that the API surface doesn't change.

A `BrowserView` is a separate native `WebContents` layered on top of the `BrowserWindow`'s own web
contents, positioned by pixel bounds set from the main process (`view.setBounds(...)`). Sizing those
bounds to the content-area region only (excluding the `260px` sidebar — see `--sidebar-width` in
`packages/frontend/src/index.css:18`) means the sidebar, rendered by the underlying DeskOS page's own
DOM, stays fully visible and interactive while the BrowserView is showing — this is what makes "sidebar
+ embedded epaper simultaneously" possible, which no iframe-based approach could ever achieve (see PO
Rationale).

## Components

### 1. `packages/electron` (new workspace)

```
packages/electron/
  src/
    main.ts        — app lifecycle, BrowserWindow creation, BrowserView registry, IPC handlers
    preload.ts      — contextBridge API exposed to the renderer
  package.json      — deps: electron only
  tsconfig.json      — CommonJS, matches packages/backend's tsconfig shape
```

`main.ts` responsibilities:
- Set `app.setPath('userData', path.join(os.homedir(), '.deskos-electron'))` — the new,
  separate-from-`~/.deskos-chromium` persistent store PO Functional Requirement 5 calls out. This is
  where all `persist:*` session partitions physically live on disk.
- Create one `BrowserWindow` with `kiosk: true` (Electron's built-in kiosk mode — fullscreen, no frame,
  no window controls; equivalent to today's `--kiosk` Chromium flag), `webPreferences: { contextIsolation:
  true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') }`, loading
  `http://localhost:3001`.
- Maintain `const views = new Map<string, BrowserView>()`. On `ipcMain.handle('embed:show', (viewId,
  url))`: create the `BrowserView` on first use (`webPreferences: { partition: 'persist:' + viewId, ... }`),
  attach it with `win.addBrowserView(view)`, compute bounds (window content bounds minus the 260px sidebar
  offset — see Tech Decisions), and load `url` only on first creation (subsequent shows just re-attach,
  no reload — satisfies PO's "stay alive across navigation" requirement). On `ipcMain.handle('embed:hide')`:
  `win.removeBrowserView(view)` for whichever view is currently attached — this detaches/hides it without
  destroying the `WebContents`, so state (scroll position, session, in-page navigation) is preserved for
  next time.
- Recompute and re-apply bounds for any currently-attached view on the `BrowserWindow`'s `'resize'` event
  (covers orientation rotation, which changes the effective display resolution via `wlr-randr`).
- `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))` on both the main window and every
  BrowserView — mirrors the existing sandboxing philosophy already applied to `ArticleReaderModal`'s
  iframe (`allow-scripts allow-same-origin allow-forms allow-popups`, no `allow-popups-to-escape-sandbox`);
  epaper sites don't need to spawn further top-level windows, and allowing it would resurrect the
  original "unclosable window" class of bug this whole investigation started from.

`preload.ts`:
```ts
contextBridge.exposeInMainWorld('deskosElectron', {
  isElectron: true,
  showEmbeddedView: (viewId: string, url: string) => ipcRenderer.invoke('embed:show', viewId, url),
  hideEmbeddedView: () => ipcRenderer.invoke('embed:hide'),
})
```

### 2. `packages/frontend` changes

- `plugins/types.ts`: replace the epaper-specific use of `contentMode: 'external'` with a new
  `'embedded-webview'` mode. `PluginSubItem` gains `embeddedUrl?: string`. `onActivate` (added earlier
  this session for the now-retired open-epaper flow) is removed from the epaper sub-items — it's no
  longer an action-fire-and-forget click, it's a real navigable content mode.
- `ContentArea.tsx`: new branch for `contentMode === 'embedded-webview'`. On mount, call
  `window.deskosElectron?.showEmbeddedView(item.id, item.embeddedUrl)`; on unmount (cleanup function),
  call `window.deskosElectron?.hideEmbeddedView()`. Renders an empty/near-empty container in the content
  area — the BrowserView paints on top of it natively, so React doesn't render the actual epaper content
  itself. If `window.deskosElectron` is undefined (plain-browser dev preview via `npm run dev` at
  `localhost:3000`, not running inside Electron), show a fallback message ("Embedded view requires the
  Electron shell — run `npm run electron:dev`") instead of silently doing nothing.
- `NewsPlugin.tsx`: `news-the-hindu`/`news-livemint` become `contentMode: 'embedded-webview'`,
  `embeddedUrl: 'https://epaper.thehindu.com'` / `'https://epaper.livemint.com'`. Drop the `openEpaper()`
  fetch helper entirely — no backend round-trip needed anymore.

### 3. `packages/backend` changes

- Remove the `open-epaper` route and its `EPAPER_SITES`/`isEpaperSite`/`LAUNCH_EPAPER_SCRIPT` support
  code from `routes/system.ts` (PO Functional Requirement 6). `exit-to-desktop` and `shutdown` routes are
  untouched — see Tech Decisions on why Exit to Desktop needs no changes at all.

### 4. `scripts/` changes

- **Removed**: `scripts/launch-epaper.sh` (no longer used — epaper is a BrowserView in the same process
  as DeskOS itself now, not a separately-launched Chromium window).
- **`scripts/return-to-kiosk.sh`**: drop the `pkill -f 'chromium.*--user-data-dir'` workaround — it
  existed solely to clean up a leftover *separate* epaper Chromium window fighting over the shared
  `--user-data-dir` profile lock, a scenario that no longer exists once epaper lives inside the same
  Electron process. Reverts to just `sudo /usr/bin/systemctl start deskos-kiosk.service`.
- **`scripts/launch-kiosk.sh`**: replaced by a thin launch wrapper (could keep the same filename for
  minimal churn in `deskos-kiosk.service`) that keeps the existing `xset s off / xset s noblank / xset
  -dpms` screensaver-disable calls (these are X11-display-level, independent of which browser process
  runs), then execs the Electron binary instead of Chromium:
  ```bash
  ELECTRON_BIN="${REPO_DIR}/node_modules/.bin/electron"
  MAIN_JS="${REPO_DIR}/packages/electron/dist/main.js"
  exec "${ELECTRON_BIN}" "${MAIN_JS}"
  ```
- **`scripts/apply-orientation.sh`, `scripts/hdmi-power.sh`**: **no changes**. Both operate on the Wayland
  output via `wlr-randr`, which is transparent to any XWayland client sitting on top of it — true for
  Chromium today and equally true for Electron (Electron runs via XWayland here too, see Tech Decisions).
- **`scripts/deskos-kiosk.service`**: `ExecStart` line updated to point at the new launch wrapper (same
  file path if we keep reusing `launch-kiosk.sh`'s name — no unit-file placeholder changes needed).
  `DISPLAY`/`XAUTHORITY` env vars stay exactly as they are today.

### 5. Root workspace

- `package.json`: add `"packages/electron"` to the `workspaces` array. `build` script gains a third
  step: `npm run build -w packages/electron`. New script `electron:dev` for local (including macOS)
  testing of the Electron shell + BrowserView mechanism against the dev servers, separate from the
  existing plain-browser `npm run dev` flow (which remains the fast day-to-day UI dev loop and does not
  require Electron at all).

## Data Models

No new persisted data models. Electron's per-site `persist:*` session partitions are Electron/Chromium-
managed state (cookies, localStorage, IndexedDB) under `~/.deskos-electron`, not application-level data
this project defines a schema for — same category of thing as the existing `~/.deskos-chromium` profile
today, just Electron's own equivalent.

## API Contracts

**Removed**: `POST /api/system/open-epaper` (HTTP route retired along with the workaround it supported).

**Unchanged**: every other `/api/*` route, including `POST /api/system/exit-to-desktop` and `POST
/api/system/shutdown` — these still just start/stop `deskos-kiosk.service` by name via the existing
`deskos-kiosk-control`/`deskos-shutdown` sudoers rules. The service name doesn't change, only what
process it launches internally, so these routes require zero code changes.

**New (IPC, not HTTP)** — `window.deskosElectron`, exposed only inside the Electron-rendered main window:
- `isElectron: boolean` — presence check for non-Electron dev contexts.
- `showEmbeddedView(viewId: string, url: string): Promise<void>`
- `hideEmbeddedView(): Promise<void>`

## Tech Decisions

- **New `packages/electron` workspace**, TypeScript, single runtime dependency (`electron`). No
  `electron-builder`/`electron-forge` packaging — this is a single self-hosted device, not a distributed
  installer target. Run unpackaged directly via `node_modules/.bin/electron packages/electron/dist/main.js`,
  same "must `npm install` on-device (ARM-native prebuilt binary)" pattern already established for
  `better-sqlite3` in the README's deploy runbook.
- **BrowserWindow loads the existing served frontend** (`http://localhost:3001`) rather than loading
  built files directly via `file://` — keeps `packages/backend` as the single source of truth for
  serving the frontend, identical to today's Chromium-kiosk behavior, and requires no change to how the
  frontend is built or served.
- **BrowserView per embedded site**, not one shared view — isolates cookies/localStorage/IndexedDB
  between different embedded dashboards (epaper today; a future Home Assistant–style dashboard later)
  via separate `persist:<viewId>` partitions. Trivial to add a new one: register a new `viewId` and URL,
  no new mechanism needed — this is the "reusable pattern" PO asked for.
- **Bounds calculation**: `{ x: 260, y: 0, width: winBounds.width - 260, height: winBounds.height }`,
  recomputed on the window's `'resize'` event (covers orientation rotation). `260` mirrors
  `--sidebar-width` in `packages/frontend/src/index.css:18` — **Developer must keep these in sync
  manually** (there's no automatic sharing between a CSS custom property and Electron main-process TS;
  flagged as an Open Question below for a more robust fix if the sidebar width ever changes).
- **Electron runs via XWayland**, not native Wayland/Ozone mode — deliberately matches today's working
  Chromium setup exactly (same `DISPLAY`/`XAUTHORITY` env vars already on `deskos-kiosk.service`) rather
  than introducing a second unknown (Wayland-native Electron compatibility) on top of the migration
  itself. Native Wayland/Ozone is an explicit non-goal for this upgrade.
- **`apply-orientation.sh`/`hdmi-power.sh` need no changes** — `wlr-randr` operates on the Wayland output
  itself, transparent to any XWayland client on top of it, Electron included.
- **Exit to Desktop needs no changes** — it stops/starts `deskos-kiosk.service` by unit name; that the
  process behind the name changed from Chromium to Electron is invisible to that mechanism.
- **`open-epaper` route, `launch-epaper.sh`, and `return-to-kiosk.sh`'s pkill workaround are removed**,
  not just superseded — leaving them would be dead code from a stopgap this upgrade directly replaces
  (PO acceptance criterion).
- **contextIsolation + sandboxed preload, no nodeIntegration**, for both the main window and every
  BrowserView — least-privilege default, and an improvement over today's `--disable-web-security` (now
  already removed) rather than a regression.
- **`setWindowOpenHandler` denies all new-window requests** from both the main window and BrowserViews —
  prevents any embedded site (or a future home-automation dashboard) from spawning an unclosable
  top-level window, the exact bug class this whole session started with.

## Open Questions

1. **Exact Pi 4 RAM (2/4/8GB) is unconfirmed.** This gates whether Electron + one active BrowserView fits
   comfortably alongside the existing backend + news-pipeline SQLite workload. **First Developer task
   should be an on-device spike**: `npm install electron` on the actual Pi (confirms the ARM prebuilt
   installs cleanly at all — also need `uname -m` to confirm `arm64` vs `armv7l`, since Pi 4 supports
   both depending on the installed OS image), launch a minimal kiosk + one BrowserView, and capture
   `free -h` idle vs. active. This is a go/no-go checkpoint per PO's Non-Functional Requirements — if
   numbers are bad, the fallback is PO's originally-declined "shell first, embed later" option, not
   silently shipping something that thrashes the Pi.
2. **Sidebar-width constant (`260`) is manually duplicated** between CSS and Electron main-process code.
   Low risk short-term (sidebar width rarely changes), but Developer should consider a small shared-constants
   file (e.g. `packages/electron/src/layout-constants.ts` importable from both, or reading it from an env
   var set at build time) if this starts to drift.
3. **New-window policy for in-page links inside an embedded site** (e.g. epaper's own outbound links to
   unrelated domains) — denying all `setWindowOpenHandler` requests is the safe default proposed above;
   Developer should confirm this doesn't break any legitimate in-epaper navigation the user actually
   needs (e.g. does the epaper reader ever *need* a popup for anything functional? Unlikely, but worth a
   quick manual check during Tester phase).
4. **Per-site session reset** (e.g. a Settings button to clear a stuck embedded session) is a natural
   follow-up but explicitly out of scope for this upgrade per PO.
