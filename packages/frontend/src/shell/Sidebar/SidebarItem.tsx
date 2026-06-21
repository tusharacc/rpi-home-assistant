import type { PluginSubItem } from '../../plugins/types'
import styles from './Sidebar.module.css'

interface SidebarItemProps {
  item: PluginSubItem
  isActive: boolean
  onSelect: (id: string) => void
}

export function SidebarItem({ item, isActive, onSelect }: SidebarItemProps) {
  const handleClick = () => onSelect(item.id)

  return (
    <div
      className={[styles.subItem, isActive ? styles.subItemActive : ''].join(' ')}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
    >
      {item.icon && <span className={styles.subItemIcon}>{item.icon}</span>}
      <span className={styles.subItemMeta}>
        <span className={styles.subItemLabel}>{item.label}</span>
        {item.finePrint && (
          <span className={styles.subItemFinePrint}>{item.finePrint}</span>
        )}
      </span>
    </div>
  )
}
