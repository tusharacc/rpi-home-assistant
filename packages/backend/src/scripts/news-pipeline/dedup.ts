import type { DiscoveredArticle } from '../../news/types'
import { hashTitle, hashUrl } from '../../news/hash'
import { findArticleByTitleHash, findArticleByUrlHash, mergeIntoArticle } from '../../news/db'

export interface HashedArticle extends DiscoveredArticle {
  urlHash: string
  titleHash: string
  mergedSources: { source: string; url: string }[]
}

export function dedupAndMerge(discovered: DiscoveredArticle[]): HashedArticle[] {
  const seenUrlHashes = new Set<string>()
  const toInsert: HashedArticle[] = []
  const batchIndexByTitleHash = new Map<string, number>()

  for (const article of discovered) {
    const urlHash = hashUrl(article.url)
    if (seenUrlHashes.has(urlHash)) continue
    seenUrlHashes.add(urlHash)

    if (findArticleByUrlHash(urlHash)) continue

    const titleHash = hashTitle(article.title)

    const existingByTitle = findArticleByTitleHash(titleHash)
    if (existingByTitle && existingByTitle.source !== article.source) {
      mergeIntoArticle(existingByTitle.id, { source: article.source, url: article.url })
      continue
    }

    const batchIndex = batchIndexByTitleHash.get(titleHash)
    if (batchIndex !== undefined && toInsert[batchIndex].source !== article.source) {
      toInsert[batchIndex].mergedSources.push({ source: article.source, url: article.url })
      continue
    }

    batchIndexByTitleHash.set(titleHash, toInsert.length)
    toInsert.push({ ...article, urlHash, titleHash, mergedSources: [] })
  }

  return toInsert
}
