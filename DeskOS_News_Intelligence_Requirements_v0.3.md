# DeskOS Requirements v0.3

## News Intelligence & Knowledge Discovery

### Objective

DeskOS shall provide a curated reading experience instead of a
traditional RSS reader. The objective is to surface high-quality, fresh
and relevant content while minimizing duplicates, clickbait and AI
noise.

## Sources

### Newspapers

-   The Hindu (subscriber)
-   LiveMint (subscriber)
-   Wall Street Journal (subscriber)

### Public Sources

-   RSS feeds
-   Google News topic feeds
-   Official government releases
-   Company engineering blogs
-   arXiv
-   Papers with Code
-   Hacker News
-   Selected Reddit communities

### GitHub Discovery

Track: - AI repositories - LLMs - RAG - Agentic AI - Software
Engineering - DevOps/SRE - Observability

Treat GitHub as an Engineering Radar, not a news source.

## Pipeline

Discovery → Deduplication → Classification → Paywall Detection → Ranking
→ Reading Queue

## Storage

SQLite fields: - URL hash - Title hash - Source - Published date -
Discovery date - Topic - Status - Quality score

Status: - New - Shown - Saved - Ignored - Expired

Rules: - Never show duplicate articles. - Preserve bookmarked
articles. - Merge duplicate stories from multiple sources.

## Freshness

-   Breaking news: 24 hours
-   General news: 7 days
-   Engineering: 30 days
-   Research: 90 days

Unsaved articles older than 7 days shall expire automatically.

## Paywall

Classification: - Free - Subscriber Access - Paywalled - Unknown

No paywall bypass.

## Ranking

Use: - Source reputation - Freshness - Topic relevance - Original
reporting - Duplicate penalty - Clickbait penalty - AI-overexposure
penalty

## Reading Modes

Balanced Engineering AI Focus

## Engineering Radar

Separate feeds: - Trending GitHub repositories - New releases - AI
frameworks - Papers with Code - Engineering blogs

## User Actions

Save Ignore Mark Read Open Original Hide Source Follow Source

## Future

-   AI daily briefing
-   Weekly engineering digest
-   Personal recommendations
-   Company watch lists
