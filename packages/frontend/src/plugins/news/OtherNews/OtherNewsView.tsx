import { useState } from 'react'
import type { ArticleReaderRequest, ReadingMode } from './types'
import { ReadingQueue } from './ReadingQueue'
import { EngineeringRadar } from './EngineeringRadar'
import { ArticleReaderModal } from './ArticleReaderModal'

type Tab = 'queue' | 'radar'

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
}

const controlsRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  padding: '0.75rem 1rem',
  borderBottom: '1px solid var(--border-default)',
  flexShrink: 0,
}

const segmentedStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
}

function segmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.75rem',
    background: active ? 'var(--bg-sidebar-active)' : 'transparent',
    border: '1px solid var(--border-default)',
    borderRadius: '4px',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.65rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }
}

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
}

const MODES: { value: ReadingMode; label: string }[] = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'ai-focus', label: 'AI Focus' },
]

export function OtherNewsView() {
  const [mode, setMode] = useState<ReadingMode>('balanced')
  const [tab, setTab] = useState<Tab>('queue')
  const [reader, setReader] = useState<ArticleReaderRequest | null>(null)

  return (
    <div style={containerStyle}>
      <div style={controlsRowStyle}>
        <div style={segmentedStyle}>
          {MODES.map((m) => (
            <button
              key={m.value}
              style={segmentButtonStyle(mode === m.value)}
              onClick={() => setMode(m.value)}
              disabled={tab === 'radar'}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={segmentedStyle}>
          <button style={segmentButtonStyle(tab === 'queue')} onClick={() => setTab('queue')}>
            Queue
          </button>
          <button style={segmentButtonStyle(tab === 'radar')} onClick={() => setTab('radar')}>
            Radar
          </button>
        </div>
      </div>
      <div style={scrollAreaStyle}>
        {tab === 'queue' ? (
          <ReadingQueue mode={mode} onOpenArticle={setReader} />
        ) : (
          <EngineeringRadar onOpenArticle={setReader} />
        )}
      </div>
      {reader && (
        <ArticleReaderModal url={reader.url} title={reader.title} onClose={() => setReader(null)} />
      )}
    </div>
  )
}
