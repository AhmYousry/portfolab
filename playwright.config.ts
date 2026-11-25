import { defineConfig, devices } from '@playwright/test'

const channel = process.env.PW_CHANNEL

// Second web server with PostHog enabled against a fake host that Playwright intercepts.
// Lets E2E inspect the exact payloads the real SDK would send, without any network egress.
export const ANALYTICS_WEB_PORT = 5175
export const FAKE_POSTHOG_HOST = 'https://posthog.e2e.test'

export const FREE_LAUNCH_WEB_PORT = 5176
const freeLaunch = process.env.PW_FREE_LAUNCH === '1'
const ISOLATED_SPECS = /(analytics|free-launch)\.spec\.ts/

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'ar-EG',
    trace: 'retain-on-failure',
    ...(channel ? { channel } : {}),
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) },
      grepInvert: /@mobile/,
      testIgnore: ISOLATED_SPECS,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], ...(channel ? { channel } : {}) },
      grep: /@mobile/,
      testIgnore: ISOLATED_SPECS,
    },
    {
      name: 'analytics',
      testMatch: /analytics\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(channel ? { channel } : {}),
        baseURL: `http://localhost:${ANALYTICS_WEB_PORT}`,
        // posthog-js drops events from "HeadlessChrome" user agents (bot filter); use a normal UA.
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    },
    ...(freeLaunch
      ? [
          {
            name: 'free-launch',
            testMatch: /free-launch\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              ...(channel ? { channel } : {}),
              baseURL: `http://localhost:${FREE_LAUNCH_WEB_PORT}`,
            },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: 'pnpm --filter @pb/api dev:local',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @pb/web dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @pb/web exec vite --port ${ANALYTICS_WEB_PORT} --strictPort`,
      url: `http://localhost:${ANALYTICS_WEB_PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        VITE_POSTHOG_KEY: 'phc_e2e_fake_project_key',
        VITE_POSTHOG_HOST: FAKE_POSTHOG_HOST,
        VITE_POSTHOG_REPLAY_ENABLED: 'false',
      },
    },
    ...(freeLaunch
      ? [
          {
            command: `pnpm --filter @pb/web exec vite --port ${FREE_LAUNCH_WEB_PORT} --strictPort`,
            url: `http://localhost:${FREE_LAUNCH_WEB_PORT}`,
            reuseExistingServer: true,
            timeout: 60_000,
            env: { VITE_FREE_LAUNCH: 'true' },
          },
        ]
      : []),
  ],
})
