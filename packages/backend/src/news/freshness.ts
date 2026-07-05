import type { Category } from './types'

const WINDOW_MS: Record<Category, number> = {
  general: 7 * 24 * 60 * 60 * 1000,
  engineering: 30 * 24 * 60 * 60 * 1000,
  research: 90 * 24 * 60 * 60 * 1000,
}

export function computeExpiresAt(category: Category, discoveredAt: string): string {
  return new Date(new Date(discoveredAt).getTime() + WINDOW_MS[category]).toISOString()
}

export function radarExpiresAt(discoveredAt: string): string {
  return computeExpiresAt('engineering', discoveredAt)
}
