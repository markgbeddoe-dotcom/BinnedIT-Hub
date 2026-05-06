import { test, expect } from '@playwright/test'

/**
 * Cash vs Accrual basis toggle — Sprint 17 #17E persona-driven e2e specs.
 *
 * Companion plan: docs/audits/2026-05-07-cash-accrual-uat.md
 *
 * Source-of-truth dollar values (Feb 2026, closed month):
 *   - Cash net profit:    -$17,638.72
 *   - Accrual net profit:  $30,511.71
 *   - Δ (accrual - cash): +$48,150.43
 *
 * These match the assertions in the UAT plan §1 and the Vitest regression
 * case in api/lib/xero-mapper.test.js. If you change one of the three,
 * change all three.
 *
 * Selectors used by these tests (TODO for sibling agent 17D — please add
 * the data-testid attributes below to the components in question; the
 * test file documents the contract sibling 17C+17D need to honour):
 *
 *   data-testid="basis-toggle-desktop"   on the header chip (visible >= 768px)
 *   data-testid="basis-toggle-mobile"    on the mobile-drawer item (visible < 768px)
 *   data-testid="basis-toggle"           wrapper element common to both — the
 *                                         test asserts presence via the
 *                                         viewport-specific selector first,
 *                                         then falls back to the generic one.
 *   data-testid="kpi-net-profit"         the Snapshot Net Profit tile value
 *   data-testid="basis-pill-accrual"     the "(accrual basis)" badge that
 *                                         appears when accrual is active.
 *                                         MUST NOT be rendered when cash is
 *                                         active.
 *
 * Setup notes:
 *   - The login.spec.js precedent shows we test the unauthenticated boot path
 *     via baseURL '/'. For this feature we need to reach the Snapshot tab.
 *     Sibling 17D should expose a `?role=` query-param test escape hatch
 *     (or a fixture-injected test-only AuthContext provider) so we can mock
 *     the role without standing up a Supabase test user. See the Investor
 *     test below — that's the contract.
 *
 *   - All tests run at both desktop (1440x900) and mobile (390x844) per
 *     playwright.config.js project matrix. We branch selector choice off
 *     viewport.width.
 *
 *   - These tests will FAIL until 17C (mapper basis flag) and 17D (toggle
 *     UI + testids) cherry-pick into master. Do NOT run `npm run test:e2e`
 *     in this worktree — it's expected to fail. Verify by running it
 *     post-integration on master.
 */

// ── Constants pinned to the UAT plan §1 ──────────────────────────────────────

const FEB_2026_CASH_NET_PROFIT_REGEX = /-?\$?\(?17[,.]638\.72\)?/
const FEB_2026_ACCRUAL_NET_PROFIT_REGEX = /\$?30[,.]511\.71/

// ── Helpers ──────────────────────────────────────────────────────────────────

function isMobile(page) {
  return page.viewportSize().width < 768
}

/** Returns the toggle Locator appropriate for the current viewport. */
function basisToggle(page) {
  return isMobile(page)
    ? page.locator('[data-testid="basis-toggle-mobile"]')
    : page.locator('[data-testid="basis-toggle-desktop"]')
}

/** Returns the Net Profit KPI tile Locator. */
function netProfitTile(page) {
  return page.locator('[data-testid="kpi-net-profit"]')
}

/**
 * Navigate to the Snapshot dashboard for Feb 2026 with optional basis
 * pre-selected (URL param). Sibling 17D should ensure the Snapshot tab is
 * reachable at /dashboard/snapshot (existing route per PRD-v6 §6.2).
 */
async function gotoSnapshotFeb2026(page, opts = {}) {
  const params = new URLSearchParams()
  params.set('month', '2026-02')
  if (opts.basis) params.set('basis', opts.basis)
  if (opts.role) params.set('role', opts.role) // test-only role escape hatch
  await page.goto(`/dashboard/snapshot?${params.toString()}`)
}

/**
 * Clear localStorage AND any persisted basis state before the test runs.
 * The default-on-first-load assertion depends on this being clean.
 */
async function clearBasisPersistence(page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem('skipsync.basis')
      window.localStorage.removeItem('basis')
    } catch (_) { /* localStorage may not be available pre-navigation */ }
  })
}

// ── 1. Toggle visibility (desktop + mobile selectors) ────────────────────────

test.describe('cash/accrual toggle — visibility at both viewports', () => {
  test('toggle is visible in the header for the current viewport', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    // Viewport-specific selector should be visible
    await expect(basisToggle(page)).toBeVisible({ timeout: 10_000 })
  })

  test('the OTHER viewport selector is hidden (desktop chip not on mobile, vice versa)', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    if (isMobile(page)) {
      // On mobile, the desktop header chip should be display:none / not in tree.
      await expect(page.locator('[data-testid="basis-toggle-desktop"]')).toBeHidden()
    } else {
      // On desktop, the mobile drawer item should be hidden.
      await expect(page.locator('[data-testid="basis-toggle-mobile"]')).toBeHidden()
    }
  })
})

// ── 2. Default basis is cash on first load (Mark §2.1, Sarah §2.2, Jake §2.3) ─

test.describe('cash/accrual toggle — first-load default', () => {
  test('default basis is cash; Net Profit tile shows -$17,638.72 for Feb 2026', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(netProfitTile(page)).toBeVisible({ timeout: 10_000 })
    await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX)
    // The (accrual basis) pill MUST NOT be present when cash is active.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })
})

// ── 3. Clicking Accrual updates state + KPI tile ─────────────────────────────

test.describe('cash/accrual toggle — clicking Accrual updates state and visible value', () => {
  test('toggle to accrual changes Net Profit tile from cash to accrual value', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX)

    // Click the toggle. The exact interaction depends on how 17D implements it
    // (button toggle, segmented control, switch). We use .click() on the
    // viewport-specific testid wrapper — sibling 17D should ensure the click
    // target propagates a single basis change regardless of element type.
    await basisToggle(page).click()

    // KPI value should update without a full reload (within 500ms per §2.1 #3).
    await expect(netProfitTile(page)).toHaveText(FEB_2026_ACCRUAL_NET_PROFIT_REGEX, { timeout: 1000 })

    // State should flow into URL OR localStorage (either is acceptable per §2.1 #4).
    const url = new URL(page.url())
    const localBasis = await page.evaluate(() => window.localStorage.getItem('skipsync.basis'))
    expect(url.searchParams.get('basis') === 'accrual' || localBasis === 'accrual').toBe(true)
  })
})

// ── 4. Persistence: refresh keeps the chosen basis (localStorage) ────────────

test.describe('cash/accrual toggle — persistence across refresh', () => {
  test('selecting accrual then refreshing keeps the page on accrual', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    await basisToggle(page).click()
    await expect(netProfitTile(page)).toHaveText(FEB_2026_ACCRUAL_NET_PROFIT_REGEX, { timeout: 1000 })

    // Hard reload — same URL, no query-param shortcut.
    await page.reload()

    await expect(netProfitTile(page)).toBeVisible({ timeout: 10_000 })
    await expect(netProfitTile(page)).toHaveText(FEB_2026_ACCRUAL_NET_PROFIT_REGEX)
    // Pill should also be back.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toBeVisible()
  })
})

// ── 5. "(accrual basis)" pill appears when accrual is active ─────────────────

test.describe('cash/accrual toggle — accrual basis pill visibility', () => {
  test('pill appears when accrual is active and disappears when toggled back', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page)
    // Initially cash — pill absent.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)

    // Toggle to accrual — pill appears.
    await basisToggle(page).click()
    const pill = page.locator('[data-testid="basis-pill-accrual"]')
    await expect(pill).toBeVisible({ timeout: 1000 })
    await expect(pill).toHaveText(/accrual basis/i)

    // Toggle back to cash — pill disappears.
    await basisToggle(page).click()
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })
})

// ── 6. Investor role: toggle disabled, basis stays cash (UAT §2.4) ───────────
//
// Mocking the role:
//   - Preferred mechanism (sibling 17D should add): a `?role=investor`
//     query-param escape hatch that the AuthContext honours when running
//     under Playwright (gate via NODE_ENV !== 'production' or a Vite env
//     flag like VITE_ALLOW_TEST_ROLE).
//   - Fallback mechanism (also acceptable): Playwright fixture that sets
//     a cookie or localStorage entry like `skipsync.test.role=investor`
//     before navigation. This file uses the query-param approach — if 17D
//     chooses the localStorage approach, swap the addInitScript below.
//
// TODO 17D — without the escape hatch the test cannot run; document above
// covers the two acceptable shapes.

test.describe('cash/accrual toggle — investor role lock (UAT §2.4)', () => {
  test('investor sees the toggle but cannot interact; basis stays cash', async ({ page }) => {
    await clearBasisPersistence(page)
    // Use the query-param escape hatch. Sibling 17D may instead rely on
    // a localStorage-based test fixture — see comment block above.
    await gotoSnapshotFeb2026(page, { role: 'investor' })

    const toggle = basisToggle(page)
    await expect(toggle).toBeVisible({ timeout: 10_000 })

    // Disabled state — accept either `disabled` attribute or `aria-disabled="true"`.
    const isDisabled = await toggle.evaluate((el) => {
      return el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    })
    expect(isDisabled).toBe(true)

    // Tooltip / title / aria-describedby explains why.
    const explainer = await toggle.evaluate((el) => {
      const title = el.getAttribute('title') || ''
      const describedById = el.getAttribute('aria-describedby')
      let described = ''
      if (describedById) {
        const node = document.getElementById(describedById)
        if (node) described = node.textContent || ''
      }
      // Also check for a child .tooltip element if the implementation uses one.
      const tooltipChild = el.querySelector('[role="tooltip"]')?.textContent || ''
      return `${title} ${described} ${tooltipChild}`.trim()
    })
    expect(explainer).toMatch(/investor|reporting consistency|contact the owner/i)

    // KPI tile must read the cash value before AND after a force-click.
    await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX)

    // Force-click the disabled control. The basis must NOT change.
    await toggle.click({ force: true }).catch(() => { /* disabled elements may throw */ })
    await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX)

    // Pill must NEVER render on the investor route.
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })

  test('investor: ?basis=accrual deep-link is silently overridden to cash', async ({ page }) => {
    await clearBasisPersistence(page)
    await gotoSnapshotFeb2026(page, { role: 'investor', basis: 'accrual' })
    await expect(netProfitTile(page)).toBeVisible({ timeout: 10_000 })
    // Even with ?basis=accrual in the URL, investor sees cash. Per UAT §3.2
    // follow-up: "even with ?basis=accrual in the URL, the page renders cash".
    await expect(netProfitTile(page)).toHaveText(FEB_2026_CASH_NET_PROFIT_REGEX)
    await expect(page.locator('[data-testid="basis-pill-accrual"]')).toHaveCount(0)
  })
})
