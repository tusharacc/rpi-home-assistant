const STORAGE_KEY = 'deskos_nav_state'

export interface NavState {
  activeItemId: string | null
  expandedWidgets: string[]
}

const defaultState: NavState = {
  activeItemId: null,
  expandedWidgets: [],
}

export function loadNavState(): NavState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState
    return JSON.parse(raw) as NavState
  } catch {
    return defaultState
  }
}

export function saveNavState(state: NavState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
