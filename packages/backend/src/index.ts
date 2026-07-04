import express from 'express'
import path from 'path'

const app = express()
const PORT = process.env.PORT ?? 3001
const FRONTEND_DIST = path.join(__dirname, '../../dist/frontend')

const EPAPER_SITES: Record<string, string> = {
  thehindu: 'https://epaper.thehindu.com',
  livemint: 'https://epaper.livemint.com',
}

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' })
})

// Fetches the epaper site's shell HTML server-side and strips frame-blocking
// headers so it can be embedded in our iframe. A <base> tag is injected so the
// browser still resolves the page's own relative/root-relative asset and API
// requests against the real origin, rather than ours.
app.get('/api/proxy/epaper/:site', async (req, res) => {
  const siteOrigin = EPAPER_SITES[req.params.site]
  if (!siteOrigin) {
    res.status(404).json({ error: 'Unknown epaper site' })
    return
  }

  try {
    const upstream = await fetch(siteOrigin, {
      headers: { 'User-Agent': req.get('user-agent') ?? 'Mozilla/5.0' },
    })
    const contentType = upstream.headers.get('content-type') ?? 'text/html'
    let body = await upstream.text()

    if (contentType.includes('text/html')) {
      body = body.replace(/<head[^>]*>/i, (match) => `${match}<base href="${siteOrigin}/">`)
    }

    res.status(upstream.status)
    res.setHeader('Content-Type', contentType)
    res.send(body)
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch epaper site', detail: (err as Error).message })
  }
})

app.use(express.static(FRONTEND_DIST))

// IMPORTANT: keep this last — all API routes must be registered above this line
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`DeskOS backend running on http://localhost:${PORT}`)
})
