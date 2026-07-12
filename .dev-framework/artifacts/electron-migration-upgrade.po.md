# PO — Electron Migration Upgrade

## Upgrade Rationale

DeskOS currently runs as a plain web app: a React/Vite frontend served by an Express backend, displayed
by system Chromium in `--kiosk` mode. Authenticated third-party content (starting with The Hindu /
LiveMint epaper) cannot be genuinely embedded in this model — the only DOM embedding primitive
available to a web page is an iframe, and Chromium's storage partitioning gives a third-party iframe a
completely separate, permanently-empty `localStorage` from the real top-level site. This was proven via
live debugging this session (inspecting `epaper.thehindu.com` directly with Chrome DevTools): the
epaper's session lives in `localStorage` (`<accountId>:session-data`), not a cookie, and no Chromium
flag can override storage partitioning on modern versions (confirmed empirically — the
`SameSiteByDefaultCookies` killswitch was tried first and is dead on Chromium 142).

The current shipped workaround — News → The Hindu/LiveMint stop the kiosk and open the epaper as its
own separate top-level Chromium window (`scripts/launch-epaper.sh`), returning via a "Return to DeskOS"
desktop icon — works, but breaks the "DeskOS shell always visible" model. This doesn't scale: home
automation dashboards are planned next, and repeating "exit kiosk, open a separate window, come back"
for every embedded authenticated integration is not viable long-term.

Electron's `BrowserView`/`WebContentsView` is a separate `WebContents` — its own top-level browsing
context under programmatic control, not a DOM-nested sub-frame — so it is **not** subject to the iframe
storage-partitioning rule that blocks the current approach. This is the architectural reason Electron is
the fix, not a preference for Electron generally.

## Migration Strategy (v1 → v2)

**Hard cutover.** DeskOS is a single-user personal appliance with no external users to migrate and no
requirement to support old and new simultaneously. The Electron shell replaces the Chromium-kiosk launch
entirely in one deploy:

- `deskos-kiosk.service` launches the Electron app binary instead of `chromium --kiosk ...`
- No feature flag, no dual-mode support, no fallback path preserved in code
- If something breaks post-deploy, recovery is `git revert` + redeploy (same pattern already used for
  every other live fix this project has shipped), not a runtime toggle

The existing React frontend and Express backend are **not** thrown away — they continue to provide the
DeskOS UI and API exactly as today. Electron is an added shell around them: its main process creates a
`BrowserWindow` that loads the same DeskOS frontend (served by the same Express backend, same
`packages/backend`/`packages/frontend` structure), plus manages `BrowserView` instances for embedded
third-party content.

## User Stories

- As the device owner, I can tap News → The Hindu/LiveMint and read the epaper embedded directly in the
  DeskOS UI (sidebar still visible, no separate window, no exiting the kiosk), the same way I read the
  Other News reading queue today.
- As the device owner, the first time I open an epaper after this upgrade, I sign in once (temporarily
  attaching a keyboard, same as initial device setup) and that session persists across reboots from then
  on, inside Electron's own persistent session store.
- As the device owner, I can still use "Exit to Desktop" for general maintenance (plugging in a
  keyboard, file manager, terminal) unrelated to any single embedded site.
- As the device owner, switching between News → The Hindu and other sidebar items keeps the epaper's
  BrowserView loaded in the background, so switching back to it is instant rather than a fresh reload.
- As the future implementer of a home-automation plugin, the embedded-webview pattern built for epaper
  is generic enough to reuse for a new embedded dashboard without re-solving the storage-partitioning
  problem.

## Functional Requirements

1. Replace `scripts/launch-kiosk.sh`'s Chromium invocation with an Electron main process launch. The
   Electron `BrowserWindow` loads the existing DeskOS frontend (served by the existing Express backend on
   port 3001, same as today — no change to `packages/backend`/`packages/frontend`'s own architecture).
2. Extend the plugin `contentMode` system (`packages/frontend/src/plugins/types.ts`, currently
   `'react' | 'external'`) with a new mode for genuinely embedded third-party content (e.g.
   `'embedded-webview'`), replacing `'external'` for the epaper sub-items specifically.
3. Rebuild News → The Hindu and News → LiveMint on top of Electron's `BrowserView`/`WebContentsView`,
   positioned and sized to occupy the same content-area region `ReactContainer` occupies today, with the
   DeskOS sidebar remaining visible and interactive alongside it.
4. `BrowserView` instances persist across sidebar navigation: switching away from an embedded item and
   back to it (or to a different embedded item within the same session) does not destroy and recreate the
   view. Only an explicit close action (if any is added) or app restart destroys it.
5. Electron's session storage (used by `BrowserView` instances) is a **new, separate** persistent store
   from the existing `~/.deskos-chromium` profile used by system Chromium today. One-time sign-in per
   embedded site (keyboard temporarily attached, same pattern as current setup step 4 in the README) is
   required post-migration; the old profile's sessions are not carried over or reused.
6. Retire the current `open-epaper` workaround (`POST /api/system/open-epaper`, `scripts/launch-epaper.sh`)
   once the BrowserView-embedded version ships — the separate-window flow was explicitly a stopgap for
   this exact problem.
7. Keep "Exit to Desktop" (`POST /api/system/exit-to-desktop`, `scripts/deskos-kiosk-control.sudoers`,
   the "Return to DeskOS" desktop icon) — general-purpose maintenance escape hatch, not being retired.
   Its meaning shifts slightly: it now stops the Electron app (not a plain Chromium kiosk process), and
   "Return to DeskOS" relaunches Electron.
8. All existing functionality not explicitly changed by this upgrade continues to work unchanged:
   orientation rotation, standby (currently disabled pending the wlr-randr/DPMS fix — not in scope here),
   shutdown, the news-intelligence reading queue and its in-app reader modal (already non-iframe, unaffected
   by this migration), and the news-pipeline systemd timer.

## Non-Functional Requirements

- **Resource budget**: target hardware is a **Raspberry Pi 4** (exact RAM — 2GB/4GB/8GB — to be confirmed
  on-device; `free -h` before Architect finalizes any memory-budget assumptions). Electron bundles its own
  Chromium + Node runtime, which is heavier than the current bare-Chromium approach. The Architect phase
  must produce a concrete resource assessment (idle RAM, RAM with one BrowserView active, disk footprint)
  before Developer starts, given `scripts/lightweight-mode.sh` already exists specifically because this
  device's resource budget is tight.
- **No keyboard in normal operation** (unchanged device constraint): all DeskOS-side interactions
  (sidebar navigation, switching between embedded views) must remain pointer/touch-only. Keyboard is only
  required for the one-time per-site sign-in step, same exception as today.
- **Platform parity**: the app must still run on macOS for development (`npm run dev`) and Raspberry Pi
  OS (Bookworm/Trixie, Wayland/labwc via XWayland) for deployment, per existing CLAUDE.md rules. Electron
  on Wayland/XWayland needs verification — confirm whether Electron runs natively on Wayland or needs an
  XWayland compatibility path, and whether `apply-orientation.sh`/`hdmi-power.sh`'s `wlr-randr` usage
  still applies unchanged to an Electron-driven display.
- **No regression in existing security posture**: `--disable-web-security` stays removed (already done
  this session, nothing needs it); Electron's `BrowserView` sites should run with contextIsolation/sandboxing
  defaults appropriate for displaying trusted third-party sites, not arbitrary user-supplied URLs.

## Backwards Compatibility

- Not applicable in the traditional sense (no external users/API consumers), but: the existing
  `~/.deskos-chromium` Chromium profile is **not** migrated or reused — this is a known, accepted breaking
  change (see Functional Requirement 5), not an oversight.
- `packages/backend`'s API surface (`/api/*`) is not expected to change as part of this migration; Electron
  is a new consumer of the same backend, not a replacement for it.
- The news-intelligence article-reader modal (server-side Readability extraction, shipped earlier this
  session) is unaffected — it already doesn't use iframes and needs no Electron-specific changes.

## Acceptance Criteria

- [ ] `deskos-kiosk.service` launches an Electron app that renders the existing DeskOS UI full-screen on
      the Pi's display, with parity to today's Chromium-kiosk behavior (fullscreen, no window chrome, no
      accidental way to navigate away from the app).
- [ ] News → The Hindu and News → LiveMint render the epaper embedded within the DeskOS content area
      (sidebar visible and usable simultaneously), not as a separate window.
- [ ] A fresh Electron session, after one manual sign-in per epaper site, shows the subscribed/
      authenticated view — verified live on the actual Pi, not just locally.
- [ ] That signed-in session survives a full device reboot.
- [ ] Switching sidebar focus away from and back to an embedded epaper view does not force a reload/
      re-render from scratch.
- [ ] Exit to Desktop and Return to DeskOS both still function correctly against the Electron app.
- [ ] Orientation rotation, shutdown, and the news-intelligence pipeline/reading-queue continue working
      unchanged.
- [ ] Documented resource usage (RAM idle / RAM with one BrowserView active) on the actual Pi 4 hardware,
      captured in the Architect or Tester artifact, with an explicit call on whether `lightweight-mode.sh`
      needs updating.
- [ ] `open-epaper` route/script and their sudoers-adjacent scaffolding are removed once the BrowserView
      version is verified working (avoid leaving dead code from the stopgap).
- [ ] CLAUDE.md and README updated to describe the Electron shell, the new embedded-webview content mode,
      and the removal of the `open-epaper` workaround.
