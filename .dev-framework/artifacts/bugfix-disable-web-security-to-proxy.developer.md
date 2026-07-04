# Bugfix: Replace --disable-web-security with backend proxy approach

## Bug Summary

`scripts/launch-kiosk.sh` launched Chromium with `--disable-web-security` to work
around epaper sites (The Hindu, LiveMint) that may block iframe embedding via
`X-Frame-Options`/CSP `frame-ancestors`. This contradicts `CLAUDE.md`'s stated
policy: the backend proxy approach (stripping the blocking header) is preferred
over disabling Chromium's web security model, since the latter globally weakens
the kiosk browser's security for all sites it visits, not just the two epaper
domains.

## Root Cause Analysis

- Verified via `curl -I` (browser UA) against both `epaper.thehindu.com` and
  `epaper.livemint.com` root pages: neither actually sent `X-Frame-Options` or a
  `frame-ancestors` CSP directive at fetch time. The original justification may
  have been accurate at some point, or the header may only appear in some
  session/auth states not reproducible via a plain curl request.
- Both epaper readers are client-rendered SPAs (The Hindu: Vue —
  `chunk-vendors.js`/`app.js`; LiveMint: Next.js). `X-Frame-Options` and
  `frame-ancestors` only block a *document* from rendering as the target of a
  frame/iframe navigation — they do not block sub-resource fetches (script,
  img, link, XHR/fetch). So only the single initial top-level HTML response
  needs to be proxied, not every asset, as long as the reader doesn't do full
  page reloads during in-app navigation (unverified on real hardware — flagged
  as a testing note below).
- Resource references in both sites' HTML mix root-relative paths (`/js/...`,
  `/manifest.json`) and fully-qualified absolute URLs. If the top-level HTML is
  served from our own backend origin unmodified, root-relative paths would
  resolve against our backend instead of the real epaper origin and 404 (or hit
  our SPA catch-all). Fixed by injecting `<base href="{realOrigin}/">` into
  `<head>`, so the browser resolves all relative/root-relative resource and API
  requests against the real origin directly, without the response needing full
  URL rewriting.

## Fix Implementation

- Added `GET /api/proxy/epaper/:site` in `packages/backend/src/index.ts`.
  Fetches the real epaper origin server-side, and if the response is HTML,
  injects `<base href="{realOrigin}/">` right after the opening `<head>` tag.
  Response headers are freshly constructed (only `Content-Type` is copied), so
  `X-Frame-Options`/CSP headers from upstream are never forwarded — no
  explicit stripping logic needed.
- Updated `packages/frontend/src/plugins/news/NewsPlugin.tsx` — `iframeSrc` for
  both The Hindu and LiveMint now points at `/api/proxy/epaper/thehindu` /
  `/api/proxy/epaper/livemint` instead of the external URLs directly. Vite's
  existing `/api` dev proxy (`vite.config.ts`) forwards this to the backend
  with no extra config.
- Removed `--disable-web-security` from `scripts/launch-kiosk.sh`.
- Updated `README.md`'s explanation section to describe the proxy approach
  instead of the removed flag.

## Files Changed

- `packages/backend/src/index.ts` — new proxy route
- `packages/frontend/src/plugins/news/NewsPlugin.tsx` — iframeSrc updated
- `scripts/launch-kiosk.sh` — removed `--disable-web-security`
- `README.md` — updated iframe embedding explanation

## Testing Notes

Verified locally (backend built + run directly, bypassing a `tsx watch`
restart loop unrelated to this change):
- `curl http://localhost:3001/api/proxy/epaper/thehindu` → 200, no
  `X-Frame-Options` header, `<base href="https://epaper.thehindu.com/">`
  present in response body.
- `curl http://localhost:3001/api/proxy/epaper/livemint` → same, base tag
  correct.
- `curl http://localhost:3001/api/proxy/epaper/nonsense` → 404 for unknown
  site key.
- `tsc --noEmit` passes.

**Not yet verified — needs real RPi/Chromium testing**:
- Whether the iframe actually renders the reader correctly end-to-end in a
  real browser (asset loading via `<base>`, JS execution, layout).
- Whether the already-authenticated session cookies (set during the one-time
  Google SSO login into the persistent Chromium profile) are still sent on the
  epaper site's own subsequent fetch/XHR calls, since those calls originate
  from a document whose top-level origin is now our backend rather than the
  real epaper domain. This is a `SameSite` cookie / third-party-context risk
  that a curl-only test cannot exercise.
- Whether the epaper readers do any full-page (non-SPA) navigation during
  normal use (e.g. switching edition/date) — if so, those navigations would
  need proxying too, since only the initial `/api/proxy/epaper/:site` response
  is currently covered.

Recommend the user test this directly on the RPi kiosk hardware before
considering the bug fully resolved.
