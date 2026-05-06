import { describe, it, expect } from 'vitest'
import {
  computeJobCosting,
  estimatedTotalCost,
  actualTotalCost,
  hasActualCosts,
  jobRevenue,
  DRIVER_HOURLY_RATE_AUD,
} from './jobCosting'

describe('jobCosting — guard rails', () => {
  it('returns zeroes for null/undefined booking', () => {
    const r = computeJobCosting(null)
    expect(r.revenue).toBe(0)
    expect(r.costSoFar).toBe(0)
    expect(r.marginSoFar).toBe(0)
    expect(r.marginPct).toBe(0)
    expect(r.hasActuals).toBe(false)
  })

  it('handles empty booking object', () => {
    const r = computeJobCosting({})
    expect(r.revenue).toBe(0)
    expect(r.estimatedCost).toBe(0)
    expect(r.hasActuals).toBe(false)
  })

  it('hasActualCosts: false when no actual_* fields', () => {
    expect(hasActualCosts({ price: 500, estimated_fuel: 50 })).toBe(false)
  })

  it('hasActualCosts: true when any actual_* present', () => {
    expect(hasActualCosts({ actual_fuel: 0 })).toBe(true)         // explicit 0 still counts
    expect(hasActualCosts({ actual_tip_fee: 80 })).toBe(true)
    expect(hasActualCosts({ actual_total_cost: 200 })).toBe(true)
  })
})

describe('estimatedTotalCost', () => {
  it('sums fuel + tip + time × rate', () => {
    const total = estimatedTotalCost({
      estimated_fuel: 30,
      estimated_tip_fee: 80,
      estimated_driver_time: 2,
    })
    // 30 + 80 + 2 × 45 = 200
    expect(total).toBe(200)
  })

  it('treats missing fields as 0', () => {
    expect(estimatedTotalCost({ estimated_fuel: 50 })).toBe(50)
    expect(estimatedTotalCost({ estimated_driver_time: 1 })).toBe(45)
  })

  it('respects custom rate', () => {
    expect(estimatedTotalCost({ estimated_driver_time: 2 }, 60)).toBe(120)
  })
})

describe('actualTotalCost', () => {
  it('prefers actual_total_cost when present', () => {
    expect(actualTotalCost({
      actual_total_cost: 250,
      actual_fuel: 999,           // ignored
      actual_driver_time: 99,
    })).toBe(250)
  })

  it('sums line items when actual_total_cost is null', () => {
    expect(actualTotalCost({
      actual_fuel: 40,
      actual_tip_fee: 90,
      actual_driver_time: 1.5,    // 1.5 × 45 = 67.5
    })).toBe(197.5)
  })
})

describe('jobRevenue', () => {
  it('uses price when set', () => {
    expect(jobRevenue({ price: 500, estimated_cost: 999 })).toBe(500)
  })

  it('falls back to estimated_cost (legacy / sample shape)', () => {
    expect(jobRevenue({ estimated_cost: 285 })).toBe(285)
  })

  it('returns 0 when neither set', () => {
    expect(jobRevenue({})).toBe(0)
  })
})

describe('computeJobCosting — full scenarios', () => {
  it('estimate-only (no actuals): costSoFar = estimatedCost, marginSoFar reflects forecast', () => {
    const booking = {
      price: 500,
      estimated_fuel: 30,
      estimated_tip_fee: 80,
      estimated_driver_time: 2,   // → 200 estimated total
    }
    const r = computeJobCosting(booking)
    expect(r.revenue).toBe(500)
    expect(r.estimatedCost).toBe(200)
    expect(r.hasActuals).toBe(false)
    expect(r.costSoFar).toBe(200)
    expect(r.marginSoFar).toBe(300)
    expect(r.marginPct).toBe(60)
    expect(r.estimateVariance).toBe(0)
  })

  it('actuals present: costSoFar = actualCost, marginSoFar reflects live data', () => {
    const booking = {
      price: 500,
      estimated_fuel: 30,
      estimated_tip_fee: 80,
      estimated_driver_time: 2,
      actual_fuel: 35,
      actual_tip_fee: 110,
      actual_driver_time: 2.5,    // 35 + 110 + 112.5 = 257.5
    }
    const r = computeJobCosting(booking)
    expect(r.revenue).toBe(500)
    expect(r.hasActuals).toBe(true)
    expect(r.actualCost).toBe(257.5)
    expect(r.costSoFar).toBe(257.5)
    expect(r.marginSoFar).toBe(242.5)
    expect(r.marginPct).toBeCloseTo(48.5, 1)
    expect(r.estimateVariance).toBe(57.5)
    expect(r.estimateVariancePct).toBeCloseTo(28.75, 2)
  })

  it('zero revenue does not divide-by-zero', () => {
    const r = computeJobCosting({
      estimated_fuel: 50,
    })
    expect(r.revenue).toBe(0)
    expect(r.marginPct).toBe(0)
  })

  it('loss-making job: marginSoFar negative, marginPct negative', () => {
    const r = computeJobCosting({
      price: 200,
      actual_total_cost: 280,
    })
    expect(r.marginSoFar).toBe(-80)
    expect(r.marginPct).toBe(-40)
    expect(r.costSoFar).toBe(280)
  })
})

describe('DRIVER_HOURLY_RATE_AUD constant', () => {
  it('matches the rate baked into src/api/driver.js getJobCostVariances', () => {
    expect(DRIVER_HOURLY_RATE_AUD).toBe(45)
  })
})
