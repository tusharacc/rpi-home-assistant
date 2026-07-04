# Architect Design: additional-features

**Status**: Ready for Developer
**Based on**: `artifacts/additional-features.po.md`

## System Design

Five additions layered onto the existing architecture, none of which change the core
Express-serves-built-React-SPA model:

```
Chromium kiosk (Wayland/XWayland)
        │
        ▼
React SPA (packages/frontend)
  ├─ Settings plugin (new)         ── GET/PUT /api/settings, POST /api/system/shutdown
  ├─ Investments plugin (new, placeholder — react-only, no backend)
  ├─ Home Automation plugin (new, placeholder — react-only, no backend)
  └─ IdleMonitor (new, app-level, not a plugin)
        │  detects idle → POST /api/standby/enter
        │  detects activity → POST /api/standby/exit
        ▼
Express backend (packages/backend)
  ├─ /api/settings          (GET/PUT)  → reads/writes packages/backend/data/settings.json
  ├─ /api/settings/rotate   (POST)     → shells out to output-transform command, updates settings.json
  ├─ /api/standby/enter     (POST)     → shells out to blank HDMI, pauses refresh flag
  ├─ /api/standby/exit      (POST)     → shells out to un-blank HDMI
  └─ /api/system/shutdown   (POST)     → shells out to scoped shutdown command
        │
        ▼
scripts/apply-orientation.sh   (new, run at boot by deskos-backend.service ExecStartPre,
                                 and by the /api/settings/rotate route)
scripts/lightweight-mode.sh    (new, run once by install-services.sh, not at every boot)
```

Two systemd services already exist (`deskos-backend`, `deskos-kiosk`); no new service is needed —
standby/shutdown/rotation are all just backend routes that shell out, invoked by the frontend.

## Components

### Frontend

- **`packages/frontend/src/plugins/settings/SettingsPlugin.tsx`** (new)
  - `contentMode: 'react'`, sidebar entry "Settings" (gear icon from `lucide-react`).
  - On mount: `GET /api/settings` → renders current orientation, system info (uptime), and:
    - "Portrait" / "Landscape" buttons → `POST /api/settings/rotate { orientation }`
    - "Standby Now" button → `POST /api/standby/enter`
    - "Shut Down" button → confirm-free, single tap (no on-screen keyboard means no typed
      confirmation) → `POST /api/system/shutdown`, then render the full-screen
      "Safe to switch off power." message client-side immediately (don't wait for the backend
      response — the Pi will lose power shortly after `shutdown` runs).
  - No new shared UI kit; reuses the existing inline-style pattern seen in `RpiDesktopPlugin.tsx`
    for the placeholder-style panels (system info block).

- **`packages/frontend/src/plugins/investments/InvestmentsPlugin.tsx`** (new, placeholder)
  **`packages/frontend/src/plugins/home-automation/HomeAutomationPlugin.tsx`** (new, placeholder)
  - Both follow the exact `RpiDesktopPlugin.tsx` pattern verbatim: `contentMode: 'react'`,
    `render()` returns the same centered "coming soon"-style placeholder panel, no `subItems`,
    no backend calls, `activate`/`deactivate`/`refresh` all no-ops.

- **`packages/frontend/src/App.tsx`**
  - Add three `pluginRegistry.register(...)` calls (settings, investments, home-automation)
    alongside the existing two, and mount the new app-level `IdleMonitor` component (see below)
    once at the top of the tree — it renders nothing, just listens for input.

- **`packages/frontend/src/lib/idle-monitor.ts` + a small `IdleMonitor` component** (new)
  - Listens for `pointerdown`/`pointermove`/`touchstart` on `window` (never `keydown` — per the
    PO's input-model decision), debounced, resets a 10-minute timer (hardcoded constant, not
    configurable per PO).
  - On timeout: `POST /api/standby/enter`, sets a local `isStandby` flag.
  - On first activity while `isStandby` is true: `POST /api/standby/exit`, clears the flag.
  - Also exposes the manual trigger used by the Settings "Standby Now" button (shared function,
    not a duplicate timer).
  - This lives outside the plugin system (it's cross-cutting, not a sidebar entry), imported once
    in `App.tsx`.

### Backend

- **`packages/backend/src/routes/settings.ts`** (new)
  - `GET /api/settings` → reads `packages/backend/data/settings.json`, returns
    `{ orientation: 'portrait' | 'landscape' }` (defaults to `landscape` if the file is missing —
    covers the PO's "very first boot" edge case without erroring).
  - `PUT /api/settings` → generic partial update, validates shape before writing (per `CLAUDE.md`'s
    "validate shape before use" rule, applied here to the request body as well as any future
    `localStorage`-style read).
  - `POST /api/settings/rotate` → body `{ orientation }`, validates it's exactly `'portrait'` or
    `'landscape'`, calls `scripts/apply-orientation.sh <orientation>` via `child_process.execFile`
    (not `exec` — avoids shell interpolation entirely since the value is already validated against
    a fixed enum, but `execFile` is the safer default regardless), then persists the new value to
    `settings.json` only after the script exits `0`.

- **`packages/backend/src/routes/standby.ts`** (new)
  - `POST /api/standby/enter` → `execFile('scripts/hdmi-power.sh', ['off'])`, sets an in-memory
    `isStandby` flag (no need to persist this across a backend restart — PO's edge case says a
    backend restart during standby should not force a wake, so the safest behavior is: on backend
    restart, don't assume standby state either way, just leave the display as the OS currently has
    it — the flag is advisory, not authoritative over hardware state).
  - `POST /api/standby/exit` → `execFile('scripts/hdmi-power.sh', ['on'])`, clears the flag.
  - The "pause refresh jobs" requirement from the PO has no concrete implementation target today —
    there is no existing polling/refresh job in the codebase (epaper content is a static iframe,
    not polled). This route only toggles HDMI power; documented as an Open Question below.

- **`packages/backend/src/routes/system.ts`** (new)
  - `POST /api/system/shutdown` → first calls the same "standby exit"/HDMI-on logic in-process
    (covers the PO's "shutdown while in standby must wake the display first" edge case), waits
    briefly, then `execFile('sudo', ['/sbin/shutdown', 'now'])` (or the Pi's actual path — verify
    via `which shutdown` on real hardware, per the project's established pattern of confirming
    paths on the real device rather than assuming).

- **`packages/backend/src/index.ts`**
  - Register the three new route modules above `express.static(FRONTEND_DIST)` (all `/api/*`,
    consistent with the existing rule that the SPA catch-all stays last).
  - No change to `FRONTEND_DIST` or the catch-all regex.

- **`packages/backend/data/settings.json`** (new, gitignored — runtime state, not source)
  - `{ "orientation": "landscape" }` — single source of truth for persisted orientation.
  - Add `packages/backend/data/` to `.gitignore` except for a checked-in
    `packages/backend/data/.gitkeep` (or the directory is created by `install-services.sh` at
    install time) so a fresh clone doesn't 404/`ENOENT` on first `GET /api/settings`.

### Scripts (new)

- **`scripts/apply-orientation.sh`**
  - Args: `portrait` or `landscape`. Runs the Wayland output-transform command (`wlr-randr` for
    `labwc`, or the `wayfire`-specific equivalent — **Open Question**, needs confirming which
    compositor the deployed Pi actually runs, per PO's dependency note) against the connected
    output.
  - Also invoked once, early, from `deskos-kiosk.service`'s `ExecStartPre` (reading the persisted
    value from `settings.json` itself, or via a tiny `ExecStartPre` line that calls
    `curl -s localhost:3001/api/settings` then pipes into this script) so orientation is correct
    before Chromium paints — avoiding the "flash of wrong orientation" the PO calls out. Simplest
    implementation: the script itself reads `packages/backend/data/settings.json` directly (no
    HTTP round-trip needed since it runs on the same machine with filesystem access), so it works
    even before the backend has finished starting.

- **`scripts/hdmi-power.sh`**
  - Args: `on` or `off`. Wraps whatever the Wayland-equivalent of `xset dpms force off` is
    (`wlr-randr --output <name> --off` / `--on`, tentative — same Open Question as above about
    compositor).

- **`scripts/lightweight-mode.sh`**
  - Run once, manually, from `install-services.sh` (or as a documented separate one-time step —
    Developer's call which, but not a boot-time or runtime hook either way): `rfkill block
    bluetooth`, disable a short, explicit list of known default Raspberry Pi OS desktop
    services/apps, leaves Wi-Fi (`rfkill` wlan) untouched. No systemd unit runs this repeatedly —
    it's a config-once script, matching the PO's explicit "not a runtime toggle" decision.

- **`scripts/install-services.sh`** (existing, extended)
  - Add a step that creates `packages/backend/data/` if missing (idempotent `mkdir -p`), and
    documents `lightweight-mode.sh` as an optional manual step in the README rather than always
    running it automatically (so a dev/test Pi isn't silently stripped of Bluetooth without the
    installer choosing to).

- **`scripts/deskos-kiosk.service`** (existing, extended)
  - Add `ExecStartPre=.../scripts/apply-orientation.sh` (reading from the persisted file) before
    the existing `launch-kiosk.sh` line, so the display is correctly rotated the moment Chromium
    opens.

## Data Models

```ts
// packages/backend/src/settings-store.ts
interface DeskOSSettings {
  orientation: 'portrait' | 'landscape'
}
```

Single flat JSON file, single field for now — deliberately not over-built for the "Brightness
(future)/Theme (future)" fields the PO explicitly deferred; add fields to this interface when
those features are actually built, not now.

## API Contracts

| Method | Path                    | Body                                   | Response                              |
|--------|-------------------------|-----------------------------------------|----------------------------------------|
| GET    | `/api/settings`         | —                                        | `{ orientation: 'portrait'\|'landscape' }` |
| PUT    | `/api/settings`         | `Partial<DeskOSSettings>`               | updated `DeskOSSettings`               |
| POST   | `/api/settings/rotate`  | `{ orientation: 'portrait'\|'landscape' }` | `{ orientation }` or `400` on invalid value, `500` on script failure |
| POST   | `/api/standby/enter`    | —                                        | `{ status: 'standby' }`                |
| POST   | `/api/standby/exit`     | —                                        | `{ status: 'active' }`                 |
| POST   | `/api/system/shutdown`  | —                                        | `202 { status: 'shutting-down' }` (fire-and-forget — response may never be seen by the frontend if power drops fast) |

All five are `/api/*`, registered above the SPA catch-all — no change needed to the existing
`/^(?!\/api).*$/` regex.

## Tech Decisions

- **`execFile`, never `exec`**, for every shell-out (`apply-orientation.sh`, `hdmi-power.sh`,
  `shutdown`) — avoids shell-metacharacter injection risk entirely, even though inputs are
  validated against small enums; defense in depth costs nothing here.
- **Shutdown privilege**: a `sudoers.d` drop-in scoping passwordless `sudo` to the single exact
  command `/sbin/shutdown -h now` (or whatever `which shutdown` resolves to on the real Pi) for
  the DeskOS service user only — installed by `install-services.sh`, not documented as a manual
  step, so it isn't skipped/forgotten and isn't a broad passwordless-sudo grant either.
- **Standby is advisory state in the backend, not authoritative** — the actual HDMI on/off state
  lives in the OS/compositor; the backend's `isStandby` boolean is only used to avoid redundant
  `hdmi-power.sh` calls and to answer the frontend's "am I in standby" query, per the PO's
  backend-restart edge case.
- **No new frontend state library** — `IdleMonitor` uses plain browser APIs and a local
  `useState`/module-level variable, consistent with the codebase's current lack of any global
  state manager.
- **Placeholders (Investments, Home Automation) are pure copy-paste of `RpiDesktopPlugin.tsx`'s
  shape** — deliberately not abstracted into a shared `PlaceholderPlugin(name)` helper in this
  workspace; the PO/CLAUDE.md project style favors avoiding premature abstraction, and there are
  only 3 instances of this shape total (rpi-desktop existing + 2 new) — Developer may introduce
  a shared helper only if it turns out to reduce real duplication cleanly, not required.
- **`packages/backend/data/` is gitignored** — this is the first instance of the backend
  persisting runtime state to disk; treat it the same as build output, not source.

## Open Questions

1. **Which Wayland compositor is actually running on the deployed Pi — `labwc` or `wayfire`?**
   This determines the exact `apply-orientation.sh`/`hdmi-power.sh` command syntax (`wlr-randr`
   flags differ slightly). Needs confirming via `echo $XDG_CURRENT_DESKTOP` or `ps aux | grep
   -E 'labwc|wayfire'` on the real hardware before Developer finalizes those two scripts — same
   category of "verify on real device" lesson as the `FRONTEND_DIST` and Chromium-binary-naming
   bugs from the last deployment.
2. **"Pause refresh jobs" during standby** (PO functional requirement under Standby) has no
   concrete target in the current codebase — there is no polling/auto-refresh mechanism for the
   epaper iframes today. Recommend Developer treat this as a no-op for this workspace (nothing to
   pause) and note it explicitly in the developer artifact, rather than inventing a refresh
   mechanism that doesn't otherwise exist yet.
3. **Exact shutdown binary path** (`/sbin/shutdown` vs `/usr/sbin/shutdown` vs a plain `shutdown`
   already on `PATH`) — confirm via `which shutdown` on the real Pi before writing the sudoers
   drop-in, since sudoers rules matching by absolute path won't match if the path guess is wrong.
4. **iframe survival across an HDMI blank/unblank cycle** (PO edge case: standby mid-epaper-load)
   — untested assumption is that blanking HDMI output doesn't reload the Chromium page (unlike a
   full Chromium restart), so the iframe should survive untouched; Tester should explicitly verify
   this on real hardware rather than assume it.
