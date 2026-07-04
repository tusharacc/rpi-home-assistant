import { Router } from 'express'
import { execFile } from 'child_process'
import os from 'os'
import path from 'path'
import { SCRIPTS_DIR } from '../paths'
import { readSettings, writeSettings, type Orientation } from '../settings-store'

const ORIENTATION_SCRIPT = path.join(SCRIPTS_DIR, 'apply-orientation.sh')

function isOrientation(value: unknown): value is Orientation {
  return value === 'portrait' || value === 'landscape'
}

export const settingsRouter = Router()

settingsRouter.get('/settings', (_req, res) => {
  res.json({ ...readSettings(), uptimeSeconds: os.uptime() })
})

settingsRouter.put('/settings', (req, res) => {
  const body: unknown = req.body
  if (
    typeof body !== 'object' ||
    body === null ||
    ('orientation' in body && !isOrientation((body as Record<string, unknown>).orientation))
  ) {
    res.status(400).json({ error: 'invalid settings payload' })
    return
  }

  const current = readSettings()
  const update = body as Partial<{ orientation: Orientation }>
  const next = { ...current, ...update }
  writeSettings(next)
  res.json(next)
})

settingsRouter.post('/settings/rotate', (req, res) => {
  const body: unknown = req.body
  const orientation =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).orientation
      : undefined

  if (!isOrientation(orientation)) {
    res.status(400).json({ error: 'orientation must be "portrait" or "landscape"' })
    return
  }

  execFile(ORIENTATION_SCRIPT, [orientation], (error) => {
    if (error) {
      res.status(500).json({ error: 'failed to apply orientation' })
      return
    }
    writeSettings({ ...readSettings(), orientation })
    res.json({ orientation })
  })
})
