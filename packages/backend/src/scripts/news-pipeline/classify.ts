import type { PaywallTagged } from './paywall'

export interface Classified extends PaywallTagged {
  topic: string | null
  clickbaitScore: number | null
  aiNoiseScore: number | null
}

interface ClassificationResult {
  index: number
  topic: string
  clickbaitScore: number
  aiNoiseScore: number
}

const BATCH_SIZE = 10

function buildPrompt(batch: PaywallTagged[]): string {
  const list = batch.map((a, i) => `${i}. ${a.title}`).join('\n')
  return `For each numbered article title below, classify it and return a JSON object
of the form {"results": [...]}, where each entry has fields "index" (matching
the number), "topic" (a short lowercase topic tag), "clickbaitScore"
(0.0-1.0, how much the headline is sensationalized/clickbait), and
"aiNoiseScore" (0.0-1.0, how much this looks like generic AI-generated or
AI-overexposed content rather than substantive original reporting).
Return ONLY that JSON object, no other text.

${list}`
}

async function classifyBatch(batch: PaywallTagged[], apiKey: string, model: string): Promise<Classified[]> {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildPrompt(batch) }],
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      console.warn(`[news-pipeline] classification request failed: ${res.status}`)
      return batch.map((a) => ({ ...a, topic: a.topic, clickbaitScore: null, aiNoiseScore: null }))
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] }
    const content = data.choices[0]?.message?.content ?? '[]'
    const parsed = JSON.parse(content) as ClassificationResult[] | { results: ClassificationResult[] }
    const results = Array.isArray(parsed) ? parsed : parsed.results

    return batch.map((article, i) => {
      const result = results.find((r) => r.index === i)
      return {
        ...article,
        topic: result?.topic ?? article.topic,
        clickbaitScore: result?.clickbaitScore ?? null,
        aiNoiseScore: result?.aiNoiseScore ?? null,
      }
    })
  } catch (err) {
    console.warn('[news-pipeline] classification batch failed, leaving articles unclassified:', err)
    return batch.map((a) => ({ ...a, topic: a.topic, clickbaitScore: null, aiNoiseScore: null }))
  }
}

export async function classifyArticles(articles: PaywallTagged[]): Promise<Classified[]> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL

  if (!apiKey || !model) {
    console.warn('[news-pipeline] OPENAI_API_KEY/OPENAI_MODEL not set — skipping classification')
    return articles.map((a) => ({ ...a, topic: a.topic, clickbaitScore: null, aiNoiseScore: null }))
  }

  const results: Classified[] = []
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE)
    results.push(...(await classifyBatch(batch, apiKey, model)))
  }
  return results
}
