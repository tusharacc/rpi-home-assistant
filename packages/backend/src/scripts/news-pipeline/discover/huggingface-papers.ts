import type { DiscoveredArticle } from '../../../news/types'
import { fetchWithTimeout } from '../../../news/fetch-with-timeout'

// paperswithcode.com's own API is gone — paperswithcode.com/api/v1/papers now
// 302-redirects to huggingface.co/papers, which absorbed the product. This
// hits HF's daily-papers API directly instead of following that redirect.
interface HfDailyPaper {
  publishedAt: string
  title: string
  paper: { id: string }
}

export async function discoverFromHuggingFacePapers(): Promise<DiscoveredArticle[]> {
  const now = new Date().toISOString()

  try {
    const res = await fetchWithTimeout('https://huggingface.co/api/daily_papers')
    if (!res.ok) {
      console.warn(`[news-pipeline] Hugging Face papers request failed: ${res.status}`)
      return []
    }
    const data = (await res.json()) as HfDailyPaper[]
    return data.slice(0, 15).map((entry) => ({
      url: `https://arxiv.org/abs/${entry.paper.id}`,
      title: entry.title,
      source: 'huggingface-papers',
      category: 'engineering' as const,
      topic: null,
      publishedAt: entry.publishedAt ?? now,
      discoveredAt: now,
    }))
  } catch (err) {
    console.warn('[news-pipeline] Hugging Face papers fetch failed:', err)
    return []
  }
}
