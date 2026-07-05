# PO Requirements — News Intelligence

Source doc: `DeskOS_News_Intelligence_Requirements_v0.3.md` (repo root)

## Problem Statement

The existing `news` plugin (`packages/frontend/src/plugins/news/NewsPlugin.tsx`) has
a placeholder sub-item, `news-other` ("Other News" — "Aggregated news — coming next
feature"), sitting alongside the two subscriber ePaper iframes (The Hindu, LiveMint).
This feature builds the real thing behind that placeholder: a curated reading queue
that discovers, deduplicates, classifies, and ranks content from public sources and
GitHub — instead of a raw RSS firehose — and shows it in a touch-friendly card UI.

Subscriber newspapers (The Hindu, LiveMint, WSJ) are explicitly **out of scope** for
discovery/ranking. Their ePaper iframes stay as-is; this feature only replaces the
"Other News" placeholder.

## Scope Decisions (resolved during PO phase)

- **No subscriber-source scraping.** The Hindu/LiveMint/WSJ iframes are untouched.
  General news discovery instead comes from:
  - **Tavily search API** (key already in `.env`, free tier ~1,000 credits/mo)
    for topic-driven discovery of general/business/tech/policy news.
  - **RSS feeds** and **Google News topic feeds** as direct, no-credit-cost sources
    for continuously-followed feeds.
  - **arXiv, Papers with Code, Hacker News, Reddit** as direct-fetch/API sources
    (per original doc) for research/engineering content.
  - **GitHub** (trending repos, releases) as a separate "Engineering Radar", not
    treated as a news source.
- **News topic focus** (for Tavily queries + RSS selection): India + world
  business/tech/policy (economy/markets, global tech industry, AI policy/regulation,
  semiconductor/hardware industry, startup funding) — a business/tech-professional
  reading list, not a general front-page firehose.
- **Engineering Radar topics** (per original doc, unchanged): AI repos, LLMs, RAG,
  Agentic AI, Software Engineering, DevOps/SRE, Observability.
- **Pipeline runtime**: standalone Node/TS script under
  `packages/backend/src/scripts/`, compiled with the rest of the backend, invoked by
  a **systemd timer** (new unit, follows the `__DESKOS_USER__`/`install-services.sh`
  templating pattern already used for other services) running **every 2–3 days**
  to stay comfortably inside the Tavily free-tier budget. Writes to a SQLite file
  under `packages/backend/data/` (already gitignored via `packages/backend/data/*.json`
  — extend the ignore pattern to cover the `.db` file too).
- **Backend API**: new `/api/news` route(s) in `packages/backend/src/routes/`,
  read-only from the frontend's perspective (reads the SQLite reading queue; the
  pipeline script is the only writer). Article actions (Save/Ignore/Mark Read/Hide
  Source/Follow Source) are the only frontend-triggered writes, via the API.
- **Classification LLM**: whichever of the three already-configured keys
  (OpenAI gpt-5.5 / Gemini gemini-3.1-pro-preview / Claude opus-4-6) is cheapest/
  fastest for a lightweight per-article classification call — architect to compare
  and pick one, used **only** for topic classification + clickbait/AI-noise scoring.
  Dedup and paywall detection stay rule-based (hashing, known-domain lists) —
  no LLM-based duplicate merging in v1.
- **GitHub auth**: design against the unauthenticated API (60 req/hr) for v1, given
  the small watchlist and 2–3 day cadence. No `GITHUB_TOKEN` in `.env` yet — token
  can be added later if rate limits become a problem.
- **Frontend surface**: replace the `news-other` sub-item's placeholder `render()`
  in `NewsPlugin.tsx` with the real reading queue UI (`contentMode: 'react'` stays).
  No new plugin, no new registry entry.
- **Layout inside "Other News"**: a top segmented-control mode switcher
  (Balanced / Engineering / AI Focus) filtering the main reading queue list, plus a
  separate Engineering Radar tab/section (trending repos, new releases, AI
  frameworks, Papers with Code, engineering blogs) — not interleaved with the queue.
- **Article actions**: icon-button row per card (save/bookmark, ignore/X, mark
  read/check, open original/external-link) — touch-friendly, no swipe gestures
  (input is pointing-device only, no confirmed touch/swipe support per CLAUDE.md).
  Hide Source / Follow Source live in a per-source overflow menu, not on every card.
- **`.env` is now gitignored** (was untracked and unprotected before this feature
  started — fixed as a prerequisite, see repo `.gitignore`).

## User Stories

1. As the DeskOS user, I want a single "Other News" view with a curated, deduplicated
   reading queue so I don't have to manually check RSS feeds/Google News/HN/Reddit.
2. As the user, I want to switch between Balanced / Engineering / AI Focus modes so
   the queue re-weights toward what I care about right now.
3. As the user, I want a separate Engineering Radar (GitHub trending, releases,
   Papers with Code, eng blogs) so I can track the ecosystem without it crowding out
   general news.
4. As the user, I want to Save/Ignore/Mark Read/Open Original per article, and
   Hide/Follow a source, using touch-friendly controls (no keyboard).
5. As the user, I never want to see the same story twice, and I never want a
   saved/bookmarked article to disappear.
6. As the user, I want stale content to clear itself out automatically based on
   freshness rules per content type, so the queue doesn't fill with dead articles.

## Functional Requirements

- **Discovery**: Tavily topic search + RSS/Google News feeds + arXiv + Papers with
  Code + Hacker News + selected Reddit communities + GitHub (trending repos, new
  releases) per the source list above.
- **Deduplication**: URL hash + title hash; merge duplicate stories reported by
  multiple sources into a single queue entry (rule-based, no LLM).
- **Classification**: topic tagging + clickbait detection + AI-overexposure
  detection via the chosen LLM.
- **Paywall detection**: classify each article Free / Subscriber Access /
  Paywalled / Unknown. No paywall bypass of any kind.
- **Ranking**: source reputation, freshness, topic relevance, original-reporting
  bonus, duplicate penalty, clickbait penalty, AI-overexposure penalty.
- **Freshness/expiry**: Breaking news 24h, general news 7d, engineering 30d,
  research 90d. Unsaved articles older than 7 days auto-expire regardless of
  category (per original doc — architect should confirm this is a floor on top of
  the per-category windows, not a contradiction, since it's shorter than the
  engineering/research windows).
- **Reading modes**: Balanced / Engineering / AI Focus — re-weight ranking, don't
  change the source set.
- **Engineering Radar**: separate section — trending GitHub repos, new releases,
  AI frameworks, Papers with Code, engineering blogs.
- **User actions**: Save, Ignore, Mark Read, Open Original, Hide Source, Follow
  Source — all persisted to SQLite via `/api/news` routes.
- **Storage**: SQLite with fields — URL hash, title hash, source, published date,
  discovery date, topic, status (New/Shown/Saved/Ignored/Expired), quality score.

## Non-Functional Requirements

- Runs within Tavily's free-tier budget (~1,000 credits/mo) at a 2–3 day cadence —
  pipeline script must cap query volume per run accordingly.
- Backend stays loopback-only (`127.0.0.1`); new `/api/news` routes follow the
  existing auth/validation posture of other mutating routes (settings/standby).
- No credential/token ever committed; `GITHUB_TOKEN` (if added later) and existing
  keys stay in `.env`, which is now gitignored.
- Must work identically on macOS (dev) and Raspberry Pi OS (deploy) — no
  platform-specific code in the pipeline script.
- Touch/pointer-only UI — no text input controls without an on-screen keyboard
  component (none planned for this feature).

## Acceptance Criteria

- [ ] "Other News" sub-item shows a live reading queue instead of the placeholder.
- [ ] No duplicate article ever appears twice in the queue (verified across at
      least 2 overlapping sources reporting the same story).
- [ ] Saved/bookmarked articles are never auto-expired.
- [ ] Switching reading mode changes article ordering without a full page reload
      being required to feel responsive.
- [ ] Engineering Radar is reachable as its own section and never displays
      subscriber-newspaper or Tavily-general-news content.
- [ ] Paywalled articles are labeled, never bypassed, and remain clickable via
      "Open Original" only.
- [ ] Pipeline systemd timer runs unattended every 2–3 days without manual
      intervention and without exceeding Tavily free-tier credits in a month.
- [ ] `.env` stays out of git across this entire feature's commits.

## Edge Cases

- Tavily monthly credit exhaustion mid-cycle — pipeline should degrade gracefully
  (skip Tavily-sourced queries, keep RSS/direct sources running) rather than error
  out the whole run.
- GitHub unauthenticated rate limit (60/hr) hit during a run — radar section should
  show whatever it fetched before the limit, not fail the entire pipeline run.
- A story updates after initial discovery (developing story) — dedup logic must
  decide update-in-place vs. new entry (architect to define using published date +
  title-hash proximity).
- Classification LLM call fails/times out for an article — article should still
  enter the queue, unclassified/lowest-confidence-ranked, not be dropped silently.
- User hides a source that a saved/bookmarked article came from — the bookmark
  must still be preserved per the "preserve bookmarked articles" rule.

## Dependencies

- `TAVILY_API_KEY` (present in `.env`).
- One of `OPENAI_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` (present in
  `.env`) — architect to pick based on cost/latency for the classification task.
- New backend dependency: a SQLite driver (e.g. `better-sqlite3`) — not yet in
  `packages/backend/package.json`.
- New systemd timer + service unit (follows `install-services.sh` templating
  pattern) — not yet created.
- `GITHUB_TOKEN` — not required for v1, may be added later.
