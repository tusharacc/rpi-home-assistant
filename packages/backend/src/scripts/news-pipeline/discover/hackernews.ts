import type { DiscoveredArticle } from '../../../news/types'
import { HN_MIN_POINTS } from '../../../news/config'
import { fetchWithTimeout } from '../../../news/fetch-with-timeout'

interface HnItem {
  title?: string
  url?: string
  score?: number
  time?: number
  type?: string
}

export async function discoverFromHackerNews(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()

  try {
    const topRes = await fetchWithTimeout('https://hacker-news.firebaseio.com/v0/topstories.json')
    if (!topRes.ok) return []
    const ids = ((await topRes.json()) as number[]).slice(0, 30)

    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetchWithTimeout(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
          if (!res.ok) return null
          return (await res.json()) as HnItem
        } catch {
          return null
        }
      }),
    )

    return items
      .filter(
        (item): item is HnItem =>
          item !== null &&
          item.type === 'story' &&
          !!item.url &&
          !!item.title &&
          (item.score ?? 0) >= HN_MIN_POINTS,
      )
      .map((item) => ({
        url: item.url as string,
        title: item.title as string,
        source: 'hackernews',
        category: 'general' as const,
        topic: null,
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : now,
        discoveredAt: now,
      }))
  } catch (err) {
    console.warn('[news-pipeline] Hacker News fetch failed:', err)
    return []
  }
}
