import express from 'express'
import path from 'path'

const app = express()
const PORT = process.env.PORT ?? 3001
const FRONTEND_DIST = path.join(__dirname, '../../dist/frontend')

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' })
})

app.use(express.static(FRONTEND_DIST))

// IMPORTANT: keep this last — all API routes must be registered above this line
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`DeskOS backend running on http://localhost:${PORT}`)
})
