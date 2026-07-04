# PO Approval: additional-features

**Status**: Approved
**Based on**: `artifacts/additional-features.executor.md`

## Executor Findings Summary

9 of 26 test cases were executable in this environment (API-level, backend-only) — all 9 passed
on first run with zero code changes needed during execution: default-settings fallback, input
validation on both `PUT /api/settings` and `POST /api/settings/rotate`, persist-only-on-script-
success behavior, standby enter/exit not crashing the process, shutdown responding promptly
without hanging, the loopback-only network binding (the reviewer's security fix), and confirmation
that no Wi-Fi-related code exists anywhere in the new surface.

The remaining 17 cases were **not run**, not failed:
- 6 frontend UI cases (TC-10–TC-15) — no connected browser this session.
- 11 hardware-dependent cases (TC-16–TC-26) — no physical Raspberry Pi available. These cover
  exactly the areas already flagged as open/unverified throughout this workflow: which Wayland
  compositor the Pi runs (Architect Open Question 1), the real `wlr-randr` command behavior, the
  exact `shutdown` binary path and whether the sudoers rule actually grants passwordless access
  (Architect Open Question 3 / Developer's flagged gap), unattended-reboot orientation
  persistence, and iframe survival across an HDMI blank/unblank cycle (Architect Open Question 4).

## PO Decision

**Approved.** No test failures occurred anywhere in this workflow — every case that could actually
be exercised in this environment passed, and the reviewer's one real finding (unauthenticated
routes reachable from the LAN) was already caught and fixed before reaching this phase. The
untested cases are an environment limitation, not a code defect, and they're honestly disclosed
rather than assumed-passing.

Advancing to `complete`. This closes the **development workflow** for `additional-features`. It
does **not** mean the feature is verified working on the actual device — per this project's own
established pattern (the prior real deployment session caught three separate bugs — path depth,
port mismatch, hardcoded user — specifically because they were checked on real hardware, not
assumed from code review), real-device verification remains a required manual step before this is
considered done in practice.

## Notes

**Action items for the user, before deploying to the real Pi:**
1. Run `npm run dev` locally and click through the Settings screen, Investments, and Home
   Automation placeholders in a real browser (TC-10–TC-15) — cheap to do before shipping to
   hardware at all.
2. On the real Pi: confirm which Wayland compositor is running
   (`echo $XDG_CURRENT_DESKTOP` or `ps aux | grep -E 'labwc|wayfire'`) — `apply-orientation.sh` and
   `hdmi-power.sh` currently assume `wlr-randr` (labwc) syntax and may need adjusting if it's
   `wayfire`.
3. On the real Pi: confirm the `shutdown` binary path (`which shutdown`) matches what's hardcoded
   in `packages/backend/src/routes/system.ts` (`SHUTDOWN_BIN`) and
   `scripts/deskos-shutdown.sudoers` — update both together if it doesn't.
4. Run `./scripts/install-services.sh` fresh (it now also installs the shutdown sudoers rule and
   creates `packages/backend/data/`) and verify `sudo visudo -c` passed without error during
   install.
5. Run the full TC-16–TC-26 hardware suite from `artifacts/additional-features.tester.md`,
   especially TC-17 (orientation survives a real unattended `sudo reboot`) and TC-21 (shutdown
   works with no password prompt) — these are the two most likely to surface a real-hardware
   surprise, per this project's deployment history.

Given the previously-outstanding "unattended reboot test" from the last deployment session is now
subsumed by TC-17, recommend running that as part of this same verification pass rather than
separately.
