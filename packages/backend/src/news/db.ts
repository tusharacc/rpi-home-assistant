import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { DATA_DIR } from '../paths'
import type {
  Article,
  Category,
  DiscoveredRadarItem,
  PaywallStatus,
  RadarItem,
  ReadingMode,
  SourcePref,
  Status,
} from './types'

const DB_PATH = path.join(DATA_DIR, 'news.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      url             TEXT NOT NULL,
      url_hash        TEXT NOT NULL UNIQUE,
      title           TEXT NOT NULL,
      title_hash      TEXT NOT NULL,
      source          TEXT NOT NULL,
      category        TEXT NOT NULL,
      topic           TEXT,
      published_at    TEXT NOT NULL,
      discovered_at   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'new',
      quality_score   REAL NOT NULL DEFAULT 0,
      clickbait_score REAL,
      ai_noise_score  REAL,
      paywall_status  TEXT NOT NULL DEFAULT 'unknown',
      is_original     INTEGER NOT NULL DEFAULT 0,
      merged_sources  TEXT NOT NULL DEFAULT '[]',
      expires_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_articles_title_hash ON articles(title_hash);
    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);

    CREATE TABLE IF NOT EXISTS radar_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      kind            TEXT NOT NULL,
      repo_full_name  TEXT NOT NULL,
      url             TEXT NOT NULL,
      description     TEXT,
      language        TEXT,
      stars           INTEGER,
      release_tag     TEXT,
      topic           TEXT,
      discovered_at   TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'new',
      expires_at      TEXT NOT NULL,
      UNIQUE(kind, repo_full_name, release_tag)
    );

    CREATE TABLE IF NOT EXISTS source_prefs (
      source   TEXT PRIMARY KEY,
      hidden   INTEGER NOT NULL DEFAULT 0,
      followed INTEGER NOT NULL DEFAULT 0
    );
  `)
  return db
}

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as number,
    url: row.url as string,
    urlHash: row.url_hash as string,
    title: row.title as string,
    titleHash: row.title_hash as string,
    source: row.source as string,
    category: row.category as Category,
    topic: row.topic as string | null,
    publishedAt: row.published_at as string,
    discoveredAt: row.discovered_at as string,
    status: row.status as Status,
    qualityScore: row.quality_score as number,
    clickbaitScore: row.clickbait_score as number | null,
    aiNoiseScore: row.ai_noise_score as number | null,
    paywallStatus: row.paywall_status as PaywallStatus,
    isOriginal: Boolean(row.is_original),
    mergedSources: JSON.parse((row.merged_sources as string) ?? '[]'),
    expiresAt: row.expires_at as string,
  }
}

function rowToRadarItem(row: Record<string, unknown>): RadarItem {
  return {
    id: row.id as number,
    kind: row.kind as RadarItem['kind'],
    repoFullName: row.repo_full_name as string,
    url: row.url as string,
    description: row.description as string | null,
    language: row.language as string | null,
    stars: row.stars as number | null,
    releaseTag: row.release_tag as string | null,
    topic: row.topic as string | null,
    discoveredAt: row.discovered_at as string,
    status: row.status as Status,
    expiresAt: row.expires_at as string,
  }
}

export function findArticleByUrlHash(urlHash: string): Article | undefined {
  const row = getDb()
    .prepare('SELECT * FROM articles WHERE url_hash = ?')
    .get(urlHash) as Record<string, unknown> | undefined
  return row ? rowToArticle(row) : undefined
}

// Confines /api/news/extract to URLs we already discovered and stored, rather
// than being an open URL-fetch proxy an attacker could point at internal hosts.
export function isKnownArticleUrl(url: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM articles WHERE url = ?
       UNION SELECT 1 FROM radar_items WHERE url = ?`,
    )
    .get(url, url)
  return row !== undefined
}

export function findArticleByTitleHash(titleHash: string): Article | undefined {
  const row = getDb()
    .prepare("SELECT * FROM articles WHERE title_hash = ? AND status != 'expired'")
    .get(titleHash) as Record<string, unknown> | undefined
  return row ? rowToArticle(row) : undefined
}

export interface NewArticleInput {
  url: string
  urlHash: string
  title: string
  titleHash: string
  source: string
  category: Category
  topic: string | null
  publishedAt: string
  discoveredAt: string
  qualityScore: number
  clickbaitScore: number | null
  aiNoiseScore: number | null
  paywallStatus: PaywallStatus
  isOriginal: boolean
  mergedSources: { source: string; url: string }[]
  expiresAt: string
}

export function insertArticle(input: NewArticleInput): void {
  getDb()
    .prepare(
      `INSERT INTO articles
        (url, url_hash, title, title_hash, source, category, topic, published_at,
         discovered_at, quality_score, clickbait_score, ai_noise_score,
         paywall_status, is_original, merged_sources, expires_at)
       VALUES
        (@url, @urlHash, @title, @titleHash, @source, @category, @topic, @publishedAt,
         @discoveredAt, @qualityScore, @clickbaitScore, @aiNoiseScore,
         @paywallStatus, @isOriginal, @mergedSources, @expiresAt)`,
    )
    .run({
      ...input,
      isOriginal: input.isOriginal ? 1 : 0,
      mergedSources: JSON.stringify(input.mergedSources),
    })
}

export function mergeIntoArticle(
  existingId: number,
  merged: { source: string; url: string },
): void {
  const existing = getDb()
    .prepare('SELECT merged_sources FROM articles WHERE id = ?')
    .get(existingId) as { merged_sources: string } | undefined
  if (!existing) return
  const list = JSON.parse(existing.merged_sources) as { source: string; url: string }[]
  if (list.some((m) => m.source === merged.source)) return
  list.push(merged)
  getDb()
    .prepare('UPDATE articles SET merged_sources = ? WHERE id = ?')
    .run(JSON.stringify(list), existingId)
}

function modeWeight(mode: ReadingMode, category: Category): number {
  if (mode === 'engineering') return category === 'engineering' ? 1.5 : category === 'research' ? 1.2 : 0.8
  if (mode === 'ai-focus') return category === 'research' ? 1.4 : 1
  return 1
}

export function getQueue(mode: ReadingMode): Article[] {
  const rows = getDb()
    .prepare(
      `SELECT a.* FROM articles a
       LEFT JOIN source_prefs sp ON sp.source = a.source
       WHERE a.status IN ('new', 'shown', 'saved')
         AND COALESCE(sp.hidden, 0) = 0
       ORDER BY a.quality_score DESC`,
    )
    .all() as Record<string, unknown>[]

  return rows
    .map(rowToArticle)
    .map((article) => ({ article, weight: article.qualityScore * modeWeight(mode, article.category) }))
    .sort((a, b) => b.weight - a.weight)
    .map(({ article }) => article)
}

export function getEngineeringArticles(): Article[] {
  const rows = getDb()
    .prepare(
      `SELECT a.* FROM articles a
       LEFT JOIN source_prefs sp ON sp.source = a.source
       WHERE a.category = 'engineering'
         AND a.status IN ('new', 'shown', 'saved')
         AND COALESCE(sp.hidden, 0) = 0
       ORDER BY a.quality_score DESC`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToArticle)
}

export function getRadarItems(): RadarItem[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM radar_items WHERE status IN ('new', 'shown')
       ORDER BY discovered_at DESC`,
    )
    .all() as Record<string, unknown>[]
  return rows.map(rowToRadarItem)
}

export function upsertRadarItem(item: DiscoveredRadarItem, expiresAt: string): void {
  const discoveredAt = item.discoveredAt ?? new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO radar_items
        (kind, repo_full_name, url, description, language, stars, release_tag,
         topic, discovered_at, expires_at)
       VALUES
        (@kind, @repoFullName, @url, @description, @language, @stars, @releaseTag,
         @topic, @discoveredAt, @expiresAt)
       ON CONFLICT(kind, repo_full_name, release_tag) DO UPDATE SET
         stars = excluded.stars,
         description = excluded.description,
         expires_at = excluded.expires_at`,
    )
    .run({ ...item, discoveredAt, expiresAt })
}

const VALID_STATUSES: Status[] = ['new', 'shown', 'saved', 'ignored', 'expired']

export function setArticleStatus(id: number, status: Status): boolean {
  if (!VALID_STATUSES.includes(status)) return false
  const result = getDb().prepare('UPDATE articles SET status = ? WHERE id = ?').run(status, id)
  return result.changes > 0
}

export function expireStaleArticles(now: Date): number {
  const nowIso = now.toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const result = getDb()
    .prepare(
      `UPDATE articles SET status = 'expired'
       WHERE status != 'saved'
         AND status != 'expired'
         AND (expires_at <= @now OR discovered_at <= @sevenDaysAgo)`,
    )
    .run({ now: nowIso, sevenDaysAgo })
  return result.changes
}

export function expireStaleRadarItems(now: Date): number {
  const result = getDb()
    .prepare(`UPDATE radar_items SET status = 'expired' WHERE status != 'expired' AND expires_at <= ?`)
    .run(now.toISOString())
  return result.changes
}

export function getSourcePrefs(): SourcePref[] {
  const rows = getDb().prepare('SELECT * FROM source_prefs').all() as Record<string, unknown>[]
  const distinctSources = getDb()
    .prepare('SELECT DISTINCT source FROM articles')
    .all() as { source: string }[]

  const prefsBySource = new Map(
    rows.map((r) => [
      r.source as string,
      { source: r.source as string, hidden: Boolean(r.hidden), followed: Boolean(r.followed) },
    ]),
  )

  for (const { source } of distinctSources) {
    if (!prefsBySource.has(source)) {
      prefsBySource.set(source, { source, hidden: false, followed: false })
    }
  }

  return [...prefsBySource.values()]
}

export function setSourceHidden(source: string, hidden: boolean): void {
  getDb()
    .prepare(
      `INSERT INTO source_prefs (source, hidden, followed) VALUES (?, ?, 0)
       ON CONFLICT(source) DO UPDATE SET hidden = excluded.hidden`,
    )
    .run(source, hidden ? 1 : 0)
}

export function setSourceFollowed(source: string, followed: boolean): void {
  getDb()
    .prepare(
      `INSERT INTO source_prefs (source, hidden, followed) VALUES (?, 0, ?)
       ON CONFLICT(source) DO UPDATE SET followed = excluded.followed`,
    )
    .run(source, followed ? 1 : 0)
}
