import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('deskosElectron', {
  isElectron: true,
  showEmbeddedView: (viewId: string, url: string): Promise<void> => ipcRenderer.invoke('embed:show', viewId, url),
  hideEmbeddedView: (): Promise<void> => ipcRenderer.invoke('embed:hide'),
})
