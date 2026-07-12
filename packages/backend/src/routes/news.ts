import { Router } from 'express'
import {
  getEngineeringArticles,
  getQueue,
  getRadarItems,
  getSourcePrefs,
  isKnownArticleUrl,
  setArticleStatus,
  setSourceFollowed,
  setSourceHidden,
} from '../news/db'
import { extractReadableArticle } from '../news/extract'
import type { ArticleAction, ReadingMode, Status } from '../news/types'

const VALID_MODES: ReadingMode[] = ['balanced', 'engineering', 'ai-focus']
const VALID_ACTIONS: ArticleAction[] = ['save', 'ignore', 'read']

const ACTION_TO_STATUS: Record<ArticleAction, Status> = {
  save: 'saved',
  ignore: 'ignored',
  read: 'shown',
}

function isReadingMode(value: unknown): value is ReadingMode {
  return typeof value === 'string' && (VALID_MODES as string[]).includes(value)
}

function isArticleAction(value: unknown): value is ArticleAction {
  return typeof value === 'string' && (VALID_ACTIONS as string[]).includes(value)
}

export const newsRouter = Router()

newsRouter.get('/news', (req, res) => {
  const mode = isReadingMode(req.query.mode) ? req.query.mode : 'balanced'
  res.json({ mode, articles: getQueue(mode) })
})

newsRouter.get('/news/radar', (_req, res) => {
  res.json({ repos: getRadarItems(), articles: getEngineeringArticles() })
})

newsRouter.get('/news/sources', (_req, res) => {
  res.json(getSourcePrefs())
})

newsRouter.get('/news/extract', async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : undefined
  if (!url) {
    res.status(400).json({ error: 'url query param is required' })
    return
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    res.status(400).json({ error: 'invalid url' })
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'invalid url' })
    return
  }

  // Only ever extract URLs we ourselves discovered and stored — otherwise
  // this becomes an open URL-fetch proxy.
  if (!isKnownArticleUrl(url)) {
    res.status(404).json({ error: 'unknown article url' })
    return
  }

  try {
    const article = await extractReadableArticle(url)
    res.json(article)
  } catch {
    res.status(502).json({ error: 'could not load a readable version of this article' })
  }
})

newsRouter.post('/news/:id/action', (req, res) => {
  const id = Number(req.params.id)
  const body: unknown = req.body
  const action =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).action
      : undefined

  if (!Number.isInteger(id) || !isArticleAction(action)) {
    res.status(400).json({ error: 'invalid article action payload' })
    return
  }

  const updated = setArticleStatus(id, ACTION_TO_STATUS[action])
  if (!updated) {
    res.status(404).json({ error: 'article not found' })
    return
  }
  res.json({ id, status: ACTION_TO_STATUS[action] })
})

function isBooleanValue(body: unknown): body is { value: boolean } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as Record<string, unknown>).value === 'boolean'
  )
}

newsRouter.post('/news/sources/:name/hide', (req, res) => {
  const body: unknown = req.body
  if (!isBooleanValue(body)) {
    res.status(400).json({ error: 'value must be a boolean' })
    return
  }
  setSourceHidden(req.params.name, body.value)
  res.json({ source: req.params.name, hidden: body.value })
})

newsRouter.post('/news/sources/:name/follow', (req, res) => {
  const body: unknown = req.body
  if (!isBooleanValue(body)) {
    res.status(400).json({ error: 'value must be a boolean' })
    return
  }
  setSourceFollowed(req.params.name, body.value)
  res.json({ source: req.params.name, followed: body.value })
})
