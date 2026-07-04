import { Router } from 'express'
import { execFile } from 'child_process'
import { wakeFromStandbySync } from './standby'

// Verify on the real Pi with `which shutdown` before relying on this path —
// sudoers rules matching by absolute path won't match if this guess is wrong.
const SHUTDOWN_BIN = '/sbin/shutdown'

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
