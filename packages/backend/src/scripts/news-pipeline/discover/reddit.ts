import type { Category, DiscoveredArticle } from '../../../news/types'
import { REDDIT_COMMUNITIES } from '../../../news/config'
import { fetchWithTimeout } from '../../../news/fetch-with-timeout'

interface RedditPost {
  data: {
    title: string
    url: string
    created_utc: number
    stickied: boolean
    is_self: boolean
  }
}

interface RedditListing {
  data: { children: RedditPost[] }
}

const RESEARCH_SUBS = new Set(['MachineLearning', 'LocalLLaMA'])

function categoryFor(sub: string): Category {
  return RESEARCH_SUBS.has(sub) ? 'research' : 'engineering'
}

export async function discoverFromReddit(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()
  const articles: DiscoveredArticle[] = []

  for (const sub of REDDIT_COMMUNITIES) {
    try {
      const res = await fetchWithTimeout(`https://www.reddit.com/r/${sub}/top.json?limit=10&t=day`, {
        headers: { 'User-Agent': 'DeskOS-NewsPipeline/1.0' },
      })
      if (!res.ok) {
        console.warn(`[news-pipeline] Reddit fetch failed for r/${sub}: ${res.status}`)
        continue
      }
      const data = (await res.json()) as RedditListing
      for (const post of data.data?.children ?? []) {
        if (post.data.stickied || post.data.is_self) continue
        articles.push({
          url: post.data.url,
          title: post.data.title,
          source: `reddit:${sub}`,
          category: categoryFor(sub),
          topic: null,
          publishedAt: new Date(post.data.created_utc * 1000).toISOString(),
          discoveredAt: now,
        })
      }
    } catch (err) {
      console.warn(`[news-pipeline] Reddit fetch failed for r/${sub}:`, err)
    }
  }

  return articles
}
