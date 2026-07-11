import { Router } from 'express'
import { execFile } from 'child_process'
import { wakeFromStandbySync } from './standby'

// Verify on the real Pi with `which shutdown`/`which systemctl` before relying
// on these paths — sudoers rules matching by absolute path won't match if
// this guess is wrong.
const SHUTDOWN_BIN = '/sbin/shutdown'
const SYSTEMCTL_BIN = '/usr/bin/systemctl'

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
