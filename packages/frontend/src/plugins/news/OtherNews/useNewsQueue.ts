import { useEffect, useState, useCallback } from 'react'
import type { Article, ReadingMode } from './types'
import { postArticleAction } from './api'

interface QueueResponse {
  mode: ReadingMode
  articles: Article[]
}

function isQueueResponse(value: unknown): value is QueueResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>).articles)
  )
}

export function useNewsQueue(mode: ReadingMode) {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/news?mode=${mode}`)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (!cancelled && isQueueResponse(data)) setArticles(data.articles)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode])

  const applyAction = useCallback((id: number, action: 'save' | 'ignore' | 'read') => {
    setArticles((prev) =>
      action === 'ignore' ? prev.filter((a) => a.id !== id) : prev,
    )
    postArticleAction(id, action)
  }, [])

  return { articles, loading, applyAction }
}
