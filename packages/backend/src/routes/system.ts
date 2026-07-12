import { Router } from 'express'
import { execFile } from 'child_process'
import path from 'path'
import { wakeFromStandbySync } from './standby'
import { SCRIPTS_DIR } from '../paths'

// Verify on the real Pi with `which shutdown`/`which systemctl` before relying
// on these paths — sudoers rules matching by absolute path won't match if
// this guess is wrong.
const SHUTDOWN_BIN = '/sbin/shutdown'
const SYSTEMCTL_BIN = '/usr/bin/systemctl'
const LAUNCH_EPAPER_SCRIPT = path.join(SCRIPTS_DIR, 'launch-epaper.sh')

const EPAPER_SITES = ['the-hindu', 'livemint'] as const
type EpaperSite = (typeof EPAPER_SITES)[number]

function isEpaperSite(value: unknown): value is EpaperSite {
  return typeof value === 'string' && (EPAPER_SITES as readonly string[]).includes(value)
}

export const systemRouter = Router()

systemRouter.post('/system/shutdown', (_req, res) => {
  // Wake the display first so the frontend's "Safe to switch off power"
  // message is actually visible, even if shutdown was triggered mid-standby.
  wakeFromStandbySync(() => {
    res.status(202).json({ status: 'shutting-down' })
    // Runs via the passwordless sudoers rule installed by install-services.sh
    // (scripts/deskos-shutdown.sudoers), scoped to exactly this one command.
    execFile('sudo', [SHUTDOWN_BIN, 'now'], () => {
      // Process/power will drop shortly; nothing more to report.
    })
  })
})

systemRouter.post('/system/exit-to-desktop', (_req, res) => {
  res.status(202).json({ status: 'exiting-to-desktop' })
  // Stopping (not killing) the unit means Restart=on-failure in
  // deskos-kiosk.service does not relaunch it — a deliberate stop is not a
  // failure. Runs via the passwordless sudoers rule installed by
  // install-services.sh (scripts/deskos-kiosk-control.sudoers), scoped to
  // exactly this one command. Relaunching happens via the "Return to DeskOS"
  // desktop icon (scripts/deskos-return-to-kiosk.desktop), since this app is
  // no longer visible once the kiosk stops.
  execFile('sudo', [SYSTEMCTL_BIN, 'stop', 'deskos-kiosk.service'], () => {
    // Chromium is closing; nothing more to report.
  })
})

systemRouter.post('/system/open-epaper', (req, res) => {
  const body: unknown = req.body
  const site =
    typeof body === 'object' && body !== null ? (body as Record<string, unknown>).site : undefined

  if (!isEpaperSite(site)) {
    res.status(400).json({ error: 'invalid epaper site' })
    return
  }

  res.status(202).json({ status: 'opening-epaper', site })

  // Epaper sessions are localStorage-based, not cookie-based -- Chromium's
  // storage partitioning means a third-party iframe (the previous approach)
  // never shares localStorage with a direct sign-in, so the epaper always
  // looked unauthenticated no matter how many times the account signed in.
  // Stop the kiosk first (same sudoers rule as exit-to-desktop) so its
  // Chromium instance releases the shared --user-data-dir profile lock,
  // then open the epaper as its own top-level window on that profile.
  execFile('sudo', [SYSTEMCTL_BIN, 'stop', 'deskos-kiosk.service'], () => {
    execFile(LAUNCH_EPAPER_SCRIPT, [site], () => {
      // Chromium window is launching; nothing more to report.
    })
  })
})
