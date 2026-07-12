# DeskOS — Claude Code Guidelines

## Project Overview

DeskOS is a Raspberry Pi personal information appliance. It's a full-screen kiosk dashboard, not a web app — think dedicated hardware device.

## Critical Device Constraints

- **No keyboard** in normal operation. Input is pointing device only (touch or mouse on a tablet display connected via HDMI/USB-C).
- **No text input UI** should be added unless it comes with an on-screen keyboard component. Any feature that requires typing is out of scope until that plugin is built.
- **Kiosk mode**: an Electron app (`packages/electron`) runs full-screen with no window chrome, hosting the DeskOS frontend. Users cannot navigate away via URL bar. (Before this Electron migration, the kiosk was bare Chromium in `--kiosk` mode — see "Epaper Access" for why that changed.)

## Account and Authentication

- Subscriber accounts use email `tusharacc@gmail.com` (Google account).
- **No credential storage in code or config files** — credentials are never committed.
- Authentication is handled via **Electron's persistent session store** (`~/.deskos-electron`, set via `app.setPath('userData', ...)` in `packages/electron/src/main.ts`): log in once per embedded site (keyboard attached only during setup), then the session persists across reboots. This is a separate profile from the pre-Electron `~/.deskos-chromium` Chromium profile — not migrated or reused, a deliberate breaking change (see "Epaper Access").
- DeskOS itself never handles login flows.

## Architecture Rules

- `packages/frontend` — React 18 + Vite. All UI.
- `packages/backend` — Express + tsx. API only; serves built frontend in production.
- `packages/electron` — Electron main process + preload script. Hosts the kiosk `BrowserWindow` (loads the frontend from `packages/backend` exactly as Chromium used to) and manages per-site `BrowserView` instances for embedded third-party content (`contentMode: 'embedded-webview'` plugin sub-items — see "Epaper Access"). No packaging/installer (`electron-builder` etc.) — runs unpackaged via `node_modules/.bin/electron`, npm-installed on-device like `better-sqlite3`.
- Plugin system lives in `packages/frontend/src/plugins/`. Each plugin is a self-contained directory.
- Register plugins in `packages/frontend/src/plugins/registry.ts` — this is the only place to add sidebar entries.
- Backend API routes are prefixed `/api/`. The SPA catch-all uses a negative-lookahead regex to exclude them.
- `packages/backend/src/paths.ts` is the single source of truth for repo-root-relative paths (`REPO_ROOT`, `SCRIPTS_DIR`, `DATA_DIR`) computed from the compiled `dist/`. New backend files must import from here rather than recomputing `__dirname` depth themselves — that's exactly how the `FRONTEND_DIST` off-by-one bug happened.
- Any backend route that shells out (rotation, standby, shutdown, etc.) must use `execFile` with an argument array, never `exec`/template strings, and must validate the input against a fixed enum before it ever reaches the shell.
- The backend binds to `127.0.0.1` only (`app.listen(PORT, '127.0.0.1', ...)` in `index.ts`), not all interfaces. This app has mutating routes now (settings/rotate, standby, shutdown) — do not remove this binding or add a route without auth to a server that isn't loopback-restricted.

## Development vs. Deployment

- Dev: `npm run dev` from repo root → frontend on 3000 (Vite dev server), backend on 3001.
- **Production always serves on port 3001, never 3000.** There is no Vite dev server in production — the Express backend serves the built frontend itself from `dist/frontend`. Any script or doc pointing Electron/kiosk at `localhost:3000` in a deployed context is a bug (this has happened before — `scripts/launch-kiosk.sh`'s `DESKOS_URL` default and the README's one-time auth command both regressed to `:3000` and had to be fixed).
- The app must work identically on macOS (dev) and Raspberry Pi OS (deploy). No platform-specific code in the main codebase — use platform abstraction if needed.
- No build step is needed during development; Vite handles HMR.
- `FRONTEND_DIST` in `packages/backend/src/index.ts` is computed relative to `__dirname` of the *compiled* `dist/index.js` (which lives at `packages/backend/dist/`), not the source file. Reaching the repo-root `dist/frontend` from there requires three `../` segments (dist → backend → packages → repo root), not two — this was off by one and caused every production request to `/` to 404 while `/api/*` worked fine (masking the bug). If this path ever needs to change again, verify by curling `/` after a real `npm run build`, not just `/api/health`.
- Raspberry Pi OS no longer creates a default `pi` user (Bookworm+) — never hardcode `User=pi` or `/home/pi/...` in systemd unit files or scripts. `scripts/deskos-backend.service` / `scripts/deskos-kiosk.service` use `__DESKOS_USER__` / `__DESKOS_REPO_DIR__` / `__DESKOS_HOME__` placeholders, substituted by `scripts/install-services.sh` at install time — install via that script, never `cp` the `.service` files directly.
- Any feature needing a privileged one-off command (e.g. shutdown) follows the same templating pattern: a `scripts/*.sudoers` file scoped to the exact command only (never a broad passwordless grant), templated with `__DESKOS_USER__` and installed by `install-services.sh` via `visudo -c` validation before copying into `/etc/sudoers.d/`. See `scripts/deskos-shutdown.sudoers`.
- Raspberry Pi OS Bookworm/Trixie run Wayland (Electron via XWayland, same as Chromium did before it) rather than classic X11. Don't assume a static `~/.Xauthority` file for manual/SSH-driven launches — run interactive one-time steps (like epaper sign-in) from a terminal opened directly in the Pi's own graphical session instead of exporting `DISPLAY`/`XAUTHORITY` over SSH.
- systemd services (`deskos-kiosk.service`'s `ExecStartPre`, `deskos-backend.service`) run outside any graphical login session, so they don't inherit `XDG_RUNTIME_DIR` or `WAYLAND_DISPLAY`. Electron itself is fine because it runs via XWayland using the `DISPLAY`/`XAUTHORITY` env vars already set on the unit (unchanged from Chromium's setup) — but any *native* Wayland client (e.g. `wlr-randr`, used by `scripts/apply-orientation.sh` and `scripts/hdmi-power.sh`) fails with `XDG_RUNTIME_DIR is invalid or not set` unless the script derives it itself (`/run/user/$(id -u)`) and locates the actual `wayland-N` socket rather than assuming one is exported. This crash-looped `deskos-kiosk.service` in production before being fixed — see those two scripts for the pattern to follow for any future Wayland-native tooling.
- Electron requires Node ≥22.12 per its own `engines` field; confirm the actual Node version on the Pi (`node --version`) matches or exceeds this before relying on it — this was flagged but not confirmed during the Electron migration (dev/CI ran Node 20.x, which produced an `EBADENGINE` warning but did not block `npm install` or running `electron --version`; verify this holds on the real device too).

## Code Style

- TypeScript everywhere. No `any` unless unavoidable with a comment explaining why.
- No credential, token, or secret in any committed file.
- `localStorage` reads must validate shape before use — never blindly cast `JSON.parse` output. Same rule applies to any backend file-based persistence (see `packages/backend/src/settings-store.ts`): a missing, unparseable, or wrong-shaped file falls back to a default rather than throwing.
- Express SPA catch-all must stay last in `packages/backend/src/index.ts` and must exclude `/api/*`.
- No comments explaining *what* the code does. Comments only for non-obvious *why*.

## Epaper Access (The Hindu / LiveMint)

News → The Hindu / LiveMint are `contentMode: 'embedded-webview'` sidebar items (`embeddedUrl` set to
the epaper URL). Selecting one is a normal sidebar navigation — `ContentArea`'s `EmbeddedWebviewContainer`
calls `window.deskosElectron.showEmbeddedView(viewId, url)` on mount and `hideEmbeddedView()` on unmount,
via the preload-exposed IPC bridge (`packages/electron/src/preload.ts`). The Electron main process
(`packages/electron/src/main.ts`) maintains a `Map<viewId, BrowserView>` registry: each embedded site gets
its own `BrowserView` on its own persistent session partition (`persist:<viewId>`), positioned via
`setBounds` to occupy only the content-area region (window width minus the `260px` sidebar — mirrors
`--sidebar-width` in `packages/frontend/src/index.css`, kept in sync manually, no automatic sharing
between a CSS custom property and the Electron main process). `hideEmbeddedView` detaches
(`removeBrowserView`) rather than destroys the view, so switching away and back doesn't reload it.

This is a genuine embed — the DeskOS sidebar stays visible and interactive simultaneously — unlike the
two approaches tried before it, both rejected for concrete, verified reasons:

1. **Iframe embedding** (original approach): live debugging (inspecting `epaper.thehindu.com` directly
   with Chrome DevTools / an MCP browser session) found The Hindu's epaper SPA stores its session in
   `localStorage` (`<accountId>:session-data`), not a cookie. Chromium's storage partitioning gives a
   third-party iframe (embedded from DeskOS's own origin) a completely separate, permanently-empty
   `localStorage` from the site's real top-level partition, so no amount of re-authenticating in a
   standalone Chromium window ever fixed the kiosk's iframe view — that data structurally could not cross
   the partition boundary. Unconditional platform behavior in modern Chromium, no override flag (the
   `SameSiteByDefaultCookies` killswitch was tried first and confirmed to be a no-op on Chromium 142).
2. **Separate top-level Chromium window** (`open-epaper`/`launch-epaper.sh`, the interim fix): worked —
   a genuine top-level navigation does share the same storage partition as a direct sign-in — but broke
   the "DeskOS shell always visible" model, and didn't scale to multiple embedded integrations (planned:
   home automation dashboards) each needing their own "exit kiosk, open a window, come back" cycle.

An even earlier idea, a backend proxy, was rejected before either of the above for a related but distinct
reason: it runs on the Pi, not in the authenticated browser, so it can't forward whatever session data
lives in the browser profile at all, cookie or `localStorage`.

**Net lesson, twice validated**: don't assume embedding a third-party authenticated SPA will carry its
login state without checking *how* embedding actually happens at the browser-engine level. An HTML
`<iframe>` is a DOM-nested sub-frame and subject to storage partitioning; Electron's `BrowserView` is a
separate top-level `WebContents` under programmatic control and is not — verify which one an "embed"
mechanism actually is before relying on it to preserve a session, don't assume from the name alone.

## Open Low-Severity Bugs

- **L-2**: Missing `aria-expanded` on expandable SidebarWidget header
- **L-3**: No visible focus ring in sidebar CSS
- **L-4**: Long JSX attribute line on `SidebarWidget.tsx:38`

Bugs filed via the dev-framework's reviewer phase are tracked separately in
`.dev-framework/bugs/bugs.json` (currently `BUG-001`, `BUG-002` — both low-severity, non-blocking,
from the `additional-features` review). Check both places when looking for known open issues.
