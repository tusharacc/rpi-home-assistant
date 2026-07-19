import { useState, useEffect, type ReactNode } from 'react'
import { pluginRegistry } from '../../plugins/registry'
import { ReactContainer } from './ReactContainer'
import { EmbeddedWebviewContainer } from './EmbeddedWebviewContainer'
import styles from './ContentArea.module.css'

interface ContentAreaProps {
  activeItemId: string | null
}

function WelcomeScreen() {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = time.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const dateStr = time.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className={styles.welcome}>
      <div className={styles.clock}>{timeStr}</div>
      <div className={styles.date}>{dateStr}</div>
      <div className={styles.brand}>DESK OS</div>
    </div>
  )
}

export function ContentArea({ activeItemId }: ContentAreaProps) {
  let content: ReactNode

  if (!activeItemId) {
    content = <WelcomeScreen />
  } else {
    const item = pluginRegistry.findItem(activeItemId)

    if (!item) {
      content = (
        <div className={styles.errorState}>
          <span className={styles.errorLabel}>NOT FOUND</span>
          <span className={styles.errorMessage}>Plugin '{activeItemId}' is not registered.</span>
        </div>
      )
    } else if (item.contentMode === 'external') {
      // Reached only via a stale persisted activeItemId from before this item
      // became external-only (it never becomes active going forward — see
      // SidebarItem/SidebarWidget). Self-resolves once any other item is picked.
      content = (
        <div className={styles.errorState}>
          <span className={styles.errorLabel}>OPENS SEPARATELY</span>
          <span className={styles.errorMessage}>
            Select '{'label' in item ? item.label : item.name}' again from the sidebar to reopen it.
          </span>
        </div>
      )
    } else if (item.contentMode === 'embedded-webview' && item.embeddedUrl) {
      content = <EmbeddedWebviewContainer viewId={item.id} url={item.embeddedUrl} />
    } else {
      content = <ReactContainer>{item.render?.() ?? null}</ReactContainer>
    }
  }

  return <main className={styles.contentArea}>{content}</main>
}
