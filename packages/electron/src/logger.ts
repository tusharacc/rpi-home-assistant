import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const LOG_DIR = path.join(app.getPath('userData'), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'main.log')

// Kiosk has no keyboard in normal operation, so there's rarely anyone at the
// device to notice unbounded log growth on the Pi's limited storage -- cap
// and rotate once instead of accumulating forever.
const MAX_LOG_BYTES = 5 * 1024 * 1024

fs.mkdirSync(LOG_DIR, { recursive: true })

function rotateIfNeeded(): void {
  try {
    if (fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.old`)
    }
  } catch {
    // No existing file yet -- nothing to rotate.
  }
}

export type LogLevel = 'info' | 'warn' | 'error'

export function log(level: LogLevel, message: string): void {
  rotateIfNeeded()
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`
  fs.appendFileSync(LOG_FILE, line)
  const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  consoleFn(line.trimEnd())
}

export function logFilePath(): string {
  return LOG_FILE
}
