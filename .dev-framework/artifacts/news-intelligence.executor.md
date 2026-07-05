# Executor — News Intelligence

Input: `artifacts/news-intelligence.tester.md`

This is a single-developer personal appliance (per CLAUDE.md: one Raspberry Pi,
no staging environment). "Deployment" means pulling this branch onto the Pi and
re-running the existing install script — there is no separate release pipeline.
I don't have SSH access to the physical Pi from this session, so the steps below
are a runbook for the user to execute, not something I can run myself; what I
*could* verify from here (build, live pipeline run, API surface) was already
covered in the tester phase.

## Deployment Steps

1. **Merge/pull this branch onto the Pi.**
   ```
   git fetch && git checkout main && git merge feature/news-intelligence
   ```
   (or however the user normally lands feature branches — this repo has no
   CI/PR-gate requirement per CLAUDE.md, just local git.)

2. **Install the new native dependency.** `better-sqlite3` is a native module
   — `npm install` at the repo root must run **on the Pi itself** (ARM), not
   copied over from the macOS dev build. This was flagged as an untested risk
   since the developer phase and is still untested on real Pi hardware.
   ```
   npm install
   ```

3. **Build.**
   ```
   npm run build
   ```
   This compiles both `packages/backend` (including
   `dist/scripts/news-pipeline/index.js`, what the new systemd timer actually
   runs) and `packages/frontend` into `dist/frontend`.

4. **Re-run the install script** to pick up the two new unit files
   (`deskos-news-pipeline.service`, `deskos-news-pipeline.timer`) — this is
   idempotent, safe to re-run even though `deskos-backend`/`deskos-kiosk` are
   already installed:
   ```
   ./scripts/install-services.sh
   ```
   This installs and `systemctl enable --now`s the new timer. First real
   trigger fires ~10 minutes after the *next* reboot (`OnBootSec=10min`), or
   after `OnUnitActiveSec=3d` from whenever it's enabled — whichever the user
   wants sooner, they can fire it manually (step 6).

5. **Restart the backend** so it picks up the new `/api/news*` routes:
   ```
   sudo systemctl restart deskos-backend
   ```

6. **Trigger one manual pipeline run** rather than waiting up to 3 days for
   the timer, so the reading queue isn't empty on first use:
   ```
   sudo systemctl start deskos-news-pipeline.service
   journalctl -u deskos-news-pipeline.service -f
   ```

## Verification

Run these on the Pi after the steps above:

- `systemctl status deskos-news-pipeline.timer` — should show `active
  (waiting)`, next trigger time populated.
- `journalctl -u deskos-news-pipeline.service --since "10 min ago"` — should
  show the same `[news-pipeline] ...` log lines verified live in the tester
  phase (discovered/inserted/upserted counts, no unhandled exceptions).
- `ls -la packages/backend/data/news.db` — file exists, non-zero size.
- `curl -s http://127.0.0.1:3001/api/news?mode=balanced | head -c 200` —
  returns real articles, not an empty array (once step 6 has completed).
- Open the kiosk display, navigate to News → Other News — confirm the
  reading queue renders instead of the old "coming next feature" placeholder,
  mode switcher and Queue/Radar tabs are interactive, tapping an article's
  Save/Ignore/Read/Open-Original icons works.
- **This last visual check is exactly the gap flagged in the tester
  report** (no browser automation available this session) — it should happen
  for real here, on the actual kiosk display, before considering this done.

## Rollback Plan

- **If the pipeline itself is broken** (bad data, runaway API costs, crash
  loop): `sudo systemctl disable --now deskos-news-pipeline.timer` stops
  future runs immediately without touching the rest of DeskOS (backend/kiosk
  services are independent units). The "Other News" UI will just show its
  empty state ("No articles yet...") rather than erroring.
- **If a bad run inserted bad data**: `rm packages/backend/data/news.db*`
  and restart `deskos-backend` — the schema is recreated from scratch on
  next access (`getDb()` in `news/db.ts` runs `CREATE TABLE IF NOT EXISTS`
  unconditionally), no migration needed since there's no prior schema to
  preserve.
- **If the feature needs to be fully reverted**: `git revert` the merge
  commit (or `git reset` if not yet pushed/shared) — this is a purely
  additive feature (new files + a few mount points in `index.ts` and the
  `news-other` sub-item's `render()`), so reverting doesn't touch any other
  plugin or route.
- Nothing here is a one-way door: no data migration, no destructive schema
  change to any existing table, no credentials created or rotated.

## Known Residual Risks (carried from tester phase, not resolved here)

- `better-sqlite3` native build on ARM — untested this session, must be
  confirmed at step 2 above.
- Reddit source permanently returns 0 articles without the user registering
  a Reddit API app (out of scope for this feature; documented, not blocking).
- Frontend UI still not visually verified in any browser this session — the
  Verification section above is where that finally happens, on real hardware.
