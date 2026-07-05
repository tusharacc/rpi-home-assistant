# Reviewer — News Intelligence

Input: `artifacts/news-intelligence.developer.md`

## Scope Reviewed

Full diff for this feature: `packages/backend/src/news/*`,
`packages/backend/src/scripts/news-pipeline/*`, `packages/backend/src/routes/news.ts`,
`packages/backend/src/index.ts`, `packages/frontend/src/plugins/news/**`,
`scripts/deskos-news-pipeline.{service,timer}`, `scripts/install-services.sh`,
`.gitignore`. Checked against: PO acceptance criteria, architect design,
CLAUDE.md rules (no `any`, execFile-not-exec, loopback binding, credential
handling, comment policy), and general correctness/security.

## Findings

### Fixed during review

1. **[High] Classification would silently fail in production.**
   `classify.ts` set `response_format: { type: 'json_object' }` (which
   requires OpenAI to return a top-level JSON *object*) while the prompt
   asked for a top-level JSON *array* — a direct contract mismatch that would
   have made every real classification call fail or behave unpredictably,
   degrading the whole classify stage to permanently-unclassified without any
   visible error (caught by the existing try/catch fallback). Fixed by
   rewording the prompt to ask for `{"results": [...]}`, matching what
   `json_object` mode requires and what the parsing code already expected.

2. **[Medium] Radar item timestamp inconsistency.** In the pipeline
   orchestrator, when a discovered GitHub radar item had no `discoveredAt`
   (the common case for `trending-repo` items), both `index.ts` and
   `db.ts`'s `upsertRadarItem` independently called
   `new Date().toISOString()` as a fallback — two separate clock reads, so
   the timestamp used to compute `expiresAt` could diverge from the
   timestamp actually stored for the row. Fixed by resolving `discoveredAt`
   once in the orchestrator and passing the fully-resolved item through.

3. **[Low/simplification] Dead code in `useNewsQueue.ts`.** The hook
   exported a `reload()` callback that duplicated the mount `useEffect`'s
   fetch logic almost verbatim, but no component ever called it — the UI has
   no manual refresh affordance (correctly scoped out per the PO phase,
   since the pipeline runs automatically on a timer). Removed `reload` and
   consolidated to the single `useEffect` fetch, per YAGNI.

### Already clean by commit time

4. Checked for the dead-code pattern of an unused type guard left over from
   an earlier draft (`isArticleArray` in the frontend `types.ts`) — this had
   already been caught and removed during development, before the developer
   commit landed. No action needed here; noted only because it's the kind of
   thing this review pass specifically looked for.

### Filed as low-severity bugs (non-blocking)

5. **SourceMenu popover has no click-outside-to-close handler.**
   (`packages/frontend/src/plugins/news/OtherNews/SourceMenu.tsx`) — clicking
   elsewhere on the page doesn't dismiss the per-source overflow menu; the
   user has to click the same trigger button again. Minor UX polish, not a
   functional blocker for a touch-only kiosk.
6. **No "manage sources" view.** `GET /api/news/sources` exists on the
   backend but nothing in the frontend surfaces the current hidden/followed
   state — `SourceMenu` fires hide/follow actions blind. Already called out
   by the developer as an intentionally deferred follow-up, not a defect
   introduced by mistake.

Both filed as bugs via the framework (see below) rather than blocking this
feature — neither affects correctness of the discovery/ranking pipeline or
data integrity, which is where a review of this feature should concentrate.

## Architecture Adherence

- Schema matches the architect's design exactly (`articles`, `radar_items`,
  `source_prefs`, same columns/types).
- Pipeline stage separation (discover → dedup → paywall → classify → rank →
  expire) matches the designed sequencing.
- API surface matches the designed routes; all mutating routes validate
  input against a fixed enum before touching the DB, consistent with
  `settings.ts`'s existing pattern.
- No route shells out; backend stays loopback-only; no new listen/bind calls.
- `.env` handling: pipeline loads it via `dotenv` at the repo root only for
  its own standalone process (not the Express server, which doesn't need
  these keys) — consistent with "DeskOS itself never handles login flows"
  in spirit (this is API-key config, not credential/login handling) and
  keeps `.env` out of git (verified gitignored, `git status --ignored`
  confirms `packages/backend/data/` — including the SQLite DB and WAL
  files — is also ignored).
- Frontend swaps only the intended `news-other` placeholder; no registry.ts
  change, matching the "sidebar entries only added in registry.ts" rule
  (this feature adds none).

## Verdict

**Low issues only — advancing per the reviewer branching rule.** The one
high and one medium finding were fixed directly during this review pass
(both are now verified via `npm run build` — backend `tsc` and frontend
`tsc && vite build` both clean). The two remaining low-severity items are
filed as bugs (see `.dev-framework/bugs/bugs.json`) rather than blocking
hand-off, consistent with how prior features (`additional-features`) handled
low-severity findings.

Outstanding from the developer phase, not re-litigated here since they're
already tracked in `news-intelligence.developer.md`'s "Known Gaps": the
pipeline has not been run against live API credentials, and the UI has not
been visually verified in a browser (Claude-in-Chrome unavailable this
session). Recommend the Tester phase prioritize a live pipeline run and a
manual browser pass before Executor/PO-approval.
