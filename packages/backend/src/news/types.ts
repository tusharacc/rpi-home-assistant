export type Category = 'general' | 'engineering' | 'research'
export type Status = 'new' | 'shown' | 'saved' | 'ignored' | 'expired'
export type PaywallStatus = 'free' | 'subscriber' | 'paywalled' | 'unknown'
export type ReadingMode = 'balanced' | 'engineering' | 'ai-focus'
export type RadarKind = 'trending-repo' | 'release'
export type ArticleAction = 'save' | 'ignore' | 'read'

export interface Article {
  id: number
  url: string
  urlHash: string
  title: string
  titleHash: string
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

export type DiscoveredArticle = Omit<
  Article,
  | 'id'
  | 'urlHash'
  | 'titleHash'
  | 'status'
  | 'qualityScore'
  | 'clickbaitScore'
  | 'aiNoiseScore'
  | 'paywallStatus'
  | 'isOriginal'
  | 'mergedSources'
  | 'expiresAt'
> & { isOriginal?: boolean }

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

export type DiscoveredRadarItem = Omit<
  RadarItem,
  'id' | 'status' | 'expiresAt' | 'discoveredAt'
> & { discoveredAt?: string }

export interface SourcePref {
  source: string
  hidden: boolean
  followed: boolean
}
