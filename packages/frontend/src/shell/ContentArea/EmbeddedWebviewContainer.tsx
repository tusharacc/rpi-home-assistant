import { useEffect } from 'react'
import styles from './ContentArea.module.css'

interface EmbeddedWebviewContainerProps {
  viewId: string
  url: string
}

export function EmbeddedWebviewContainer({ viewId, url }: EmbeddedWebviewContainerProps) {
  const electron = window.deskosElectron

  useEffect(() => {
    electron?.showEmbeddedView(viewId, url)
    return () => {
      electron?.hideEmbeddedView()
    }
  }, [electron, viewId, url])

  if (!electron) {
    return (
      <div className={styles.errorState}>
        <span className={styles.errorLabel}>ELECTRON REQUIRED</span>
        <span className={styles.errorMessage}>
          Embedded views need the DeskOS Electron shell — run <code>npm run electron:dev</code>.
        </span>
      </div>
    )
  }

  // The Electron main process paints the BrowserView natively on top of this
  // region — nothing to render here.
  return null
}
