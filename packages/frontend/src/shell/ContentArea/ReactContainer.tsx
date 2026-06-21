import type { ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import styles from './ContentArea.module.css'

interface ReactContainerProps {
  children: ReactNode
}

export function ReactContainer({ children }: ReactContainerProps) {
  return (
    <ErrorBoundary>
      <div className={styles.reactContainer}>{children}</div>
    </ErrorBoundary>
  )
}
