import { pluginRegistry } from '../../plugins/registry'
import { SidebarWidget } from './SidebarWidget'
import styles from './Sidebar.module.css'

interface SidebarProps {
  activeItemId: string | null
  expandedWidgets: string[]
  onSelect: (id: string) => void
  onToggleExpand: (id: string) => void
}

export function Sidebar({ activeItemId, expandedWidgets, onSelect, onToggleExpand }: SidebarProps) {
  const plugins = pluginRegistry.getAll()
  const active = plugins.filter(p => !p.disabled)
  const coming = plugins.filter(p => p.disabled)

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>DESK OS</div>
        <div className={styles.logoSub}>Personal Appliance · v0.1</div>
      </div>

      <nav className={styles.nav}>
        <div className={styles.section}>
          {active.map(plugin => (
            <SidebarWidget
              key={plugin.id}
              plugin={plugin}
              activeItemId={activeItemId}
              isExpanded={expandedWidgets.includes(plugin.id)}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>

        {coming.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Coming Soon</div>
            {coming.map(plugin => (
              <SidebarWidget
                key={plugin.id}
                plugin={plugin}
                activeItemId={activeItemId}
                isExpanded={false}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </nav>

      <div className={styles.footer}>
        <span className={styles.footerStatus}>
          <span className={styles.dot} />
          LIVE
        </span>
      </div>
    </aside>
  )
}
