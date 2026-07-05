import { useState } from 'react'
import { MoreVertical, EyeOff, Bell } from 'lucide-react'

interface SourceMenuProps {
  source: string
}

const menuButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  padding: '0.25rem',
  display: 'flex',
  alignItems: 'center',
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  right: 0,
  background: 'var(--bg-sidebar)',
  border: '1px solid var(--border-default)',
  borderRadius: '4px',
  padding: '0.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
  zIndex: 10,
  minWidth: '160px',
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.68rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  textAlign: 'left',
}

export function SourceMenu({ source }: SourceMenuProps) {
  const [open, setOpen] = useState(false)

  const hideSource = () => {
    fetch(`/api/news/sources/${encodeURIComponent(source)}/hide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }).catch(() => {})
    setOpen(false)
  }

  const followSource = () => {
    fetch(`/api/news/sources/${encodeURIComponent(source)}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: true }),
    }).catch(() => {})
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button style={menuButtonStyle} onClick={() => setOpen((v) => !v)} aria-label="Source options">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={popoverStyle}>
          <button style={itemStyle} onClick={followSource}>
            <Bell size={13} /> Follow Source
          </button>
          <button style={itemStyle} onClick={hideSource}>
            <EyeOff size={13} /> Hide Source
          </button>
        </div>
      )}
    </div>
  )
}
