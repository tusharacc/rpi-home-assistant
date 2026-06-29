# Add Epaper Subscriptions — Developer Artifact

**Feature:** add-epaper-subscriptions  
**Status:** Complete  
**Created:** 2026-06-29

---

## Implementation Plan

Per architect: no frontend or backend code changes required. All deliverables are infrastructure scripts and documentation.

---

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `scripts/launch-kiosk.sh` | CREATED | Chromium kiosk launch with `--disable-web-security`, persistent `--user-data-dir`, screen saver suppression |
| `scripts/deskos-backend.service` | CREATED | systemd unit for Express backend (starts before kiosk) |
| `scripts/deskos-kiosk.service` | CREATED | systemd unit for Chromium kiosk (waits for backend + graphical target) |
| `README.md` | UPDATED | Added RPi Setup section with one-time epaper auth procedure and `--disable-web-security` rationale |

No changes to `IframeContainer.tsx` or `NewsPlugin.tsx` — both already correct per architect assessment.

---

## Code Summary

**`scripts/launch-kiosk.sh`**
- Disables X screen saver and DPMS before launching Chromium
- Uses `DESKOS_URL` env var (defaults to `http://localhost:3000`) for flexibility
- `--user-data-dir=/home/pi/.deskos-chromium` — persistent directory, survives reboots, preserves Google SSO session
- `--disable-popup-blocking` — required for Google OAuth popup during initial setup login
- `--disable-session-crashed-bubble` + `--noerrdialogs` — suppress dialogs that would block the kiosk on restart

**`scripts/deskos-backend.service`**
- Runs as `pi` user
- `Restart=on-failure` with 5s delay — recovers from crashes without intervention
- Sets `NODE_ENV=production` and `PORT=3001`

**`scripts/deskos-kiosk.service`**
- `After=graphical.target deskos-backend.service` — waits for both X display and backend
- `ExecStartPre=/bin/sleep 3` — gives backend a moment to bind its port before Chromium opens DeskOS
- `DISPLAY=:0` and `XAUTHORITY` set explicitly for headless systemd context

---

## Decisions Made

- `--disable-web-security` chosen over backend proxy: proxy cannot forward Google SSO cookies; kiosk flag is sufficient for a trusted personal appliance
- `ExecStartPre=/bin/sleep 3` chosen over socket activation: simpler, no complex dependency check needed for a personal device
- `DESKOS_URL` as env var in launch script: allows switching to a different port without editing the script
