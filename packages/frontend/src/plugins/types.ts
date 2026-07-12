import type { ReactNode } from 'react'

// 'external' items never render in ContentArea -- selecting one fires
// onActivate instead of becoming the active item (see SidebarItem).
// 'embedded-webview' items render via an Electron BrowserView layered on top
// of the content area (see ContentArea's embedded-webview branch and
// packages/electron/src/main.ts) -- window.deskosElectron is only present
// when running inside the Electron shell, not in a plain-browser dev preview.
export type ContentMode = 'react' | 'external' | 'embedded-webview'

export interface PluginSubItem {
  id: string
  label: string
  finePrint?: string
  icon?: ReactNode
  contentMode: ContentMode
  render?: () => ReactNode
  onActivate?: () => void
  embeddedUrl?: string
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
  embeddedUrl?: string
  activate: () => void
  deactivate: () => void
  refresh: () => void
}
