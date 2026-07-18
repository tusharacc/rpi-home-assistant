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
- **Shell**: Electron (`packages/electron`) — kiosk `BrowserWindow` hosting the frontend, plus per-site
  `BrowserView` instances for embedded third-party content (epaper today; home automation dashboards
  planned). Requires Node ≥22.12 per Electron's own `engines` field — confirm this on whatever machine
  runs it.
- **Database**: SQLite (`better-sqlite3`, used by the news-intelligence pipeline)

## Development

```bash
npm install         # from repo root
npm run dev         # starts both frontend (3000) and backend (3001)
```

Frontend: `http://localhost:3000`  
Backend health: `http://localhost:3001/api/health`

For testing the Electron shell and embedded-webview mechanism specifically (not needed for everyday UI
work — `npm run dev` above is the fast plain-browser loop):

```bash
npm run electron:dev   # builds packages/electron, launches Electron against the :3000 dev server
```

This works on macOS too, but signs into a local `~/.deskos-electron` on whatever machine runs it — it
does not carry over to the Pi's own session (see "Epaper Access").

## Deployment

Runs unchanged on Raspberry Pi OS. In production the Express backend serves the built frontend itself (no separate dev server), on port 3001. Electron launches in kiosk mode, its `BrowserWindow` pointing to `http://localhost:3001`.

```
systemd → Express backend → Electron kiosk (BrowserWindow + BrowserViews) → DeskOS
```

### RPi Setup (one-time)

```bash
# 1. Clone and build
git clone https://github.com/tusharacc/rpi-home-assistant.git
cd rpi-home-assistant
npm install     # includes Electron -- confirms the ARM prebuilt installs on this device
npm run build   # builds backend (tsc), frontend (vite), and the Electron shell (tsc)

# 2. Make scripts executable
chmod +x scripts/launch-kiosk.sh scripts/install-services.sh

# 3. Install systemd services
#    (substitutes the current user/home/repo path into the unit files —
#    Raspberry Pi OS no longer defaults to a "pi" user, so these can't be
#    hardcoded)
./scripts/install-services.sh
sudo systemctl start deskos-backend

# 4. Start the kiosk
sudo systemctl start deskos-kiosk

# 5. One-time epaper authentication (keyboard required — only during setup)
#    Epaper is embedded directly in DeskOS (see "Epaper Access" below), so
#    sign in right on the kiosk itself: tap News → The Hindu in the sidebar
#    (sidebar stays visible), sign in with tusharacc@gmail.com using the
#    temporarily-attached keyboard, confirm it shows as subscribed.
#    Repeat for News → LiveMint.
```

> **Do step 5 at the Pi's physical desktop**, using the keyboard/mouse temporarily attached for setup — not over SSH. A terminal or session opened locally in the graphical session already has the correct display credentials; manually exporting `DISPLAY`/`XAUTHORITY` over SSH is unreliable (Raspberry Pi OS Bookworm/Trixie run Wayland with Electron under XWayland, which doesn't use a static `~/.Xauthority` file the way classic X11 does) and typically fails with `Authorization required, but no authorization protocol specified`.

> **Session expiry**: if an epaper stops showing as subscribed, tap News → The Hindu/LiveMint again and sign in directly in the embedded view with a temporarily-attached keyboard — no need to exit the kiosk or open anything separately.

### Deploying Updates

For pulling later changes onto an already-set-up Pi (not the one-time setup above), run
`scripts/deploy-to-pi.sh` **from your Mac** (not on the Pi) — it automates the whole sequence: copying
gitignored local state (`.env`, a locally-populated `news.db`) the Pi needs, then SSHing in to pull,
build, reinstall services, and restart.

```bash
export DESKOS_PI_USER=<pi-user>
export DESKOS_PI_HOST=<pi-host>
export DESKOS_PI_DIR=<repo-path-on-pi>
./scripts/deploy-to-pi.sh
```

(Or pass `--user`/`--host`/`--dir` instead of exporting env vars.) By default it deploys whatever
branch is currently checked out locally — refuses to run if that branch has unpushed commits or
uncommitted changes, since the Pi does its own `git pull` and would otherwise silently deploy nothing
new. Pass `--branch <name>` to deploy a specific branch regardless of what's checked out locally,
`--skip-transfer` to skip the `.env`/`news.db` copy (e.g. they already match on the Pi), or
`--trigger-pipeline` to also manually start the news pipeline once instead of waiting up to 3 days for
the timer.

Equivalent manual steps, if you'd rather run them by hand or the script doesn't fit your setup:

```bash
# From your Mac
scp .env <pi-user>@<pi-host>:<repo-path-on-pi>/.env
scp packages/backend/data/news.db* <pi-user>@<pi-host>:<repo-path-on-pi>/packages/backend/data/   # only if a local db exists

# On the Pi
ssh <pi-user>@<pi-host>
cd <repo-path-on-pi>
git fetch && git checkout main && git pull
npm install          # better-sqlite3/electron are native/prebuilt-binary modules — must install on-device (ARM)
npm run build        # backend + frontend + packages/electron
./scripts/install-services.sh    # idempotent; re-run any time a .service/.sudoers/.desktop file changes
sudo systemctl restart deskos-backend
sudo systemctl restart deskos-kiosk
sudo systemctl start deskos-news-pipeline.service   # optional, only if you want the queue populated now
```

`install-services.sh` is safe to re-run even when nothing changed — it re-templates and reinstalls
every unit file, both sudoers rules, and the "Return to DeskOS" desktop icon idempotently. Always
re-run it after pulling changes that touch anything under `scripts/*.service`, `scripts/*.sudoers`,
or `scripts/*.desktop`, since those aren't picked up by `npm run build` alone (`deploy-to-pi.sh`
already re-runs it every time, unconditionally).

### Troubleshooting

- **`localhost:3001` unreachable / kiosk shows "site cannot be reached"**: confirm the backend is actually up (`curl http://localhost:3001/api/health`) and that `scripts/launch-kiosk.sh`'s `DESKOS_URL` points at `3001`, not `3000` (`3000` is the dev-only Vite port — nothing listens there in production).
- **Backend healthy but `/` 404s with a bare `Not Found` page**: the built frontend is missing or the backend can't find it. Confirm `dist/frontend/index.html` exists at the repo root (run `npm run build` from the repo root, not just the backend workspace) and that the file is readable by whichever user the systemd service runs as.
- **`journalctl -u deskos-kiosk` full of D-Bus, GCM/phone-registration, Fontconfig, or VSync errors**: these are normal Chromium-engine internal noise (Electron is Chromium-based) on a minimal kiosk session (no full session bus, no Play Services) — not the cause of a blank/unreachable page. Only investigate further if the kiosk fails to launch a window at all.
- **`Electron not found` / `ERROR: ... node_modules/.bin/electron`**: run `npm install` at the repo root — Electron ships as a normal npm dependency of `packages/electron`, installed the same way as everything else, no separate download step.
- **`npm install` warns `EBADENGINE ... electron@... required: node >= 22.12.0`**: Electron's own `engines` field wants a newer Node than may be installed. This warning alone did not block `npm install` or running `electron --version` in testing (Node 20.x), but hasn't been confirmed clean on real Pi hardware yet — run `node --version` on the Pi and treat a Node upgrade as the fix if the kiosk fails to start with an engine-related error.
- **Systemd services fail to start after cloning fresh**: re-run `./scripts/install-services.sh` — it templates `User=`/paths from the current user and repo location, creates `packages/backend/data/`, and installs the shutdown and kiosk-control sudoers rules. Don't `cp` the `.service` files directly; they contain unresolved `__DESKOS_*__` placeholders.
- **`deskos-kiosk` crash-loops with `XDG_RUNTIME_DIR is invalid or not set` / `failed to connect to display`**: `scripts/apply-orientation.sh` and `scripts/hdmi-power.sh` use `wlr-randr`, a native Wayland client — unlike Electron (which reaches the display fine via XWayland using `DISPLAY`/`XAUTHORITY`, same as Chromium did before it), it needs `XDG_RUNTIME_DIR`/`WAYLAND_DISPLAY`, which systemd services don't inherit from any graphical login session. Both scripts now derive these themselves; if you still see this error, confirm a `wayland-*` socket actually exists under `/run/user/<uid>` at boot (it depends on your Pi's auto-login mechanism creating a real login session).
- **Orientation button returns `500` on the Pi**: confirm which Wayland compositor is running (`echo $XDG_CURRENT_DESKTOP`) — `apply-orientation.sh`/`hdmi-power.sh` assume `wlr-randr` (labwc); if you're on `wayfire` the command syntax may need adjusting. (Standby is currently disabled in the UI — see "Display, Power & Settings" — so it can no longer trigger this.)
- **"Return to DeskOS" desktop icon doesn't appear, or "Exit to Desktop" returns `500`**: re-run `./scripts/install-services.sh` — it installs both the `deskos-kiosk-control` sudoers rule and the desktop icon, and is safe to re-run on an existing install.
- **Tapping News → The Hindu/LiveMint shows a blank content area**: confirm `packages/electron/dist/main.js` exists (`npm run build` includes the Electron shell now) and that the kiosk is actually running the Electron binary, not a stale Chromium-only build — check `ps aux | grep electron` on the Pi. If the embedded view loads but shows a sign-in page, that's expected on a fresh `~/.deskos-electron` session — do the one-time sign-in for that site directly in the embedded view.

## Plugin Architecture

Each application is a plugin registered in `packages/frontend/src/plugins/registry.ts`. Plugins declare:
- `id`, `name`, `icon`
- `contentMode`: `'react'` (custom component, rendered in DeskOS), `'external'` (fires `onActivate`
  instead of becoming the active item — for things that open outside DeskOS entirely), or
  `'embedded-webview'` (renders via an Electron `BrowserView` layered on top of the content area,
  `embeddedUrl` set to the target site — see "Epaper Access" below)
- Optional `subItems` for expandable sidebar sections

## Current Plugins

| Plugin | Status | Content |
|--------|--------|---------|
| News › The Hindu | Active | `epaper.thehindu.com` embedded via Electron `BrowserView` (sidebar stays visible — see "Epaper Access") |
| News › LiveMint | Active | `epaper.livemint.com` embedded via Electron `BrowserView` (sidebar stays visible — see "Epaper Access") |
| News › Other News | Active | News Intelligence reading queue (Balanced/Engineering/AI Focus modes, Queue/Radar tabs), articles open in an in-app reader instead of a new window |
| Settings | Active | System uptime, display orientation, Shut Down, Exit to Desktop (Standby Now temporarily disabled — see below) |
| Investments | Placeholder | Coming later |
| Home Automation | Placeholder | Coming later |

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
- **Epaper Access**: News → The Hindu/LiveMint are genuinely embedded — the DeskOS sidebar stays
  visible and usable at the same time as the epaper, via an Electron `BrowserView` positioned over
  the content area (`packages/electron/src/main.ts`), one persistent session partition per site
  (`~/.deskos-electron`, separate from the pre-Electron `~/.deskos-chromium` profile). This replaced
  two earlier approaches, both rejected for concrete reasons: iframe embedding (Chromium's storage
  partitioning gives a third-party iframe a permanently-empty `localStorage`, so a session set by
  signing in anywhere else could never appear inside it — The Hindu's epaper session lives in
  `localStorage`, not a cookie) and, briefly, opening the epaper as a separate top-level Chromium
  window (worked, but broke the "DeskOS always visible" model and didn't scale to future embedded
  integrations like home automation). See CLAUDE.md's "Epaper Access" section for the full story.
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
