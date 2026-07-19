export {}

declare global {
  interface Window {
    // Present only when running inside the Electron shell (packages/electron);
    // undefined in a plain-browser dev preview (npm run dev at :3000).
    deskosElectron?: {
      isElectron: true
      showEmbeddedView: (viewId: string, url: string) => Promise<void>
      hideEmbeddedView: () => Promise<void>
      openPdf: (url: string) => Promise<void>
    }
  }
}
