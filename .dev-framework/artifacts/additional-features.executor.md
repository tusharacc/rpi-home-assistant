# Executor: additional-features

**Status**: Complete — partial coverage, hardware/browser verification outstanding
**Based on**: `artifacts/additional-features.tester.md`

## Execution Summary

Ran the full monorepo build fresh (`npm run build`, both `tsc` passes clean), then executed the 9
API-level test cases (TC-01–TC-09) against the compiled backend running standalone on a scratch
port, using `curl`, `lsof`, and `grep`. All 9 passed.

The 6 frontend cases (TC-10–TC-15) could **not** be executed — the Chrome browser automation
extension was not connected in this session (checked via `tabs_context_mcp`, same result as during
the developer phase). The 11 hardware-dependent cases (TC-16–TC-26) could not be executed — no
physical Raspberry Pi is available in this environment. Neither gap is silently glossed over here;
both are called out explicitly below and in Overall Status.

## Test Results

| ID | Result | Notes |
|----|--------|-------|
| TC-01 | **PASS** | No config file present → `GET /api/settings` returned `200 {orientation:"landscape", uptimeSeconds:68225}`, no crash. |
| TC-02 | **PASS** | `PUT` with `orientation:"sideways"` → `400 {error:"invalid settings payload"}`; no file written. |
| TC-03 | **PASS** | `PUT` with `orientation:"portrait"` → `200`; subsequent `GET` reflected `"portrait"`; `settings.json` on disk matched. |
| TC-04 | **PASS** | `POST /api/settings/rotate` with `orientation:"upsidedown"` → `400`; `settings.json` unchanged (still `"portrait"` from TC-03). |
| TC-05 | **PASS** (macOS path only) | Valid orientation on a machine without `wlr-randr` → `500 {error:"failed to apply orientation"}`; `settings.json` correctly **not** updated (persist-only-on-success confirmed). Real-Pi success path is TC-16, not run (see below). |
| TC-06 | **PASS** | `standby/enter` and `standby/exit` both returned `500` (expected — no `wlr-randr`), backend did not crash; `/api/health` still `200` immediately after. |
| TC-07 | **PASS** | `POST /api/system/shutdown` returned `202 {status:"shutting-down"}` in 0.025s — confirms the response doesn't block on the shutdown command; backend still alive/responding afterward on macOS (expected, since `sudo /sbin/shutdown` fails harmlessly here). |
| TC-08 | **PASS** | `lsof` confirmed listening socket is `127.0.0.1:3057`, not `0.0.0.0:3057` — the reviewer's security fix holds. (Did not test from a second physical machine on a LAN — a loopback-only bind is an OS-level guarantee, not app-level, so the `lsof` result is definitive without needing a second host.) |
| TC-09 | **PASS** | `grep -rni "wifi\|wi-fi\|ssid"` across all new backend/settings-frontend code returned zero matches. |
| TC-10–TC-15 | **NOT RUN** | Chrome browser extension not connected this session. |
| TC-16–TC-26 | **NOT RUN** | No physical Raspberry Pi available in this environment. |

## Issues Found

None among the 9 executed cases — all passed on first run, no code changes were needed during
execution.

## Overall Status

**Partial pass — 9/9 executed cases pass, 17/26 cases unexecuted (not failed, unexecuted).**

The unexecuted cases are not a reflection of code quality — they require infrastructure this
session doesn't have (a connected browser, a physical Pi). They cover exactly the areas already
flagged as unverified by the Architect (compositor choice, `wlr-randr` syntax) and the Developer
(shutdown binary path, sudoers behavior, iframe-across-standby survival) — nothing new. Given this
project's established pattern (the prior real deployment session found and fixed three separate
bugs — `FRONTEND_DIST` depth, port mismatch, hardcoded `pi` user — specifically *because* they were
verified on real hardware rather than assumed from code review), recommend PO-Approval treat
TC-16–TC-26 as required before this feature is considered done in practice, even though the
workflow can formally advance past Executor now. TC-10–TC-15 should be run at minimum via a local
`npm run dev` + browser check before deploying to the Pi.
