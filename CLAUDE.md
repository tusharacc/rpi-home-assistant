# DeskOS — Claude Code Guidelines

## Project Overview

DeskOS is a Raspberry Pi personal information appliance. It's a full-screen kiosk dashboard, not a web app — think dedicated hardware device.

## Critical Device Constraints

- **No keyboard** in normal operation. Input is pointing device only (touch or mouse on a tablet display connected via HDMI/USB-C).
- **No text input UI** should be added unless it comes with an on-screen keyboard component. Any feature that requires typing is out of scope until that plugin is built.
- **Kiosk mode**: Chromium runs full-screen with no browser chrome. Users cannot navigate away via URL bar.

## Account and Authentication

- Subscriber accounts use email `tusharacc@gmail.com` (Google account).
- **No credential storage in code or config files** — credentials are never committed.
- Authentication is handled via **Chromium persistent profile**: log in once during RPi setup (keyboard attached only during setup), then session cookies persist across reboots.
- DeskOS itself never handles login flows.

## Architecture Rules

- `packages/frontend` — React 18 + Vite. All UI.
- `packages/backend` — Express + tsx. API only; serves built frontend in production.
- Plugin system lives in `packages/frontend/src/plugins/`. Each plugin is a self-contained directory.
- Register plugins in `packages/frontend/src/plugins/registry.ts` — this is the only place to add sidebar entries.
- Backend API routes are prefixed `/api/`. The SPA catch-all uses a negative-lookahead regex to exclude them.
- `packages/backend/src/paths.ts` is the single source of truth for repo-root-relative paths (`REPO_ROOT`, `SCRIPTS_DIR`, `DATA_DIR`) computed from the compiled `dist/`. New backend files must import from here rather than recomputing `__dirname` depth themselves — that's exactly how the `FRONTEND_DIST` off-by-one bug happened.
- Any backend route that shells out (rotation, standby, shutdown, etc.) must use `execFile` with an argument array, never `exec`/template strings, and must validate the input against a fixed enum before it ever reaches the shell.
- The backend binds to `127.0.0.1` only (`app.listen(PORT, '127.0.0.1', ...)` in `index.ts`), not all interfaces. This app has mutating routes now (settings/rotate, standby, shutdown) — do not remove this binding or add a route without auth to a server that isn't loopback-restricted.

## Development vs. Deployment

- Dev: `npm run dev` from repo root → frontend on 3000 (Vite dev server), backend on 3001.
- **Production always serves on port 3001, never 3000.** There is no Vite dev server in production — the Express backend serves the built frontend itself from `dist/frontend`. Any script or doc pointing Chromium/kiosk at `localhost:3000` in a deployed context is a bug (this has happened before — `scripts/launch-kiosk.sh`'s `DESKOS_URL` default and the README's one-time auth command both regressed to `:3000` and had to be fixed).
- The app must work identically on macOS (dev) and Raspberry Pi OS (deploy). No platform-specific code in the main codebase — use platform abstraction if needed.
- No build step is needed during development; Vite handles HMR.
- `FRONTEND_DIST` in `packages/backend/src/index.ts` is computed relative to `__dirname` of the *compiled* `dist/index.js` (which lives at `packages/backend/dist/`), not the source file. Reaching the repo-root `dist/frontend` from there requires three `../` segments (dist → backend → packages → repo root), not two — this was off by one and caused every production request to `/` to 404 while `/api/*` worked fine (masking the bug). If this path ever needs to change again, verify by curling `/` after a real `npm run build`, not just `/api/health`.
- Raspberry Pi OS no longer creates a default `pi` user (Bookworm+) — never hardcode `User=pi` or `/home/pi/...` in systemd unit files or scripts. `scripts/deskos-backend.service` / `scripts/deskos-kiosk.service` use `__DESKOS_USER__` / `__DESKOS_REPO_DIR__` / `__DESKOS_HOME__` placeholders, substituted by `scripts/install-services.sh` at install time — install via that script, never `cp` the `.service` files directly.
- Any feature needing a privileged one-off command (e.g. shutdown) follows the same templating pattern: a `scripts/*.sudoers` file scoped to the exact command only (never a broad passwordless grant), templated with `__DESKOS_USER__` and installed by `install-services.sh` via `visudo -c` validation before copying into `/etc/sudoers.d/`. See `scripts/deskos-shutdown.sudoers`.
- Raspberry Pi OS Bookworm/Trixie run Wayland (Chromium via XWayland) rather than classic X11. Don't assume a static `~/.Xauthority` file for manual/SSH-driven Chromium launches — run interactive one-time steps (like epaper sign-in) from a terminal opened directly in the Pi's own graphical session instead of exporting `DISPLAY`/`XAUTHORITY` over SSH.
- systemd services (`deskos-kiosk.service`'s `ExecStartPre`, `deskos-backend.service`) run outside any graphical login session, so they don't inherit `XDG_RUNTIME_DIR` or `WAYLAND_DISPLAY`. Chromium itself is fine because it runs via XWayland using the `DISPLAY`/`XAUTHORITY` env vars already set on the unit — but any *native* Wayland client (e.g. `wlr-randr`, used by `scripts/apply-orientation.sh` and `scripts/hdmi-power.sh`) fails with `XDG_RUNTIME_DIR is invalid or not set` unless the script derives it itself (`/run/user/$(id -u)`) and locates the actual `wayland-N` socket rather than assuming one is exported. This crash-looped `deskos-kiosk.service` in production before being fixed — see those two scripts for the pattern to follow for any future Wayland-native tooling.
- Unlike `deskos-kiosk.service`, `deskos-backend.service` does **not** set `DISPLAY`/`XAUTHORITY` (it's API-only, normally has no reason to touch the display). `scripts/launch-epaper.sh` is invoked from the backend but still needs to launch a real Chromium window via XWayland, so it derives `DISPLAY=:0`/`XAUTHORITY=$HOME/.Xauthority` itself rather than assuming they're set — same self-sufficiency principle as the Wayland-native scripts above, just for a different pair of env vars.

## Code Style

- TypeScript everywhere. No `any` unless unavoidable with a comment explaining why.
- No credential, token, or secret in any committed file.
- `localStorage` reads must validate shape before use — never blindly cast `JSON.parse` output. Same rule applies to any backend file-based persistence (see `packages/backend/src/settings-store.ts`): a missing, unparseable, or wrong-shaped file falls back to a default rather than throwing.
- Express SPA catch-all must stay last in `packages/backend/src/index.ts` and must exclude `/api/*`.
- No comments explaining *what* the code does. Comments only for non-obvious *why*.

## Epaper Access (The Hindu / LiveMint)

Epaper sites are **not** iframe-embedded — News → The Hindu / LiveMint are `contentMode: 'external'`
sidebar items that POST `/api/system/open-epaper`, which stops `deskos-kiosk.service` and opens the
epaper as its own top-level Chromium window on the same `--user-data-dir` profile (see
`scripts/launch-epaper.sh`), the same pattern as "Exit to Desktop". `--disable-web-security` was
removed from `launch-kiosk.sh` since nothing embeds cross-origin content anymore.

This replaced an earlier iframe-based approach after live debugging found the actual reason it
never showed as subscribed: The Hindu's epaper SPA stores its session in `localStorage`
(`<accountId>:session-data`), not a cookie — confirmed by inspecting it directly with Chrome
DevTools/an MCP browser session, live, against the real site. Chromium's storage partitioning gives
a third-party iframe (embedded from DeskOS's own origin) a completely separate, permanently-empty
`localStorage` from the site's real top-level partition, so no amount of re-authenticating in a
standalone Chromium window ever fixed the kiosk's iframe view — that data structurally could not
cross the partition boundary. This is unconditional platform behavior in modern Chromium with no
override flag (same fate as the `SameSiteByDefaultCookies` killswitch, which was tried first and
confirmed to be a no-op on Chromium 142). A backend proxy was evaluated even earlier and also
rejected, for a related but distinct reason: it runs on the Pi, not in the authenticated browser, so
it can't forward whatever session data lives in the Chromium profile at all, cookie or
`localStorage`. **Net lesson: don't assume iframe-embedding a third-party authenticated SPA will
carry its login state — verify the actual auth mechanism (cookie vs. token-in-storage) before
choosing that approach, since only a genuine top-level navigation is guaranteed to share the same
storage partition as a direct sign-in.**

## Open Low-Severity Bugs

- **L-2**: Missing `aria-expanded` on expandable SidebarWidget header
- **L-3**: No visible focus ring in sidebar CSS
- **L-4**: Long JSX attribute line on `SidebarWidget.tsx:38`

Bugs filed via the dev-framework's reviewer phase are tracked separately in
`.dev-framework/bugs/bugs.json` (currently `BUG-001`, `BUG-002` — both low-severity, non-blocking,
from the `additional-features` review). Check both places when looking for known open issues.
