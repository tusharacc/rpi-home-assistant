import { expireStaleArticles, expireStaleRadarItems } from '../../news/db'

export function expireStale(): { articles: number; radarItems: number } {
  const now = new Date()
  return {
    articles: expireStaleArticles(now),
    radarItems: expireStaleRadarItems(now),
  }
}
