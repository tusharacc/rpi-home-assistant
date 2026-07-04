# Tester: additional-features

**Status**: Ready for Executor
**Based on**: `artifacts/additional-features.po.md`, `artifacts/additional-features.developer.md`

## Test Plan

Test cases are written only in this phase — the Executor runs them. Coverage maps to the PO's 10
Acceptance Criteria and 6 Edge Cases, plus the security fix from the reviewer round. Cases are
split into **API-level** (runnable now, backend only, no real Pi needed) and **hardware-dependent**
(need the real Raspberry Pi — `wlr-randr`, actual HDMI power, actual reboot, actual shutdown). The
developer already ran informal `curl` checks during implementation; these are the same surface
area but written as a repeatable, complete suite rather than ad hoc exploration.

## Test Cases

### API-level (backend, runnable on any machine with Node — no real Pi required)

**TC-01 — GET /api/settings returns default on missing config**
- Steps: delete/ensure absent `packages/backend/data/settings.json`, start backend,
  `GET /api/settings`.
- Expected: `200 { orientation: "landscape", uptimeSeconds: <number> }` — no error, no crash.
- Maps to: PO Edge Case "reboot occurring with no completed orientation ever persisted".

**TC-02 — PUT /api/settings rejects invalid orientation**
- Steps: `PUT /api/settings` with body `{ "orientation": "sideways" }`.
- Expected: `400 { error: "invalid settings payload" }`; `settings.json` unchanged.

**TC-03 — PUT /api/settings accepts and persists valid orientation**
- Steps: `PUT /api/settings` with `{ "orientation": "portrait" }`; then `GET /api/settings`.
- Expected: `200`; second `GET` reflects `orientation: "portrait"`; `settings.json` on disk
  contains the updated value.

**TC-04 — POST /api/settings/rotate rejects invalid orientation before shelling out**
- Steps: `POST /api/settings/rotate` with `{ "orientation": "upsidedown" }`.
- Expected: `400`; confirm (via a temporary log or process monitor) that `apply-orientation.sh` is
  never invoked for the invalid value.

**TC-05 — POST /api/settings/rotate calls the script and persists only on success**
- Steps: on a machine without `wlr-randr` (e.g. macOS dev), `POST /api/settings/rotate` with a
  valid orientation.
- Expected: `500 { error: "failed to apply orientation" }` (script fails, expected here);
  `settings.json` is **not** updated, since the route only persists after the script exits `0`.
- On real Pi hardware, expected instead: `200 { orientation }`, `settings.json` updated, and the
  physical display visibly rotates.

**TC-06 — POST /api/standby/enter and /exit toggle without crashing when hdmi-power.sh fails**
- Steps: `POST /api/standby/enter`, then `POST /api/standby/exit`, on a machine without
  `wlr-randr`.
- Expected: both return `500` (script fails), process does not crash, no unhandled rejection in
  logs.

**TC-07 — POST /api/system/shutdown wakes display first, responds 202, doesn't hang**
- Steps: `POST /api/system/shutdown`.
- Expected: `202 { status: "shutting-down" }` returned promptly (not blocked on the shutdown
  command completing); backend process may exit shortly after on real hardware, but the HTTP
  response itself must not hang waiting for that.

**TC-08 — Backend listens on loopback only (security fix regression test)**
- Steps: start the compiled backend; run `lsof -iTCP -sTCP:LISTEN -n -P | grep <port>` (or
  equivalent); attempt `curl` to the same port using a non-loopback interface address if one is
  available.
- Expected: listening socket shows `127.0.0.1:<port>`, never `0.0.0.0:<port>`; a request from a
  non-loopback source is refused (connection refused, not just an app-level 403).
- Maps to: reviewer's SC-04 finding / fix.

**TC-09 — No Wi-Fi status/config anywhere in the API surface**
- Steps: grep the diff and running route list for any Wi-Fi-related endpoint or field.
- Expected: none exist — confirms PO Acceptance Criterion 9.

### Frontend (needs a browser — dev server or real device)

**TC-10 — Settings screen opens without a keyboard**
- Steps: click the "Settings" sidebar entry using only mouse/touch.
- Expected: panel renders with Uptime, Orientation (Portrait/Landscape), and Power (Standby Now,
  Shut Down) sections; no text input field anywhere on the screen.

**TC-11 — Orientation buttons reflect and update current state**
- Steps: load Settings, note which of Portrait/Landscape is highlighted as active; click the
  other one.
- Expected: the clicked button becomes visually active immediately (optimistic update on `200`);
  a failed rotate (e.g. dev machine without `wlr-randr`) leaves the UI state unchanged, matching
  TC-05's persistence-only-on-success behavior.

**TC-12 — Standby Now button triggers standby without duplicating the idle timer's own trigger**
- Steps: click "Standby Now" in Settings; then, while still within the 10-minute idle window,
  move the mouse.
- Expected: `POST /api/standby/enter` fires once (from the button, via the shared
  `triggerStandby()`); the subsequent mouse movement calls `POST /api/standby/exit` exactly once
  (not skipped, not duplicated) — confirms Deviation 2 from the developer artifact actually works
  as intended, not just compiles.

**TC-13 — Shutdown button shows the safe-to-power-off message immediately**
- Steps: click "Shut Down".
- Expected: the panel immediately switches to the full-screen "Safe to switch off power." message,
  regardless of how long the backend's `POST /api/system/shutdown` call takes to resolve (PO
  Acceptance Criterion 6 — the frontend must not wait for the response).

**TC-14 — Investments and Home Automation placeholders render without erroring**
- Steps: click "Investments", then "Home Automation" in the sidebar.
- Expected: each shows an inert "coming later" panel identical in shape to the existing
  "Raspberry Pi Desktop" placeholder; no console errors, no 404s (PO Acceptance Criterion 8).

**TC-15 — No control anywhere in the new UI requires a keyboard**
- Steps: attempt every new interactive element (Settings buttons, placeholder screens) using only
  mouse/touch.
- Expected: fully operable; confirms PO Acceptance Criterion 10.

### Hardware-dependent (real Raspberry Pi required — cannot run in this session)

**TC-16 — Whole-kiosk display rotation actually rotates the physical output**
- Steps: on the real Pi, click Landscape/Portrait in Settings.
- Expected: the entire Chromium kiosk output visibly rotates (not just a CSS reflow) — PO
  Acceptance Criterion 2, first half.

**TC-17 — Orientation persists across a real unattended reboot**
- Steps: set Portrait, `sudo reboot`, wait for the kiosk to come back up with no keyboard
  attached.
- Expected: kiosk boots directly back into Portrait — no flash of the wrong orientation, no manual
  intervention needed. PO Acceptance Criterion 2, second half. (This is also the previously-flagged
  outstanding "unattended reboot test" from the last deployment session — this test subsumes it.)

**TC-18 — Auto-standby after 10 minutes idle, backend and Wi-Fi stay up**
- Steps: leave the device completely untouched for 10+ minutes.
- Expected: HDMI blanks; `curl http://localhost:3001/api/health` (run from the Pi itself, or SSH)
  still returns `200`; Wi-Fi stays connected (`iwconfig`/`nmcli` shows connected). PO Acceptance
  Criterion 3.

**TC-19 — Wake from standby on touch/mouse activity, never on keyboard**
- Steps: enter standby (wait or use Standby Now); then press a physical key on an attached
  keyboard (setup-only scenario); confirm no wake. Then touch/click the display or move the mouse.
- Expected: keyboard input does **not** wake the device; touch/mouse input wakes it within a short,
  perceptible delay, restoring the prior orientation. PO Acceptance Criterion 4 + the input-model
  decision from PO discovery.

**TC-20 — Manual standby trigger works identically to auto-idle**
- Steps: tap "Standby Now" in Settings well before the 10-minute idle timeout.
- Expected: standby begins immediately, same behavior as TC-18. PO Acceptance Criterion 5.

**TC-21 — Real shutdown powers down the Pi and the sudoers rule works non-interactively**
- Steps: tap "Shut Down" on the real Pi.
- Expected: "Safe to switch off power." displays, then the Pi actually powers off, with no sudo
  password prompt (validates `scripts/deskos-shutdown.sudoers` was installed and the assumed
  `/sbin/shutdown` path is correct — Architect Open Question 3). PO Acceptance Criterion 6.
- **If this fails**: check `which shutdown` on the real Pi and compare against the path hardcoded
  in `packages/backend/src/routes/system.ts` and `scripts/deskos-shutdown.sudoers` — the developer
  artifact explicitly flags this as unverified.

**TC-22 — Lightweight Mode script disables Bluetooth, leaves Wi-Fi enabled**
- Steps: run `scripts/lightweight-mode.sh` once on a fresh Pi; check `rfkill list` and
  `iwconfig`/`nmcli` afterward.
- Expected: Bluetooth shows blocked; Wi-Fi still shows connected. PO Acceptance Criterion 7.

**TC-23 — Shutdown while already in standby still shows the safe-to-power-off message**
- Steps: enter standby (HDMI blanked), then trigger shutdown via Settings (only reachable if the
  display can still be interacted with — likely requires waking first via touch, then
  immediately shutting down) — or trigger shutdown via a direct API call while standby is active.
- Expected: display wakes before/as part of the shutdown sequence, so the "Safe to switch off
  power." message is actually visible, not left invisible on a blanked screen. PO Edge Case 3.

**TC-24 — Rapid double-tap of Portrait/Landscape doesn't desync persisted state from actual output**
- Steps: tap Portrait then immediately tap Landscape (within ~1 second) on the real Pi.
- Expected: final persisted `settings.json` orientation matches the actual physical display
  orientation — no race where the first request's persistence overwrites the second's, or vice
  versa. PO Edge Case 2.

**TC-25 — iframe survives an HDMI blank/unblank cycle without reload**
- Steps: open a News epaper plugin, let it fully load, then let auto-standby (or manual trigger)
  blank the HDMI output, then wake it.
- Expected: the epaper iframe is still showing its previously-loaded content, not reset to a blank
  or reloaded state. PO Edge Case 1 / Architect Open Question 4 — flagged as an untested
  assumption by the Architect; this is the first real test of it.

**TC-26 — Backend restart during standby doesn't force a wake or lose orientation**
- Steps: enter standby, then restart the `deskos-backend` systemd service
  (`sudo systemctl restart deskos-backend`), observe display state before/after.
- Expected: display does not unexpectedly wake just because the backend restarted; persisted
  orientation in `settings.json` is unaffected by the restart. PO Edge Case 4.
