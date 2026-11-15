import { createApp } from './app.js'

const DEFAULT_PORT = 3001
const port = Number(process.env.PORT ?? DEFAULT_PORT)

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env first.')
  process.exit(1)
}

createApp().listen(port, () => {
  console.log(`TaskFlow API running on http://localhost:${port}`)
})
