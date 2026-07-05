import type { DiscoveredRadarItem } from '../../../news/types'
import { GITHUB_TOPICS } from '../../../news/config'
import { fetchWithTimeout } from '../../../news/fetch-with-timeout'

interface GhRepo {
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  stargazers_count: number
}

interface GhSearchResponse {
  items: GhRepo[]
}

interface GhRelease {
  tag_name: string
  html_url: string
  published_at: string
}

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchLatestRelease(fullName: string): Promise<GhRelease | null> {
  try {
    const res = await fetchWithTimeout(`https://api.github.com/repos/${fullName}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', ...authHeaders() },
    })
    if (!res.ok) return null
    return (await res.json()) as GhRelease
  } catch {
    return null
  }
}

export async function discoverFromGitHub(): Promise<DiscoveredRadarItem[]> {
  const items: DiscoveredRadarItem[] = []
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  for (const topic of GITHUB_TOPICS) {
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/search/repositories?q=topic:${encodeURIComponent(topic)}+pushed:>${since}&sort=stars&order=desc&per_page=5`,
        { headers: { Accept: 'application/vnd.github+json', ...authHeaders() } },
      )

      if (res.status === 403 || res.status === 429) {
        console.warn(`[news-pipeline] GitHub rate limit hit on topic "${topic}" — stopping GitHub discovery`)
        break
      }
      if (!res.ok) {
        console.warn(`[news-pipeline] GitHub search failed for topic "${topic}": ${res.status}`)
        continue
      }

      const data = (await res.json()) as GhSearchResponse
      for (const repo of data.items ?? []) {
        items.push({
          kind: 'trending-repo',
          repoFullName: repo.full_name,
          url: repo.html_url,
          description: repo.description,
          language: repo.language,
          stars: repo.stargazers_count,
          releaseTag: null,
          topic,
        })

        const release = await fetchLatestRelease(repo.full_name)
        if (release && new Date(release.published_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000) {
          items.push({
            kind: 'release',
            repoFullName: repo.full_name,
            url: release.html_url,
            description: null,
            language: repo.language,
            stars: repo.stargazers_count,
            releaseTag: release.tag_name,
            topic,
            discoveredAt: release.published_at,
          })
        }
      }
    } catch (err) {
      console.warn(`[news-pipeline] GitHub discovery failed for topic "${topic}":`, err)
    }
  }

  return items
}
