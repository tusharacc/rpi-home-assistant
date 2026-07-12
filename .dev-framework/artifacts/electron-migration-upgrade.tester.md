# Tester — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.reviewer.md`

## Test Plan

This upgrade has an unusual verification profile: everything statically checkable (types, build,
route/script wiring, security flag presence) was already verified by Developer/Reviewer. What's
**never been run** is the actual Electron kiosk on real hardware — no `kiosk: true` window has been
launched, no `BrowserView` has actually rendered, no sign-in flow has been exercised, and none of the
architect's flagged go/no-go numbers (Pi 4 RAM, Node version) have been measured. So this test plan is
weighted almost entirely toward on-device, real-hardware execution rather than more unit-style checks —
there's very little left to test that doesn't require the actual Pi (or, for a subset, this same
machine with explicit permission to open a real window).

Test cases are grouped by where they must run:
- **Group A — On the Pi, via SSH/local build+typecheck only** (no window, no display needed)
- **Group B — On the Pi, real kiosk display required** (the primary gap this whole upgrade needs closed)
- **Group C — Local machine, requires explicit permission** (would take over the screen)

No test suite exists in this repo (confirmed during the code-quality review), so all cases here are
manual/exploratory, not automated — Executor runs each by hand and records pass/fail with observed
behavior.

## Test Cases

### Group A — Pre-flight, no display needed

**TC-01: Node version check**
- Input: `node --version` on the Pi
- Expected: `>= v22.12.0` (Electron 43's stated minimum)
- Why it matters: CLAUDE.md flags this as unconfirmed; dev environment (Node 20.19.5) worked despite
  an `EBADENGINE` warning, but that's not proof the Pi's version (unknown) will behave the same,
  especially for actually *running* the packaged app rather than just `--version`.
- Edge case: if `< v22.12.0`, note the exact version and treat as a blocking finding for
  Executor/PO-approval — architect's stated fallback is a Node upgrade or pinning an older Electron.

**TC-02: Fresh `npm install` on the Pi (ARM)**
- Input: `npm install` at repo root on a clean clone, per README's updated RPi Setup steps
- Expected: completes without fatal errors; `node_modules/.bin/electron` exists and is executable;
  `electron --version` reports `43.1.0`
- Edge case: if Electron's prebuilt binary has no ARM variant matching the Pi's actual architecture
  (`armv7l` vs `arm64` — depends on which Raspberry Pi OS image is installed), install may fail
  outright or fall back to a source build. Run `uname -m` alongside this to record which architecture
  was actually tested.

**TC-03: Full build**
- Input: `npm run build` at repo root
- Expected: all three workspace builds succeed (`backend`, `frontend`, `electron`); `packages/electron/dist/main.js`
  and `packages/electron/dist/preload.js` both exist afterward
- Edge case: none expected — already verified locally on macOS; this case exists to catch any
  ARM-specific TypeScript/build divergence, which is unlikely but unverified.

**TC-04: `launch-kiosk.sh` preflight checks fire correctly**
- Input: run `scripts/launch-kiosk.sh` directly (not via systemd) after deliberately removing/renaming
  `packages/electron/dist/main.js`
- Expected: script exits with the `ERROR: .../main.js not found. Run 'npm run build'...` message, not
  a raw Electron crash
- Then: restore `dist/main.js`, temporarily rename `node_modules/.bin/electron`, re-run
- Expected: script exits with the `ERROR: Electron not found...` message
- Why it matters: these are new guard clauses added in this upgrade specifically to fail clearly
  instead of silently launching nothing — worth confirming they actually trigger correctly, not just
  that the happy path works.

### Group B — Real kiosk display, primary verification target

**TC-05: Kiosk launches and matches prior fullscreen/no-chrome behavior**
- Steps: `sudo systemctl restart deskos-kiosk` on the Pi (after `install-services.sh` if the service
  file's `Description`/`ExecStart` changed — confirm it picks up the Electron launch path)
- Expected: fullscreen window, no title bar/borders/menu, DeskOS renders (same visual baseline as the
  pre-migration Chromium kiosk)
- Edge case: if Electron's `kiosk: true` behaves differently from Chromium's `--kiosk` flag on this
  specific labwc/XWayland setup (e.g., a title bar sneaks through, or focus/always-on-top behavior
  differs), note exactly what's different.

**TC-06: Sidebar navigation still works for all non-embedded items**
- Steps: tap through Settings, News → Other News, and any other `contentMode: 'react'` items
- Expected: identical behavior to before this upgrade — this code path wasn't meaningfully changed
  (only the wrapper wiring in `ContentArea.tsx` was refactored), regression here would indicate the
  Simplify refactor broke something the type system didn't catch (e.g., a React key/reconciliation
  issue from restructuring conditional rendering).

**TC-07: First-time epaper sign-in (The Hindu)**
- Precondition: fresh `~/.deskos-electron` (first boot after this upgrade, or manually cleared for a
  clean test)
- Steps: temporarily attach a keyboard, tap News → The Hindu
- Expected: content area shows an embedded, unauthenticated epaper view; **sidebar remains visible and
  tappable at the same time** (this is the core deliverable of the whole upgrade — confirm it's not
  full-screen-taking-over like the old separate-window approach). Sign in with `tusharacc@gmail.com`
  directly in the embedded view using the keyboard.
- Expected after sign-in: embedded view shows subscribed/authenticated content without needing a
  restart or re-navigation.
- Edge case: if bounds are miscalculated (`SIDEBAR_WIDTH_PX` mismatch against the real
  `--sidebar-width`, or a HiDPI/scaling factor main.ts doesn't account for), the embedded view might be
  offset, overlapping the sidebar, or leaving a dead strip — record exact pixel behavior if so.

**TC-08: Repeat TC-07 for LiveMint**
- Same as TC-07, separate site, separate `persist:news-livemint` partition — confirms partitions are
  genuinely isolated per site (signing into one shouldn't affect or leak into the other).

**TC-09: Session persists across reboot**
- Steps: after TC-07/TC-08 succeed, `sudo reboot` the Pi, wait for the kiosk to come back up, tap News
  → The Hindu again
- Expected: still shows authenticated/subscribed content, no re-prompt for sign-in
- Why it matters: this is the actual point of using `persist:` partitions under a stable `userData`
  path — confirms it's not an in-memory-only session that dies with the process.

**TC-10: Switching away from and back to an embedded view doesn't reload it**
- Steps: with The Hindu embedded view showing content, tap Settings, then tap News → The Hindu again
- Expected: view reappears instantly, no visible reload/flash, no re-fetch of the page (scroll
  position, if any, should be preserved) — this is the specific behavior `showEmbeddedView`/
  `hideEmbeddedView`'s attach/detach-not-destroy design exists to deliver
- Edge case: if it DOES visibly reload, that means `removeBrowserView`/`addBrowserView` isn't
  preserving `WebContents` state the way the implementation assumes — would need main-process
  investigation.

**TC-11: Switching between two different embedded views**
- Steps: with The Hindu showing, tap News → LiveMint directly (not via Settings first)
- Expected: The Hindu's view is hidden (not visible, not still receiving input) and LiveMint's view
  shows in its place; tapping back to The Hindu again shows it instantly (per TC-10) without needing to
  pass through a non-embedded item first
- Why it matters: exercises the `activeViewId !== viewId` branch in `showEmbeddedView`, the one
  invisible-in-typechecking path most likely to have a subtle bug (e.g., forgetting to detach the
  previous view, leaving two BrowserViews stacked).

**TC-12: Orientation rotation with an embedded view active**
- Steps: with The Hindu's embedded view showing, use Settings → Portrait/Landscape to rotate
- Expected: embedded view's bounds update to match the new dimensions (via the `resize` listener →
  `repositionActiveView`) — no dead strip, no content cut off, sidebar still fully visible at its
  fixed width in either orientation
- Edge case: if the window `resize` event doesn't fire on a `wlr-randr`-driven orientation change
  (as opposed to an actual window resize), bounds would go stale — this is a real architectural
  assumption from the architect doc worth specifically confirming, not just assuming it works because
  resize events "should" fire.

**TC-13: `setWindowOpenHandler` denial doesn't break legitimate epaper functionality**
- Steps: browse around within the embedded epaper view — click on articles, navigate between sections,
  any in-page links
- Expected: normal in-page navigation works (loads within the same `BrowserView`); nothing the user
  actually needs silently fails because it tried to open a new window
- Why it matters: flagged as an open question in the architect doc; confirms the safe-by-default
  choice didn't accidentally break something users rely on.

**TC-14: Exit to Desktop / Return to DeskOS still work**
- Steps: Settings → "Exit to Desktop"; confirm the RPi desktop appears; double-click "Return to DeskOS"
  on the desktop
- Expected: identical behavior to before this upgrade (architect's claim: zero changes needed to this
  path since it just stops/starts the systemd unit by name) — confirms that claim holds against the
  Electron-launched kiosk, not just in theory
- Then: repeat TC-07 (sign into an epaper) again afterward to confirm nothing about the Exit-to-Desktop
  round-trip corrupted the `~/.deskos-electron` session

**TC-15: RAM measurement — architect's go/no-go checkpoint**
- Steps: `free -h` with the kiosk idle (no embedded view active), then again with an embedded epaper
  view active (post TC-07)
- Expected: recorded numbers, compared against total Pi 4 RAM (also record via `free -h` total, since
  exact Pi 4 variant — 2/4/8GB — was unconfirmed as of the PO/Architect phases)
- Why it matters: this is the specific checkpoint the architect flagged as potentially scope-limiting.
  Not a pass/fail in isolation — Executor should report the raw numbers and flag if the device appears
  to be under memory pressure (swapping, OOM-killer activity in `dmesg`/`journalctl`) rather than
  applying an arbitrary threshold.

**TC-16: Shutdown still works**
- Steps: Settings → "Shut Down"
- Expected: "Safe to switch off power." message displays, actual shutdown occurs — unaffected by this
  upgrade (route unchanged), included for completeness since it's a full round-trip through the
  Electron-hosted frontend.

**TC-17: `journalctl -u deskos-kiosk` sanity check**
- Steps: after normal kiosk operation (boot, some navigation, an embedded view shown), review the
  service's logs
- Expected: no unexpected crash/restart-loop entries; any Electron/Chromium-engine noise (GCM,
  Fontconfig, etc., per the README's troubleshooting note) is present but not accompanied by actual
  fatal errors

### Group C — Local machine, explicit permission required

**TC-18: `npm run electron:dev` launches locally**
- Precondition: explicit user go-ahead to open a real window on the dev machine, since this takes over
  the screen (kiosk mode)
- Steps: `npm run dev` in one terminal (starts frontend :3000 + backend :3001), `npm run electron:dev`
  in another
- Expected: Electron window opens pointed at `:3000`, same fullscreen/no-chrome kiosk behavior as
  production would show pointed at `:3001`
- Why it matters: proves the Electron mechanism itself works at all, independent of Pi-specific
  concerns (Wayland/XWayland, ARM binaries) — useful as a faster iteration loop than round-tripping to
  the Pi for every check, and as a fallback if Pi access is delayed.
- Note: any sign-in done here populates a **local** `~/.deskos-electron` on the dev machine, not the
  Pi's — explicitly not a substitute for TC-07/TC-08/TC-09 on real hardware.

## Handoff to Executor

Execute Group A and Group C first (fastest feedback, lowest risk/permission bar). Group B requires Pi
access and is where the real verification weight sits — if Pi access isn't available to Executor in
this session, that must be reported explicitly as "not executed, needs on-device follow-up" rather than
skipped silently, since Group B is where every one of this upgrade's PO acceptance criteria actually
gets proven true or false.
