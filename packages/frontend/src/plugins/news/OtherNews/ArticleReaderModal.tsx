import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { ArticleReaderRequest } from './types'
import styles from './ArticleReaderModal.module.css'

interface ArticleReaderModalProps {
  url: string
  title: string
  onClose: () => void
  onNavigate: (request: ArticleReaderRequest) => void
}

interface ExtractedArticle {
  title: string
  byline: string | null
  content: string
  textContent: string
}

function isExtractedArticle(value: unknown): value is ExtractedArticle {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).content === 'string' &&
    typeof (value as Record<string, unknown>).textContent === 'string'
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-content)',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  padding: '0.6rem',
  borderBottom: '1px solid var(--border-default)',
  flexShrink: 0,
}

const closeButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '0.5rem 1rem',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.7rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '2rem',
  display: 'flex',
  justifyContent: 'center',
}

const centeredStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  margin: 'auto',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textAlign: 'center',
}

const articleStyle: React.CSSProperties = {
  maxWidth: '640px',
  width: '100%',
  fontFamily: 'var(--font-ui)',
  color: 'var(--text-primary)',
}

const articleTitleStyle: React.CSSProperties = {
  fontSize: '1.4rem',
  lineHeight: 1.3,
  marginBottom: '0.5rem',
}

const articleBylineStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  marginBottom: '1.5rem',
}

export function ArticleReaderModal({ url, title, onClose, onNavigate }: ArticleReaderModalProps) {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [article, setArticle] = useState<ExtractedArticle | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setArticle(null)

    fetch(`/api/news/extract?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('extract failed'))))
      .then((data: unknown) => {
        if (cancelled) return
        if (isExtractedArticle(data)) {
          setArticle(data)
          setStatus('success')
        } else {
          setStatus('error')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [url])

  // Extracted content can contain raw <a href> links (e.g. arXiv's "View
  // PDF") with no target="_blank" -- left alone, that's a same-window
  // navigation that hijacks the entire kiosk window (no back/close button in
  // kiosk mode; confirmed live, only Alt+F4 got out of it, closing the whole
  // app). Re-route link clicks through the reader itself instead: re-extract
  // the linked URL and show it in this same modal. PDFs will just show the
  // "couldn't load a readable version" error state -- not ideal, but a closed
  // system, never a hijacked kiosk.
  function handleContentClick(event: MouseEvent<HTMLDivElement>): void {
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href || !/^https?:\/\//.test(href)) return
    event.preventDefault()
    onNavigate({ url: href, title: anchor.textContent?.trim() || title })
  }

  return (
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <button style={closeButtonStyle} onClick={onClose} aria-label="Close article">
          <X size={16} /> Close
        </button>
      </div>
      <div style={bodyStyle}>
        {status === 'loading' && <div style={centeredStateStyle}>Loading article…</div>}
        {status === 'error' && (
          <div style={centeredStateStyle}>
            <AlertTriangle size={28} strokeWidth={1} />
            Couldn&apos;t load a readable version of &quot;{title}&quot;.
            <br />
            The source site may block this kind of access.
          </div>
        )}
        {status === 'success' && article && (
          <article style={articleStyle}>
            <div style={articleTitleStyle}>{article.title || title}</div>
            {article.byline && <div style={articleBylineStyle}>{article.byline}</div>}
            {/* Sanitized server-side via sanitize-html before this ever reaches the client. */}
            <div
              className={styles.content}
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </article>
        )}
      </div>
    </div>
  )
}
