import { ChevronRight } from 'lucide-react'
import type { Plugin } from '../../plugins/types'
import { SidebarItem } from './SidebarItem'
import styles from './Sidebar.module.css'

interface SidebarWidgetProps {
  plugin: Plugin
  activeItemId: string | null
  isExpanded: boolean
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}

export function SidebarWidget({ plugin, activeItemId, isExpanded, onSelect, onToggleExpand }: SidebarWidgetProps) {
  const hasSubItems = Boolean(plugin.subItems?.length)
  const isLeaf = !hasSubItems
  const isHeaderActive = isLeaf
    ? activeItemId === plugin.id
    : (plugin.subItems?.some(s => s.id === activeItemId) ?? false)

  const handleHeaderClick = () => {
    if (plugin.disabled) return
    if (isLeaf) {
      onSelect(plugin.id)
    } else {
      onToggleExpand(plugin.id)
    }
  }

  const headerClass = [
    styles.widgetHeader,
    isHeaderActive ? styles.widgetHeaderActive : '',
    plugin.disabled ? styles.widgetHeaderDisabled : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={styles.widget}>
      <div className={headerClass} onClick={handleHeaderClick} role="button" tabIndex={plugin.disabled ? -1 : 0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleHeaderClick() }}>
        <span className={styles.widgetIcon}>{plugin.icon}</span>
        <span className={styles.widgetMeta}>
          <span className={styles.widgetName}>{plugin.name}</span>
          {plugin.finePrint && (
            <span className={styles.widgetFinePrint}>{plugin.finePrint}</span>
          )}
        </span>
        {hasSubItems && !plugin.disabled && (
          <ChevronRight
            size={14}
            className={[styles.chevron, isExpanded ? styles.chevronExpanded : ''].join(' ')}
          />
        )}
      </div>

      {hasSubItems && isExpanded && !plugin.disabled && (
        <div className={styles.subItems}>
          {plugin.subItems!.map(sub => (
            <SidebarItem
              key={sub.id}
              item={sub}
              isActive={activeItemId === sub.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
