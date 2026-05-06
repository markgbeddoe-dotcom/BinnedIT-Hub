import { describe, it, expect } from 'vitest'
import { normalizeBinType, normalizeCompetitorBinType, isCanonicalBinType, CANONICAL_BIN_TYPES } from './binTypes'

describe('normalizeBinType — Bin Manager / Xero SKU formats', () => {
  it.each([
    // WMF (general waste)
    ['WMF - 4m', '4m General Waste'],
    ['WMF - 4m Heavy', '4m General Waste'],
    ['WMF - 4m Light', '4m General Waste'],
    ['WMF - 6m Heavy', '6m General Waste'],
    ['WMF - 6m Light', '6m General Waste'],
    ['WMF - 8m', '8m General Waste'],
    ['WMF - 10m', '10m General Waste'],
    ['WMF - 10M', '10m General Waste'],
    ['WMF - 12M', '12m General Waste'],
    ['WMF - 12m Light', '12m General Waste'],
    ['WMF - 16m', '16m General Waste'],
    ['WMF - 23m', '23m General Waste'],
    // Bin-Manager-style W- (with dash, no WMF prefix)
    ['W - 4m Heavy (305)', '4m General Waste'],
    ['W - 6m Heavy (307)', '6m General Waste'],
    ['W - 8m Light (308)', '8m General Waste'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBinType(input)).toBe(expected)
  })
})

describe('normalizeBinType — ASB (asbestos)', () => {
  it.each([
    ['ASB - 2M', '2m Asbestos'],
    ['ASB - 4m', '4m Asbestos'],
    ['ASB - 6m', '6m Asbestos'],
    ['ASB - 8m', '8m Asbestos'],
    ['ASB - 10m', '10m Asbestos'],
    ['ASB - 16m', '16m Asbestos'],
    ['ASB - 23m', '23m Asbestos'],
    ['ASB - 8m (328)', '8m Asbestos'],
    ['ASBESTOS 2M', '2m Asbestos'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBinType(input)).toBe(expected)
  })
})

describe('normalizeBinType — SOI (soil)', () => {
  it.each([
    ['SOI - 4m FOR JOBS NOT RECYCLING', '4m Soil'],
    ['SOI - 6m FOR JOBS NOT RECYCLING', '6m Soil'],
    ['SOI - 8m FOR JOBS NOT RECYCLING', '8m Soil'],
    ['S - 4m (344)', '4m Soil'],
    ['S - 6m (346)', '6m Soil'],
    ['S - 8m (348)', '8m Soil'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBinType(input)).toBe(expected)
  })
})

describe('normalizeBinType — GRW (green waste)', () => {
  it.each([
    ['GRW - 4m GREEN WASTE', '4m Green Waste'],
    ['GRW - 8m GREEN WASTE', '8m Green Waste'],
    ['GRW - 10m GREEN WASTE', '10m Green Waste'],
    ['GRW - 16m GREEN WASTE', '16m Green Waste'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBinType(input)).toBe(expected)
  })
})

describe('normalizeBinType — CON (concrete)', () => {
  it.each([
    ['CON - 4m FOR JOBS NOT RECYCLING', '4m Concrete'],
    ['CON - 6m FOR JOBS NOT RECYCLING', '6m Concrete'],
    ['CON - 8m FOR JOBS NOT RECYCLING', '8m Concrete'],
    ['C - 6m (356)', '6m Concrete'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeBinType(input)).toBe(expected)
  })
})

describe('normalizeBinType — already-canonical and unknown', () => {
  it.each(CANONICAL_BIN_TYPES.slice(0, 5))('idempotent: %s', (name) => {
    expect(normalizeBinType(name)).toBe(name)
  })

  it.each([
    [''],
    [null],
    [undefined],
    ['ASB - Bigm'],          // ambiguous: Bigm is not a canonical size
    ['random nonsense'],
    ['Just a description'],
  ])('returns null for un-mappable: %s', (input) => {
    expect(normalizeBinType(input)).toBeNull()
  })
})

describe('normalizeCompetitorBinType — handles competitor formats', () => {
  it.each([
    ['4m³ GW', '4m General Waste'],
    ['6m³ GW', '6m General Waste'],
    ['8m³ GW', '8m General Waste'],
    ['4m³ Asbestos', '4m Asbestos'],
    ['6m³ Asbestos', '6m Asbestos'],
    ['6m³ Green Waste', '6m Green Waste'],
    ['8M³ ASB', '8m Asbestos'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCompetitorBinType(input)).toBe(expected)
  })
})

describe('isCanonicalBinType', () => {
  it('returns true for canonical names', () => {
    expect(isCanonicalBinType('4m General Waste')).toBe(true)
    expect(isCanonicalBinType('6m Asbestos')).toBe(true)
  })
  it('returns false for legacy/unknown', () => {
    expect(isCanonicalBinType('WMF - 4m')).toBe(false)
    expect(isCanonicalBinType('')).toBe(false)
    expect(isCanonicalBinType(null)).toBe(false)
  })
})
