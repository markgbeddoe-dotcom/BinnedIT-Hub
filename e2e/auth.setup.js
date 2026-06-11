// GAP-072 — e2e auth fixture (storageState pattern).
//
// Runs once as the `setup` project before the desktop/mobile projects.
// Logs into SkipSync through the real LoginPage UI with TEST_USER_EMAIL /
// TEST_USER_PASSWORD (defaults to the known local test login from CLAUDE.md)
// and saves the browser storage state — including the Supabase session token
// in localStorage — to e2e/.auth/user.json. The desktop/mobile projects then
// start every spec already authenticated.
//
// Failure mode: if login is impossible (no Supabase reachable, bad creds),
// we write an EMPTY storage state instead of failing the whole run, so the
// unauthenticated smoke spec (login.spec.js) still executes and authed specs
// self-skip via hasAuthState(). Set E2E_REQUIRE_AUTH=1 to hard-fail instead.

import fs from 'node:fs'
import path from 'node:path'
import { test as setup, expect } from '@playwright/test'
import { STORAGE_STATE, NO_AUTH_STATE } from './auth-helpers.js'

const EMAIL = process.env.TEST_USER_EMAIL || 'mark@binnedit.com.au'
const PASSWORD = process.env.TEST_USER_PASSWORD || 'BinnedIT2024x'

setup('authenticate as office test user', async ({ page }) => {
  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true })

  try {
    await page.goto('/')
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Successful office login lands on /home (main.jsx AuthGate -> App ->
    // "/" redirects to "/home"). Investor/viewer roles land on /investor.
    await expect(page).toHaveURL(/\/(home|investor)/, { timeout: 20_000 })

    await page.context().storageState({ path: STORAGE_STATE })
    console.log(`[auth.setup] Saved authenticated storage state for ${EMAIL}`)
  } catch (err) {
    if (process.env.E2E_REQUIRE_AUTH === '1') throw err
    fs.writeFileSync(STORAGE_STATE, JSON.stringify(NO_AUTH_STATE, null, 2))
    console.warn(
      `\n[auth.setup] WARNING: login as ${EMAIL} failed (${err.message?.split('\n')[0]}).\n` +
      '[auth.setup] Wrote an EMPTY storage state — authenticated specs will be SKIPPED.\n' +
      '[auth.setup] Check TEST_USER_EMAIL / TEST_USER_PASSWORD and that VITE_SUPABASE_URL /\n' +
      '[auth.setup] VITE_SUPABASE_ANON_KEY point at a reachable Supabase project.\n' +
      '[auth.setup] Set E2E_REQUIRE_AUTH=1 to make this a hard failure.\n'
    )
  }
})
