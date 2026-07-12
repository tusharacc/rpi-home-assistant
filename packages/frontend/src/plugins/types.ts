import type { ReactNode } from 'react'

// 'external' items never render in ContentArea -- selecting one fires
// onActivate instead of becoming the active item (see SidebarItem).
export type ContentMode = 'react' | 'external'

export interface PluginSubItem {
  id: string
  label: string
  finePrint?: string
  icon?: ReactNode
  contentMode: ContentMode
  render?: () => ReactNode
  onActivate?: () => void
}

export interface Plugin {
  id: string
  name: string
  finePrint?: string
  icon: ReactNode
  contentMode: ContentMode
  disabled?: boolean
  subItems?: PluginSubItem[]
  render?: () => ReactNode
  onActivate?: () => void
  activate: () => void
  deactivate: () => void
  refresh: () => void
}
