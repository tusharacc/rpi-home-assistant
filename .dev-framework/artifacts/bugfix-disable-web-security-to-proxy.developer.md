# Bugfix: Replace --disable-web-security with backend proxy approach

## Bug Summary

`scripts/launch-kiosk.sh` launched Chromium with `--disable-web-security`,
which `CLAUDE.md` flagged as contradicting its stated iframe embedding policy
(proxy preferred). Investigated whether a backend proxy could replace it.

## Root Cause Analysis (round 1)

- Verified via `curl -I` that neither epaper site sends `X-Frame-Options` on a
  plain root-page fetch — inconclusive on its own, since both readers are
  client-rendered SPAs (Vue / Next.js) and the header may only appear in an
  authenticated session state.
- Built a minimal top-level-only proxy (`/api/proxy/epaper/:site` + `<base>`
  tag injection) and verified via curl that it strips frame headers and
  resolves relative asset paths correctly.

## Root Cause Analysis (round 2 — after reviewer rejection)

Reviewer found, and I confirmed directly against `packages/backend/src/index.ts`,
that the proxy fundamentally cannot work for this use case:

- The proxy's `fetch()` call runs server-side, in the Node backend process —
  it has no access to the browser's cookie jar, where the persistent Chromium
  profile's Google SSO session lives. The proxied page always renders
  logged-out/paywalled, defeating the entire subscription feature.
- Only the initial shell document is proxied. Any in-reader navigation (login
  link, pagination, article permalink) hits the real epaper origin directly,
  reintroducing the exact `X-Frame-Options` block one click deep. Any dynamic
  content the SPA loads via its own fetch/XHR becomes a genuine cross-origin
  request, subject to CORS and default same-origin credential exclusion —
  likely breaking most of the reader's real content even before cookies.
- The proxied document is served from our own backend origin, so the existing
  iframe sandbox's `allow-same-origin` now grants the external epaper page's
  script the same origin as the DeskOS app itself (localStorage, DOM, `/api/*`)
  — a privilege escalation not present when the iframe was genuinely
  cross-origin.
- Crucially: this exact approach and rejection reasoning was **already
  documented** in `.dev-framework/artifacts/add-epaper-subscriptions.architect.md:96`
  from the original feature's design phase: *"Backend proxy | Rejected |
  Cannot forward Google SSO cookies; would require full site proxying (images,
  JS, fonts)"*. `CLAUDE.md`'s blanket "proxy preferred" policy conflicted with
  that specific, already-reasoned decision.

User was presented with the choice (revert vs. build a full cookie-forwarding
reverse proxy vs. discuss further) and chose to revert.

## Fix Implementation

Reverted the proxy approach entirely, restoring the original validated design:

- Removed `/api/proxy/epaper/:site` route and `EPAPER_SITES` map from
  `packages/backend/src/index.ts`.
- Restored direct external `iframeSrc` values in
  `packages/frontend/src/plugins/news/NewsPlugin.tsx`.
- Restored `--disable-web-security` in `scripts/launch-kiosk.sh`.
- Restored README's `--disable-web-security` explanation, updated to mention
  the proxy was evaluated and rejected (with the concrete reason) rather than
  never considered.
- Updated `CLAUDE.md`'s iframe embedding policy: it previously stated the
  proxy approach was blanket-preferred, contradicting the original architect's
  own reasoned rejection of it. Now states `--disable-web-security` is the
  correct approach and documents why the proxy doesn't work, so this
  contradiction can't recur.

## Files Changed

- `packages/backend/src/index.ts` — proxy route removed
- `packages/frontend/src/plugins/news/NewsPlugin.tsx` — iframeSrc reverted to direct external URLs
- `scripts/launch-kiosk.sh` — `--disable-web-security` restored
- `README.md` — explanation updated to reflect proxy was evaluated and rejected
- `CLAUDE.md` — iframe embedding policy corrected to resolve the doc conflict

## Testing Notes

- `tsc --noEmit` passes on the backend.
- `git diff f21e509 -- packages/backend/src/index.ts packages/frontend/src/plugins/news/NewsPlugin.tsx scripts/launch-kiosk.sh` confirms this exactly reverses the rejected commit.
- No behavior change from what was running before this bugfix workspace was
  created — this restores the previously-shipped, working state. No new
  RPi/hardware testing needed beyond what the original feature already
  validated.
