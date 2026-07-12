import { useEffect, useState } from 'react'
import { Star, Tag, ExternalLink, Radar } from 'lucide-react'
import type { Article, ArticleReaderRequest, RadarItem } from './types'
import { ArticleCard } from './ArticleCard'
import { postArticleAction } from './api'

interface RadarResponse {
  repos: RadarItem[]
  articles: Article[]
}

function isRadarResponse(value: unknown): value is RadarResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).repos) &&
    Array.isArray((value as Record<string, unknown>).articles)
  )
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.68rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  padding: '1rem 1rem 0.5rem',
}

const repoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border-subtle)',
  textDecoration: 'none',
  color: 'var(--text-primary)',
}

const repoMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
}

function RepoRow({
  item,
  onOpenArticle,
}: {
  item: RadarItem
  onOpenArticle: (request: ArticleReaderRequest) => void
}) {
  return (
    <button
      style={{ ...repoRowStyle, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
      onClick={() => onOpenArticle({ url: item.url, title: item.repoFullName })}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem' }}>{item.repoFullName}</div>
        {item.description && (
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </div>
        )}
      </div>
      <div style={repoMetaStyle}>
        {item.kind === 'release' && item.releaseTag && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Tag size={12} /> {item.releaseTag}
          </span>
        )}
        {item.stars !== null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Star size={12} /> {item.stars}
          </span>
        )}
        <ExternalLink size={14} />
      </div>
    </button>
  )
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: '10px',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

export function EngineeringRadar({
  onOpenArticle,
}: {
  onOpenArticle: (request: ArticleReaderRequest) => void
}) {
  const [data, setData] = useState<RadarResponse | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/news/radar')
      .then((res) => res.json())
      .then((d: unknown) => {
        if (!cancelled && isRadarResponse(d)) setData(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const applyAction = (id: number, action: 'save' | 'ignore' | 'read') => {
    setData((prev) =>
      prev
        ? { ...prev, articles: action === 'ignore' ? prev.articles.filter((a) => a.id !== id) : prev.articles }
        : prev,
    )
    postArticleAction(id, action)
  }

  if (data && data.repos.length === 0 && data.articles.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <Radar size={28} strokeWidth={1} />
        Radar is empty — the pipeline runs every few days.
      </div>
    )
  }

  return (
    <div>
      {data && data.repos.length > 0 && (
        <>
          <div style={sectionHeadingStyle}>Trending Repos &amp; Releases</div>
          {data.repos.map((item) => (
            <RepoRow
              key={`${item.kind}-${item.repoFullName}-${item.releaseTag ?? ''}`}
              item={item}
              onOpenArticle={onOpenArticle}
            />
          ))}
        </>
      )}
      {data && data.articles.length > 0 && (
        <>
          <div style={sectionHeadingStyle}>Papers &amp; Engineering Blogs</div>
          {data.articles.map((article) => (
            <ArticleCard key={article.id} article={article} onAction={applyAction} onOpenArticle={onOpenArticle} />
          ))}
        </>
      )}
    </div>
  )
}
