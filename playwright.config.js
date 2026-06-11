import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import { STORAGE_STATE } from './e2e/auth-helpers.js'

// SkipSync E2E config — matches the desktop + mobile QA protocol from CLAUDE.md.
// Run with: npm run test:e2e (after one-time `npm run test:e2e:install`)
//
// GAP-072 auth fixture: the `setup` project logs in once via the real LoginPage
// (TEST_USER_EMAIL / TEST_USER_PASSWORD env, see e2e/README.md) and saves the
// Supabase session to e2e/.auth/user.json; desktop + mobile projects reuse it
// via storageState, so specs start already authenticated. Specs that test the
// unauthenticated path opt out with `test.use({ storageState: NO_AUTH_STATE })`.

// Local convenience: pick up TEST_USER_* / VITE_SUPABASE_* from .env.local.
dotenv.config({ path: '.env.local' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // One-time login; writes e2e/.auth/user.json (empty state if login fails,
    // so the rest of the suite still starts — see e2e/auth.setup.js).
    { name: 'setup', testMatch: /auth\.setup\.js/, use: { ...devices['Desktop Chrome'] } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
