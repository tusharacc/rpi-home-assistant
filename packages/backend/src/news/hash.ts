import crypto from 'crypto'

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    parsed.searchParams.forEach((_, key) => {
      if (key.toLowerCase().startsWith('utm_') || key === 'ref' || key === 'fbclid') {
        parsed.searchParams.delete(key)
      }
    })
    return `${parsed.origin}${parsed.pathname}${parsed.search}`.replace(/\/$/, '').toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function hashUrl(url: string): string {
  return crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex')
}

export function hashTitle(title: string): string {
  return crypto.createHash('sha256').update(normalizeTitle(title)).digest('hex')
}
