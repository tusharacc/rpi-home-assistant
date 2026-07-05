import Parser from 'rss-parser'
import type { DiscoveredArticle } from '../../../news/types'

const parser = new Parser({ timeout: 15_000 })

const ARXIV_QUERY =
  'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG' +
  '&sortBy=submittedDate&sortOrder=descending&max_results=15'

export async function discoverFromArxiv(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()

  try {
    const parsed = await parser.parseURL(ARXIV_QUERY)
    return (parsed.items ?? [])
      .filter((item) => item.link && item.title)
      .map((item) => ({
        url: item.link as string,
        title: (item.title as string).replace(/\s+/g, ' ').trim(),
        source: 'arxiv',
        category: 'research' as const,
        topic: null,
        publishedAt: item.isoDate ?? item.pubDate ?? now,
        discoveredAt: now,
      }))
  } catch (err) {
    console.warn('[news-pipeline] arXiv fetch failed:', err)
    return []
  }
}
