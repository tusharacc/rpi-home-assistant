import { useState, useCallback } from 'react'
import { Sidebar } from './Sidebar/Sidebar'
import { ContentArea } from './ContentArea/ContentArea'
import { loadNavState, saveNavState, type NavState } from '../state/navigationState'
import styles from './Shell.module.css'

export function Shell() {
  const [navState, setNavState] = useState<NavState>(() => loadNavState())

  const handleSelect = useCallback((id: string) => {
    setNavState(prev => {
      const next = { ...prev, activeItemId: id }
      saveNavState(next)
      return next
    })
  }, [])

  const handleToggleExpand = useCallback((id: string) => {
    setNavState(prev => {
      const expanded = prev.expandedWidgets.includes(id)
        ? prev.expandedWidgets.filter(w => w !== id)
        : [...prev.expandedWidgets, id]
      const next = { ...prev, expandedWidgets: expanded }
      saveNavState(next)
      return next
    })
  }, [])

  return (
    <div className={styles.shell}>
      <Sidebar
        activeItemId={navState.activeItemId}
        expandedWidgets={navState.expandedWidgets}
        onSelect={handleSelect}
        onToggleExpand={handleToggleExpand}
      />
      <ContentArea activeItemId={navState.activeItemId} />
    </div>
  )
}
