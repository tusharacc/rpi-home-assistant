import type { ReactNode } from 'react'

export type ContentMode = 'iframe' | 'react'

export interface PluginSubItem {
  id: string
  label: string
  finePrint?: string
  icon?: ReactNode
  contentMode: ContentMode
  iframeSrc?: string
  render?: () => ReactNode
}

export interface Plugin {
  id: string
  name: string
  finePrint?: string
  icon: ReactNode
  contentMode: ContentMode
  disabled?: boolean
  subItems?: PluginSubItem[]
  iframeSrc?: string
  render?: () => ReactNode
  activate: () => void
  deactivate: () => void
  refresh: () => void
}
