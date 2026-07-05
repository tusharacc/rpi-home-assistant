# Developer Log — News Intelligence

Input: `artifacts/news-intelligence.architect.md`

## Implementation Notes

Followed the architect's sequencing map end to end:

1. **Shared foundation** (`packages/backend/src/news/`): `types.ts`, `hash.ts`
   (normalized URL/title hashing — strips UTM params and fragments before
   hashing so tracking-param variants of the same URL still dedup), `db.ts`
   (better-sqlite3, schema exactly as designed: `articles`, `radar_items`,
   `source_prefs`), `freshness.ts` (per-category expiry windows), `config.ts`
   (Tavily topics, RSS feeds, Reddit communities, GitHub topics).
2. **Pipeline stages** (`packages/backend/src/scripts/news-pipeline/`):
   `discover/{tavily,rss,arxiv,paperswithcode,hackernews,reddit,github}.ts`,
   `dedup.ts`, `paywall.ts`, `classify.ts`, `rank.ts`, `expire.ts`, `index.ts`
   orchestrator. All discovery calls use the global `fetch` (Node 20) rather
   than adding SDK dependencies, per the "personal appliance, keep it light"
   spirit of the codebase.
3. **API routes**: `packages/backend/src/routes/news.ts`, wired into `index.ts`
   the same way `settings`/`standby`/`system` routers are — fixed-enum
   validation before any DB write, matching `settings.ts`'s `isOrientation`
   pattern.
4. **Frontend**: `packages/frontend/src/plugins/news/OtherNews/` — the
   placeholder `news-other` sub-item in `NewsPlugin.tsx` now renders
   `<OtherNewsView />` (mode switcher + Queue/Radar tabs, matching the dark
   mono-font style used by `SettingsPlugin.tsx`, the only other plugin with a
   real implementation to reference).
5. **systemd**: `scripts/deskos-news-pipeline.service` (oneshot) +
   `scripts/deskos-news-pipeline.timer` (`OnBootSec=10min`,
   `OnUnitActiveSec=3d`, `Persistent=true` so a missed run while powered off
   catches up on next boot), added to `install-services.sh`'s templating loop.
   Only the `.timer` is `systemctl enable`d, not the oneshot `.service` — the
   `.service` file intentionally has no `[Install]` section, since the timer
   is what triggers it.

New deps added to `packages/backend`: `better-sqlite3`, `@types/better-sqlite3`,
`rss-parser`, `dotenv` (none of these existed before this feature — backend
previously had only `express`).

## Files Changed

- `packages/backend/src/news/{types,hash,db,freshness,config}.ts` (new)
- `packages/backend/src/scripts/news-pipeline/{index,dedup,paywall,classify,rank,expire}.ts` (new)
- `packages/backend/src/scripts/news-pipeline/discover/{tavily,rss,arxiv,paperswithcode,hackernews,reddit,github}.ts` (new)
- `packages/backend/src/routes/news.ts` (new)
- `packages/backend/src/index.ts` (mounted `newsRouter`)
- `packages/backend/package.json` (new deps + `news:pipeline` script)
- `packages/frontend/src/plugins/news/OtherNews/{types,api,useNewsQueue,OtherNewsView,ReadingQueue,EngineeringRadar,ArticleCard,SourceMenu}.tsx` (new)
- `packages/frontend/src/plugins/news/NewsPlugin.tsx` (placeholder swapped for `<OtherNewsView />`)
- `scripts/deskos-news-pipeline.service`, `scripts/deskos-news-pipeline.timer` (new)
- `scripts/install-services.sh` (installs/enables the new timer)
- `.gitignore` (added `packages/backend/data/*.db` and `*.db-*` for the WAL files)

## Deviations from Architect Design

- **"Breaking news: 24h" freshness tier dropped.** The schema only has
  `general`/`engineering`/`research` categories; there's no signal in v1 to
  distinguish "breaking" from general news at discovery time. Implemented
  general-news freshness as a flat 7-day window. Flagging rather than
  inventing an unvalidated breaking-news heuristic.
- **"Duplicate penalty" ranking factor**: not implemented as a separate
  penalty term. Exact-hash duplicates are merged away in `dedup.ts` before
  ranking ever sees them, so there's nothing left to penalize by the time
  `rank.ts` runs. Cross-source corroboration (an article merged from &gt;1
  source) gets a small positive bonus instead, since it typically signals a
  more notable story, not a lower-quality one.
- **`GET /api/news/sources` is implemented on the backend but not yet
  consumed by the frontend.** `SourceMenu.tsx` fires hide/follow POSTs blind
  (no indication of current hidden/followed state) rather than fetching and
  displaying the source list. Scoped out to keep the UI surface to what the
  PO/architect explicitly asked for (Hide/Follow actions); a "manage
  followed/hidden sources" view is a natural follow-up, not built here.

## Testing Performed

- `npm run build -w packages/backend` — clean (`tsc`).
- `npx tsc --noEmit -p packages/frontend` — clean.
- `npm run build` (both packages, full production build via `tsc && vite build`)
  — clean, bundle produced at `dist/frontend`.
- `bash -n scripts/install-services.sh` — syntax OK.
- Started both dev servers (`npm run dev`) against a fresh empty `news.db` and
  curled the new endpoints directly:
  - `GET /api/health` → `200 {"status":"ok",...}`
  - `GET /api/news?mode=balanced` → `200 {"mode":"balanced","articles":[]}`
  - `GET /api/news/radar` → `200 {"repos":[],"articles":[]}`
  - `GET /api/news/sources` → `200 []`
  All correct for an empty DB (pipeline hasn't run yet).
- **Not performed**: the pipeline script itself was not executed end-to-end
  against the live Tavily/OpenAI/GitHub APIs in `.env` — those are real
  credentials with limited free-tier budget (Tavily ~1,000 credits/month), and
  running it blind during development would burn real quota. Recommend the
  user run `npm run news:pipeline -w packages/backend` manually once, then
  inspect `packages/backend/data/news.db`, before relying on the systemd timer.
- **Not performed**: no visual/browser verification of the `OtherNewsView` UI
  (mode switcher, article cards, source overflow menu). The Claude-in-Chrome
  browser extension was unavailable in this session. TypeScript compiles
  clean and the component tree is structurally sound, but actual rendering,
  click behavior, and layout have not been visually confirmed — this should
  be done before considering the frontend done-done.

## Known Gaps / Follow-ups

- Pipeline has never been run live — first real run should be watched
  manually (see above) to confirm Tavily/OpenAI/GitHub calls behave as
  expected against real credentials, and to sanity-check the classification
  model ID (`gpt-5.5` in `.env` — flagged as non-standard back in the
  architect phase; confirm it's a valid/billable model before relying on it).
- No "manage sources" UI (see Deviations above).
- Near-duplicate detection is exact-hash only (title normalized/lowercased,
  but not fuzzy) — paraphrased headlines about the same story from two
  outlets will show as separate entries. Documented as a v1 limitation by the
  architect, not a bug.
- `better-sqlite3` is a native module — first Pi (ARM) install should confirm
  it builds/installs cleanly there; not tested on ARM in this session (dev
  environment is macOS).
- Browser-based UI verification (see Testing Performed) still outstanding.
