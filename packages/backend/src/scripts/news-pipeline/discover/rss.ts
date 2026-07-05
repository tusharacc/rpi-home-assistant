import Parser from 'rss-parser'
import type { DiscoveredArticle } from '../../../news/types'
import { RSS_FEEDS } from '../../../news/config'

const parser = new Parser()

export async function discoverFromRss(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()
  const articles: DiscoveredArticle[] = []

  for (const feed of RSS_FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url)
      for (const item of parsed.items ?? []) {
        if (!item.link || !item.title) continue
        articles.push({
          url: item.link,
          title: item.title,
          source: feed.source,
          category: feed.category,
          topic: null,
          publishedAt: item.isoDate ?? item.pubDate ?? now,
          discoveredAt: now,
        })
      }
    } catch (err) {
      console.warn(`[news-pipeline] RSS fetch failed for ${feed.source}:`, err)
    }
  }

  return articles
}
