import type { DiscoveredArticle } from '../../../news/types'
import { TAVILY_TOPICS } from '../../../news/config'
import { fetchWithTimeout } from '../../../news/fetch-with-timeout'

interface TavilyResult {
  title: string
  url: string
  published_date?: string
}

interface TavilyResponse {
  results: TavilyResult[]
}

export async function discoverFromTavily(apiKey: string | undefined): Promise<DiscoveredArticle[]> {
  if (!apiKey) {
    console.warn('[news-pipeline] TAVILY_API_KEY not set — skipping Tavily discovery')
    return []
  }

  const now = new Date().toISOString()
  const articles: DiscoveredArticle[] = []

  for (const topic of TAVILY_TOPICS) {
    try {
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: topic,
          topic: 'news',
          max_results: 5,
        }),
      })

      if (res.status === 429 || res.status === 401) {
        console.warn(`[news-pipeline] Tavily quota/auth issue (status ${res.status}) — stopping Tavily discovery`)
        break
      }
      if (!res.ok) {
        console.warn(`[news-pipeline] Tavily request failed for "${topic}": ${res.status}`)
        continue
      }

      const data = (await res.json()) as TavilyResponse
      for (const result of data.results ?? []) {
        articles.push({
          url: result.url,
          title: result.title,
          source: 'tavily',
          category: 'general',
          topic,
          publishedAt: result.published_date ?? now,
          discoveredAt: now,
        })
      }
    } catch (err) {
      console.warn(`[news-pipeline] Tavily discovery failed for "${topic}":`, err)
    }
  }

  return articles
}
