import { useEffect, useRef } from 'react'

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const ACTIVITY_THROTTLE_MS = 250

let manualStandbyTrigger: (() => void) | null = null

/** Used by the Settings screen's "Standby Now" button — shares state with the
 *  idle timer instead of firing a second, uncoordinated standby request. */
export function triggerStandby(): void {
  manualStandbyTrigger?.()
}

export function IdleMonitor(): null {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isStandby = useRef(false)
  const lastActivity = useRef(0)

  useEffect(() => {
    const enterStandby = () => {
      if (isStandby.current) return
      isStandby.current = true
      fetch('/api/standby/enter', { method: 'POST' }).catch(() => {})
    }

    const exitStandby = () => {
      if (!isStandby.current) return
      isStandby.current = false
      fetch('/api/standby/exit', { method: 'POST' }).catch(() => {})
    }

    const resetIdleTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(enterStandby, IDLE_TIMEOUT_MS)
    }

    // Deliberately no 'keydown' listener — DeskOS has no keyboard in normal
    // operation, so standby wakes on touch/mouse activity only.
    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivity.current < ACTIVITY_THROTTLE_MS) return
      lastActivity.current = now

      exitStandby()
      resetIdleTimer()
    }

    resetIdleTimer()
    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('pointermove', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    manualStandbyTrigger = enterStandby

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('pointermove', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      manualStandbyTrigger = null
    }
  }, [])

  return null
}
