# Reviewer: Replace --disable-web-security with backend proxy approach

## Review Summary

Ran code-review (medium effort, 5 finder agents across correctness,
removed-behavior, cross-file, cleanup, and altitude/conventions angles) against
commit `f21e509`. The mechanics of the proxy (stripping frame headers, `<base>`
tag injection) work as designed and were verified by curl in the developer
phase — but the fix does not actually solve the underlying problem for
authenticated content, and reintroduces the original blocking behavior for
anything beyond the initial page load. It also silently escalates the iframe's
sandbox trust boundary.

Critically: `.dev-framework/artifacts/add-epaper-subscriptions.architect.md:96`
(from the original feature's design phase) already considered and **rejected**
this exact approach:

> | Backend proxy | Rejected | Cannot forward Google SSO cookies; would require
> full site proxying (images, JS, fonts) |

This bugfix re-attempts the rejected approach without resolving the reason it
was rejected. That's not just a coincidence the developer phase missed — it's
the same failure mode showing up in the implementation.

## Issues by Severity

### High

1. **Server-side proxy fetch forwards no cookies** (`packages/backend/src/index.ts:31-33`).
   The `fetch(siteOrigin, ...)` call runs in the Node backend process, which
   has no access to the browser's cookie jar (where the persistent Chromium
   profile's Google SSO session lives). The proxied shell HTML will always be
   the anonymous/logged-out or paywalled version — the subscription feature
   this whole plugin exists for will not render authenticated content. This
   directly reproduces the exact reason the proxy approach was rejected during
   the original feature's architect phase.

2. **Sandbox privilege escalation** (`packages/frontend/src/shell/ContentArea/IframeContainer.tsx:14`,
   combined with `packages/backend/src/index.ts` route). The iframe's
   `sandbox="allow-scripts allow-same-origin ..."` was safe when `iframeSrc`
   was a genuinely cross-origin URL (`https://epaper.thehindu.com`) — the
   external site's own origin was still isolated from the DeskOS app. Now that
   the document is served from `/api/proxy/epaper/:site` on our *own* backend
   origin, `allow-same-origin` grants the framed (externally-sourced,
   unsanitized) HTML the same origin as the DeskOS shell itself. Any script in
   that page can reach `window.parent.document`, DeskOS's own `localStorage`,
   and `/api/*` as the app itself. This is a regression introduced by the fix,
   not present before.

3. **Only the top-level document is proxied — everything past it breaks**
   (`packages/backend/src/index.ts:23-47`). The `<base>` tag fixes relative
   asset paths for the *initial* load, but:
   - Any in-reader full-page navigation (a login link, pagination, an article
     permalink) navigates the iframe directly to the real epaper origin,
     reintroducing the exact `X-Frame-Options` block this fix exists to solve
     — just one click deeper.
   - Any `fetch`/XHR the SPA's own JS makes back to its real domain for
     dynamic content becomes a genuine cross-origin request. Even before
     considering cookies, this is subject to CORS (which these sites almost
     certainly don't allow for arbitrary origins) and defaults to
     `credentials: 'same-origin'`, which excludes cookies for a now-cross-origin
     call regardless. Both readers are SPAs (Vue / Next.js) that very likely
     load real content this way — the proxy's currently-verified "it returns
     200 with a base tag" is not evidence the reader actually works end-to-end.

### Medium

4. **Comment describes *what*, not *why*** (`packages/backend/src/index.ts:19-22`).
   CLAUDE.md Code Style states verbatim: "No comments explaining *what* the
   code does. Comments only for non-obvious *why*." The current comment
   restates the mechanics (fetch, strip headers, inject base tag) rather than
   justifying a non-obvious decision.

5. **Reverses a documented architectural decision without reconciling it**
   (cross-doc: `CLAUDE.md`'s general iframe-embedding guidance vs.
   `add-epaper-subscriptions.architect.md`'s specific, reasoned rejection of
   this exact approach). Both docs remain checked in and now contradict each
   other. Whichever way this is resolved, one of them needs updating so future
   readers aren't left with two conflicting rationales for the same decision.

### Low

6. `fetch()` follows redirects by default (`index.ts:31`) — if the upstream
   ever redirects to a login/consent/paywall page, the proxy transparently
   serves that final page's HTML with the `<base>` tag pointing at wherever it
   landed, with no signal to the client that the origin changed.
7. No caching (`index.ts:23-47`) — every request re-fetches and re-transforms
   the upstream shell HTML from scratch. Wasteful on Pi-class hardware for a
   page whose shell markup changes rarely intraday.
8. `upstream.text()` decodes assuming UTF-8 default (`index.ts:35`) — a
   non-UTF-8 charset from either site (no explicit charset in their
   Content-Type) could produce mojibake with no error surfaced.

## Approval Status

**Rejected — returning to Developer.**

The three High findings mean this fix, as implemented, will not deliver a
working authenticated epaper view and introduces a new same-origin privilege
escalation. Before re-submitting, the developer should resolve the conflict
with `add-epaper-subscriptions.architect.md`'s prior rejection rationale —
either by finding a proxy design that actually forwards/maintains the
authenticated session (materially larger scope: cookie jar management,
Set-Cookie rewriting, full-site proxying per the original architect's own
assessment), or by escalating back to the user/PO that `--disable-web-security`
may need to stay, and that `CLAUDE.md`'s blanket policy statement needs
updating to reflect the concrete constraint discovered when this was actually
designed.
