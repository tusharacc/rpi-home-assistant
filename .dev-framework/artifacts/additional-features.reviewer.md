# Reviewer: additional-features

**Status**: Approved — advancing to Tester
**Based on**: `artifacts/additional-features.developer.md`, `artifacts/additional-features.code-quality-report.md`

## Review Summary

Code-quality gate ran twice: round 1 BLOCKED on a HIGH secure-coding finding (unauthenticated
mutating routes reachable from the LAN because the backend listened on `0.0.0.0`); round 2 PASSED
after the developer bound the server to `127.0.0.1` and verified it via `lsof` + `curl`. Full
report in `artifacts/additional-features.code-quality-report.md`.

Beyond the code-quality gate, reviewed the diff against the architect's design and the PO's
acceptance criteria:

- **Input validation**: every new route (`rotate`, `standby/enter|exit`, `system/shutdown`)
  rejects malformed bodies before touching `execFile` or the filesystem; `settings-store.ts`
  validates JSON shape on read, matching the `CLAUDE.md` localStorage-shape rule applied to a file
  read instead. No gaps found.
- **`execFile` usage**: confirmed no `exec`/`eval`/shell-string-interpolation anywhere in the new
  backend code — every shell-out uses `execFile` with an argument array, and every argument that
  reaches a script was already validated against a fixed two-value enum. Consistent with the
  Secure Coding checklist run at the start of the developer phase.
- **Input model**: `idle-monitor.ts` listens only for `pointerdown`/`pointermove`/`touchstart`,
  confirmed no `keydown` anywhere in the diff — matches the PO's explicit decision.
- **Path handling**: `paths.ts` centralizes the repo-root-relative path computation instead of
  each new route file recomputing `__dirname` depth independently — this directly avoids a repeat
  of the exact `FRONTEND_DIST` off-by-one bug documented in `CLAUDE.md`. Verified by the developer
  via a real build + `require()` + `fs.existsSync` check (not just code review) — good adherence
  to the project's "verify by building, not by inspection" lesson from the last deployment.
- **Deviations flagged by the developer** (system-info folded into `GET /api/settings`; manual
  standby routed through the shared `IdleMonitor` trigger; sudoers plumbing added beyond the
  original architect scope) are all reasonable, well-justified, and don't warrant a High/Medium —
  approved as-is.
- **Placeholder plugins**: verified `InvestmentsPlugin.tsx`/`HomeAutomationPlugin.tsx` match the
  existing `RpiDesktopPlugin.tsx` shape exactly (no `subItems`, no backend calls, inert `render`).

## Issues by Severity

### High

None (SC-04 resolved in round 2 — see Code Quality Report).

### Medium

None.

### Low

1. **Simplify (advisory)**: `InvestmentsPlugin.tsx`/`HomeAutomationPlugin.tsx`/
   `RpiDesktopPlugin.tsx` share an identical placeholder-panel style/JSX shape three times now.
   Architect explicitly deferred abstracting this; filing as a low-priority bug rather than
   blocking, per code-quality's non-blocking handling of Simplify findings.
2. **Simplify (advisory)**: `SettingsPlugin.tsx`'s `isSettingsResponse` type guard has slightly
   more nested parens than necessary. Cosmetic, no behavior impact.

Both filed as bugs (see `.dev-framework/bugs/`) rather than blocking hand-off, per the reviewer
branching rule for low-only findings.

## Approval Status

**Approved.** No High or Medium issues remain. Advancing to Tester.
