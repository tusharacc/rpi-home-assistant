import { useState, useEffect } from 'react'
import { pluginRegistry } from '../../plugins/registry'
import { IframeContainer } from './IframeContainer'
import { ReactContainer } from './ReactContainer'
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
  if (!activeItemId) {
    return (
      <main className={styles.contentArea}>
        <WelcomeScreen />
      </main>
    )
  }

  const item = pluginRegistry.findItem(activeItemId)

  if (!item) {
    return (
      <main className={styles.contentArea}>
        <div className={styles.errorState}>
          <span className={styles.errorLabel}>NOT FOUND</span>
          <span className={styles.errorMessage}>Plugin '{activeItemId}' is not registered.</span>
        </div>
      </main>
    )
  }

  return (
    <main className={styles.contentArea}>
      {item.contentMode === 'iframe' && item.iframeSrc ? (
        <IframeContainer src={item.iframeSrc} title={'label' in item ? item.label : item.name} />
      ) : (
        <ReactContainer>
          {item.render?.() ?? null}
        </ReactContainer>
      )}
    </main>
  )
}
