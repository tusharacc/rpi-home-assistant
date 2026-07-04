import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, RectangleVertical, RectangleHorizontal, Moon, Power } from 'lucide-react'
import type { Plugin } from '../types'
import { triggerStandby } from '../../lib/idle-monitor'

type Orientation = 'portrait' | 'landscape'

interface SettingsResponse {
  orientation: Orientation
  uptimeSeconds: number
}

function isSettingsResponse(value: unknown): value is SettingsResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    (('orientation' in value) &&
      ((value as Record<string, unknown>).orientation === 'portrait' ||
        (value as Record<string, unknown>).orientation === 'landscape')) &&
    typeof (value as Record<string, unknown>).uptimeSeconds === 'number'
  )
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  height: '100%',
  padding: '2rem',
  gap: '1.5rem',
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-muted)',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
}

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'transparent',
  border: '1px solid var(--text-muted)',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.72rem',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  borderColor: 'var(--accent)',
  color: 'var(--accent)',
}

function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [shuttingDown, setShuttingDown] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then(res => res.json())
      .then((data: unknown) => {
        if (!cancelled && isSettingsResponse(data)) setSettings(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const rotate = (orientation: Orientation) => {
    fetch('/api/settings/rotate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orientation }),
    })
      .then(res => {
        if (res.ok) setSettings(prev => (prev ? { ...prev, orientation } : prev))
      })
      .catch(() => {})
  }

  const standbyNow = () => {
    triggerStandby()
  }

  const shutDown = () => {
    setShuttingDown(true)
    fetch('/api/system/shutdown', { method: 'POST' }).catch(() => {})
  }

  if (shuttingDown) {
    return (
      <div style={{ ...panelStyle, alignItems: 'center', justifyContent: 'center' }}>
        <Power size={32} strokeWidth={1} />
        <div style={{ fontSize: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Safe to switch off power.
        </div>
      </div>
    )
  }

  return (
    <div style={panelStyle}>
      <div>
        <div style={{ fontSize: '0.65rem', opacity: 0.7 }}>System Uptime</div>
        <div style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
          {settings ? formatUptime(settings.uptimeSeconds) : '—'}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: '0.5rem' }}>Orientation</div>
        <div style={rowStyle}>
          <button
            style={settings?.orientation === 'portrait' ? activeButtonStyle : buttonStyle}
            onClick={() => rotate('portrait')}
          >
            <RectangleVertical size={14} /> Portrait
          </button>
          <button
            style={settings?.orientation === 'landscape' ? activeButtonStyle : buttonStyle}
            onClick={() => rotate('landscape')}
          >
            <RectangleHorizontal size={14} /> Landscape
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: '0.5rem' }}>Power</div>
        <div style={rowStyle}>
          <button style={buttonStyle} onClick={standbyNow}>
            <Moon size={14} /> Standby Now
          </button>
          <button style={buttonStyle} onClick={shutDown}>
            <Power size={14} /> Shut Down
          </button>
        </div>
      </div>
    </div>
  )
}

export const settingsPlugin: Plugin = {
  id: 'settings',
  name: 'Settings',
  finePrint: 'Display & Power',
  icon: <SettingsIcon size={18} />,
  contentMode: 'react',
  render: () => <SettingsPanel />,
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
