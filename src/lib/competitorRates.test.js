/**
 * Sprint 14 #30 — competitor rate name normalization tests.
 *
 * The CompetitorPage column header is "4m³ GW" but a competitor entry might
 * have been keyed as "4m General Waste" (Xero/Bin-Manager style) or "4m GW"
 * (sloppy paste, no superscript). The audit
 * `docs/audits/2026-05-06/audit-pricing-bugs.md` §4 found those cases
 * silently dropped. These tests document the expected resolution behaviour
 * via `normalizeCompetitorBinType` (re-exported from binTypes.js, the
 * Sprint-11 source of truth — DO NOT touch that file).
 */
import { describe, it, expect } from 'vitest'
import { normalizeCompetitorBinType } from './binTypes'

/**
 * Reference implementation matching CompetitorPage's lookupRate(). Kept here
 * as a module-private copy so the unit tests don't have to JSDOM-render the
 * page. The component uses this same algorithm — see CompetitorPage.jsx.
 */
function lookupRate(competitor, serviceName) {
  if (!competitor || !competitor.rates) return undefined
  if (Object.prototype.hasOwnProperty.call(competitor.rates, serviceName)) {
    return competitor.rates[serviceName]
  }
  const canonical = normalizeCompetitorBinType(serviceName)
  if (!canonical) return undefined
  for (const key of Object.keys(competitor.rates)) {
    if (normalizeCompetitorBinType(key) === canonical) {
      return competitor.rates[key]
    }
  }
  return undefined
}

describe('competitor rate lookup — normalization fallback', () => {
  it('resolves "4m³ GW" lookup against a rate stored as "4m General Waste"', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 430 } }
    expect(lookupRate(competitor, '4m³ GW')).toBe(430)
  })

  it('resolves "4m GW" (no superscript) against canonical-stored rate', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 430 } }
    expect(lookupRate(competitor, '4m GW')).toBe(430)
  })

  it('resolves "4m³ GW" against a rate stored as "4m GW"', () => {
    const competitor = { name: 'Test', rates: { '4m GW': 430 } }
    expect(lookupRate(competitor, '4m³ GW')).toBe(430)
  })

  it('preserves direct-match identity (fast path) for exact key', () => {
    const competitor = { name: 'Test', rates: { '4m³ GW': 430 } }
    expect(lookupRate(competitor, '4m³ GW')).toBe(430)
  })

  it('case-insensitive: "8M³ ASB" finds rate stored as "8m Asbestos"', () => {
    const competitor = { name: 'Test', rates: { '8m Asbestos': 2200 } }
    expect(lookupRate(competitor, '8M³ ASB')).toBe(2200)
  })

  it('returns undefined for truly-unknown service names (no silent default)', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 430 } }
    expect(lookupRate(competitor, 'random nonsense')).toBeUndefined()
  })

  it('returns undefined when canonical normalizer cannot map the lookup', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 430 } }
    // 'ASB - Bigm' is documented in binTypes.test.js as un-mappable
    expect(lookupRate(competitor, 'ASB - Bigm')).toBeUndefined()
  })

  it('returns undefined when bin type exists nowhere in this competitor', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 430 } }
    // Different size — must not silently fall through
    expect(lookupRate(competitor, '6m³ GW')).toBeUndefined()
  })

  it('handles an empty rates object', () => {
    const competitor = { name: 'Test', rates: {} }
    expect(lookupRate(competitor, '4m³ GW')).toBeUndefined()
  })

  it('handles a competitor with no rates property', () => {
    expect(lookupRate({ name: 'Test' }, '4m³ GW')).toBeUndefined()
    expect(lookupRate(null, '4m³ GW')).toBeUndefined()
    expect(lookupRate(undefined, '4m³ GW')).toBeUndefined()
  })

  it('returns string POA values verbatim (not just numbers)', () => {
    const competitor = { name: 'Test', rates: { '4m General Waste': 'POA' } }
    expect(lookupRate(competitor, '4m³ GW')).toBe('POA')
  })
})
