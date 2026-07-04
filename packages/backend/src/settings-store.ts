import fs from 'fs'
import path from 'path'
import { DATA_DIR } from './paths'

export type Orientation = 'portrait' | 'landscape'

export interface DeskOSSettings {
  orientation: Orientation
}

const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json')

const DEFAULT_SETTINGS: DeskOSSettings = { orientation: 'landscape' }

function isOrientation(value: unknown): value is Orientation {
  return value === 'portrait' || value === 'landscape'
}

function isDeskOSSettings(value: unknown): value is DeskOSSettings {
  return (
    typeof value === 'object' &&
    value !== null &&
    isOrientation((value as Record<string, unknown>).orientation)
  )
}

export function readSettings(): DeskOSSettings {
  let raw: string
  try {
    raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
  } catch {
    return { ...DEFAULT_SETTINGS }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }

  return isDeskOSSettings(parsed) ? parsed : { ...DEFAULT_SETTINGS }
}

export function writeSettings(settings: DeskOSSettings): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
}
