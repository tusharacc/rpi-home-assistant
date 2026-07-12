import { app, BrowserView, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import os from 'os'

// Separate from the pre-Electron ~/.deskos-chromium profile by design — see
// CLAUDE.md's "Epaper Access" section. Embedded sites sign in fresh here.
app.setPath('userData', path.join(os.homedir(), '.deskos-electron'))

const DESKOS_URL = process.env.DESKOS_URL ?? 'http://localhost:3001'

// Mirrors --sidebar-width in packages/frontend/src/index.css. No automatic
// sharing between a CSS custom property and this process -- keep in sync
// manually if the sidebar width ever changes (see architect Open Question 2).
const SIDEBAR_WIDTH_PX = 260

let mainWindow: BrowserWindow | null = null
const embeddedViews = new Map<string, BrowserView>()
let activeViewId: string | null = null

function computeContentBounds(win: BrowserWindow): { x: number; y: number; width: number; height: number } {
  const [width, height] = win.getContentSize()
  return { x: SIDEBAR_WIDTH_PX, y: 0, width: Math.max(width - SIDEBAR_WIDTH_PX, 0), height }
}

function getOrCreateView(viewId: string, url: string): BrowserView {
  const existing = embeddedViews.get(viewId)
  if (existing) return existing

  const view = new BrowserView({
    webPreferences: {
      // One partition per embedded site -- isolates cookies/localStorage
      // between e.g. epaper and any future home-automation dashboard.
      partition: `persist:${viewId}`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  // Deny new-window requests from the embedded site itself -- an outbound
  // link spawning a further top-level window is exactly the unclosable-
  // window bug class this whole feature exists to avoid.
  view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  void view.webContents.loadURL(url)

  embeddedViews.set(viewId, view)
  return view
}

function showEmbeddedView(viewId: string, url: string): void {
  if (!mainWindow) return

  if (activeViewId && activeViewId !== viewId) {
    const previous = embeddedViews.get(activeViewId)
    if (previous) mainWindow.removeBrowserView(previous)
  }

  const view = getOrCreateView(viewId, url)
  mainWindow.addBrowserView(view)
  view.setBounds(computeContentBounds(mainWindow))
  activeViewId = viewId
}

function hideEmbeddedView(): void {
  if (!mainWindow || !activeViewId) return
  const view = embeddedViews.get(activeViewId)
  if (view) mainWindow.removeBrowserView(view)
  activeViewId = null
}

function repositionActiveView(): void {
  if (!mainWindow || !activeViewId) return
  const view = embeddedViews.get(activeViewId)
  if (view) view.setBounds(computeContentBounds(mainWindow))
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    kiosk: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.on('resize', repositionActiveView)
  void win.loadURL(DESKOS_URL)

  return win
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

ipcMain.handle('embed:show', (_event, viewId: unknown, url: unknown) => {
  if (!isNonEmptyString(viewId) || !isNonEmptyString(url)) return
  showEmbeddedView(viewId, url)
})

ipcMain.handle('embed:hide', () => {
  hideEmbeddedView()
})

app.whenReady().then(() => {
  mainWindow = createMainWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
