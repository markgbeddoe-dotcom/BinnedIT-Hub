import { describe, it, expect } from 'vitest'
import { checkBinType, formatTable, KNOWN_SKUS } from './check-bin-types.js'

describe('checkBinType', () => {
  it('marks canonical input as canonical', () => {
    const r = checkBinType('4m General Waste')
    expect(r).toEqual({
      input: '4m General Waste',
      normalized: '4m General Waste',
      status: 'canonical',
    })
  })

  it('marks WMF SKU as canonical after normalization', () => {
    const r = checkBinType('WMF - 4m Heavy')
    expect(r.normalized).toBe('4m General Waste')
    expect(r.status).toBe('canonical')
  })

  it('marks Bin Manager W- SKU with account code as canonical', () => {
    const r = checkBinType('W - 8m Light (308)')
    expect(r.normalized).toBe('8m General Waste')
    expect(r.status).toBe('canonical')
  })

  it('marks un-mappable input as unmapped with null normalized', () => {
    const r = checkBinType('ASB - Bigm')
    expect(r.normalized).toBeNull()
    expect(r.status).toBe('unmapped')
  })

  it('marks empty string as unmapped', () => {
    const r = checkBinType('')
    expect(r.normalized).toBeNull()
    expect(r.status).toBe('unmapped')
  })
})

describe('formatTable', () => {
  it('produces a table with header, separator, and row(s) for the given fixture', () => {
    const rows = [
      checkBinType('4m General Waste'),
      checkBinType('WMF - 4m Heavy'),
      checkBinType('ASB - Bigm'),
    ]
    const out = formatTable(rows)
    // header row
    expect(out).toContain('input')
    expect(out).toContain('normalized')
    expect(out).toContain('status')
    // canonical entries
    expect(out).toContain('4m General Waste')
    expect(out).toContain('canonical')
    // unmapped entry
    expect(out).toContain('ASB - Bigm')
    expect(out).toContain('(null)')
    expect(out).toContain('unmapped')
    // shape: header + separator + 3 data rows = 5 lines + trailing newline
    expect(out.trimEnd().split('\n')).toHaveLength(5)
  })

  it('handles empty input gracefully', () => {
    expect(formatTable([])).toBe('(no input)\n')
  })
})

describe('KNOWN_SKUS fixture is fully canonicalisable', () => {
  it('every entry maps to a canonical bin type', () => {
    const unmapped = KNOWN_SKUS
      .map(checkBinType)
      .filter(r => r.status !== 'canonical')
    expect(unmapped).toEqual([])
  })
})
