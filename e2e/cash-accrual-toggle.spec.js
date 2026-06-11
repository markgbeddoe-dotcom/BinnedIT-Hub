import { test, expect } from '@playwright/test'
import { hasAuthState } from './auth-helpers.js'

/**
 * Cash vs Accrual basis toggle — Sprint 17 #17E persona-driven e2e specs.
 * REPAIRED 2026-06-10 (GAP-072): the original file was written before siblings
 * 17C/17D landed and 8/9 tests died at login. Changes:
 *
 *   1. AUTH — specs now run authenticated via the storageState fixture
 *      (playwright.config.js `setup` project + e2e/auth.setup.js). If login
 *      wasn't possible, hasAuthState() is false and every test here SKIPS
 *      with a clear reason instead of timing out for 30s each.
 *
 *   2. SELECTORS — sibling 17D shipped a segmented control: the wrapper
 *      carries data-testid="basis-toggle-desktop|mobile" plus data-basis and
 *      data-basis-locked attributes; the two buttons inside carry
 *      data-testid="basis-toggle-cash" / "basis-toggle-accrual" (App.jsx
 *      ~L313-352). Clicking the WRAPPER (as the original spec did) hits an
 *      arbitrary button — we now click the specific basis button and assert
 *      state via the wrapper's data-basis attribute.
 *
 *   3. STORAGE KEY — the real key is 'skipsync.accounting_basis'
 *      (src/hooks/useAccountingBasis.js L26), not 'skipsync.basis'.
 *
 *   4. LIVE-DATA ASSERTIONS — exact Feb-2026 dollar assertions (GAP-076:
 *      brittle against re-sync) only run when E2E_LIVE_DATA=1. State/pill
 *      assertions run everywhere.
 *
 *   5. INVESTOR TESTS — the promised `?role=` escape hatch was never built,
 *      and main.jsx AuthGate hard-redirects viewer/investor off /dashboard/*
 *      entirely, so the "investor sees a disabled toggle on Snapshot"
 *      scenario cannot exist as written. Marked test.skip with a TODO.
 *
 * Source-of-truth dollar values (Feb 2026, closed month):
 *   - Cash net profit:    -$17,638.72
 *   - Accrual net profit:  $30,511.71
 * These match api/lib/xero-mapper.test.js and the UAT plan §1 — change all
 * three together.
 */

// ── Constants ────────────────────────────────────────────────────────────────

const BASIS_STORAGE_KEY = 'skipsync.accounting_basis' // useAccountingBasis.js L26
const FEB_2026_CASH_NET_PROFIT_REGEX = /-?\$?\(?17[,.]638\.72\)?/
const FEB_2026_ACCRUAL_NET_PROFIT_REGEX = /\$?30[,.]511\.71/

// Exact dollar assertions require a live Supabase with Feb-2026 synced.
const LIVE_DATA = process.env.E2E_LIVE_DATA === '1'

// Every test in this file needs an authenticated session.
test.skip(!hasAuthState(), 'No authenticated storage state — login failed in auth.setup.js (see its console warning). Authenticated basis-toggle specs need a reachable Supabase + valid TEST_USER_EMAIL/TEST_USER_PASSWORD.')

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMobile(page) {
  return page.viewportSize().width < 768
}

/** The segmented-control WRAPPER for the current viewport (carries data-basis). */
function basisToggle(page) {
  return isMobile(page)
    ? page.locator('[data-testid="basis-toggle-mobile"]')
    : page.locator('[data-testid="basis-toggle-desktop"]')
}

/** The specific basis button inside the wrapper ('cash' | 'accrual'). */
function basisButton(page, basis) {
  return basisToggle(page).locator(`[data-testid="basis-toggle-${basis}"]`)
}

/** The Net Profit KPI tile Locator (SnapshotTab). */
function netProfitTile(page) {
  return page.locator('[data-testid="kpi-net-profit"]')
}

/** Navigate to the Snapshot dashboard for Feb 2026. */
async function gotoSnapshotFeb2026(page) {
  await page.goto('/dashboard/snapshot?month=2026-02')
}

/** Clear persisted basis state before page scripts run, so default-on-first-load
 *  assertions start clean. NOTE: init scripts re-run on EVERY navigation, so we
 *  guard with sessionStorage to only wipe on the first load — otherwise the
 *  persistence-across-refresh test would wipe its own persisted choice. */
async function clearBasisPersistence(page) {
  await page.addInitScript((key) => {
    try {
      if (!window.sessionStorage.getItem('__e2e_basis_wiped')) {
        window.localStorage.removeItem(key)
        window.localStorage.removeItem('skipsync.basis') // legacy key from pre-17D spec
        window.sessionStorage.setItem('__e2e_basis_wiped', '1')
      }
    } catch {
      /* storage may not be available pre-navigation */
    }
  }, BASIS_STORAGE_KEY)
}

// ── 1. Toggle visibility (desktop + mobile selectors) ────────────────────────

test.describe('cash/accrual toggle — visibility at both viewports', () => {
  test('toggle is visible in the header for the current viewport', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    // Segmented control exposes both basis buttons.
    await expect(basisButton(page, 'cash')).toBeVisible()
    await expect(basisButton(page, 'accrual')).toBeVisible()
  })

  test('the OTHER viewport selector is not rendered (desktop chip not on mobile, vice versa)', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    if (isMobile(page)) {
      await expect(page.locator('[data-testid="basis-toggle-desktop"]')).toBeHidden()
    } else {
      await expect(page.locator('[data-testid="basis-toggle-mobile"]')).toBeHidden()
    }
  })
})

// ── 2. Default basis is cash on first load (Mark §2.1, Sarah §2.2, Jake §2.3) ─

test.describe('cash/accrual toggle — first-load default', () => {
  test('default basis is cash; accrual pill absent', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'cash')
    // The (accrual basis) pill MUST NOT be present when cash is active.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)

    if (LIVE_DATA) {
      // GAP-076: exact Feb-2026 value — only meaningful against the live synced DB.
      await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX, { timeout: 15_000 })
    }
  })
})

// ── 3. Clicking Accrual updates state + KPI tile ─────────────────────────────

test.describe('cash/accrual toggle — clicking Accrual updates state and visible value', () => {
  test('toggle to accrual updates basis state and persists to localStorage', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'cash', { timeout: 15_000 })

    await basisButton(page, 'accrual').click()

    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'accrual')
    const persisted = await page.evaluate((key) => window.localStorage.getItem(key), BASIS_STORAGE_KEY)
    expect(persisted).toBe('accrual')

    if (LIVE_DATA) {
      await expect(netProfitTile(page)).toHaveText(FEB_2026_ACCRUAL_NET_PROFIT_REGEX, { timeout: 5_000 })
    }
  })
})

// ── 4. Persistence: refresh keeps the chosen basis (localStorage) ────────────

test.describe('cash/accrual toggle — persistence across refresh', () => {
  test('selecting accrual then refreshing keeps the page on accrual', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    await basisButton(page, 'accrual').click()
    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'accrual')

    // Hard reload — same URL, no query-param shortcut. The init script from
    // clearBasisPersistence re-runs here but is sessionStorage-guarded, so the
    // persisted accrual choice survives.
    await page.reload()

    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'accrual')
    await expect(page.locator('[data-testid="basis-pill-accrual"]').first()).toBeVisible()

    if (LIVE_DATA) {
      await expect(netProfitTile(page)).toHaveText(FEB_2026_ACCRUAL_NET_PROFIT_REGEX, { timeout: 15_000 })
    }
  })
})

// ── 5. "(accrual basis)" pill appears when accrual is active ─────────────────

test.describe('cash/accrual toggle — accrual basis pill visibility', () => {
  test('pill appears when accrual is active and disappears when toggled back', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(basisToggle(page)).toBeVisible({ timeout: 15_000 })
    // Initially cash — pill absent.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)

    // Toggle to accrual — pill appears (desktop renders it on the active tab,
    // mobile renders a standalone pill; both carry the same testid).
    await basisButton(page, 'accrual').click()
    const pill = page.locator('[data-testid="basis-pill-accrual"]').first()
    await expect(pill).toBeVisible({ timeout: 2_000 })
    await expect(pill).toHaveText(/accrual basis/i)

    // Toggle back to cash — pill disappears.
    await basisButton(page, 'cash').click()
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })
})

// ── 6. Investor role: toggle disabled, basis stays cash (UAT §2.4) ───────────
//
// TODO (GAP-072 follow-up — needs a product decision, not just test code):
// these two specs are UNRUNNABLE against the current app:
//   - The promised `?role=investor` test escape hatch was never built
//     (no role/basis query-param handling exists in App.jsx or AuthContext).
//   - main.jsx AuthGate redirects viewer/investor roles to /investor for ANY
//     other path, so an investor can never reach /dashboard/snapshot to see
//     a "disabled" toggle there. The basis lock itself lives in
//     useAccountingBasis (locked => forced 'cash') and is best covered by a
//     vitest hook test plus an e2e against a real investor storageState
//     fixture (second setup project with TEST_INVESTOR_EMAIL/PASSWORD).
// Re-enable once either (a) an investor test account + second storageState
// fixture exists, or (b) the escape hatch ships behind VITE_ALLOW_TEST_ROLE.

test.describe('cash/accrual toggle — investor role lock (UAT §2.4)', () => {
  test.skip(true, 'Needs an investor auth fixture: ?role= escape hatch was never built and AuthGate redirects investors off /dashboard/* — see TODO above.')

  test('investor sees the toggle but cannot interact; basis stays cash', async ({ page }) => {
    await gotoSnapshotFeb2026(page)
    const toggle = basisToggle(page)
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    await expect(toggle).toHaveAttribute('data-basis-locked', 'true')
    await expect(basisButton(page, 'accrual')).toBeDisabled()
    await basisButton(page, 'accrual').click({ force: true }).catch(() => {})
    await expect(toggle).toHaveAttribute('data-basis', 'cash')
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })

  test('investor: ?basis=accrual deep-link is silently overridden to cash', async ({ page }) => {
    await page.goto('/dashboard/snapshot?month=2026-02&basis=accrual')
    await expect(basisToggle(page)).toHaveAttribute('data-basis', 'cash', { timeout: 10_000 })
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })
})
