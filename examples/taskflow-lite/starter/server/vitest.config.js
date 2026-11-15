import fs from 'node:fs'
import { defineConfig } from 'vitest/config'

if (fs.existsSync('.env.test')) process.loadEnvFile('.env.test')

if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error(
    'Tests need a separate database. Set DATABASE_URL in .env.test to a *_test database.',
  )
}

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.js'],
    fileParallelism: false,
  },
})
