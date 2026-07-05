# Dev Framework Checkpoint
**Date**: 2026-07-05
**Workspace**: (none)
**Phase**: n/a
**Branch**: main
**Workflow**: n/a

## Done this session
- feat(framework): new workspace news-intelligence
- feat(framework): news-intelligence PO complete, hand off to architect
- feat(framework): news-intelligence architect design complete
- feat(framework): news-intelligence architect complete, hand off to developer
- feat(news-intelligence): implement discovery pipeline, API, and reading queue UI
- feat(framework): news-intelligence developer complete, hand off to reviewer
- fix(news-intelligence): correct classification JSON contract and radar timestamp consistency
- fix(news-intelligence): fix live-testing findings — dead PWC API, missing timeouts, unresolvable Google News URLs
- feat(framework): news-intelligence executor complete, hand off to po-approval
- feat(framework): news-intelligence workflow complete
- Merge feature/news-intelligence into main
- archive(news-intelligence): feature workflow complete

## Where things stand
The `news-intelligence` feature ran the full dev-framework workflow (PO →
Architect → Developer → Reviewer → Tester → Executor → PO-approval),
merged into `main`, and was archived. It implements the News Intelligence
pipeline behind the existing "Other News" placeholder: discovery (Tavily,
arXiv, Hacker News, Hugging Face papers, GitHub trending/releases as a
separate Engineering Radar), dedup/merge, rule-based paywall detection, LLM
classification, ranking, and freshness-based expiry, running via a new
systemd timer every 3 days, with a reading queue UI (Balanced/Engineering/AI
Focus modes, Queue/Radar tabs, per-article actions, per-source hide/follow).
Live-tested against real Tavily/OpenAI/GitHub/HN/arXiv APIs (not just
mocked) — three real bugs were found and fixed this way (dead Papers with
Code API replaced with Hugging Face's, missing fetch timeouts that could
hang the pipeline forever, unresolvable Google News redirect URLs — Google
News feeds dropped in favor of Tavily per user decision). Reddit sources are
configured but blocked by Reddit's anti-scraping (403s); would need a
registered Reddit API app to fix, out of scope for now. `main` has been
pushed to `origin`. The archive commit itself (and this checkpoint) are new
local commits not yet confirmed pushed this session.

## Pending decisions
- [ ] Frontend UI (`OtherNewsView`, mode switcher, article cards, radar
      tabs) has never been visually verified in an actual browser —
      Claude-in-Chrome was unavailable all session. Should happen before
      trusting the UI is fully correct.
- [ ] Not yet deployed to the physical Pi — native `better-sqlite3` build on
      ARM is untested; runbook is ready in the archived
      `news-intelligence.executor.md` artifact.
- [ ] Two low-severity bugs open and unaddressed: BUG-003 (source overflow
      menu doesn't close on outside click), BUG-004 (no manage-sources view
      even though the backend route exists).
- [ ] Reddit discovery source is dead without a registered Reddit API app
      (client ID/secret) — user decision needed on whether to pursue this.

## Next action
Deploy to the Pi following the runbook in
`.dev-framework/artifacts/news-intelligence.executor.md` (tagged
`release/news-intelligence`) — install native deps on-device, run
`install-services.sh`, trigger one manual pipeline run, and do the still-
outstanding visual UI check on the actual kiosk display.
