import { test, expect } from '@playwright/test'

// Smoke test — confirms the SkipSync app boots and the login screen renders
// at both desktop and mobile viewports (project matrix in playwright.config.js).
//
// Pre-req: `npm run dev` is reachable (Playwright starts it automatically via webServer).
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY may be unset locally — the AuthGate
// still routes to LoginPage when there's no session, so this test does not require
// a working Supabase project.

test('login screen renders at /', async ({ page }) => {
  await page.goto('/')
  // LoginPage shows a heading containing "SkipSync" and an email input
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
