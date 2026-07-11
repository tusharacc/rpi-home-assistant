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

Runs unchanged on Raspberry Pi OS. In production the Express backend serves the built frontend itself (no separate dev server), on port 3001. Chromium launches in kiosk mode pointing to `http://localhost:3001`.

```
systemd → Express backend → Chromium kiosk → DeskOS
```

### RPi Setup (one-time)

```bash
# 1. Clone and build
git clone https://github.com/tusharacc/rpi-home-assistant.git
cd rpi-home-assistant
npm install
npm run build   # builds backend (tsc) then frontend (vite) into packages/backend/dist/

# 2. Make scripts executable
chmod +x scripts/launch-kiosk.sh scripts/install-services.sh

# 3. Install systemd services
#    (substitutes the current user/home/repo path into the unit files —
#    Raspberry Pi OS no longer defaults to a "pi" user, so these can't be
#    hardcoded)
./scripts/install-services.sh
sudo systemctl start deskos-backend

# 4. One-time epaper authentication (keyboard required — only during setup)
#    Run this BEFORE enabling the kiosk service, or temporarily exit kiosk mode.
#    Open Chromium with the same profile the kiosk uses:
CHROMIUM_PROFILE="$HOME/.deskos-chromium"
CHROMIUM_BIN=$(command -v chromium-browser || command -v chromium)
"$CHROMIUM_BIN" --user-data-dir="$CHROMIUM_PROFILE" http://localhost:3001
#    In the sidebar: click News → The Hindu → click "Sign in with Google"
#    Authenticate with tusharacc@gmail.com
#    Repeat for News → LiveMint
#    Close Chromium.

# 5. Start the kiosk
sudo systemctl start deskos-kiosk
```

> **Do step 4 at the Pi's physical desktop**, using the keyboard/mouse temporarily attached for setup — not over SSH. A terminal opened locally in the graphical session already has the correct display credentials; manually exporting `DISPLAY`/`XAUTHORITY` over SSH is unreliable (Raspberry Pi OS Bookworm/Trixie run Wayland with Chromium under XWayland, which doesn't use a static `~/.Xauthority` file the way classic X11 does) and typically fails with `Authorization required, but no authorization protocol specified`.

> **First Chromium launch may prompt to set a keyring password** (for the OS credential store, e.g. gnome-keyring/libsecret). Any password works — it's separate from your Google account. This is currently a manual, interactive step; see the note below about kiosk reboots.

> **Why `--disable-web-security`?**  
> The Hindu and LiveMint epaper sites may send frame-blocking headers (`X-Frame-Options` / CSP `frame-ancestors`) that prevent embedding them in an iframe from a different origin. A backend-proxy workaround was evaluated and rejected: proxying the shell page server-side can't forward the browser's Google SSO session cookie (the proxy fetch runs on the Pi, not in the authenticated browser), so the embedded reader would always show a logged-out/paywalled view — and only the initial page load could be proxied, so any in-reader navigation would hit the same block again one click deep. The kiosk launch script instead uses `--disable-web-security` to bypass the restriction directly in the browser. This is appropriate for a single-purpose personal appliance running a trusted local app — it is not a shared or general-purpose browser.

> **Session expiry**: Google SSO sessions occasionally expire. If an epaper shows a login page instead of content, reconnect a keyboard and repeat step 4 above.

### Deploying Updates

For pulling later changes onto an already-set-up Pi (not the one-time setup above):

```bash
# From your Mac, if .env or a locally-populated news.db need to travel with this
# update (both are gitignored, so `git pull` alone won't carry them):
scp .env <pi-user>@<pi-host>:<repo-path-on-pi>/.env
scp packages/backend/data/news.db* <pi-user>@<pi-host>:<repo-path-on-pi>/packages/backend/data/   # only if a local db exists

# On the Pi
ssh <pi-user>@<pi-host>
cd <repo-path-on-pi>
git fetch && git checkout main && git pull
npm install          # better-sqlite3 is a native module — must build on-device (ARM), not copied from macOS
npm run build
./scripts/install-services.sh    # idempotent; re-run any time a .service/.sudoers/.desktop file changes
sudo systemctl restart deskos-backend
sudo systemctl restart deskos-kiosk   # picks up frontend changes (e.g. the article reader modal)
```

`install-services.sh` is safe to re-run even when nothing changed — it re-templates and reinstalls
every unit file, both sudoers rules, and the "Return to DeskOS" desktop icon idempotently. Always
re-run it after pulling changes that touch anything under `scripts/*.service`, `scripts/*.sudoers`,
or `scripts/*.desktop`, since those aren't picked up by `npm run build` alone.

If the update includes news-pipeline changes and you want the reading queue populated immediately
rather than waiting up to 3 days for the timer:
```bash
sudo systemctl start deskos-news-pipeline.service
journalctl -u deskos-news-pipeline.service -f
```

### Troubleshooting

- **`localhost:3001` unreachable / kiosk shows "site cannot be reached"**: confirm the backend is actually up (`curl http://localhost:3001/api/health`) and that `scripts/launch-kiosk.sh`'s `DESKOS_URL` points at `3001`, not `3000` (`3000` is the dev-only Vite port — nothing listens there in production).
- **Backend healthy but `/` 404s with a bare `Not Found` page**: the built frontend is missing or the backend can't find it. Confirm `dist/frontend/index.html` exists at the repo root (run `npm run build` from the repo root, not just the backend workspace) and that the file is readable by whichever user the systemd service runs as.
- **`journalctl -u deskos-kiosk` full of D-Bus, GCM/phone-registration, Fontconfig, or VSync errors**: these are normal Chromium internal noise on a minimal kiosk session (no full session bus, no Play Services) — not the cause of a blank/unreachable page. Only investigate further if the kiosk fails to launch a window at all.
- **`chromium-browser: command not found`**: expected on Bookworm/Trixie — the package is just `chromium`. `scripts/launch-kiosk.sh` already detects either name; if running Chromium manually, use `chromium` directly.
- **Systemd services fail to start after cloning fresh**: re-run `./scripts/install-services.sh` — it templates `User=`/paths from the current user and repo location, creates `packages/backend/data/`, and installs the shutdown and kiosk-control sudoers rules. Don't `cp` the `.service` files directly; they contain unresolved `__DESKOS_*__` placeholders.
- **`deskos-kiosk` crash-loops with `XDG_RUNTIME_DIR is invalid or not set` / `failed to connect to display`**: `scripts/apply-orientation.sh` and `scripts/hdmi-power.sh` use `wlr-randr`, a native Wayland client — unlike Chromium (which reaches the display fine via XWayland using `DISPLAY`/`XAUTHORITY`), it needs `XDG_RUNTIME_DIR`/`WAYLAND_DISPLAY`, which systemd services don't inherit from any graphical login session. Both scripts now derive these themselves; if you still see this error, confirm a `wayland-*` socket actually exists under `/run/user/<uid>` at boot (it depends on your Pi's auto-login mechanism creating a real login session).
- **Orientation button returns `500` on the Pi**: confirm which Wayland compositor is running (`echo $XDG_CURRENT_DESKTOP`) — `apply-orientation.sh`/`hdmi-power.sh` assume `wlr-randr` (labwc); if you're on `wayfire` the command syntax may need adjusting. (Standby is currently disabled in the UI — see "Display, Power & Settings" — so it can no longer trigger this.)
- **"Return to DeskOS" desktop icon doesn't appear, or "Exit to Desktop" returns `500`**: re-run `./scripts/install-services.sh` — it installs both the `deskos-kiosk-control` sudoers rule and the desktop icon, and is safe to re-run on an existing install.

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
| News › Other News | Active | News Intelligence reading queue (Balanced/Engineering/AI Focus modes, Queue/Radar tabs), articles open in an in-app reader instead of a new window |
| Settings | Active | System uptime, display orientation, Shut Down, Exit to Desktop (Standby Now temporarily disabled — see below) |
| Investments | Placeholder | Coming later |
| Home Automation | Placeholder | Coming later |
| Raspberry Pi Desktop | Placeholder | Coming later |

## Display, Power & Settings

- **Orientation**: Portrait/Landscape buttons in Settings rotate the whole kiosk output (not just
  a CSS reflow) via the Wayland compositor, and persist across reboot in
  `packages/backend/data/settings.json`.
- **Standby (currently disabled)**: both the 10-minute idle auto-trigger and the manual "Standby
  Now" button are disabled in the frontend (`STANDBY_ENABLED = false` in
  `packages/frontend/src/lib/idle-monitor.ts`). Root cause: `scripts/hdmi-power.sh` turns the
  display off via `wlr-randr --output X --off`, which fully removes the output from the Wayland
  compositor's layout rather than doing a DPMS-style blank. Once the sole output is disabled, the
  compositor has nothing to hit-test the pointer against, so it stops delivering
  `pointermove`/`pointerdown`/`touchstart` events entirely — the exact events the wake logic
  depends on — leaving the display stuck off with no way to wake it (no keyboard to fall back to).
  This locked the physical device twice before being found. Re-enable only after `hdmi-power.sh`
  is switched to a true DPMS blank (e.g. `wlopm`/`wlr-output-power-management-v1`, if the
  compositor supports it) that keeps the output in the layout and input flowing.
- **Exit to Desktop**: the "Exit to Desktop" button stops `deskos-kiosk.service` (a clean
  `systemctl stop`, so `Restart=on-failure` does not relaunch it), revealing the underlying RPi
  desktop for maintenance — no SSH needed. To come back, double-click the "Return to DeskOS" icon
  on the RPi desktop (installed by `install-services.sh` to `~/Desktop/`), which starts the kiosk
  service back up. Both directions run via a passwordless `sudo` rule scoped to exactly
  `systemctl stop/start deskos-kiosk.service` (`scripts/deskos-kiosk-control.sudoers`).
- **Shutdown**: the "Shut Down" button shows "Safe to switch off power." and runs a real shutdown,
  via a passwordless `sudo` rule scoped to exactly that one command (installed by
  `install-services.sh`, never a broad sudo grant).
- **Lightweight Mode**: an optional, one-time setup script (`scripts/lightweight-mode.sh`) that
  disables Bluetooth and a few unnecessary default desktop services, leaving Wi-Fi untouched. Not
  run automatically — run it manually once if you want it:
  ```bash
  ./scripts/lightweight-mode.sh
  ```

## UI Theme

Terminal Amber dark theme:
- Background: `#080808`
- Accent: `#D97706`
- Font: monospace throughout
