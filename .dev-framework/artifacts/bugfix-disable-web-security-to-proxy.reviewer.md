# Reviewer: Replace --disable-web-security with backend proxy approach

## Review Summary

**Round 1** (commit `f21e509`): implemented a backend proxy
(`/api/proxy/epaper/:site` + `<base>` tag injection) to replace
`--disable-web-security`. Rejected — 3 High findings: the proxy can't forward
the browser's Google SSO session cookie (fetch runs server-side), only the
initial page load is covered so in-reader navigation reintroduces the same
block, and the same-origin iframe src escalates the sandbox's
`allow-same-origin` trust boundary. This also reproduced a rejection already
recorded in `add-epaper-subscriptions.architect.md:96` from the original
feature's design phase. Full detail preserved in git history (commit
`482d380`, reviewer round 1).

**Round 2** (commit `ca9329f`, this review): developer reverted the proxy
entirely per user decision — restored `--disable-web-security` in
`scripts/launch-kiosk.sh`, restored direct external `iframeSrc` values in
`NewsPlugin.tsx`, removed the proxy route from `packages/backend/src/index.ts`,
and corrected `CLAUDE.md`/`README.md` so the documented policy no longer
contradicts the original architect's reasoning.

Code-quality (Simplify / Secure Coding / Secret Detection) all PASSED — see
`bugfix-disable-web-security-to-proxy.code-quality-report.md`. Confirmed via
`git diff f21e509 ca9329f` that the code changes are an exact revert (no drift,
no leftover proxy code, no new issues introduced).

## Issues by Severity

### High

None.

### Medium

None.

### Low

None. (The three low findings from round 1 — redirect-following, no caching,
charset assumption — no longer apply since the code they concerned has been
removed entirely.)

## Approval Status

**Approved.** This restores the codebase to its previously-validated working
state and resolves the CLAUDE.md/architect-decision conflict that caused this
bugfix workspace to be opened in the first place. No open issues. Advancing to
Tester.
