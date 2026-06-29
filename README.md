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

Runs unchanged on Raspberry Pi OS. Chromium launches in kiosk mode pointing to `http://localhost:<port>`.

```
systemd → Express backend → Chromium kiosk → DeskOS
```

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

## Authentication Note

Epaper sources require subscriber login. Since the RPi has no keyboard in normal use, authentication is handled via **Chromium persistent profile**: log in once during initial setup (with keyboard attached), and the session cookie is preserved across reboots. DeskOS itself stores no credentials.

## UI Theme

Terminal Amber dark theme:
- Background: `#080808`
- Accent: `#D97706`
- Font: monospace throughout
