import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import sanitizeHtml from 'sanitize-html'
import { fetchWithTimeout } from './fetch-with-timeout'

export interface ExtractedArticle {
  title: string
  byline: string | null
  content: string
  textContent: string
}

// Most sources here (arXiv, Hugging Face, GitHub, HN, blogs) block iframe
// embedding via X-Frame-Options/CSP, which --disable-web-security does not
// bypass (that flag only relaxes same-origin scripting, not frame-ancestors).
// Extracting readable content server-side and rendering it as our own HTML
// sidesteps framing entirely instead of fighting those headers.
export async function extractReadableArticle(url: string): Promise<ExtractedArticle> {
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DeskOS/1.0)' },
  })
  if (!res.ok) {
    throw new Error(`fetch failed with status ${res.status}`)
  }

  const html = await res.text()
  const dom = new JSDOM(html, { url })
  const parsed = new Readability(dom.window.document as unknown as Document).parse()
  if (!parsed || !parsed.content) {
    throw new Error('readability could not extract article content')
  }

  const content = sanitizeHtml(parsed.content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['figure', 'figcaption', 'img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt'],
      a: ['href'],
    },
  })

  return {
    title: parsed.title ?? '',
    byline: parsed.byline ?? null,
    content,
    textContent: parsed.textContent ?? '',
  }
}
