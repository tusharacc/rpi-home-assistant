# Executor — Electron Migration Upgrade

Input: `artifacts/electron-migration-upgrade.tester.md`

## Execution Summary

Execution didn't follow the Tester's 18 written cases mechanically — instead, the user deployed to the
real Pi and used it live, which surfaced real bugs the static test plan couldn't have anticipated
(exact auth-provider domains, exact PDF URL schemes, a deploy-script data-loss bug). Each was diagnosed
and fixed in the same session, redeployed, and re-verified live. This is a more thorough form of
hardware validation than the original plan, but it does **not** map 1:1 onto the 18 cases — several are
confirmed, several remain genuinely unexecuted. Both are recorded honestly below rather than claiming
full coverage.

## Test Results (against the Tester's 18 cases)

| Case | Result | Notes |
|------|--------|-------|
| TC-01 Node version check | **Not executed** | Never ran `node --version` on the Pi directly; everything ran successfully throughout, so likely fine, but unconfirmed |
| TC-02 `npm install` on Pi | PASS | Implied by every successful deploy this session |
| TC-03 Full build | PASS | Implied by every successful deploy this session |
| TC-04 `launch-kiosk.sh` preflight checks | PASS | Verified directly (missing `main.js` / missing `electron` binary both produce clear errors) |
| TC-05 Kiosk launches, fullscreen/no chrome | PASS | Confirmed live on the Pi |
| TC-06 Sidebar nav for non-embedded items | PASS | Confirmed live (Other News, Settings) |
| TC-07 First-time epaper sign-in (The Hindu) | PASS | Confirmed live, after fixing FedCM + the Piano ID popup allowlist |
| TC-08 LiveMint sign-in | **Not executed** | Only The Hindu was tested; LiveMint may hit a different identity provider (flagged as a real risk when the Piano ID fix shipped) |
| TC-09 Session persists across reboot | **Not executed** | Restarts (`systemctl restart`) were tested repeatedly, not a full `sudo reboot` |
| TC-10 Switch away/back doesn't reload embedded view | **Not directly observed** | No explicit confirmation either way |
| TC-11 Switch between two embedded views | **Not executed** | Requires LiveMint, which wasn't tested |
| TC-12 Orientation rotation with embedded view active | **Not executed** | |
| TC-13 `setWindowOpenHandler` doesn't break legitimate functionality | PASS (revised) | The *deny* path did initially break something real (PDF links) — found live, fixed with a native PDF viewer window rather than loosening the deny policy |
| TC-14 Exit to Desktop / Return to DeskOS | **Not executed on Pi** | Only tested on macOS, where it's expected to fail (no systemd) — not a real test |
| TC-15 RAM measurement (architect's go/no-go checkpoint) | **Not executed** | Never measured; the app has been running without apparent issue throughout, but no numbers were captured |
| TC-16 Shutdown | **Not executed** | |
| TC-17 `journalctl` sanity check | PASS | Reviewed multiple times during live debugging; no crash-loops, only expected Chromium-engine noise |
| TC-18 `electron:dev` local launch | PASS | Run multiple times on macOS during development |

## Issues Found and Fixed (not in the original test plan — found via live use)

1. Google/Piano ID sign-in silently blocked (`setWindowOpenHandler` denied the identity-provider
   popup) — fixed with a two-host allowlist (`accounts.google.com`, `id.tinypass.com`) discovered via
   live request logging, plus disabling Chromium's FedCM feature (Google's SDK tried FedCM first and
   failed silently before ever attempting the classic popup).
2. DevTools hotkey didn't respond on macOS — Option is a dead-key modifier on US Mac keyboards, scrambling
   what `key` reports; fixed by matching on physical `code` instead.
3. A same-window navigation (arXiv's "View PDF" link, no `target="_blank"`) hijacked the entire kiosk
   window with no way back except Alt+F4, which quit the whole app — fixed with a `will-navigate` origin
   lock on the main window plus in-reader link interception.
4. PDFs still didn't render after fix #3 (Readability can't parse PDF binary) — fixed with a real,
   non-kiosk PDF viewer window using Chromium's built-in viewer.
5. That PDF detection initially missed arXiv's actual URL scheme (no `.pdf` file extension) — fixed by
   also matching `/pdf/` as a path segment.
6. **`deploy-to-pi.sh` was unconditionally overwriting the Pi's live `news.db` with an empty local stub
   on every single deploy** — the actual root cause of an extended "articles keep disappearing" chase
   that initially looked like a SQLite/WAL bug. Fixed by making that transfer opt-in
   (`--push-local-db`), off by default.

## Overall Status

**Functionally validated for the areas actually used live**: kiosk boot, sidebar navigation, The Hindu
epaper embed + sign-in, Other News reading queue (including the underlying pipeline once the deploy-script
bug was found), PDF viewing, and the deploy/redeploy loop itself — all confirmed working on real
hardware, several only after live-discovered fixes.

**Genuinely unverified**: LiveMint (may have a different identity-provider quirk than The Hindu),
reboot persistence, orientation rotation while an embedded view is active, Exit to Desktop on the Pi
itself, RAM usage under load, and Shutdown. None of these showed any sign of trouble during the session,
but none were positively exercised either — this is an honest gap, not a pass.
