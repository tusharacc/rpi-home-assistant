import { TrendingUp } from 'lucide-react'
import type { Plugin } from '../types'

export const investmentsPlugin: Plugin = {
  id: 'investments',
  name: 'Investments',
  finePrint: 'Portfolio & Markets',
  icon: <TrendingUp size={18} />,
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
      <TrendingUp size={28} strokeWidth={1} />
      Investment dashboard — coming later
    </div>
  ),
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
