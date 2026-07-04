# Complete: additional-features

**Workflow**: full (po → architect → developer → reviewer → tester → executor → po-approval → complete)
**Branch**: `feature/additional-features`

## Summary

Delivered from `DeskOS_Requirements_v0.2.md`: a Settings screen (system uptime, orientation
toggle, Standby Now, Shut Down), whole-kiosk display rotation persisted across reboot, a
touch/mouse-only idle-triggered Standby (10 min fixed, no keyboard involvement), a scoped
passwordless Shutdown, a one-time Lightweight Mode setup script, and inert Investments/Home
Automation sidebar placeholders. Investments/Home Automation full functionality, Wi-Fi
status/config, and Electron migration were explicitly scoped out during PO discovery.

## Phase-by-Phase

- **PO**: scoped to Settings/rotation/power-states + placeholders; excluded Wi-Fi entirely; kept
  the existing React/Express/Chromium-kiosk stack.
- **Architect**: five new `/api/*` routes shelling out via `execFile` to three new scripts;
  centralized repo-root path resolution (`paths.ts`) to avoid repeating the `FRONTEND_DIST`
  off-by-one bug class; flagged 4 open questions (compositor choice, refresh-job no-op, shutdown
  binary path, iframe-across-standby survival).
- **Developer**: implemented as designed, 2 documented deviations (uptime folded into
  `GET /api/settings`; manual standby shares state with the idle timer). Added the sudoers
  plumbing for shutdown that the architect's design implied but didn't fully spec.
- **Reviewer**: code-quality gate **blocked once** — HIGH finding, unauthenticated mutating routes
  reachable from the LAN because the server bound to `0.0.0.0`. Fixed by binding to `127.0.0.1`;
  re-ran and passed. 2 low Simplify findings filed as `BUG-001`/`BUG-002`, non-blocking.
- **Tester**: 26 test cases written — 9 API-level, 6 frontend, 11 hardware-dependent.
- **Executor**: 9/9 executable cases passed. 17 not run (no connected browser, no physical Pi) —
  disclosed honestly rather than assumed passing.
- **PO Approval**: approved — no failures anywhere, only environment-limited gaps. 5 action items
  left for the user before real deployment (browser click-through, compositor confirmation,
  shutdown-path confirmation, fresh `install-services.sh` run, full hardware test pass).

## Known Follow-ups (not blocking, tracked)

- `BUG-001`: duplicate placeholder-panel shape across 3 plugins (deferred abstraction).
- `BUG-002`: cosmetic nested-parens in `SettingsPlugin.tsx`'s type guard.
- TC-16–TC-26 (real-Pi verification) and TC-10–TC-15 (browser verification) — see
  `artifacts/additional-features.po-approval.md` Notes for the full checklist.

## Next Steps

Run `/dev archive-feature additional-features` to archive this workspace, then merge
`feature/additional-features` into `main` when ready (both are user-triggered, not automatic).
