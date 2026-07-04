# Developer Implementation: additional-features

**Status**: Ready for Reviewer
**Based on**: `artifacts/additional-features.architect.md`

## Implementation Plan

Followed the architect's design as-is, with two deviations noted below (system-info endpoint,
manual-standby wiring). Implemented in this order: backend path/settings-store primitives → three
new route modules → wire into `index.ts` → three new shell scripts → systemd/install-script
updates → frontend plugins (Settings, Investments placeholder, Home Automation placeholder) →
`IdleMonitor` → `App.tsx` registration.

## Files Changed

**Backend (new)**
- `packages/backend/src/paths.ts` — `REPO_ROOT` / `SCRIPTS_DIR` / `DATA_DIR`, single source of
  truth for repo-root-relative paths from compiled `dist/`, deliberately centralized so future
  files don't each recompute `__dirname` depth independently (that's exactly how the
  `FRONTEND_DIST` off-by-one bug happened previously).
- `packages/backend/src/settings-store.ts` — `readSettings`/`writeSettings` against
  `packages/backend/data/settings.json`; validates parsed JSON shape before use (same pattern as
  `navigationState.ts`'s `loadNavState`, per `CLAUDE.md`'s localStorage-shape rule, applied here to
  a file read instead).
- `packages/backend/src/routes/settings.ts` — `GET/PUT /api/settings`, `POST /api/settings/rotate`.
- `packages/backend/src/routes/standby.ts` — `POST /api/standby/enter|exit`, exports
  `wakeFromStandbySync` for reuse by the shutdown route.
- `packages/backend/src/routes/system.ts` — `POST /api/system/shutdown`.

**Backend (modified)**
- `packages/backend/src/index.ts` — registered the three new routers above
  `express.static(FRONTEND_DIST)`, no change to the SPA catch-all.

**Scripts (new)**
- `scripts/apply-orientation.sh`, `scripts/hdmi-power.sh` — both assume `wlr-randr` (labwc); see
  Open Question carried over from Architect, unresolved (no real Pi available in this session to
  test — see Testing Gaps below).
- `scripts/lightweight-mode.sh` — one-time, not wired into any service.
- `scripts/deskos-shutdown.sudoers` — templated sudoers drop-in (`__DESKOS_USER__` placeholder,
  same pattern as the existing `.service` templates), grants passwordless `sudo /sbin/shutdown`
  to the DeskOS user only, nothing broader.

**Scripts (modified)**
- `scripts/deskos-kiosk.service` — added `ExecStartPre` calling `apply-orientation.sh` (no arg —
  reads persisted setting) before `launch-kiosk.sh`.
- `scripts/install-services.sh` — `mkdir -p packages/backend/data` so a fresh install has
  somewhere to write `settings.json` before the first `PUT`/`rotate` call; also templates and
  installs `deskos-shutdown.sudoers` to `/etc/sudoers.d/deskos-shutdown` (0440, root:root),
  validated with `visudo -c` before install so a malformed sudoers file can't be installed and
  potentially break `sudo` system-wide.

**Frontend (new)**
- `packages/frontend/src/plugins/settings/SettingsPlugin.tsx` — sidebar entry + `SettingsPanel`
  component (uptime, orientation buttons, Standby Now, Shut Down).
- `packages/frontend/src/plugins/investments/InvestmentsPlugin.tsx`,
  `packages/frontend/src/plugins/home-automation/HomeAutomationPlugin.tsx` — placeholders, copied
  from `RpiDesktopPlugin.tsx`'s shape per the architect's explicit "don't abstract yet" call.
- `packages/frontend/src/lib/idle-monitor.ts` — `IdleMonitor` component + exported
  `triggerStandby()`.

**Frontend (modified)**
- `packages/frontend/src/App.tsx` — registered the three new plugins, mounted `<IdleMonitor />`
  alongside `<Shell />`.

**Other**
- `.gitignore` — added `packages/backend/data/*.json` (first instance of the backend persisting
  runtime state to disk).

## Code Summary

- All three new backend routes validate their inputs against a fixed enum (`'portrait' |
  'landscape'`, or no body at all for standby/shutdown) before ever reaching `execFile` — no
  string ever flows from a request body into a shell argument without being checked against an
  exact literal match first. `execFile` used throughout, never `exec`, so this is defense in depth
  rather than the only guard (per the Secure Coding checklist run before implementation, SC-02/
  SC-08).
- `settings-store.ts`'s `readSettings` treats a missing file, unparseable JSON, or wrong-shaped
  JSON identically — falls back to `{ orientation: 'landscape' }` — covering the PO's "very first
  boot, no config file yet" edge case without a special-cased branch.
- `GET /api/settings` also returns `uptimeSeconds` (via Node's built-in `os.uptime()`, no shell-out
  needed) — see Deviation 1 below.
- `IdleMonitor` listens only for `pointerdown`/`pointermove`/`touchstart`, explicitly no `keydown`
  — commented inline as intentional, matching the PO's confirmed input-model decision.
  `pointermove` is throttled to one handled event per 250ms to avoid a fetch-storm or timer-reset
  storm during continuous mouse movement.
- Standby state (`isStandby`) is an in-memory boolean in `standby.ts`, not persisted — matches the
  architect's "advisory, not authoritative" decision; a backend restart mid-standby doesn't force a
  wake or a false "still in standby" claim either way.
- Shutdown route wakes the display first (reuses `wakeFromStandbySync`, ignoring its error — best
  effort, per architect's edge case about shutdown-during-standby needing the "safe to power off"
  message to actually be visible), responds `202` immediately, then shells out to `shutdown now`.

## Decisions Made

### Deviation 1 — system info folded into `GET /api/settings`, no separate endpoint
The architect's frontend section implied the Settings screen gets system info (uptime) from the
same `GET /api/settings` call that returns orientation, but the API Contracts table only specified
`{ orientation }`. Rather than adding a whole separate `/api/system/info` endpoint for one field,
extended the existing response to `{ orientation, uptimeSeconds }` — `uptimeSeconds` is computed
in the route handler via `os.uptime()` (in-process, no `execFile`), not persisted, and not part of
`settings-store.ts`'s concern (that module stays about persisted settings only). Flagging this as
a deviation for Reviewer to confirm is acceptable rather than silently deviating.

### Deviation 2 — manual "Standby Now" button routed through `IdleMonitor`'s shared trigger
Per the architect's explicit note ("shared function, not a duplicate timer"), the Settings panel's
Standby Now button calls `triggerStandby()` exported from `lib/idle-monitor.ts` rather than issuing
its own `fetch('/api/standby/enter')`. This keeps the idle timer's internal `isStandby` ref in sync
with manually-triggered standby — without it, a manual trigger followed by activity wouldn't call
`/api/standby/exit` (the idle monitor wouldn't know it needs to).

### Kept as designed, no changes
- Whole-kiosk-output rotation via shell scripts (not CSS reflow).
- Lightweight Mode as a manual one-time script, no systemd unit, no UI toggle.
- No Wi-Fi status/config anywhere in the diff.
- Placeholder plugins are copy-paste, not abstracted (only 3 total instances of this shape now
  including the pre-existing `RpiDesktopPlugin.tsx`).

## Testing Gaps (for Tester/Executor to account for)

- **`wlr-randr`-dependent scripts are entirely untested on real hardware in this session** — no
  physical Pi was available. Verified only that: (a) the backend correctly rejects invalid
  orientation values before ever calling the script, (b) `execFile` failures are caught and
  surfaced as `500`s rather than crashing the process, (c) the compiled path resolution
  (`SCRIPTS_DIR`) correctly points at the real `scripts/` directory when run via
  `node packages/backend/dist/index.js` from the repo root. The actual `wlr-randr` command syntax,
  and which compositor (`labwc` vs `wayfire`) the deployed Pi runs, remain unverified — this is the
  same category of "must confirm on real device" risk flagged by the Architect (Open Question 1)
  and by prior deployment history in `CLAUDE.md` (Chromium binary naming, `FRONTEND_DIST` depth).
- **Browser-based UI verification was not performed** — the Chrome browser automation extension
  was not connected in this session, so the Settings screen, its buttons, and the two new
  placeholder sidebar entries were not visually exercised in a real browser. `npm run build` (full
  monorepo, both `tsc` passes) succeeded with zero type errors, and the compiled backend was
  started standalone and exercised via `curl` for every new route (`GET/PUT /api/settings`,
  `POST /api/settings/rotate` valid+invalid, `POST /api/standby/enter`, `POST /api/system/shutdown`
  — all behaved correctly, including the expected `500`s from the Pi-only scripts failing on
  macOS). Tester/Executor should load the actual Settings screen in a browser (dev server or real
  device) and click through it.
- **Shutdown route + sudoers**: confirmed the route returns `202` and now calls
  `execFile('sudo', ['/sbin/shutdown', 'now'])` (fails harmlessly on macOS — no `sudo`/binary
  configured the same way). Added the missing piece flagged during initial implementation: a
  templated `scripts/deskos-shutdown.sudoers` installed by `install-services.sh` to
  `/etc/sudoers.d/deskos-shutdown`, validated with `visudo -c` before install. **Still unverified
  on real hardware**: the exact `shutdown` binary path (`/sbin/shutdown` is an assumption — Open
  Question 3 from Architect) and whether `visudo -c` / `install` behave as expected under actual
  `sudo` on Raspberry Pi OS. If the path is wrong, both `system.ts`'s `SHUTDOWN_BIN` constant and
  `deskos-shutdown.sudoers` need the same corrected path.
- **`iframe` survival across HDMI blank/unblank** (Architect Open Question 4) — not tested, no real
  epaper content ever went through a standby cycle in this session.
