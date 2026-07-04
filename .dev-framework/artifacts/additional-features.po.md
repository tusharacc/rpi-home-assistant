# PO Requirements: additional-features

**Status**: Ready for Architect
**Source input**: `DeskOS_Requirements_v0.2.md`

## Problem Statement

DeskOS currently ships only the News/epaper plugins plus kiosk boot. `DeskOS_Requirements_v0.2.md`
describes a broader v0.2 vision (Investments, Home Automation, power states, display rotation,
Settings). This workspace scopes the next slice of that vision to what's deliverable now without
new hardware dependencies or architecture changes: a **Settings screen**, **display rotation**, and
**power states** (Standby / Shutdown / Lightweight Mode). Investments and Home Automation are
explicitly deferred to placeholder sidebar entries, matching the existing "Raspberry Pi Desktop"
placeholder pattern — no real functionality for those two in this workspace.

## Scope Decisions (from discovery)

- **In scope**: Settings screen, Display rotation, Standby, Shutdown, Lightweight Mode (as a
  one-time setup config, not a runtime toggle).
- **Out of scope**: Investments and Home Automation get placeholder sidebar entries only (label +
  "Coming later", no content). No Wi-Fi status, network info, or Wi-Fi configuration anywhere in
  this feature — Wi-Fi is entirely excluded per explicit user instruction, not just read-only.
- **Architecture**: stays on the current stack — React 18 + Vite frontend, Express + tsx backend,
  Chromium kiosk. The "Electron" mention in the source doc is treated as stale/aspirational, not a
  directive to migrate.
- **Input model**: no change to the existing "no keyboard in normal operation, touch/mouse only"
  constraint in `CLAUDE.md`. Standby wakes on touch/mouse activity only, never keyboard.

## User Stories

1. As the device user, I can open a Settings screen from the sidebar to see system info and
   orientation controls, without needing a keyboard.
2. As the device user, I can rotate the whole kiosk display between portrait and landscape from a
   button in Settings, and it stays that way after a reboot.
3. As the device user, I can trigger Standby manually, or have it happen automatically after 10
   minutes of no touch/mouse input, and the display and epaper refresh jobs pause while Wi-Fi and
   the backend stay alive.
4. As the device user, I can tap and/or touch/click anywhere to instantly wake the device from
   Standby.
5. As the device user, I can trigger a safe Shutdown from Settings and see a clear
   "Safe to switch off power" message before cutting power.
6. As the installer/maintainer, Lightweight Mode (disabled Bluetooth, disabled unused
   services/desktop apps, Wi-Fi kept on) is configured once during RPi setup — not something the
   end user toggles at runtime.

## Functional Requirements

### Settings screen
- New sidebar entry "Settings", registered in `packages/frontend/src/plugins/registry.ts` per the
  existing plugin pattern.
- Displays: current orientation (portrait/landscape), basic system info (uptime, at minimum —
  further fields like storage/CPU temp are a nice-to-have, not required).
- Displays orientation toggle (Portrait / Landscape buttons).
- Displays a "Shut Down" button.
- No text input fields anywhere on this screen (consistent with no-keyboard/no-on-screen-keyboard
  constraint).
- Brightness and Theme controls are explicitly future (per source doc) — not built now; the
  screen's layout should not block adding them later.

### Display rotation
- Portrait/Landscape buttons rotate the **entire kiosk output** at the OS level (Wayland output
  transform — e.g. `wlr-randr --output <name> --transform 90` or equivalent for whatever
  compositor Raspberry Pi OS Bookworm/Trixie ships), not just a CSS reflow — this matches users
  physically rotating the Koorui monitor on its stand.
- Chosen orientation persists in a backend-side JSON config file (e.g.
  `packages/backend/data/settings.json`) and must be re-applied automatically at boot, before or
  immediately as Chromium launches, to avoid a visible flash of the wrong orientation.
- Must not require a keyboard or SSH session to change.

### Standby
- Auto-triggers after 10 minutes of no touch/mouse input system-wide (fixed value — not
  user-adjustable in this workspace).
- Also triggers immediately via a manual control (e.g. a Settings button or sidebar icon).
- On entering standby: blank/turn off HDMI output, pause any refresh/polling jobs (e.g. epaper
  auto-refresh if one exists), keep Wi-Fi active, keep the Node.js backend process alive.
- Wakes instantly on any touch or mouse activity (movement or click/tap) — never on keyboard
  activity, per the input-model decision above.
- Resume must restore the display to exactly the state/orientation it was in before standby.

### Shutdown
- Triggered only via the on-screen "Shut Down" button in Settings (no physical-button-only path
  built in this workspace, since none of the current hardware list wires one to GPIO).
- On trigger: persist any in-flight application state that matters (at minimum, current
  orientation setting, which is already persisted continuously), then display "Safe to switch off
  power." full-screen, then execute a Linux shutdown.
- The backend needs a scoped, passwordless way to run `shutdown` as the DeskOS system user —
  architect to determine the specific sudoers/polkit mechanism, restricted to that one command
  only (no broad passwordless sudo).

### Lightweight Mode
- Not a runtime feature — a one-time RPi setup-time configuration, extending
  `scripts/install-services.sh` (or a new sibling setup script) to: disable Bluetooth
  (`rfkill block bluetooth` or equivalent, made persistent), disable known-unnecessary desktop
  services/apps that Raspberry Pi OS enables by default, while explicitly leaving Wi-Fi enabled.
- No corresponding UI toggle, no runtime backend logic — this is deploy tooling, not app code.

### Placeholders
- Add "Investments" and "Home Automation" sidebar entries as placeholders (same pattern as the
  existing "Raspberry Pi Desktop" entry: visible, disabled/inert content, "Coming later" label).
  No backend routes, no real plugin logic for either.

## Non-Functional Requirements

- No new text-input UI anywhere (Settings screen included) — this remains out of scope until an
  on-screen keyboard plugin exists, per `CLAUDE.md`.
- No credentials/secrets introduced by any of this (shutdown mechanism, orientation persistence).
- Must work identically in dev (macOS) where applicable — display rotation and Lightweight Mode
  are inherently Pi/Linux-only, so those two need a platform abstraction or a documented no-op on
  macOS dev, per the existing "no platform-specific code in the main codebase" rule; Settings
  screen UI and Standby's frontend-visible behavior should still be dev-testable on macOS with the
  OS-level parts stubbed.
- Orientation and standby state changes must survive an unattended reboot (this project has an
  existing pattern of verifying such things for real, not just in code review — see the
  outstanding "unattended reboot test" from the last deployment).

## Acceptance Criteria

1. Settings sidebar entry exists and opens without requiring a keyboard.
2. Tapping Portrait/Landscape visibly rotates the entire kiosk display (not just a layout reflow),
   and the same orientation is restored automatically after a real `sudo reboot` on the physical
   Pi.
3. After 10 minutes of no touch/mouse input, the display blanks (HDMI off) but the backend stays
   reachable (`curl http://localhost:3001/api/health` still returns `200`) and Wi-Fi stays
   connected.
4. A touch or mouse click during standby wakes the display within a short, perceptible delay and
   restores the prior orientation.
5. A manual "Standby" control (wherever the architect places it — Settings and/or sidebar) enters
   standby immediately, without waiting for the idle timeout.
6. Tapping "Shut Down" in Settings shows "Safe to switch off power." and the Pi actually powers
   down (verified on real hardware, not just backend logs).
7. Lightweight Mode setup script run once on a fresh Pi results in Bluetooth disabled and
   Wi-Fi still enabled and connected, verified via `rfkill list` / `iwconfig` or equivalent.
8. Investments and Home Automation appear in the sidebar as inert placeholders and do not error
   or 404 when clicked.
9. No Wi-Fi status, SSID, or network configuration UI appears anywhere in this feature.
10. No new keyboard-only interaction path exists; every control introduced is tap/click-operable.

## Edge Cases

- Standby triggered manually while the epaper iframe is mid-load — must not corrupt or need a full
  reload on wake (verify whether iframe state survives an HDMI blank vs. needs an explicit
  refresh).
- Rapid toggle of Portrait/Landscape (e.g. accidental double-tap) — rotation command should not
  race itself or leave the backend's persisted config out of sync with the actual applied output
  transform.
- Shutdown triggered while in Standby (display currently blanked) — the "Safe to switch off power"
  message must still become visible (i.e. shutdown must wake the display first, not leave the user
  looking at a blank screen wondering if anything happened).
- Backend restart (e.g. crash/systemd restart) while in Standby — must not force an unwanted
  wake, and must not lose the persisted orientation setting.
- Reboot occurring with no completed orientation ever persisted (very first boot) — must default
  to landscape (matches current hardcoded assumption) rather than erroring on a missing config
  file.
- Idle timer interaction with the epaper plugins' own possible auto-refresh (if any exists) —
  refresh jobs pausing during standby must not also silently cancel a refresh that was already
  needed right as standby was entered.

## Dependencies

- Wayland compositor's output-transform tooling on the actual Raspberry Pi OS version deployed
  (confirm `wlr-randr` or equivalent is available/installed — this needs verifying on the real Pi,
  same lesson as the FRONTEND_DIST and Chromium-binary-naming issues from the last deployment).
- A scoped passwordless shutdown mechanism (sudoers drop-in restricted to `/sbin/shutdown` or
  polkit rule) — needs to be added via `scripts/install-services.sh` or a new setup script, not
  manually on the Pi, to stay consistent with the existing "install via script, never manual"
  pattern.
- Backend needs a small persistent JSON config store (`packages/backend/data/settings.json` or
  similar) — first instance of the backend persisting its own state to disk in this project.
- Confirm whether the currently deployed Pi (Bookworm/Trixie per prior conversation) uses `labwc`
  or `wayfire` as its compositor, since the output-transform command differs slightly between them.
