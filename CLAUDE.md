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

## Development vs. Deployment

- Dev: `npm run dev` from repo root → frontend on 3000 (Vite dev server), backend on 3001.
- **Production always serves on port 3001, never 3000.** There is no Vite dev server in production — the Express backend serves the built frontend itself from `dist/frontend`. Any script or doc pointing Chromium/kiosk at `localhost:3000` in a deployed context is a bug (this has happened before — `scripts/launch-kiosk.sh`'s `DESKOS_URL` default and the README's one-time auth command both regressed to `:3000` and had to be fixed).
- The app must work identically on macOS (dev) and Raspberry Pi OS (deploy). No platform-specific code in the main codebase — use platform abstraction if needed.
- No build step is needed during development; Vite handles HMR.
- `FRONTEND_DIST` in `packages/backend/src/index.ts` is computed relative to `__dirname` of the *compiled* `dist/index.js` (which lives at `packages/backend/dist/`), not the source file. Reaching the repo-root `dist/frontend` from there requires three `../` segments (dist → backend → packages → repo root), not two — this was off by one and caused every production request to `/` to 404 while `/api/*` worked fine (masking the bug). If this path ever needs to change again, verify by curling `/` after a real `npm run build`, not just `/api/health`.
- Raspberry Pi OS no longer creates a default `pi` user (Bookworm+) — never hardcode `User=pi` or `/home/pi/...` in systemd unit files or scripts. `scripts/deskos-backend.service` / `scripts/deskos-kiosk.service` use `__DESKOS_USER__` / `__DESKOS_REPO_DIR__` / `__DESKOS_HOME__` placeholders, substituted by `scripts/install-services.sh` at install time — install via that script, never `cp` the `.service` files directly.
- Raspberry Pi OS Bookworm/Trixie run Wayland (Chromium via XWayland) rather than classic X11. Don't assume a static `~/.Xauthority` file for manual/SSH-driven Chromium launches — run interactive one-time steps (like epaper sign-in) from a terminal opened directly in the Pi's own graphical session instead of exporting `DISPLAY`/`XAUTHORITY` over SSH.

## Code Style

- TypeScript everywhere. No `any` unless unavoidable with a comment explaining why.
- No credential, token, or secret in any committed file.
- `localStorage` reads must validate shape before use — never blindly cast `JSON.parse` output.
- Express SPA catch-all must stay last in `packages/backend/src/index.ts` and must exclude `/api/*`.
- No comments explaining *what* the code does. Comments only for non-obvious *why*.

## iframe Embedding

External epaper sites are embedded via iframe. If a site sends `X-Frame-Options: SAMEORIGIN`, use `--disable-web-security` on Chromium — not a backend proxy. A backend proxy was evaluated and rejected: the proxy fetch runs on the Pi, not in the authenticated browser, so it can't forward the Google SSO session cookie that lives in the Chromium persistent profile, and it can only cover the initial page load — any in-reader navigation would hit the same block again. `--disable-web-security` is acceptable here because DeskOS is a single-purpose personal appliance, not a shared or general-purpose browser.

## Open Low-Severity Bugs

- **L-2**: Missing `aria-expanded` on expandable SidebarWidget header
- **L-3**: No visible focus ring in sidebar CSS
- **L-4**: Long JSX attribute line on `SidebarWidget.tsx:38`
