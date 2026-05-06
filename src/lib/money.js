/**
 * @file src/lib/money.js
 *
 * Sprint 14 #29 — money rounding helpers. Closes audit
 * `docs/audits/2026-05-06/audit-pricing-bugs.md` §5: rounding was ad-hoc
 * (`Math.round`, `.toFixed`, unrounded floats mixed across PricingTab /
 * CompetitorPage / costAllocator). The same metric rounded differently in
 * different places, so users would (rightly) see PricingTab show "$865" while
 * FleetTab showed "$863" for the same bin.
 *
 * Rules (per audit recommended contract):
 *   - Round MONEY to nearest cent at calculation time, NOT at display time.
 *   - Round PERCENTAGES to 1 decimal at display time only.
 *   - `avg_price = revenue / deliveries`, ex GST, cents-precision.
 *   - Format with en-AU locale; negatives are `-$X,XXX.YY`.
 *   - null / undefined / NaN inputs return safe values (0 for math, '—' for
 *     formatted display) rather than propagating NaN through KPIs.
 *
 * See src/lib/money.test.js for full coverage of edge cases.
 */

/**
 * Round money to nearest cent (always at calculation time, not display).
 * Returns 0 for null/undefined/NaN so KPIs never show NaN.
 */
export function roundMoney(value) {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Round percentage to 1 decimal (display formatting helper).
 * Returns 0 for null/undefined/NaN.
 */
export function roundPercent(value) {
  if (value === null || value === undefined) return 0
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10) / 10
}

/**
 * Compute average price as revenue / deliveries with cents-precision.
 * Returns 0 if deliveries is 0/null/undefined (no divide-by-zero NaN leak).
 *
 * Canonical contract from audit §recommendation 2: PricingTab + FleetTab MUST
 * use this helper so the same bin doesn't show two different "avg price"
 * numbers across tabs.
 */
export function avgPrice(revenue, deliveries) {
  if (revenue === null || revenue === undefined) return 0
  if (deliveries === null || deliveries === undefined) return 0
  const r = Number(revenue)
  const d = Number(deliveries)
  if (!Number.isFinite(r) || !Number.isFinite(d)) return 0
  if (d === 0) return 0
  return roundMoney(r / d)
}

/**
 * Format $X,XXX.YY string for display (en-AU). Negatives are -$X,XXX.YY.
 *
 * @param {number|null|undefined} value
 * @param {{ showCents?: boolean }} [opts] - showCents defaults to true.
 * @returns {string} e.g. "$1,234.56", "-$1,234.56", "$1,234" (when showCents:false), "—" for null/NaN.
 */
export function formatMoney(value, opts = { showCents: true }) {
  if (value === null || value === undefined) return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'

  const showCents = opts && opts.showCents !== false
  const minFrac = showCents ? 2 : 0
  const maxFrac = showCents ? 2 : 0

  // Use absolute value for the en-AU number portion, then prepend sign + $
  // ourselves so the sign placement is "-$1,234.56" (NOT "$-1,234.56" that
  // some en-AU currency implementations produce).
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-AU', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  })
  const sign = n < 0 ? '-' : ''
  return `${sign}$${formatted}`
}
