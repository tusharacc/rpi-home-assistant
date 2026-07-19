# Code Quality Report — electron-migration-upgrade

## Round 2 — 2026-07-12T13:44:57Z (reviewer, post-fix)

| Agent | Status | Findings |
|---|---|---|
| Simplify | PASS | 0 new findings; round 1's finding applied and verified against current `ContentArea.tsx` |
| Secure Coding | PASS | 0 critical, 0 high, 0 medium, 0 low — both round-1 findings confirmed fixed in `main.ts` (`EMBEDDABLE_VIEWS` allowlist check, `event.sender` check on both IPC handlers) |
| Secret Detection | PASS | 0 secrets found |

**CODE QUALITY: PASSED.** No blocking findings. Advancing to reviewer artifact completion — see
`electron-migration-upgrade.reviewer.md` for the full review (round 2 approved).

---

# Round 1 (original report, preserved for audit trail)

Generated: 2026-07-12T13:23:47Z
Mode: reviewer

## Summary

| Agent | Status | Findings |
|---|---|---|
| Simplify | 1 finding | 0 actionable, 1 advisory (no test suite in repo) |
| Secure Coding | BLOCKED | 0 critical, 0 high, 1 medium, 1 low |
| Secret Detection | PASS | 0 secrets found |

## Simplify Agent Findings

```
SIMPLIFY FINDING
  ID:        SIM-01
  File:      packages/frontend/src/shell/ContentArea/ContentArea.tsx
  Lines:     42–95
  Issue:     Duplicate structure — the same `<main className={styles.contentArea}>...</main>`
             wrapper is repeated across five early-return branches (no-activeItemId,
             not-found, external, embedded-webview, and the default react branch). This diff
             added a fourth occurrence (the new embedded-webview branch) to an already-existing
             pattern, worsening it rather than an opportunity introduced fresh by this change.
  Current:
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
            <div className={styles.errorState}>...</div>
          </main>
        )
      }

      if (item.contentMode === 'external') {
        return (
          <main className={styles.contentArea}>
            <div className={styles.errorState}>...</div>
          </main>
        )
      }

      if (item.contentMode === 'embedded-webview' && item.embeddedUrl) {
        return (
          <main className={styles.contentArea}>
            <EmbeddedWebviewContainer viewId={item.id} url={item.embeddedUrl} />
          </main>
        )
      }

      return (
        <main className={styles.contentArea}>
          <ReactContainer>{item.render?.() ?? null}</ReactContainer>
        </main>
      )
    }
  Proposed:
    export function ContentArea({ activeItemId }: ContentAreaProps) {
      let content: React.ReactNode

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
  Notes:     Preserves all existing behavior and branch conditions exactly. Reduces five copies
             of the wrapper markup to one. No test suite exists in this repo to verify against
             automatically, so this is advisory, not auto-applied.
  Status:    ADVISORY
```

## Secure Coding Findings

### [MEDIUM] SC-08 — Insecure Design (Input Validation)

File: `packages/electron/src/main.ts:96-99`

Description: The `embed:show` IPC handler validates that `viewId`/`url` are non-empty strings
(`isNonEmptyString`), but does not validate that `url` is one of the actual known/allowed embeddable
sites before passing it to `showEmbeddedView` → `getOrCreateView` → `view.webContents.loadURL(url)`.
This is a real regression in this diff, not a pre-existing gap: the route it replaces
(`POST /api/system/open-epaper`, removed in this same change) validated `site` against a fixed enum
(`EPAPER_SITES`/`isEpaperSite`) before ever reaching a privileged action. The IPC boundary introduced
here drops that check. Today the only caller is DeskOS's own trusted frontend code
(`NewsPlugin.tsx`'s two hardcoded URLs), so this isn't exploitable by an external actor directly — but
if a future bug (XSS in rendered news content, a compromised dependency, a future plugin with
user-influenced content) ever let attacker-controlled JS run in the main window's renderer, that
renderer already has `window.deskosElectron` in scope (by design, via the preload contextBridge) and
could call `showEmbeddedView('x', 'https://attacker.example/phishing')`, causing Electron's main
process to load and display an arbitrary attacker-chosen URL as a `BrowserView` with its own
persistent, disk-backed session partition — a real (if currently narrow) escalation path this app
didn't have before this diff, since the equivalent HTTP route was enum-validated.

Current code:
```ts
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

ipcMain.handle('embed:show', (_event, viewId: unknown, url: unknown) => {
  if (!isNonEmptyString(viewId) || !isNonEmptyString(url)) return
  showEmbeddedView(viewId, url)
})
```

Recommended fix: Validate `url` against a fixed allowlist in the main process (mirroring the removed
`isEpaperSite` pattern and the existing `isKnownArticleUrl` pattern already used in
`packages/backend/src/news/db.ts` for the same class of problem), e.g.:
```ts
const EMBEDDABLE_VIEWS: Record<string, string> = {
  'news-the-hindu': 'https://epaper.thehindu.com',
  'news-livemint': 'https://epaper.livemint.com',
}

ipcMain.handle('embed:show', (_event, viewId: unknown, url: unknown) => {
  if (!isNonEmptyString(viewId) || !isNonEmptyString(url)) return
  if (EMBEDDABLE_VIEWS[viewId] !== url) return
  showEmbeddedView(viewId, url)
})
```
This also removes the need to trust the renderer's `url` argument as anything other than a selector,
consistent with defense-in-depth at this boundary — same principle CLAUDE.md already states for
backend routes ("must validate the input against a fixed enum before it ever reaches the shell"),
applied here to the equivalent IPC boundary instead of a shell boundary.

### [LOW] Advisory — IPC handler doesn't verify sender

File: `packages/electron/src/main.ts:96-104`

Description: `ipcMain.handle('embed:show', ...)`/`ipcMain.handle('embed:hide', ...)` don't check
`event.sender` against `mainWindow?.webContents`. Today only the main window's preload script exposes
`window.deskosElectron` (the embedded `BrowserView`s deliberately have no `preload` set — confirmed in
`getOrCreateView`, a correct and good existing design choice), so this isn't currently reachable from
untrusted content. Still, an explicit sender check is cheap, standard Electron hardening, and would
remain correct if the app ever grows a second window.

Recommended fix (non-blocking, low priority):
```ts
ipcMain.handle('embed:show', (event, viewId: unknown, url: unknown) => {
  if (event.sender !== mainWindow?.webContents) return
  ...
})
```

## Secret Detection Findings

No secrets detected. Diff reviewed: `electron` version pin, new `packages/electron` source files,
`system.ts` route removal, frontend plugin/type changes, script changes. No credentials, tokens, or
high-entropy strings introduced.
