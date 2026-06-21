import { Component, type ReactNode } from 'react'
import styles from './ContentArea.module.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorState}>
          <span className={styles.errorLabel}>PLUGIN ERROR</span>
          <span className={styles.errorMessage}>{this.state.error?.message ?? 'Unknown error'}</span>
        </div>
      )
    }
    return this.props.children
  }
}
