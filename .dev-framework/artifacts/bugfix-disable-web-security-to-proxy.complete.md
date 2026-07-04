# Complete: Replace --disable-web-security with backend proxy approach

## Outcome

Reverted to `--disable-web-security`. The bug (CLAUDE.md's iframe embedding
policy contradicting a decision Chromium already needed) is fixed by
correcting the documentation, not the code.

## Phase History

1. **Developer (round 1)** — researched X-Frame-Options behavior on both
   epaper sites, built a minimal top-level-only backend proxy
   (`/api/proxy/epaper/:site` + `<base>` tag injection), verified via curl
   that it strips frame headers and resolves relative paths correctly.
2. **Reviewer (round 1)** — 5-angle code review found 3 High severity issues:
   the proxy can't forward the browser's Google SSO session cookie (fetch
   runs server-side), only the initial page load is covered so in-reader
   navigation reintroduces the same block, and the same-origin iframe src
   escalates the sandbox's `allow-same-origin` trust boundary. Also
   discovered the original `add-epaper-subscriptions` feature's architect
   phase had already evaluated and rejected this exact approach for the
   same cookie-forwarding reason. **Rejected — returned to developer.**
3. **User decision** — presented with revert vs. full cookie-forwarding
   reverse proxy vs. discuss further; chose to revert.
4. **Developer (round 2)** — removed the proxy route, restored direct
   external `iframeSrc` values, restored `--disable-web-security` in the
   kiosk launch script, and corrected `CLAUDE.md`/`README.md` so the
   documented policy no longer contradicts the architect's prior reasoning.
5. **Reviewer (round 2)** — code-quality (simplify/secure-coding/secret-
   detection) all passed; confirmed the diff is an exact revert. **Approved.**
6. **Tester** — wrote 8 test cases covering the revert's completeness,
   correctness, build health, and doc consistency.
7. **Executor** — ran all 8 cases. All passed.
8. **PO Approval** — approved; net code change from `main` is none (restores
   previously-shipped behavior), value is in the corrected documentation.

## Files Changed (net, vs. main)

- `CLAUDE.md` — iframe embedding policy corrected
- `README.md` — `--disable-web-security` rationale updated to reflect the
  evaluated-and-rejected proxy approach
- `packages/backend/src/index.ts`, `packages/frontend/src/plugins/news/NewsPlugin.tsx`,
  `scripts/launch-kiosk.sh` — no net change (proxy added then fully reverted)

## Next Step

Suggest `/dev archive-feature bugfix-disable-web-security-to-proxy`.
