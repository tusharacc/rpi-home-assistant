# Code Quality Report — additional-features
Generated: 2026-07-04T13:42:51Z (round 1, BLOCKED) / 2026-07-04T13:45:50Z (round 2, PASSED)
Mode: reviewer

## Round 2 Re-check (2026-07-04T13:45:50Z)

Fix applied: `packages/backend/src/index.ts` now binds to `127.0.0.1` explicitly, verified via
`lsof` (listening socket shows `127.0.0.1:<port>`, not `0.0.0.0:<port>`) and via `curl` against
`/api/health` and `/api/settings` over loopback — both still respond `200`. No new `any`, `exec`/
`eval`, or unvalidated-input patterns introduced by the fix (`Number(process.env.PORT ?? 3001)` is
a safe coercion of an environment variable, not user input). SC-04 finding is resolved — the
route-level lack of auth is no longer exploitable from the LAN, only from processes already
running on the device itself, consistent with the appliance's existing threat model.

## Summary (round 2 — current)

| Agent | Status | Findings |
|---|---|---|
| Simplify | PASS / 2 findings | 2 advisory, 0 actionable-blocking |
| Secure Coding | PASS | 0 critical, 0 high, 0 medium, 0 low |
| Secret Detection | PASS | 0 secrets found |

## Summary (round 1 — historical, superseded)

| Agent | Status | Findings |
|---|---|---|
| Simplify | PASS / 2 findings | 2 advisory, 0 actionable-blocking |
| Secure Coding | BLOCKED | 1 high, 0 critical, 0 medium, 0 low |
| Secret Detection | PASS | 0 secrets found |

## Simplify Agent Findings

1. **`InvestmentsPlugin.tsx` / `HomeAutomationPlugin.tsx` / `RpiDesktopPlugin.tsx`** duplicate an
   identical placeholder-panel style object and JSX shape three times now. Advisory only — the
   Architect explicitly decided against extracting a shared `PlaceholderPlugin(name)` helper for
   this workspace ("only 3 instances... premature abstraction"). Not re-litigated here; noted for
   awareness if a 4th placeholder is ever added.
2. **`SettingsPlugin.tsx`'s `isSettingsResponse`** guard nests parens more than necessary
   (`(('orientation' in value) && (...))`). Cosmetic only, no behavior difference. Advisory.

## Secure Coding Findings (round 1 — RESOLVED in round 2, kept for history)

### [HIGH] SC-04 — Broken Access Control (OWASP A01:2021) — ✅ RESOLVED

**File:** `packages/backend/src/index.ts:28` (pre-existing `app.listen(PORT, ...)`), in
combination with the new mutating routes added by this diff:
`packages/backend/src/routes/settings.ts` (`PUT /api/settings`, `POST /api/settings/rotate`),
`packages/backend/src/routes/standby.ts` (`POST /api/standby/enter|exit`),
`packages/backend/src/routes/system.ts` (`POST /api/system/shutdown`).

**Description:** None of the five new mutating routes have any authentication/authorization
check — by itself this matches the appliance's existing threat model (no auth anywhere in the
app, single physical user, no keyboard to log in with) and would normally be acceptable as-is.
However, `app.listen(PORT, ...)` binds to all network interfaces (`0.0.0.0`), not just loopback —
this line is unchanged by the diff, but this PR is the **first** time the app has any mutating
route at all, so it's the first time that binding choice becomes exploitable. Since the device's
own hardware spec keeps Wi-Fi enabled at all times (including through Standby and Lightweight
Mode), **any other device on the same Wi-Fi network as the Pi can currently send
`POST /api/system/shutdown` or spam `POST /api/settings/rotate` / `POST /api/standby/enter` with
zero credentials**, from anywhere on the LAN, not just from the Chromium kiosk itself.

**Current code:**
```ts
app.listen(PORT, () => {
  console.log(`DeskOS backend running on http://localhost:${PORT}`)
})
```

**Failure scenario:** A phone or laptop on the same home Wi-Fi network runs
`curl -X POST http://<pi-lan-ip>:3001/api/system/shutdown` and powers off the appliance with no
authentication of any kind — a trivial denial-of-service against a device the PO's requirements
describe as something that should "boot straight into the authenticated kiosk" unattended.

**Recommended fix:** Bind the Express server to loopback only —
`app.listen(PORT, '127.0.0.1', () => { ... })`. The kiosk already connects via
`http://localhost:3001` per `CLAUDE.md`/`README.md`, so this doesn't change any documented
access path, closes the LAN exposure entirely, and needs no auth layer (which would conflict with
the "no keyboard, no credential entry" device constraint anyway).

## Secret Detection Findings

No secrets detected. Pre-commit hook (`.git/hooks/pre-commit`) already reported 0 findings on the
developer-phase commit.
