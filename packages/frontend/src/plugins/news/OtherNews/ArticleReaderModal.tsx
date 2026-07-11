import { X } from 'lucide-react'

interface ArticleReaderModalProps {
  url: string
  onClose: () => void
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

const frameStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  width: '100%',
  height: '100%',
}

export function ArticleReaderModal({ url, onClose }: ArticleReaderModalProps) {
  return (
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <button style={closeButtonStyle} onClick={onClose} aria-label="Close article">
          <X size={16} /> Close
        </button>
      </div>
      {/* No allow-popups-to-escape-sandbox: article pages must not be able to spawn
          another OS-level kiosk window with no chrome to close, which is the bug
          this modal exists to fix in the first place. */}
      <iframe
        src={url}
        title="Article reader"
        style={frameStyle}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  )
}
