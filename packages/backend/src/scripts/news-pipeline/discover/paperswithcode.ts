import type { DiscoveredArticle } from '../../../news/types'

interface PwcPaper {
  title: string
  url_abs: string
  published: string | null
}

interface PwcResponse {
  results: PwcPaper[]
}

export async function discoverFromPapersWithCode(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()

  try {
    const res = await fetch('https://paperswithcode.com/api/v1/papers/?ordering=-published')
    if (!res.ok) {
      console.warn(`[news-pipeline] Papers with Code request failed: ${res.status}`)
      return []
    }
    const data = (await res.json()) as PwcResponse
    return (data.results ?? []).slice(0, 15).map((paper) => ({
      url: paper.url_abs,
      title: paper.title,
      source: 'paperswithcode',
      category: 'engineering' as const,
      topic: null,
      publishedAt: paper.published ?? now,
      discoveredAt: now,
    }))
  } catch (err) {
    console.warn('[news-pipeline] Papers with Code fetch failed:', err)
    return []
  }
}
