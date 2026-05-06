import { describe, it, expect } from 'vitest'
import { B, fmt, fmtFull, fmtPct } from './theme'

describe('theme tokens', () => {
  it('exposes the SkipSync yellow brand token', () => {
    expect(B.yellow).toBe('#EFDF0F')
  })
})

describe('fmt — abbreviated currency', () => {
  it('formats millions with one decimal and M suffix', () => {
    expect(fmt(1_250_479)).toBe('$1.3M')
  })
  it('formats thousands with k suffix and no decimal', () => {
    expect(fmt(28_329)).toBe('$28k')
  })
  it('formats sub-thousand values with no suffix', () => {
    expect(fmt(847)).toBe('$847')
  })
})

describe('fmtFull — locale currency', () => {
  it('formats positive amounts with thousands separators', () => {
    expect(fmtFull(189184)).toBe('$189,184')
  })
  it('formats negative amounts with leading minus', () => {
    expect(fmtFull(-2500)).toBe('-$2,500')
  })
})

describe('fmtPct — percentage', () => {
  it('renders one decimal place with % sign', () => {
    expect(fmtPct(15.123)).toBe('15.1%')
  })
})
