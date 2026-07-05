import type { PaywallStatus } from '../../news/types'
import type { HashedArticle } from './dedup'

const PAYWALLED_DOMAINS = [
  'wsj.com',
  'nytimes.com',
  'ft.com',
  'economist.com',
  'bloomberg.com',
  'thehindu.com',
  'livemint.com',
  'wired.com',
]

const FREE_DOMAINS = [
  'arxiv.org',
  'github.com',
  'reddit.com',
  'paperswithcode.com',
  'news.ycombinator.com',
]

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function classifyPaywall(url: string): PaywallStatus {
  const domain = domainOf(url)
  if (!domain) return 'unknown'
  if (PAYWALLED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'subscriber'
  if (FREE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return 'free'
  return 'unknown'
}

export interface PaywallTagged extends HashedArticle {
  paywallStatus: PaywallStatus
}

export function tagPaywallStatus(articles: HashedArticle[]): PaywallTagged[] {
  return articles.map((article) => ({ ...article, paywallStatus: classifyPaywall(article.url) }))
}
