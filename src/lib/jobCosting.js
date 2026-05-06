/**
 * @file src/lib/jobCosting.js
 *
 * Pure helpers for computing per-job costing (revenue / cost-so-far /
 * margin-so-far) from a booking row. Closes audit P0-8 (Sprint 14 #19) —
 * `JobCostingWidget` was orphaned because there was no shared shape it could
 * consume from a parent that knows nothing about the driver schema.
 *
 * Inputs use the Supabase `bookings` row shape (see
 * `supabase/migrations/008_driver_app.sql`):
 *   - price                 — invoice / quoted revenue (AUD, ex-GST)
 *   - estimated_fuel        — pre-job estimate
 *   - estimated_tip_fee     — pre-job estimate
 *   - estimated_driver_time — hours
 *   - actual_fuel           — populated by the driver on completion
 *   - actual_tip_fee        — populated by the driver on completion
 *   - actual_driver_time    — hours
 *   - actual_total_cost     — overrides the parts above when present
 *
 * Driver labour rate is currently a hard-coded $45/hr (matches `src/api/driver.js`
 * `getJobCostVariances`). When SettingsPage exposes a configurable rate this
 * should accept it as an option.
 *
 * `computeJobCosting` NEVER throws and ALWAYS returns numbers (zeroes when
 * nothing is known). Callers should branch on `hasActuals` to decide whether
 * to show "estimate only" vs "live cost".
 */

export const DRIVER_HOURLY_RATE_AUD = 45

/**
 * Sum of (estimated_fuel + estimated_tip_fee + estimated_driver_time * rate).
 * Returns 0 when fields are missing.
 */
export function estimatedTotalCost(booking, rate = DRIVER_HOURLY_RATE_AUD) {
  if (!booking) return 0
  const fuel = Number(booking.estimated_fuel) || 0
  const tip = Number(booking.estimated_tip_fee) || 0
  const time = Number(booking.estimated_driver_time) || 0
  return fuel + tip + time * rate
}

/**
 * Sum of actuals. Prefers `actual_total_cost` if the driver entered an explicit
 * total; otherwise sums the line-items. Returns 0 when nothing is recorded.
 */
export function actualTotalCost(booking, rate = DRIVER_HOURLY_RATE_AUD) {
  if (!booking) return 0
  if (booking.actual_total_cost != null) return Number(booking.actual_total_cost) || 0
  const fuel = Number(booking.actual_fuel) || 0
  const tip = Number(booking.actual_tip_fee) || 0
  const time = Number(booking.actual_driver_time) || 0
  return fuel + tip + time * rate
}

/**
 * True if any actual cost field has been populated by a driver.
 */
export function hasActualCosts(booking) {
  if (!booking) return false
  return (
    booking.actual_total_cost != null ||
    booking.actual_fuel != null ||
    booking.actual_tip_fee != null ||
    booking.actual_driver_time != null
  )
}

/**
 * Revenue for the job. Falls back to estimated_cost (the legacy field on
 * sample data) when `price` is not set.
 */
export function jobRevenue(booking) {
  if (!booking) return 0
  if (booking.price != null) return Number(booking.price) || 0
  if (booking.estimated_cost != null) return Number(booking.estimated_cost) || 0
  return 0
}

/**
 * Master per-job costing computation. Returns:
 *   - revenue            — AUD, ex-GST
 *   - estimatedCost      — AUD
 *   - costSoFar          — actual if any actuals recorded, else estimated
 *   - marginSoFar        — revenue − costSoFar
 *   - marginPct          — marginSoFar / revenue × 100 (0 when revenue is 0)
 *   - hasActuals         — true if at least one actual_* field populated
 *   - estimateVariance   — actualTotal − estimatedTotal (0 when no actuals)
 *   - estimateVariancePct — same as fraction of estimate
 *
 * Numbers are NOT rounded — that's the renderer's job.
 */
export function computeJobCosting(booking, rate = DRIVER_HOURLY_RATE_AUD) {
  const revenue = jobRevenue(booking)
  const estimatedCost = estimatedTotalCost(booking, rate)
  const hasActuals = hasActualCosts(booking)
  const actualCost = hasActuals ? actualTotalCost(booking, rate) : 0
  const costSoFar = hasActuals ? actualCost : estimatedCost
  const marginSoFar = revenue - costSoFar
  const marginPct = revenue > 0 ? (marginSoFar / revenue) * 100 : 0
  const estimateVariance = hasActuals ? actualCost - estimatedCost : 0
  const estimateVariancePct = estimatedCost > 0
    ? (estimateVariance / estimatedCost) * 100
    : 0

  return {
    revenue,
    estimatedCost,
    actualCost,
    costSoFar,
    marginSoFar,
    marginPct,
    hasActuals,
    estimateVariance,
    estimateVariancePct,
  }
}
