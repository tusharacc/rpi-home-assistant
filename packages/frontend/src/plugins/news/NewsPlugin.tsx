import { Newspaper, BookOpen, Globe } from 'lucide-react'
import type { Plugin } from '../types'
import { OtherNewsView } from './OtherNews/OtherNewsView'

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
      iframeSrc: 'https://epaper.thehindu.com',
    },
    {
      id: 'news-livemint',
      label: 'LiveMint',
      finePrint: 'ePaper Edition',
      icon: <BookOpen size={14} />,
      contentMode: 'iframe',
      iframeSrc: 'https://epaper.livemint.com',
    },
    {
      id: 'news-other',
      label: 'Other News',
      finePrint: 'Aggregated Feed',
      icon: <Globe size={14} />,
      contentMode: 'react',
      render: () => <OtherNewsView />,
    },
  ],
  render: () => null,
  activate: () => {},
  deactivate: () => {},
  refresh: () => {},
}
