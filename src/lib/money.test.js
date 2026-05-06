import { describe, it, expect } from 'vitest'
import { roundMoney, roundPercent, avgPrice, formatMoney } from './money'

describe('roundMoney — round to nearest cent', () => {
  it('rounds zero to zero', () => {
    expect(roundMoney(0)).toBe(0)
  })

  it('rounds positive whole dollars unchanged', () => {
    expect(roundMoney(100)).toBe(100)
    expect(roundMoney(1234)).toBe(1234)
  })

  it('rounds negative whole dollars unchanged', () => {
    expect(roundMoney(-100)).toBe(-100)
  })

  it('rounds fractional cents to nearest cent', () => {
    expect(roundMoney(1.234)).toBe(1.23)
    expect(roundMoney(1.235)).toBe(1.24)        // standard round-half-up
    expect(roundMoney(1.2349999)).toBe(1.23)
    expect(roundMoney(0.005)).toBe(0.01)
  })

  it('rounds negative fractional cents', () => {
    // JavaScript Math.round rounds -0.5 toward +Infinity, so -1.235 → -1.23
    expect(roundMoney(-1.234)).toBe(-1.23)
    expect(roundMoney(-1.236)).toBe(-1.24)
  })

  it('handles very large numbers ($1,000,000+)', () => {
    expect(roundMoney(1_000_000)).toBe(1_000_000)
    expect(roundMoney(1_234_567.891)).toBe(1_234_567.89)
    expect(roundMoney(1_234_567.999)).toBe(1_234_568)
  })

  it('returns 0 for null / undefined / NaN / Infinity', () => {
    expect(roundMoney(null)).toBe(0)
    expect(roundMoney(undefined)).toBe(0)
    expect(roundMoney(NaN)).toBe(0)
    expect(roundMoney(Infinity)).toBe(0)
    expect(roundMoney(-Infinity)).toBe(0)
  })

  it('coerces numeric strings', () => {
    expect(roundMoney('1.234')).toBe(1.23)
    expect(roundMoney('abc')).toBe(0)
  })
})

describe('roundPercent — round to 1 decimal', () => {
  it('rounds zero to zero', () => {
    expect(roundPercent(0)).toBe(0)
  })

  it('rounds positives to 1 decimal', () => {
    expect(roundPercent(3.846)).toBe(3.8)
    expect(roundPercent(3.85)).toBe(3.9)
    expect(roundPercent(99.95)).toBe(100)
  })

  it('rounds negatives to 1 decimal', () => {
    expect(roundPercent(-3.846)).toBe(-3.8)
    expect(roundPercent(-12.55)).toBe(-12.5) // Math.round half-toward-+inf
  })

  it('handles large percentages', () => {
    expect(roundPercent(1234.56)).toBe(1234.6)
  })

  it('returns 0 for null / undefined / NaN', () => {
    expect(roundPercent(null)).toBe(0)
    expect(roundPercent(undefined)).toBe(0)
    expect(roundPercent(NaN)).toBe(0)
    expect(roundPercent(Infinity)).toBe(0)
  })
})

describe('avgPrice — revenue / deliveries with cents precision', () => {
  it('basic division', () => {
    expect(avgPrice(1000, 4)).toBe(250)
  })

  it('rounds to nearest cent', () => {
    expect(avgPrice(100, 3)).toBe(33.33)
    expect(avgPrice(200, 3)).toBe(66.67)
  })

  it('returns 0 when deliveries is 0 (no divide by zero)', () => {
    expect(avgPrice(1000, 0)).toBe(0)
  })

  it('returns 0 when revenue is 0', () => {
    expect(avgPrice(0, 5)).toBe(0)
  })

  it('handles negative revenue (refunds / credit notes)', () => {
    expect(avgPrice(-300, 3)).toBe(-100)
  })

  it('handles fractional inputs', () => {
    expect(avgPrice(1234.567, 7)).toBe(176.37)
  })

  it('handles very large numbers', () => {
    expect(avgPrice(10_000_000, 1234)).toBe(8103.73)
  })

  it('returns 0 for null / undefined inputs', () => {
    expect(avgPrice(null, 5)).toBe(0)
    expect(avgPrice(undefined, 5)).toBe(0)
    expect(avgPrice(1000, null)).toBe(0)
    expect(avgPrice(1000, undefined)).toBe(0)
    expect(avgPrice(null, null)).toBe(0)
  })

  it('returns 0 for NaN / Infinity inputs', () => {
    expect(avgPrice(NaN, 5)).toBe(0)
    expect(avgPrice(1000, NaN)).toBe(0)
    expect(avgPrice(Infinity, 5)).toBe(0)
  })
})

describe('formatMoney — en-AU display formatting', () => {
  it('formats zero with cents by default', () => {
    expect(formatMoney(0)).toBe('$0.00')
  })

  it('formats positive whole dollars', () => {
    expect(formatMoney(100)).toBe('$100.00')
    expect(formatMoney(1234)).toBe('$1,234.00')
  })

  it('formats fractional cents', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoney(1234.56)).toBe('$1,234.56')
  })

  it('formats negatives as -$X,XXX.YY (sign before dollar sign)', () => {
    expect(formatMoney(-1234.56)).toBe('-$1,234.56')
    expect(formatMoney(-100)).toBe('-$100.00')
  })

  it('respects showCents:false', () => {
    expect(formatMoney(1234.56, { showCents: false })).toBe('$1,235')
    expect(formatMoney(-1234.56, { showCents: false })).toBe('-$1,235')
  })

  it('uses default opts when omitted', () => {
    expect(formatMoney(42)).toBe('$42.00')
  })

  it('handles very large numbers ($1,000,000+) with thousands separators', () => {
    expect(formatMoney(1_000_000)).toBe('$1,000,000.00')
    expect(formatMoney(1_234_567.89)).toBe('$1,234,567.89')
    expect(formatMoney(-1_234_567.89)).toBe('-$1,234,567.89')
  })

  it('returns em-dash for null / undefined / NaN', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(NaN)).toBe('—')
    expect(formatMoney(Infinity)).toBe('—')
  })
})
