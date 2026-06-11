import { describe, it, expect } from 'vitest'
import {
  haversineKm,
  estimateLeg,
  rankTipOptions,
  CIRCUITY_FACTOR,
  DEFAULT_RATES,
} from './tipDecision'

// ── Fixtures ────────────────────────────────────────────────────
// Latitude offsets: 0.01° lat ≈ 1.112 km, so offsets give predictable
// crow-flies distances regardless of longitude compression at -38°.
const ORIGIN = { lat: -38.10, lng: 145.13 } // pickup location (Seaford-ish)
const FAR_BASE = { lat: -38.40, lng: 145.13 } // ~33.4 km south

function makeSite(name, latOffsetDeg, overrides = {}) {
  return {
    id: name,
    name,
    lat: ORIGIN.lat + latOffsetDeg,
    lng: ORIGIN.lng,
    rates_per_tonne: { 'General Waste': 150 },
    recycling_credit_per_tonne: {},
    accepted_waste_types: ['General Waste', 'Soil', 'Green Waste', 'Concrete'],
    is_active: true,
    ...overrides,
  }
}

const LOAD = { waste_type: 'General Waste', est_weight_t: 1, bin_size: '6m³' }

function rank(args = {}) {
  return rankTipOptions({
    currentLoc: ORIGIN,
    load: LOAD,
    tipSites: [],
    nextJobs: [],
    base: FAR_BASE,
    ...args,
  })
}

// ── haversine + circuity ────────────────────────────────────────
describe('haversineKm', () => {
  it('returns 0 for identical points and ~111.19 km per degree of latitude', () => {
    expect(haversineKm(ORIGIN, ORIGIN)).toBe(0)
    const oneDegNorth = { lat: ORIGIN.lat + 1, lng: ORIGIN.lng }
    expect(haversineKm(ORIGIN, oneDegNorth)).toBeGreaterThan(110)
    expect(haversineKm(ORIGIN, oneDegNorth)).toBeLessThan(112.5)
  })

  it('returns 0 for missing coords instead of NaN', () => {
    expect(haversineKm(null, ORIGIN)).toBe(0)
    expect(haversineKm(ORIGIN, { lat: 'x', lng: undefined })).toBe(0)
  })
})

describe('estimateLeg (ADR-703 seam)', () => {
  it('applies the 1.3 road-circuity factor to crow-flies distance', () => {
    const to = { lat: ORIGIN.lat + 0.1, lng: ORIGIN.lng }
    const crow = haversineKm(ORIGIN, to)
    const leg = estimateLeg(ORIGIN, to)
    expect(leg.km).toBeCloseTo(crow * CIRCUITY_FACTOR, 6)
    expect(leg.minutes).toBeGreaterThan(0)
  })
})

// ── Ranking scenarios ───────────────────────────────────────────
describe('rankTipOptions', () => {
  it('1. nearby cheap tip with a next job beats the long return to base', () => {
    const site = makeSite('Cheap & Close', 0.02, { rates_per_tonne: { 'General Waste': 10 } })
    const nextJob = { id: 'j1', customer_name: 'Peninsula Builders', lat: ORIGIN.lat + 0.03, lng: ORIGIN.lng }
    const options = rank({ tipSites: [site], nextJobs: [nextJob] })

    expect(options[0].type).toBe('tip_then_next_job')
    expect(options[0].tipSite.name).toBe('Cheap & Close')
    expect(options[0].recommended).toBe(true)
    // return_to_base is always offered, never hidden
    expect(options.some(o => o.type === 'return_to_base')).toBe(true)
    expect(options[0].totalCost).toBeLessThan(
      options.find(o => o.type === 'return_to_base').totalCost
    )
  })

  it('2. cheap-but-far site beats expensive nearby site once fees dominate', () => {
    const expensiveNear = makeSite('Expensive Near', 0.018, { rates_per_tonne: { 'General Waste': 300 } })
    const cheapFar = makeSite('Cheap Far', 0.18, { rates_per_tonne: { 'General Waste': 50 } })
    const options = rank({
      load: { ...LOAD, est_weight_t: 2 },
      tipSites: [expensiveNear, cheapFar],
      base: ORIGIN, // truck started at base; return leg symmetric
    })
    const tipOptions = options.filter(o => o.type === 'tip_then_next_job')
    expect(tipOptions[0].tipSite.name).toBe('Cheap Far')
    expect(tipOptions[1].tipSite.name).toBe('Expensive Near')
    expect(tipOptions[0].totalCost).toBeLessThan(tipOptions[1].totalCost)
  })

  it('3. recycling credit flips the ranking between otherwise identical sites', () => {
    // Same distance (one north, one south), same gate fee — credit decides.
    const plain = makeSite('No Credit', 0.05)
    const credited = makeSite('With Credit', -0.05, {
      recycling_credit_per_tonne: { 'General Waste': 40 },
    })
    const options = rank({ tipSites: [plain, credited], base: ORIGIN }) // symmetric return legs
    const tipOptions = options.filter(o => o.type === 'tip_then_next_job')
    expect(tipOptions[0].tipSite.name).toBe('With Credit')
    expect(tipOptions[0].breakdown.recyclingCredit).toBe(40)
    expect(tipOptions[1].breakdown.recyclingCredit).toBe(0)
    expect(tipOptions[0].totalCost).toBeCloseTo(tipOptions[1].totalCost - 40, 1)
  })

  it('4. sites that do not accept the waste type are filtered out (FR7.4.8)', () => {
    const greenOnly = makeSite('Green Only', 0.02, { accepted_waste_types: ['Green Waste'] })
    const options = rank({
      load: { waste_type: 'Asbestos', est_weight_t: 1 },
      tipSites: [greenOnly],
    })
    expect(options).toHaveLength(1)
    expect(options[0].type).toBe('return_to_base')
    expect(options[0].note).toBe('no eligible tip site')
    expect(options[0].recommended).toBe(true)
  })

  it('5. empty tip_sites table → return_to_base only, never a crash', () => {
    const options = rank({ tipSites: [] })
    expect(options).toHaveLength(1)
    expect(options[0].type).toBe('return_to_base')
    expect(options[0].note).toBe('no eligible tip site')
    expect(options[0].recommended).toBe(true)
    expect(options[0].totalCost).toBeGreaterThan(0) // origin → far base costs fuel+time
  })

  it('6. redeploy saving applies only when a next job exists', () => {
    const site = makeSite('Site', 0.02)
    const nextJob = { id: 'j1', lat: ORIGIN.lat + 0.04, lng: ORIGIN.lng }

    const withJob = rank({ tipSites: [site], nextJobs: [nextJob] })
      .find(o => o.type === 'tip_then_next_job')
    expect(withJob.nextJob).toBeTruthy()
    expect(withJob.breakdown.redeploySaving).toBe(DEFAULT_RATES.redeploy_bin_savings_min)

    const withoutJob = rank({ tipSites: [site], nextJobs: [] })
      .find(o => o.type === 'tip_then_next_job')
    expect(withoutJob.nextJob).toBeNull()
    expect(withoutJob.breakdown.redeploySaving).toBe(0)
  })

  it('7. radius cutoff: site beyond tip_search_radius_km is excluded; widening the rule re-includes it', () => {
    const farSite = makeSite('Far Site', 0.27) // ≈30 km crow-flies > default 25
    const withDefaultRadius = rank({ tipSites: [farSite] })
    expect(withDefaultRadius.filter(o => o.type === 'tip_then_next_job')).toHaveLength(0)
    expect(withDefaultRadius[0].note).toBe('no eligible tip site')

    const withWideRadius = rank({ tipSites: [farSite], rates: { tip_search_radius_km: 50 } })
    expect(withWideRadius.filter(o => o.type === 'tip_then_next_job')).toHaveLength(1)
  })

  it('8. tip fee and credit scale linearly with estimated weight', () => {
    const site = makeSite('Scaler', 0.02, {
      rates_per_tonne: { 'General Waste': 100 },
      recycling_credit_per_tonne: { 'General Waste': 20 },
    })
    const oneT = rank({ tipSites: [site], load: { ...LOAD, est_weight_t: 1 } })
      .find(o => o.type === 'tip_then_next_job')
    const twoT = rank({ tipSites: [site], load: { ...LOAD, est_weight_t: 2 } })
      .find(o => o.type === 'tip_then_next_job')
    expect(oneT.breakdown.tipFee).toBe(100)
    expect(twoT.breakdown.tipFee).toBe(200)
    expect(oneT.breakdown.recyclingCredit).toBe(20)
    expect(twoT.breakdown.recyclingCredit).toBe(40)
  })

  it('9. inactive sites are excluded; missing accepted_waste_types accepts everything', () => {
    const inactive = makeSite('Closed Site', 0.02, { is_active: false })
    const openToAll = makeSite('Open To All', 0.03, { accepted_waste_types: null })
    const options = rank({ load: { waste_type: 'Soil', est_weight_t: 1 }, tipSites: [inactive, openToAll] })
    const tipOptions = options.filter(o => o.type === 'tip_then_next_job')
    expect(tipOptions).toHaveLength(1)
    expect(tipOptions[0].tipSite.name).toBe('Open To All')
  })

  it('10. results are sorted ascending by totalCost with exactly one recommendation', () => {
    const sites = [
      makeSite('A', 0.02, { rates_per_tonne: { 'General Waste': 200 } }),
      makeSite('B', 0.05, { rates_per_tonne: { 'General Waste': 90 } }),
      makeSite('C', 0.09, { rates_per_tonne: { 'General Waste': 140 } }),
    ]
    const options = rank({ tipSites: sites })
    for (let i = 1; i < options.length; i++) {
      expect(options[i].totalCost).toBeGreaterThanOrEqual(options[i - 1].totalCost)
    }
    expect(options.filter(o => o.recommended)).toHaveLength(1)
    expect(options[0].recommended).toBe(true)
  })

  it('11. missing GPS falls back to base as origin; missing everything still returns a safe option', () => {
    const site = makeSite('Site', 0.02)
    // No currentLoc → origin = base (FAR_BASE is ~33 km from the site, outside radius)
    const fromBase = rank({ currentLoc: null, tipSites: [site] })
    expect(fromBase[0].type).toBe('return_to_base')

    // No currentLoc AND no base → graceful single option, no crash
    const nothing = rankTipOptions({ load: LOAD, tipSites: [site] })
    expect(nothing).toHaveLength(1)
    expect(nothing[0].type).toBe('return_to_base')
    expect(nothing[0].note).toBe('no location available')
  })

  it('12. defaults guard: zero/missing weight ranks as 1 tonne, missing rates use DEFAULT_RATES', () => {
    const site = makeSite('Site', 0.02, { rates_per_tonne: { 'General Waste': 100 } })
    const options = rank({ tipSites: [site], load: { waste_type: 'General Waste' }, rates: undefined })
    const tip = options.find(o => o.type === 'tip_then_next_job')
    expect(tip.breakdown.tipFee).toBe(100) // 1 t default × $100
    expect(Number.isFinite(tip.totalCost)).toBe(true)
  })
})
