# Developer — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.architect.md`

## Implementation Plan

Followed the architect doc's component breakdown in order: new `packages/electron` workspace first
(verify Electron installs and runs at all before building anything on top of it), then frontend plugin
system changes, then backend/scripts cleanup of the retired `open-epaper` stopgap, then docs.

## Files Changed

**New — `packages/electron` workspace:**
- `packages/electron/package.json` — single runtime dep `electron` (pinned exact `43.1.0`, per SC-07),
  `typescript`/`@types/node` devDeps
- `packages/electron/tsconfig.json` — mirrors `packages/backend`'s shape (CommonJS, ES2020, strict)
- `packages/electron/src/main.ts` — app lifecycle, kiosk `BrowserWindow`, `BrowserView` registry
  (`Map<viewId, BrowserView>`), `embed:show`/`embed:hide` IPC handlers, resize-driven bounds recalculation
- `packages/electron/src/preload.ts` — `contextBridge` exposing `window.deskosElectron`

**New — frontend:**
- `packages/frontend/src/shell/ContentArea/EmbeddedWebviewContainer.tsx` — mounts/unmounts trigger
  `showEmbeddedView`/`hideEmbeddedView`; renders a fallback message if `window.deskosElectron` is
  undefined (plain-browser dev preview)
- `packages/frontend/src/lib/electron-bridge.d.ts` — global `Window.deskosElectron` type declaration

**Modified:**
- `packages/frontend/src/plugins/types.ts` — `ContentMode` gains `'embedded-webview'`; both
  `PluginSubItem` and `Plugin` gain `embeddedUrl?: string`
- `packages/frontend/src/plugins/news/NewsPlugin.tsx` — `news-the-hindu`/`news-livemint` switch from
  `contentMode: 'external'` + `onActivate` (the retired open-epaper POST) to `contentMode:
  'embedded-webview'` + `embeddedUrl`; `openEpaper()` helper deleted entirely
- `packages/frontend/src/shell/ContentArea/ContentArea.tsx` — new branch rendering
  `EmbeddedWebviewContainer` for `contentMode === 'embedded-webview'`
- `packages/backend/src/routes/system.ts` — `open-epaper` route and its `EPAPER_SITES`/`isEpaperSite`/
  `LAUNCH_EPAPER_SCRIPT` support code removed; `shutdown`/`exit-to-desktop` routes untouched (confirmed
  they need no changes, per architect doc)
- `scripts/launch-kiosk.sh` — now execs Electron (`node_modules/.bin/electron
  packages/electron/dist/main.js`) instead of Chromium directly; keeps the `xset` screensaver-disable
  calls unchanged; adds existence checks for the Electron binary and built `main.js` with clear error
  messages
- `scripts/return-to-kiosk.sh` — dropped the `pkill -f 'chromium.*--user-data-dir'` workaround (no longer
  applicable — no separate epaper Chromium process exists to conflict with anymore)
- `scripts/deskos-kiosk.service` — `Description` updated to reflect Electron; `ExecStart` unchanged
  (still points at `launch-kiosk.sh` by the same filename); `DISPLAY`/`XAUTHORITY` env vars unchanged
- `package.json` (root) — `packages/electron` added to `workspaces`; `build` script gains a third step;
  new `electron:dev` script for local Electron+BrowserView testing against the `:3000` dev server
- `CLAUDE.md` — "Epaper Access" section rewritten to describe `BrowserView` embedding and both rejected
  prior approaches (iframe, then separate-window) with the concrete reasons each failed; "Account and
  Authentication", "Architecture Rules", and the Wayland/XDG_RUNTIME_DIR bullets updated; new bullet
  flagging the unconfirmed Node-version requirement
- `README.md` — Stack, Deployment overview, RPi Setup steps (epaper sign-in now happens **inside** the
  running kiosk instead of via a standalone Chromium window, so it moved after "start the kiosk"),
  Deploying Updates, Troubleshooting, Plugin Architecture, Current Plugins table, and the "Epaper Access"
  bullet in Display/Power/Settings all updated; new `electron:dev` note under Development

**Removed:**
- `scripts/launch-epaper.sh` — retired along with the workaround it existed for

## Code Summary

The Electron main process (`main.ts`) owns exactly one `BrowserWindow` (the kiosk shell, `kiosk: true`,
`contextIsolation: true`/`nodeIntegration: false`/`sandbox: true`) and a registry of `BrowserView`
instances keyed by `viewId`, one per embedded site, each on its own `persist:<viewId>` session partition.
`showEmbeddedView`/`hideEmbeddedView` attach/detach (never destroy) views so state persists across
sidebar navigation, satisfying the PO's "stay alive" requirement. Bounds are computed as window content
size minus a hardcoded `260px` sidebar offset (mirrors `--sidebar-width` in `index.css`, manually kept in
sync — flagged as architect Open Question 2, not resolved in this pass), recalculated on window resize
(covers orientation rotation). Both the main window and every `BrowserView` deny `setWindowOpenHandler`
requests, preventing any embedded site from spawning a further top-level window.

The frontend side is a thin adapter: `EmbeddedWebviewContainer` is the only new component, and it does
nothing but call the two IPC methods on mount/unmount and render `null` (the actual epaper content is
painted natively by the `BrowserView`, not by React). `ContentArea` needed one new conditional branch;
everything else in the plugin/sidebar system (which already had to learn about non-`'react'` content
modes for the earlier `'external'` open-epaper flow) needed no further changes beyond adding the new
mode to the type union.

Backend and scripts changes are net deletions — `open-epaper`'s route, its launch script, and the
profile-lock workaround it required in `return-to-kiosk.sh` are all gone, since embedding removes the
whole "separate Chromium process fighting over a shared profile" problem class that workaround existed
for.

## Decisions Made

- **Electron pinned to `43.1.0` exact** (not `^43.1.0`), per SC-07 from the secure-coding checklist and
  matching this repo's existing convention of pinning `better-sqlite3` etc.
- **Node version risk surfaced but not resolved**: `npm install` warned `EBADENGINE` (Electron 43 wants
  Node ≥22.12; this dev environment has Node 20.19.5). Despite the warning, install succeeded and
  `electron --version` ran correctly (downloaded and reported `v43.1.0`), so this did not block
  development — but it is **unverified on the actual Pi**, and is called out explicitly in CLAUDE.md, the
  developer's Open Items below, and as the first thing Tester/Executor must check on-device. If the Pi's
  Node is also <22.12 and that turns out to matter for the actual kiosk launch (not just `--version`),
  the fix is either upgrading Node on the Pi or pinning an older Electron major compatible with Node 20.
- **Did not attempt to launch the actual kiosk window (`kiosk: true`) during this session.** Verified
  instead: (1) the Electron binary installs and runs (`electron --version` succeeds), (2) all three
  packages (`backend`, `frontend`, `electron`) typecheck and build cleanly end-to-end via `npm run
  build`. A `kiosk: true` window would have taken over the local development machine's screen, which
  isn't appropriate to do unprompted — real end-to-end verification (BrowserView actually rendering,
  bounds correctly excluding the sidebar, sign-in flow working, session surviving a restart) needs to
  happen either with explicit local permission or, more meaningfully, on the actual Pi. This is the
  single largest gap between "typechecks and builds" and "actually works," and Tester/Executor must treat
  it as the primary focus rather than a formality.
- **Kept `contentMode: 'external'` in the type system** rather than removing it — it's a generic "fires
  an action instead of navigating" primitive (still used by nothing currently, since epaper was its only
  consumer), not epaper-specific, and architect doc's framing was "replace epaper's *use* of it," not
  "delete the mode."
- **`260px` sidebar-width constant duplicated manually** between `index.css` and `main.ts` rather than
  building a shared-constants mechanism now — matches architect's explicit "low risk short-term, revisit
  if it drifts" guidance (Open Question 2), avoided premature abstraction for a single duplicated number.
- **Did not touch `scripts/apply-orientation.sh`/`scripts/hdmi-power.sh`** — confirmed via the architect
  doc's reasoning (both operate on the Wayland output, transparent to any XWayland client including
  Electron) and via not finding any Electron-specific interaction point in either script.

## Code Quality Fixes (post-review round 1)

`code-quality-report.md` blocked hand-off on one MEDIUM (SC-08) and filed one LOW as advisory. Both
fixed directly rather than deferred:

- **[MEDIUM] SC-08** — `packages/electron/src/main.ts`'s `embed:show` IPC handler trusted the
  renderer's `url` argument outright, a regression from the enum-validated `open-epaper` route it
  replaced. Fixed by adding `EMBEDDABLE_VIEWS`, a fixed `viewId → url` map, and rejecting any call
  where `url` doesn't match the expected value for `viewId`.
- **[LOW] advisory** — neither `embed:show` nor `embed:hide` verified `event.sender` against the
  trusted main window's `webContents`. Fixed by adding that check to both handlers (not filed as a
  bug since it's resolved, not deferred).

## Open Items for Tester/Executor

1. **On-device Node version check** (`node --version` on the Pi) — blocks confidently answering whether
   the EBADENGINE warning matters in practice.
2. **On-device RAM measurement** (`free -h` idle vs. with one `BrowserView` active) — this was the
   architect's flagged go/no-go checkpoint (PO Non-Functional Requirements) and has not been done; this
   developer pass could not do it without Pi access.
3. **Actual kiosk launch and BrowserView rendering** — never visually verified this session (see Decisions
   Made). Confirm: window is truly fullscreen/frameless, sidebar renders correctly alongside the
   `BrowserView`, bounds are pixel-accurate against the real `260px`/display-resolution combination, and
   switching away from and back to an embedded item doesn't reload it.
4. **Sign-in flow on real hardware**: tap News → The Hindu on the actual kiosk, sign in with a
   temporarily-attached keyboard, confirm subscribed content renders, reboot the Pi, confirm the session
   persisted.
5. **Exit to Desktop / Return to DeskOS still work** against the Electron-launched kiosk (should be
   unaffected per architect's reasoning, but unverified in practice).
6. **`setWindowOpenHandler` denial doesn't break anything users actually need** — quick manual check that
   nothing on the epaper sites relies on a popup for legitimate functionality.
