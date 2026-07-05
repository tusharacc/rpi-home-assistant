# Architect Design — News Intelligence

Input: `artifacts/news-intelligence.po.md`

## Technical Approach

Two independent runtime pieces sharing one SQLite file:

1. **Pipeline script** (`packages/backend/src/scripts/news-pipeline/`) — the only
   writer. Runs standalone via `node dist/scripts/news-pipeline/index.js`, triggered
   by a new systemd timer every 2–3 days. Does discovery → dedup → classify →
   paywall-detect → rank → expire, in that order, then exits.
2. **Express backend** — reads the same SQLite file for `GET /api/news*`, and is
   the only writer for user-triggered mutations (save/ignore/read/hide/follow),
   since those come from the frontend via HTTP, not from the pipeline.

Both share a single `packages/backend/src/news/db.ts` module (better-sqlite3,
synchronous — matches the existing sync-fs style of `settings-store.ts`) so schema
and query logic aren't duplicated between the script and the route layer.

better-sqlite3 is a new dependency for `packages/backend` (none exists today).

## Component/Module Breakdown

```
packages/backend/src/
  news/
    db.ts                 # shared SQLite access: schema, migrations, CRUD
    types.ts              # Article, RadarItem, Source, Status, Category types
  scripts/news-pipeline/
    index.ts              # orchestrates the pipeline, single entry point
    discover/
      tavily.ts            # topic search queries -> raw articles
      rss.ts                # RSS feed + Google News topic feed fetch
      arxiv.ts
      paperswithcode.ts
      hackernews.ts
      reddit.ts
      github.ts             # trending repos + releases -> RadarItem shape
    dedup.ts               # url/title hash + cross-source merge
    classify.ts            # LLM call: topic tag, clickbait score, AI-noise score
    paywall.ts             # rule-based domain/heuristic classification
    rank.ts                # scoring per PO ranking factors
    expire.ts              # freshness-window + 7-day-unsaved-floor cleanup
  routes/
    news.ts                # GET /api/news, /api/news/radar, /api/news/sources,
                            # POST /api/news/:id/action, /api/news/sources/:name/*
```

Frontend:
```
packages/frontend/src/plugins/news/
  NewsPlugin.tsx           # existing file; news-other.render() replaced
  OtherNews/
    OtherNewsView.tsx      # top-level: mode switcher + tab (Queue | Radar)
    ReadingQueue.tsx        # article cards, filtered/sorted by mode
    ArticleCard.tsx         # icon-button row: save/ignore/read/open-original
    EngineeringRadar.tsx    # repos/releases/PWC/blogs section
    SourceMenu.tsx          # per-source overflow: hide/follow
    useNewsQueue.ts         # fetch hook against /api/news
```

## Data Model / Storage

SQLite file: `packages/backend/data/news.db` (extend `.gitignore`'s
`packages/backend/data/*.json` pattern to also cover `*.db`).

```sql
-- General reading queue: general news + arXiv + Papers with Code + eng blogs.
-- (PWC/blogs are article-shaped — title/url/summary — so they belong here,
-- not in radar_items, which is repo-shaped.)
CREATE TABLE articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  url             TEXT NOT NULL,
  url_hash        TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  title_hash      TEXT NOT NULL,
  source          TEXT NOT NULL,          -- e.g. 'tavily', 'rss:<feed>', 'arxiv', 'hn', 'reddit:<sub>'
  category        TEXT NOT NULL,          -- 'general' | 'engineering' | 'research'
  topic           TEXT,                   -- classifier output
  published_at    TEXT NOT NULL,          -- ISO 8601
  discovered_at   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',  -- new|shown|saved|ignored|expired
  quality_score   REAL NOT NULL DEFAULT 0,
  clickbait_score REAL,
  ai_noise_score  REAL,
  paywall_status  TEXT NOT NULL DEFAULT 'unknown', -- free|subscriber|paywalled|unknown
  is_original     INTEGER NOT NULL DEFAULT 0,
  merged_sources  TEXT,                   -- JSON array of {source,url} merged into this entry
  expires_at      TEXT NOT NULL
);

-- GitHub-shaped items: trending repos + releases. Not article-shaped, so kept
-- separate rather than forced into the articles table.
CREATE TABLE radar_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT NOT NULL,          -- 'trending-repo' | 'release'
  repo_full_name  TEXT NOT NULL,          -- 'owner/repo'
  url             TEXT NOT NULL,
  description     TEXT,
  language        TEXT,
  stars           INTEGER,
  release_tag     TEXT,                  -- only for kind='release'
  topic           TEXT,                  -- 'llm' | 'rag' | 'agentic-ai' | 'devops' | ...
  discovered_at   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',
  expires_at      TEXT NOT NULL,
  UNIQUE(kind, repo_full_name, release_tag)
);

-- Per-source hide/follow preference, keyed by the `source` string used above.
CREATE TABLE source_prefs (
  source   TEXT PRIMARY KEY,
  hidden   INTEGER NOT NULL DEFAULT 0,
  followed INTEGER NOT NULL DEFAULT 0
);
```

`expires_at` is precomputed at insert time from category (breaking 24h / general
7d / engineering 30d / research 90d), then `expire.ts` additionally force-expires
any **unsaved** row where `discovered_at` is older than 7 days — i.e. the 7-day
rule is a ceiling on top of the per-category window for anything not saved, never
a floor that shortens breaking-news' 24h. Rows with `status='saved'` are excluded
from all expiry regardless of age (never overwritten to `expired`).

## API Design

All under existing `app.use('/api', ...)` mount, loopback-only (unchanged).

- `GET /api/news?mode=balanced|engineering|ai-focus` — ranked queue, mode re-weights
  ordering only, never changes the underlying source set (per PO decision).
- `GET /api/news/radar` — `radar_items`, plus engineering-category `articles`
  (PWC/blogs) needed for the Radar tab.
- `GET /api/news/sources` — list of distinct sources with `hidden`/`followed` flags.
- `POST /api/news/:id/action` — body `{ action: 'save'|'ignore'|'read' }`, validated
  against a fixed enum before touching the DB (same input-validation posture as
  `settings.ts`'s `isOrientation` guard).
- `POST /api/news/sources/:name/hide` / `/follow` — toggles `source_prefs`; body
  `{ value: boolean }`.

No route ever calls `execFile`/shells out — this feature has no privileged-command
surface, unlike rotation/standby/shutdown.

## Integration Points

- **`NewsPlugin.tsx`**: `news-other.render()` swaps its placeholder JSX for
  `<OtherNewsView />`. No registry.ts change — sub-item already exists.
- **systemd**: new `scripts/deskos-news-pipeline.service` (`Type=oneshot`,
  `ExecStart=node .../dist/scripts/news-pipeline/index.js`) +
  `scripts/deskos-news-pipeline.timer` (`OnUnitActiveSec=3d` or a fixed
  `OnCalendar=` every 2–3 days), templated with the same
  `__DESKOS_USER__`/`__DESKOS_REPO_DIR__` placeholders and added to
  `install-services.sh`'s unit loop + a `systemctl enable --now
  deskos-news-pipeline.timer` line. This is a plain Node script (no Wayland/DISPLAY
  dependency), so none of the `XDG_RUNTIME_DIR` issues documented for
  `apply-orientation.sh`/`hdmi-power.sh` apply here.
- **`.env`**: pipeline script reads `TAVILY_API_KEY` and whichever LLM key is
  chosen, via the same repo-root `.env` (already gitignored this session).
- **`paths.ts`**: pipeline script's compiled location
  (`dist/scripts/news-pipeline/index.js`) is one level deeper than `dist/index.js`
  — reuse `DATA_DIR`/`REPO_ROOT` from `paths.ts` rather than recomputing
  `__dirname` depth, per the existing off-by-one warning in that file.

## Sequencing / Implementation Map

1. `news/types.ts` + `news/db.ts` (schema, migrations-on-boot, CRUD) — foundation
   everything else depends on.
2. `scripts/news-pipeline/discover/*.ts` — one source at a time, each returning a
   common intermediate shape before hitting `dedup.ts`.
3. `dedup.ts`, `paywall.ts`, `rank.ts` — rule-based stages, testable without any
   network/LLM calls.
4. `classify.ts` — LLM integration last among pipeline stages, since it's the one
   with real API cost; validate the rest of the pipeline with mocked classification
   first.
5. `expire.ts` + `scripts/news-pipeline/index.ts` orchestration.
6. `routes/news.ts` + wire into `index.ts`.
7. Frontend: `useNewsQueue.ts` → `ReadingQueue.tsx`/`ArticleCard.tsx` →
   `EngineeringRadar.tsx` → `SourceMenu.tsx` → `OtherNewsView.tsx` → swap into
   `NewsPlugin.tsx`.
8. systemd unit + timer files + `install-services.sh` update — last, since it only
   matters for Pi deployment, not local dev iteration.

## Risks & Trade-offs

- **Model IDs in `.env` look non-standard** (`gpt-5.5`, `gemini-3.1-pro-preview`,
  `claude-opus-4-6`) — none of these match a verified current model identifier.
  Developer must confirm the actual valid model ID/endpoint for whichever provider
  is chosen before wiring `classify.ts`; don't assume the `.env` value is
  necessarily correct or final.
- **Tavily credit budget is tight** (~1,000/mo, ~13 "full runs"). A 2–3 day cadence
  is ~10–15 runs/month — right at the edge. `tavily.ts` should cap query count per
  run (e.g. one query per tracked topic, not per keyword permutation) and the
  pipeline must degrade gracefully (skip Tavily, keep other sources) on 429/quota
  errors rather than aborting the whole run.
- **better-sqlite3 is a native module** — needs a rebuild step on the Pi (ARM)
  vs. macOS (dev). Confirm `npm run build`/install docs cover `npm rebuild` or
  equivalent on first Pi deploy; this is the kind of platform gap CLAUDE.md warns
  about (no platform-specific *code*, but native deps still need attention).
- **GitHub unauthenticated rate limit (60/hr)**: fine at 2–3 day cadence with a
  small watchlist per PO decision, but `github.ts` should fail soft per-repo, not
  abort the whole radar fetch, so a mid-run 429 doesn't blank the entire section.
- **Dedup/merge across sources without an LLM**: title-hash exact match will miss
  paraphrased headlines about the same story from two sources. Accepted for v1 per
  PO (no LLM-based merge in v1) — expect some near-duplicate leakage; note as a
  known v1 limitation, not a bug to chase.

## Open Questions for Developer

- Confirm actual valid model ID + pricing for the chosen classification LLM before
  implementation (see risk above).
- Decide exact `OnCalendar`/`OnUnitActiveSec` systemd timer expression for "every
  2–3 days" (e.g. `OnCalendar=*-*-1/3` vs `OnUnitActiveSec=60h`) — either is fine,
  pick whichever is simpler to reason about for missed-run catch-up behavior.
- Confirm whether Papers with Code has a stable public API/RSS to hit, or whether
  it needs to go through Tavily/scraping instead — original doc lists it as a
  distinct source but doesn't specify access method.
