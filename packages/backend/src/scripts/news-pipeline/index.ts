import path from 'path'
import { config } from 'dotenv'
import { REPO_ROOT } from '../../paths'
import { insertArticle, upsertRadarItem } from '../../news/db'
import { computeExpiresAt, radarExpiresAt } from '../../news/freshness'
import { discoverFromTavily } from './discover/tavily'
import { discoverFromRss } from './discover/rss'
import { discoverFromArxiv } from './discover/arxiv'
import { discoverFromHuggingFacePapers } from './discover/huggingface-papers'
import { discoverFromHackerNews } from './discover/hackernews'
import { discoverFromReddit } from './discover/reddit'
import { discoverFromGitHub } from './discover/github'
import { dedupAndMerge } from './dedup'
import { tagPaywallStatus } from './paywall'
import { classifyArticles } from './classify'
import { rankArticles } from './rank'
import { expireStale } from './expire'

config({ path: path.join(REPO_ROOT, '.env') })

async function run(): Promise<void> {
  const started = Date.now()
  console.log('[news-pipeline] run started')

  const discovered = (
    await Promise.all([
      discoverFromTavily(process.env.TAVILY_API_KEY),
      discoverFromRss(),
      discoverFromArxiv(),
      discoverFromHuggingFacePapers(),
      discoverFromHackerNews(),
      discoverFromReddit(),
    ])
  ).flat()
  console.log(`[news-pipeline] discovered ${discovered.length} raw articles`)

  const deduped = dedupAndMerge(discovered)
  console.log(`[news-pipeline] ${deduped.length} new articles after dedup/merge`)

  const paywallTagged = tagPaywallStatus(deduped)
  const classified = await classifyArticles(paywallTagged)
  const ranked = rankArticles(classified)

  for (const article of ranked) {
    insertArticle({
      url: article.url,
      urlHash: article.urlHash,
      title: article.title,
      titleHash: article.titleHash,
      source: article.source,
      category: article.category,
      topic: article.topic,
      publishedAt: article.publishedAt,
      discoveredAt: article.discoveredAt,
      qualityScore: article.qualityScore,
      clickbaitScore: article.clickbaitScore,
      aiNoiseScore: article.aiNoiseScore,
      paywallStatus: article.paywallStatus,
      isOriginal: article.isOriginal,
      mergedSources: article.mergedSources,
      expiresAt: computeExpiresAt(article.category, article.discoveredAt),
    })
  }
  console.log(`[news-pipeline] inserted ${ranked.length} articles`)

  const radarItems = await discoverFromGitHub()
  for (const item of radarItems) {
    const discoveredAt = item.discoveredAt ?? new Date().toISOString()
    upsertRadarItem({ ...item, discoveredAt }, radarExpiresAt(discoveredAt))
  }
  console.log(`[news-pipeline] upserted ${radarItems.length} radar items`)

  const expired = expireStale()
  console.log(
    `[news-pipeline] expired ${expired.articles} articles, ${expired.radarItems} radar items`,
  )

  console.log(`[news-pipeline] run finished in ${Date.now() - started}ms`)
}

run().catch((err) => {
  console.error('[news-pipeline] run failed:', err)
  process.exitCode = 1
})
