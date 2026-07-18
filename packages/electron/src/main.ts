import { app, BrowserView, BrowserWindow, ipcMain, WebContents } from 'electron'
import path from 'path'
import os from 'os'
import { log, logFilePath } from './logger'

// Google's own client SDK (accounts.google.com/gsi/client) feature-detects
// FedCM support and uses it instead of a classic window.open() popup when
// available -- confirmed live: sign-in silently failed with "FedCM get()
// rejects with AbortError" / "Provider's accounts list is empty" in an
// embedded BrowserView, no popup ever appeared for setWindowOpenHandler to
// even see. Reporting FedCM as unsupported makes the SDK fall back to its
// classic popup flow, which the accounts.google.com allowance in
// getOrCreateView below then lets through. Must run before app is ready.
app.commandLine.appendSwitch('disable-features', 'FedCm')

// Separate from the pre-Electron ~/.deskos-chromium profile by design — see
// CLAUDE.md's "Epaper Access" section. Embedded sites sign in fresh here.
app.setPath('userData', path.join(os.homedir(), '.deskos-electron'))

const DESKOS_URL = process.env.DESKOS_URL ?? 'http://localhost:3001'

// Force-open DevTools on launch for whatever this env var is set on --
// useful for a one-off debug run over SSH when the kiosk display itself
// isn't rendering anything to click into. The F12/Ctrl+Shift+I hotkey below
// covers the normal case (keyboard temporarily attached, display working).
const FORCE_DEVTOOLS = process.env.DESKOS_ELECTRON_DEVTOOLS === '1'

// The only URLs the main process will ever load into a BrowserView, keyed by
// viewId. The renderer's `url` argument to embed:show is checked against this
// rather than trusted outright -- the DeskOS frontend is trusted today, but an
// IPC boundary that accepts an arbitrary URL from any renderer script that
// happens to run (e.g. a future XSS in rendered content) is exactly the kind
// of open redirect-into-a-persistent-session this app shouldn't have, matching
// the enum validation the HTTP route this replaced used to do.
const EMBEDDABLE_VIEWS: Record<string, string> = {
  'news-the-hindu': 'https://epaper.thehindu.com',
  'news-livemint': 'https://epaper.livemint.com',
}

// Mirrors --sidebar-width in packages/frontend/src/index.css. No automatic
// sharing between a CSS custom property and this process -- keep in sync
// manually if the sidebar width ever changes (see architect Open Question 2).
const SIDEBAR_WIDTH_PX = 260

let mainWindow: BrowserWindow | null = null
const embeddedViews = new Map<string, BrowserView>()
let activeViewId: string | null = null

process.on('uncaughtException', (err) => {
  log('error', `Uncaught exception in main process: ${err.stack ?? err.message}`)
})
process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection in main process: ${String(reason)}`)
})

// Shared diagnostics wiring for both the main window and every embedded
// BrowserView -- log page-load failures and renderer console output to disk
// (see packages/electron/src/logger.ts), and let F12/Ctrl+Shift+I open
// DevTools for that specific surface. There's no keyboard in normal
// operation, so this only does anything when one is temporarily attached
// for debugging, same convention as epaper sign-in.
function attachDiagnostics(webContents: WebContents, label: string): void {
  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log('error', `[${label}] failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`)
  })

  webContents.on('console-message', (event) => {
    const level = event.level === 'error' ? 'error' : event.level === 'warning' ? 'warn' : 'info'
    log(level, `[${label}] console: ${event.message} (${event.sourceId}:${event.lineNumber})`)
  })

  webContents.on('render-process-gone', (_event, details) => {
    log('error', `[${label}] renderer process gone: ${details.reason}`)
  })

  webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    // `code` (physical key position) rather than `key` (resulting character)
    // -- on US Mac keyboards, Option is a dead-key modifier for accented
    // characters, so holding it can change what `key` reports for "I"
    // entirely instead of leaving it as "i".
    const isDevToolsKey =
      input.code === 'F12' ||
      (input.control && input.shift && input.code === 'KeyI') || // Windows/Linux (the Pi's actual keyboard)
      (input.meta && input.alt && input.code === 'KeyI') // macOS convention (local electron:dev testing)
    if (isDevToolsKey) {
      log('info', `[${label}] DevTools hotkey pressed, toggling`)
      webContents.toggleDevTools()
    }
  })
}

function computeContentBounds(win: BrowserWindow): { x: number; y: number; width: number; height: number } {
  const [width, height] = win.getContentSize()
  return { x: SIDEBAR_WIDTH_PX, y: 0, width: Math.max(width - SIDEBAR_WIDTH_PX, 0), height }
}

// Confirmed live via the window-open logging below: The Hindu's "Sign in
// with Google" doesn't pop accounts.google.com directly -- it goes through
// Piano ID (id.tinypass.com), a third-party identity/paywall platform, which
// only then redirects to Google internally. Allow both; LiveMint may turn
// out to use a different/additional identity provider, discoverable the same
// way if its own sign-in popup also gets denied and logged.
const ALLOWED_AUTH_POPUP_HOSTS = ['accounts.google.com', 'id.tinypass.com']

function isAllowedAuthPopupUrl(targetUrl: string): boolean {
  try {
    return ALLOWED_AUTH_POPUP_HOSTS.includes(new URL(targetUrl).hostname)
  } catch {
    return false
  }
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
  // Deny new-window requests by default -- an outbound link spawning a
  // further top-level window is exactly the unclosable-window bug class
  // this whole feature exists to avoid. One deliberate exception: identity-
  // provider sign-in popups (DeskOS itself never handles login flows, per
  // CLAUDE.md) -- allow specifically those, as a real, closable window on
  // its own persistent partition shared across embedded sites, separate
  // from each site's own persist:<viewId> session.
  view.webContents.setWindowOpenHandler(({ url: targetUrl, disposition }) => {
    log('info', `[view:${viewId}] window-open request: ${targetUrl} (disposition: ${disposition})`)
    if (!isAllowedAuthPopupUrl(targetUrl)) return { action: 'deny' }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 500,
        height: 650,
        webPreferences: {
          partition: 'persist:google-auth',
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    }
  })
  view.webContents.on('did-create-window', (popup) => {
    log('info', `[view:${viewId}] popup window created: ${popup.webContents.getURL()}`)
    popup.on('closed', () => log('info', `[view:${viewId}] popup window closed`))
  })
  attachDiagnostics(view.webContents, `view:${viewId}`)
  if (FORCE_DEVTOOLS) view.webContents.openDevTools({ mode: 'detach' })
  void view.webContents.loadURL(url)

  embeddedViews.set(viewId, view)
  log('info', `Created BrowserView ${viewId} -> ${url}`)
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
  log('info', `Showing embedded view ${viewId}`)
}

function hideEmbeddedView(): void {
  if (!mainWindow || !activeViewId) return
  const view = embeddedViews.get(activeViewId)
  if (view) mainWindow.removeBrowserView(view)
  log('info', `Hiding embedded view ${activeViewId}`)
  activeViewId = null
}

function repositionActiveView(): void {
  if (!mainWindow || !activeViewId) return
  const view = embeddedViews.get(activeViewId)
  if (view) view.setBounds(computeContentBounds(mainWindow))
}

function isPdfUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const path = parsed.pathname.toLowerCase()
    // .pdf suffix covers traditional filenames; /pdf/ as a path segment
    // covers content-negotiated schemes with no file extension at all --
    // confirmed live, arXiv serves PDFs at e.g. arxiv.org/pdf/2607.15277,
    // no ".pdf" anywhere in the URL, which the suffix-only check missed
    // entirely and silently fell through to the (always-failing, PDFs
    // aren't HTML) Readability extraction path instead.
    return path.endsWith('.pdf') || /\/pdf\//.test(path)
  } catch {
    return false
  }
}

// Server-side Readability extraction (the Other News reader) can only parse
// HTML, not PDFs -- e.g. arXiv's "View PDF" link always failed with
// "couldn't load a readable version". A real, normal (non-kiosk) window with
// window chrome lets Chromium's built-in PDF viewer render it directly, and
// the user can close it like a real window since it isn't kiosk-mode.
function openPdfWindow(url: string): void {
  const pdfWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      plugins: true, // enables Chromium's built-in PDF viewer
    },
  })
  pdfWindow.setMenuBarVisibility(false)
  pdfWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  attachDiagnostics(pdfWindow.webContents, 'pdf-viewer')
  void pdfWindow.loadURL(url)
  log('info', `Opened PDF viewer window for ${url}`)
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
  // The kiosk window must never leave the DeskOS app itself -- confirmed
  // live: a raw <a href> inside Readability-extracted article content (e.g.
  // arXiv's "View PDF" link) with no target="_blank" is a same-window
  // navigation, not a new-window request, so setWindowOpenHandler above
  // never even saw it. Chromium's built-in PDF viewer then took over the
  // entire kiosk window with no back/close affordance (no window chrome in
  // kiosk mode) -- the only way out was Alt+F4, which closed the whole app.
  // This is a second, independent guard for the same
  // "kiosk must not navigate away" property, at the same-window layer
  // rather than the new-window layer.
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (new URL(targetUrl).origin !== new URL(DESKOS_URL).origin) {
      event.preventDefault()
      log('warn', `Blocked main window navigation away from DeskOS to ${targetUrl}`)
    }
  })
  win.on('resize', repositionActiveView)
  attachDiagnostics(win.webContents, 'main')
  if (FORCE_DEVTOOLS) win.webContents.openDevTools({ mode: 'detach' })
  void win.loadURL(DESKOS_URL)

  return win
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

ipcMain.handle('embed:show', (event, viewId: unknown, url: unknown) => {
  if (event.sender !== mainWindow?.webContents) return
  if (!isNonEmptyString(viewId) || !isNonEmptyString(url)) return
  if (EMBEDDABLE_VIEWS[viewId] !== url) return
  showEmbeddedView(viewId, url)
})

ipcMain.handle('embed:hide', (event) => {
  if (event.sender !== mainWindow?.webContents) return
  hideEmbeddedView()
})

ipcMain.handle('pdf:open', (event, url: unknown) => {
  if (event.sender !== mainWindow?.webContents) return
  if (!isNonEmptyString(url) || !isPdfUrl(url)) return
  openPdfWindow(url)
})

app.whenReady().then(() => {
  log('info', `App ready (pid ${process.pid}). Logging to ${logFilePath()}`)
  mainWindow = createMainWindow()
})

app.on('window-all-closed', () => {
  log('info', 'All windows closed, quitting')
  app.quit()
})
