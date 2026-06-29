# Add Epaper Subscriptions — Architect Artifact

**Feature:** add-epaper-subscriptions  
**Status:** Complete  
**Created:** 2026-06-29

---

## System Design

The epaper URLs are already wired correctly in `NewsPlugin.tsx` and `IframeContainer.tsx` already renders them. The only two problems to solve are:

1. **Browser-enforced iframe blocking** — `X-Frame-Options: SAMEORIGIN` from epaper sites causes Chromium to refuse rendering them. Fix: launch Chromium with `--disable-web-security` on the RPi.
2. **Missing deployment scripts** — No kiosk launch script or systemd service files exist in the repo.

No backend proxy is needed. No URL changes are needed. No plugin code changes are needed. The feature is entirely infrastructure + documentation.

---

## Components

### 1. `scripts/launch-kiosk.sh` (NEW)

Shell script to launch Chromium in kiosk mode on RPi with the correct flags:

```
chromium-browser \
  --kiosk \
  --disable-web-security \
  --user-data-dir=/home/pi/.deskos-chromium \
  --no-first-run \
  --disable-default-apps \
  --disable-popup-blocking \
  --disable-translate \
  --noerrdialogs \
  http://localhost:3000
```

Key flags:
- `--kiosk` — full-screen, no browser chrome
- `--disable-web-security` — bypasses X-Frame-Options and frame-ancestors CSP so iframes load
- `--user-data-dir=/home/pi/.deskos-chromium` — persistent profile (required with `--disable-web-security`; survives reboots so Google SSO session cookie is preserved)
- `--disable-popup-blocking` — required for Google OAuth popup during initial setup login
- `--noerrdialogs` — suppresses crash recovery dialogs that would block the kiosk

### 2. `scripts/deskos-backend.service` (NEW)

systemd unit that starts the Express backend on boot before Chromium.

### 3. `scripts/deskos-kiosk.service` (NEW)

systemd unit that starts `launch-kiosk.sh` after the backend is up and X display is available.

### 4. `packages/frontend/src/shell/ContentArea/IframeContainer.tsx` (REVIEW — likely no change)

Current sandbox: `"allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"`

Assessment:
- `allow-scripts` — required for epaper JS
- `allow-same-origin` — required for session cookies (Google SSO)
- `allow-forms` — required for any form submission in the epaper
- `allow-popups` — required for Google OAuth popup (setup only)
- `allow-popups-to-escape-sandbox` — required for OAuth popup to have full permissions

This sandbox is **sufficient**. No change needed unless testing reveals the epaper attempts top-frame navigation (in which case add `allow-top-navigation-by-user-activation`).

Note: `--disable-web-security` does NOT disable the HTML `sandbox` attribute — those are enforced by different mechanisms. The sandbox must remain correct independently.

### 5. `README.md` (UPDATE)

Add "RPi Setup" section with:
- Install steps (clone, npm install, build)
- systemd service installation commands
- **One-time epaper auth procedure**: connect keyboard → navigate to each epaper URL → click "Sign in with Google" → authenticate with tusharacc@gmail.com → disconnect keyboard

---

## Data Models

No new data models. The Chromium profile (at `/home/pi/.deskos-chromium`) stores all session state — this is outside the application codebase.

---

## API Contracts

No new API endpoints. Backend is unchanged.

---

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| iframe blocking fix | `--disable-web-security` on Chromium | Simpler than backend proxy; preserves Google SSO cookie flow; appropriate for a single-purpose personal appliance |
| Session storage | Chromium `--user-data-dir` | Survives reboots; no credentials in code |
| Backend proxy | Rejected | Cannot forward Google SSO cookies; would require full site proxying (images, JS, fonts) |
| Sandbox attribute | Keep as-is | Current sandbox supports all required epaper behaviours |
| systemd | Two units (backend + kiosk) | Backend must be up before Chromium opens DeskOS |

---

## Files to Create/Modify

| File | Action | Notes |
|------|--------|-------|
| `scripts/launch-kiosk.sh` | CREATE | Chromium kiosk launch with flags |
| `scripts/deskos-backend.service` | CREATE | systemd for Express backend |
| `scripts/deskos-kiosk.service` | CREATE | systemd for Chromium kiosk |
| `README.md` | UPDATE | Add RPi setup section with epaper auth steps |
| `IframeContainer.tsx` | NO CHANGE | Sandbox already correct |
| `NewsPlugin.tsx` | NO CHANGE | URLs already correct |

---

## Open Questions

None — all decisions resolved.
