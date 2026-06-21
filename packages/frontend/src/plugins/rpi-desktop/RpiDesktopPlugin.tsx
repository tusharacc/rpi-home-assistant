import { Monitor } from 'lucide-react'
import type { Plugin } from '../types'

export const rpiDesktopPlugin: Plugin = {
  id: 'rpi-desktop',
  name: 'Raspberry Pi Desktop',
  finePrint: 'Exit Kiosk',
  icon: <Monitor size={18} />,
  contentMode: 'react',
  render: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      flexDirection: 'column',
      gap: '10px',
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      fontSize: '0.72rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>
      <Monitor size={28} strokeWidth={1} />
      RPi Desktop integration — coming soon
    </div>
  ),
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
