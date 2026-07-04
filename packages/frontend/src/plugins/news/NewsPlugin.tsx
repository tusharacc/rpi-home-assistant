import { Newspaper, BookOpen, Globe } from 'lucide-react'
import type { Plugin } from '../types'

export const newsPlugin: Plugin = {
  id: 'news',
  name: 'News',
  finePrint: 'Press & Media',
  icon: <Newspaper size={18} />,
  contentMode: 'react',
  subItems: [
    {
      id: 'news-the-hindu',
      label: 'The Hindu',
      finePrint: 'ePaper Edition',
      icon: <BookOpen size={14} />,
      contentMode: 'iframe',
      iframeSrc: '/api/proxy/epaper/thehindu',
    },
    {
      id: 'news-livemint',
      label: 'LiveMint',
      finePrint: 'ePaper Edition',
      icon: <BookOpen size={14} />,
      contentMode: 'iframe',
      iframeSrc: '/api/proxy/epaper/livemint',
    },
    {
      id: 'news-other',
      label: 'Other News',
      finePrint: 'Aggregated Feed',
      icon: <Globe size={14} />,
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
          <Globe size={28} strokeWidth={1} />
          Aggregated news — coming next feature
        </div>
      ),
    },
  ],
  render: () => null,
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
