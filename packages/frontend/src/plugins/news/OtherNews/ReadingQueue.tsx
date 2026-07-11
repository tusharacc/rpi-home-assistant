import { Newspaper } from 'lucide-react'
import type { ReadingMode } from './types'
import { useNewsQueue } from './useNewsQueue'
import { ArticleCard } from './ArticleCard'

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

interface ReadingQueueProps {
  mode: ReadingMode
  onOpenArticle: (url: string) => void
}

export function ReadingQueue({ mode, onOpenArticle }: ReadingQueueProps) {
  const { articles, loading, applyAction } = useNewsQueue(mode)

  if (!loading && articles.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <Newspaper size={28} strokeWidth={1} />
        No articles yet — the pipeline runs every few days.
      </div>
    )
  }

  return (
    <div>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} onAction={applyAction} onOpenArticle={onOpenArticle} />
      ))}
    </div>
  )
}
