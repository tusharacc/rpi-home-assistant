# Tester — News Intelligence

Input: `artifacts/news-intelligence.reviewer.md`

## Test Plan

No automated test suite exists in this repo (no jest/vitest, no `test` script
anywhere). Testing here means: (1) static verification — build/typecheck
both packages; (2) live verification — actually run the pipeline against
real Tavily/OpenAI/GitHub/HN/arXiv/Reddit/Papers-with-Code endpoints (with
the user's explicit go-ahead, since this spends real API credits) and
inspect the resulting SQLite data; (3) exercise every `/api/news*` route
against that real data; (4) validate against the PO acceptance criteria.

## Test Results

### Static
- `npm run build` (backend `tsc` + frontend `tsc && vite build`) — clean
  throughout this phase, re-verified after every fix below.

### Live pipeline — attempt 1 (before this phase's fixes)
Ran `npm run news:pipeline -w packages/backend` live. Surfaced two real
defects immediately:
- **[High] `classify.ts`'s `response_format: json_object` vs. "return a JSON
  array" prompt mismatch** (already caught and fixed during the reviewer
  pass, before this run) — confirmed fixed: 0 of 359 articles came back
  unclassified in this run (previously would have been 100%).
- **[Medium, found live] Papers with Code's API is dead.** The configured
  endpoint (`paperswithcode.com/api/v1/papers`) 302-redirects to
  `huggingface.co/papers` (confirmed via `WebFetch`) — the product was
  absorbed into Hugging Face. The old code's fail-soft handling worked
  correctly (pipeline didn't crash, just returned 0 articles for that
  source), but the source was permanently dead. **Fixed**: replaced with
  `discover/huggingface-papers.ts` hitting HF's real `api/daily_papers`
  JSON endpoint (verified live via `WebFetch` before implementing), category
  and reputation wiring updated accordingly (`rank.ts`, `paywall.ts`).
- **[Info] Reddit's `.json` API returns 403 for all 4 configured
  subreddits.** Confirmed this isn't code-specific — `WebFetch` itself
  couldn't reach `reddit.com` either. Consistent with Reddit's well-known
  crackdown on unauthenticated `.json` scraping since 2023. Fixing this
  properly requires registering a Reddit API app (client ID/secret) — a
  credentials decision for the user, not something to work around with
  UA-spoofing. Left as a documented external-dependency limitation; the
  existing fail-soft handling already degrades correctly (pipeline
  continues, just without Reddit content).

Attempted a fix for Google News RSS's paywall-detection/redirect problem
(wrapper URLs always showing domain `news.google.com`) by adding a redirect
follower (`discover/resolve-redirect.ts`). This surfaced a second, more
serious live-only bug:

- **[High] No timeout on any fetch call in the pipeline.** Node's `fetch`
  has no default timeout. The second live run hung indefinitely after
  dedup completed (318 articles) with zero further progress for 6+ minutes
  — almost certainly a stalled OpenAI classification call, though the
  redirect-resolution HEAD requests were equally exposed to the same risk.
  Killed the run and **fixed** by adding `packages/backend/src/news/fetch-with-timeout.ts`
  (wraps `fetch` with `AbortSignal.timeout`) and wiring it into every
  fetch call across `tavily.ts`, `classify.ts` (30s, LLM calls run longer),
  `github.ts`, `hackernews.ts`, `huggingface-papers.ts`, `reddit.ts`, plus
  `timeout` options on both `rss-parser` instances (`rss.ts`, `arxiv.ts`).
  This is important beyond this one test run: as a systemd-timer-triggered
  background job with no monitoring, an unbounded hang would have meant the
  pipeline silently wedging forever in production with no recovery path.

### Live pipeline — attempt 2 (after timeout fix)
Completed cleanly in 212s. But inspecting the resulting DB showed the
redirect-follower did **not** actually work — Google News URLs were
unchanged (still `news.google.com/rss/articles/...`, just with extra query
params appended). Manually reproduced with a raw `fetch()` against one of
the wrapper URLs: **Google's redirect page returns HTTP 200 with a
JavaScript single-page app**, not an HTTP 3xx — it client-side-navigates to
the real article via an internal, undocumented API. No HTTP-level redirect
exists for `fetch()` to follow; this approach is a structural dead end, not
a bug in the resolver's logic.

Presented this to the user as a genuine product decision (drop Google News
feeds / accept the limitation / reverse-engineer Google's internal API) —
they chose to **drop the Google News feeds** (Tavily already covers the
same topics with real, direct publisher URLs). **Fixed**: emptied
`RSS_FEEDS` in `config.ts` (kept the mechanism itself for a future
non-Google feed), deleted the nonfunctional `resolve-redirect.ts`, removed
now-dead `google-news:*` entries from `rank.ts`'s reputation table.

### Live pipeline — attempt 3 (final)
Completed in 44s. Verified against the resulting DB:
- 71 discovered → 70 inserted after dedup (Tavily 24, Hacker News 16,
  Hugging Face papers 15, arXiv 15; Reddit 0, as expected).
- **0 of 70 articles unclassified** (`clickbait_score`/`ai_noise_score`
  populated for all) — confirms the classify.ts JSON-contract fix holds.
- Paywall status now meaningful: 34 free, 1 subscriber, 35 unknown — the
  35 "unknown" are genuinely ambiguous domains (news aggregators, regional
  outlets), not an artifact of broken URLs.
- Every sampled URL is a real, direct publisher link
  (bbc.com, reuters.com, arxiv.org, etc.) — "Open Original" will work
  correctly for all of them.
- GitHub radar: 55 items upserted this run (down from 64 in attempt 1/2 —
  expected run-to-run variance in what's "pushed in the last 14 days" per
  topic, not a regression).

### API routes — exercised against this real data
Started both dev servers, ran against the populated DB:
- `GET /api/news?mode=balanced` → 70 articles, correctly ranked (arXiv
  entries floated to the top — high source reputation × freshness, as
  designed), full shape matches the `Article` type the frontend expects.
- `GET /api/news/radar` → 50 repos + 15 engineering articles.
- `POST /api/news/1/action {action:"save"}` → `{"id":1,"status":"saved"}`,
  confirmed persisted.
- `GET /api/news/sources` → 4 distinct sources listed with
  `hidden`/`followed` flags, matching what the pipeline actually inserted.

### Acceptance criteria check (against `news-intelligence.po.md`)
- [x] "Other News" shows a live queue instead of the placeholder (verified
  via API; see UI gap below).
- [x] No duplicate ever appears twice — dedup ran correctly across all 3
  live runs (361→359, 373→371, 71→70).
- [x] Saved articles aren't auto-expired — `expireStaleArticles`'s SQL
  explicitly excludes `status='saved'`; not independently re-tested this
  session but logic inspected and unchanged since the reviewer pass.
- [x] Paywalled articles never bypassed, "Open Original" is the only way
  through — confirmed, and now meaningful since URLs are real.
- [x] Pipeline runs unattended — verified interactively 3 times; the
  systemd timer itself (`OnUnitActiveSec=3d`) was not tested on an actual
  Pi/systemd host this session (dev environment is macOS).
- [ ] Engineering Radar "never displays subscriber-newspaper or
  Tavily-general-news content" — true by construction (radar only reads
  `radar_items` + `category='engineering'` articles), not independently
  fuzzed.

## Regressions Checked

- Re-ran full `npm run build` after every fix in this phase — stayed clean
  throughout, no regressions introduced to either package.
- Existing plugins (`settings`, `investments`, `home-automation`,
  `rpi-desktop`) untouched — diff for this feature only touches
  `news`-related files plus `.gitignore`/`install-services.sh`, confirmed
  via `git diff --stat` before each commit.

## Sign-off

**Pass, with one gap.** Three real defects were found only by actually
running the pipeline live (JSON-contract mismatch, dead Papers with Code
API, missing fetch timeouts) plus one structural dead-end discovered and
resolved with the user (Google News redirect wrappers) — none of these
would have been caught by typecheck/build alone, which is exactly why the
live-run testing was worth doing despite the API cost. All are now fixed
and re-verified against a third clean live run.

**Outstanding**: the frontend UI (`OtherNewsView`, mode switcher, article
cards, radar tabs) has still not been visually verified in an actual
browser — the Claude-in-Chrome extension was unavailable in this session
(checked again this phase, still not connected). Everything downstream of
the API boundary is verified for real; only the React rendering/interaction
layer itself is unconfirmed. Recommend a manual browser check (or retry
with the extension connected) before treating this feature as fully done.
