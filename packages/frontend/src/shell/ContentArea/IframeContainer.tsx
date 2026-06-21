import styles from './ContentArea.module.css'

interface IframeContainerProps {
  src: string
  title: string
}

export function IframeContainer({ src, title }: IframeContainerProps) {
  return (
    <iframe
      className={styles.iframe}
      src={src}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
    />
  )
}
