import { Home } from 'lucide-react'
import type { Plugin } from '../types'

export const homeAutomationPlugin: Plugin = {
  id: 'home-automation',
  name: 'Home Automation',
  finePrint: 'Devices & Scenes',
  icon: <Home size={18} />,
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
      <Home size={28} strokeWidth={1} />
      Home automation — coming later
    </div>
  ),
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
