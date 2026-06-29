# DeskOS — Raspberry Pi Personal Information Appliance

A full-screen, plugin-based dashboard designed to run on a Raspberry Pi connected to a tablet display. Behaves as a dedicated appliance: boots directly into DeskOS, no general desktop access.

## Hardware

| Component | Details |
|-----------|---------|
| Compute | Raspberry Pi |
| Display | Mobile tablet screen (used as external monitor via HDMI/USB-C) |
| Input | Pointing device only (touch or mouse) — **no keyboard attached in normal use** |
| Power | USB-C power bank |

> **Input constraint**: The device has no keyboard in normal operation. All UI interactions must be click/touch only. Text input anywhere in DeskOS is out of scope unless explicitly added via on-screen keyboard plugin.

## Stack

- **Frontend**: React 18, TypeScript, Vite (port 3000 in dev)
- **Backend**: Node.js, Express, tsx (port 3001 in dev)
- **Browser**: Chromium (kiosk mode on RPi)
- **Database**: SQLite (planned, not yet implemented)

## Development

```bash
npm install         # from repo root
npm run dev         # starts both frontend (3000) and backend (3001)
```

Frontend: `http://localhost:3000`  
Backend health: `http://localhost:3001/api/health`

## Deployment

Runs unchanged on Raspberry Pi OS. Chromium launches in kiosk mode pointing to `http://localhost:3000`.

```
systemd → Express backend → Chromium kiosk → DeskOS
```

### RPi Setup (one-time)

```bash
# 1. Clone and build
git clone https://github.com/tusharacc/rpi-home-assistant.git
cd rpi-home-assistant
npm install
npm run build   # builds frontend into packages/backend/dist/frontend

# 2. Make launch script executable
chmod +x scripts/launch-kiosk.sh

# 3. Install systemd services
sudo cp scripts/deskos-backend.service /etc/systemd/system/
sudo cp scripts/deskos-kiosk.service   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable deskos-backend deskos-kiosk
sudo systemctl start deskos-backend

# 4. One-time epaper authentication (keyboard required — only during setup)
#    Run this BEFORE enabling the kiosk service, or temporarily exit kiosk mode.
#    Open Chromium with the same profile the kiosk uses:
CHROMIUM_PROFILE=/home/pi/.deskos-chromium
chromium-browser --user-data-dir="$CHROMIUM_PROFILE" http://localhost:3000
#    In the sidebar: click News → The Hindu → click "Sign in with Google"
#    Authenticate with tusharacc@gmail.com
#    Repeat for News → LiveMint
#    Close Chromium.

# 5. Start the kiosk
sudo systemctl start deskos-kiosk
```

> **Why `--disable-web-security`?**  
> The Hindu and LiveMint epaper sites send `X-Frame-Options: SAMEORIGIN`, which prevents browsers from embedding them in iframes from a different origin (localhost). The kiosk launch script includes `--disable-web-security` to bypass this restriction. This is appropriate for a single-purpose personal appliance running a trusted local app — it is not a shared or general-purpose browser.

> **Session expiry**: Google SSO sessions occasionally expire. If an epaper shows a login page instead of content, reconnect a keyboard and repeat step 4 above.

## Plugin Architecture

Each application is a plugin registered in `packages/frontend/src/plugins/registry.ts`. Plugins declare:
- `id`, `name`, `icon`
- `contentMode`: `'react'` (custom component) or `'iframe'` (external URL)
- Optional `subItems` for expandable sidebar sections

## Current Plugins

| Plugin | Status | Content |
|--------|--------|---------|
| News › The Hindu | Active | ePaper iframe (`epaper.thehindu.com`) |
| News › LiveMint | Active | ePaper iframe (`epaper.livemint.com`) |
| News › Other News | Placeholder | Coming next feature |
| Raspberry Pi Desktop | Placeholder | Coming later |

## UI Theme

Terminal Amber dark theme:
- Background: `#080808`
- Accent: `#D97706`
- Font: monospace throughout
