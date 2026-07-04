# Tester: Replace --disable-web-security with backend proxy approach (reverted)

## Test Plan

Since the code change is a pure revert to the previously-shipped, working
state (plus documentation corrections), test cases focus on: (1) confirming
the revert is complete and correct, (2) confirming no proxy remnants remain,
(3) confirming the app still builds/runs, (4) confirming doc consistency.
No new runtime behavior was introduced, so no new feature test cases are
needed beyond what the original `add-epaper-subscriptions` feature already
validated.

## Test Cases

### TC-1: Backend has no proxy route remnants
- **Input:** `grep -rn "proxy/epaper\|EPAPER_SITES" packages/backend/src/`
- **Expected:** No matches.

### TC-2: NewsPlugin iframeSrc points at external URLs directly
- **Input:** Inspect `packages/frontend/src/plugins/news/NewsPlugin.tsx`
- **Expected:** `iframeSrc` for `news-the-hindu` is `https://epaper.thehindu.com`;
  for `news-livemint` is `https://epaper.livemint.com`.

### TC-3: Kiosk launch script restores the flag
- **Input:** Inspect `scripts/launch-kiosk.sh`
- **Expected:** `--disable-web-security` present in the Chromium invocation,
  before `--user-data-dir`.

### TC-4: Backend type-checks and builds cleanly
- **Input:** `cd packages/backend && npx tsc --noEmit`
- **Expected:** Exit 0, no errors.

### TC-5: Full workspace build succeeds
- **Input:** `npm run build` from repo root
- **Expected:** Exit 0; `packages/backend/dist/index.js` and
  `dist/frontend/index.html` (or equivalent build output) produced.

### TC-6: Diff is an exact revert of the rejected commit
- **Input:** `git diff f21e509 ca9329f -- packages/backend/src/index.ts packages/frontend/src/plugins/news/NewsPlugin.tsx scripts/launch-kiosk.sh`
- **Expected:** Diff shows only removals of round-1 additions and restoration
  of prior lines — no unexpected additional changes.

### TC-7: CLAUDE.md and README no longer contradict each other
- **Input:** Inspect `CLAUDE.md` "iframe Embedding" section and README's
  `--disable-web-security` explanation block.
- **Expected:** Both state `--disable-web-security` is the correct approach
  and both explain the proxy was evaluated and rejected for the same reason
  (cannot forward Google SSO session cookie).

### TC-8 (edge case): No secrets or credentials introduced
- **Input:** `git diff f21e509 ca9329f` reviewed for credential-shaped strings.
- **Expected:** None present (already confirmed by code-quality secret
  detection agent — PASS).

Handing off to Executor to run these against the actual repo state.
