import { defineConfig } from 'vitest/config'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://pb:pb_local_dev_only@localhost:5432/portfolio_builder_test'

if (!TEST_DATABASE_URL.includes('test')) {
  throw new Error('TEST_DATABASE_URL must point to a *_test database')
}

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: 'test-secret-test-secret-test-secret-0000',
      CORS_ORIGINS: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
      RATE_LIMIT_DISABLED: 'true',
      CONTENT_DIR: '../../content',
    },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
