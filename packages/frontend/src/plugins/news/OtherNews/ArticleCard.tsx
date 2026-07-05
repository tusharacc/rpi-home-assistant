import { Bookmark, X, Check, ExternalLink, Lock } from 'lucide-react'
import type { Article } from './types'
import { SourceMenu } from './SourceMenu'

interface ArticleCardProps {
  article: Article
  onAction: (id: number, action: 'save' | 'ignore' | 'read') => void
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '1rem',
  borderBottom: '1px solid var(--border-subtle)',
  fontFamily: 'var(--font-ui)',
}

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '0.5rem',
}

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.62rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: 'var(--text-primary)',
  lineHeight: 1.35,
}

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.4rem',
  marginTop: '0.25rem',
}

const actionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

const savedButtonStyle: React.CSSProperties = {
  ...actionButtonStyle,
  color: 'var(--accent)',
  borderColor: 'var(--accent)',
}

function paywallLabel(status: Article['paywallStatus']): string | null {
  if (status === 'subscriber') return 'Subscriber'
  if (status === 'paywalled') return 'Paywalled'
  return null
}

export function ArticleCard({ article, onAction }: ArticleCardProps) {
  const paywall = paywallLabel(article.paywallStatus)

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <div style={metaRowStyle}>
          <span>{article.source}</span>
          {article.topic && <span>· {article.topic}</span>}
          {paywall && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Lock size={10} /> {paywall}
            </span>
          )}
        </div>
        <SourceMenu source={article.source} />
      </div>

      <div style={titleStyle}>{article.title}</div>

      <div style={actionsRowStyle}>
        <button
          style={article.status === 'saved' ? savedButtonStyle : actionButtonStyle}
          onClick={() => onAction(article.id, 'save')}
          aria-label="Save"
        >
          <Bookmark size={16} />
        </button>
        <button style={actionButtonStyle} onClick={() => onAction(article.id, 'read')} aria-label="Mark read">
          <Check size={16} />
        </button>
        <button style={actionButtonStyle} onClick={() => onAction(article.id, 'ignore')} aria-label="Ignore">
          <X size={16} />
        </button>
        <a
          style={{ ...actionButtonStyle, textDecoration: 'none', marginLeft: 'auto' }}
          href={article.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Open original"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </div>
  )
}
