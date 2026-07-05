import type { Classified } from './classify'

const SOURCE_REPUTATION: Record<string, number> = {
  tavily: 0.6,
  arxiv: 0.9,
  paperswithcode: 0.85,
  hackernews: 0.75,
  'google-news:india-business': 0.65,
  'google-news:world-tech': 0.65,
  'google-news:ai-policy': 0.65,
}

function reputationFor(source: string): number {
  if (source in SOURCE_REPUTATION) return SOURCE_REPUTATION[source]
  if (source.startsWith('reddit:')) return 0.55
  return 0.5
}

function freshnessScore(publishedAt: string): number {
  const hoursOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60)
  return Math.max(0, 1 - hoursOld / (24 * 7))
}

// Exact-hash duplicates are merged away in dedup.ts before ranking ever runs, so
// there is no separate "duplicate penalty" term here — a merged entry's
// mergedSources length is used as a small corroboration bonus instead.
export interface Ranked extends Classified {
  qualityScore: number
  isOriginal: boolean
}

export function rankArticle(article: Classified): Ranked {
  const isOriginal =
    article.mergedSources.length > 0 || article.source === 'arxiv' || article.source === 'paperswithcode'

  const reputation = reputationFor(article.source)
  const freshness = freshnessScore(article.publishedAt)
  const clickbaitPenalty = (article.clickbaitScore ?? 0) * 0.15
  const aiNoisePenalty = (article.aiNoiseScore ?? 0) * 0.15
  const corroborationBonus = Math.min(article.mergedSources.length, 3) * 0.03

  const qualityScore =
    reputation * 0.35 +
    freshness * 0.35 +
    (isOriginal ? 0.15 : 0) +
    corroborationBonus -
    clickbaitPenalty -
    aiNoisePenalty

  return { ...article, qualityScore, isOriginal }
}

export function rankArticles(articles: Classified[]): Ranked[] {
  return articles.map(rankArticle)
}
