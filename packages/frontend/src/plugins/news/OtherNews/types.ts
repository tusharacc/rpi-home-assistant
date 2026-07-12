export type Category = 'general' | 'engineering' | 'research'
export type Status = 'new' | 'shown' | 'saved' | 'ignored' | 'expired'
export type PaywallStatus = 'free' | 'subscriber' | 'paywalled' | 'unknown'
export type ReadingMode = 'balanced' | 'engineering' | 'ai-focus'
export type RadarKind = 'trending-repo' | 'release'

export interface Article {
  id: number
  url: string
  title: string
  source: string
  category: Category
  topic: string | null
  publishedAt: string
  discoveredAt: string
  status: Status
  qualityScore: number
  clickbaitScore: number | null
  aiNoiseScore: number | null
  paywallStatus: PaywallStatus
  isOriginal: boolean
  mergedSources: { source: string; url: string }[]
  expiresAt: string
}

export interface RadarItem {
  id: number
  kind: RadarKind
  repoFullName: string
  url: string
  description: string | null
  language: string | null
  stars: number | null
  releaseTag: string | null
  topic: string | null
  discoveredAt: string
  status: Status
  expiresAt: string
}

export interface SourcePref {
  source: string
  hidden: boolean
  followed: boolean
}

export interface ArticleReaderRequest {
  url: string
  title: string
}
