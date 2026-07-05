import express from 'express'
import path from 'path'
import { settingsRouter } from './routes/settings'
import { standbyRouter } from './routes/standby'
import { systemRouter } from './routes/system'
import { newsRouter } from './routes/news'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)
const FRONTEND_DIST = path.join(__dirname, '../../../dist/frontend')

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' })
})

app.use('/api', settingsRouter)
app.use('/api', standbyRouter)
app.use('/api', systemRouter)
app.use('/api', newsRouter)

app.use(express.static(FRONTEND_DIST))

// IMPORTANT: keep this last — all API routes must be registered above this line
app.get(/^(?!\/api).*$/, (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'))
})

// Bound to loopback only — the kiosk and the Vite dev proxy both reach this
// via localhost, and this is now the first PR with mutating routes
// (settings/rotate/standby/shutdown), so it must not be reachable from the
// rest of the LAN.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`DeskOS backend running on http://localhost:${PORT}`)
})
