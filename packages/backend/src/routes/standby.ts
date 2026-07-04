import { Router } from 'express'
import { execFile } from 'child_process'
import path from 'path'
import { SCRIPTS_DIR } from '../paths'

const HDMI_POWER_SCRIPT = path.join(SCRIPTS_DIR, 'hdmi-power.sh')

// Advisory only — the real on/off state lives in the compositor. A backend
// restart during standby must not force a wake either way, so this flag is
// never trusted as authoritative, only used to answer "am I in standby".
let isStandby = false

function setHdmiPower(state: 'on' | 'off', onDone: (error: Error | null) => void): void {
  execFile(HDMI_POWER_SCRIPT, [state], (error) => onDone(error))
}

export const standbyRouter = Router()

standbyRouter.post('/standby/enter', (_req, res) => {
  setHdmiPower('off', (error) => {
    if (error) {
      res.status(500).json({ error: 'failed to enter standby' })
      return
    }
    isStandby = true
    res.json({ status: 'standby' })
  })
})

standbyRouter.post('/standby/exit', (_req, res) => {
  setHdmiPower('on', (error) => {
    if (error) {
      res.status(500).json({ error: 'failed to exit standby' })
      return
    }
    isStandby = false
    res.json({ status: 'active' })
  })
})

export function wakeFromStandbySync(onDone: (error: Error | null) => void): void {
  setHdmiPower('on', (error) => {
    if (!error) isStandby = false
    onDone(error)
  })
}
