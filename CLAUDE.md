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

- Dev: `npm run dev` from repo root → frontend on 3000, backend on 3001.
- The app must work identically on macOS (dev) and Raspberry Pi OS (deploy). No platform-specific code in the main codebase — use platform abstraction if needed.
- No build step is needed during development; Vite handles HMR.

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
