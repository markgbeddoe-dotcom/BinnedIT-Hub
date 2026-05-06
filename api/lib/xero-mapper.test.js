/**
 * @file api/lib/xero-mapper.test.js
 *
 * Vitest tests for the Xero → Supabase mapping logic. SKU names + amounts are
 * drawn from the actual Binned-IT Xero exports captured in the 2026-05-06
 * reconciliation audit (docs/audits/2026-05-06/parsed/). Each P0/P1 finding
 * from that audit has a dedicated assertion below — when these tests pass,
 * the audit's headline issues are closed.
 */

import { describe, it, expect } from 'vitest'
import {
  parseAmount,
  classifyTradingIncomeRow,
  classifyCOSRow,
  parsePLSections,
  mapPLToFinancials,
  findCashBalance,
  parseBalanceSheet,
  parseAgedReceivables,
} from './xero-mapper.js'

// ── parseAmount ──────────────────────────────────────────────────────────────

describe('parseAmount', () => {
  it.each([
    ['1234.56', 1234.56],
    ['$1,234.56', 1234.56],
    [' 1,234 ', 1234],
    ['', 0],
    [null, 0],
    [undefined, 0],
    ['(1,500)', -1500],
    ['(1,500.25)', -1500.25],
    [-99, -99],
    [42, 42],
  ])('%s → %s', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })
})

// ── classifyTradingIncomeRow ─────────────────────────────────────────────────

describe('classifyTradingIncomeRow — ASB / asbestos', () => {
  it.each([
    ['ASB  -1.1', 'asbestos'],
    ['ASB - 4m', 'asbestos'],
    ['ASB - 6m', 'asbestos'],
    ['ASB - 8m', 'asbestos'],
    ['ASB - 10m', 'asbestos'],
    ['ASB - 16m', 'asbestos'],
    ['ASB - 23m', 'asbestos'],
    ['ASB - 2M', 'asbestos'],
    ['ASB - Bigm', 'asbestos'],
    ['ASBESTOS 2M', 'asbestos'],
    ['Asbestos Waste Tonnage', 'asbestos'],
    ['Revenue - Asbestos (ASB)', 'asbestos'],
  ])('%s → %s', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })
})

describe('classifyTradingIncomeRow — SOI / soil', () => {
  it.each([
    ['SOI - 4m FOR JOBS NOT RECYCLING', 'soil'],
    ['SOI - 6m FOR JOBS NOT RECYCLING', 'soil'],
    ['SOI - 8m FOR JOBS NOT RECYCLING', 'soil'],
    ['CONTAMINATED SOIL REVENUE', 'soil'],
    ['Contaminated Soil Tonnage', 'soil'],
    ['Revenue - Soil (SOI)', 'soil'],
  ])('%s → %s', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })
})

describe('classifyTradingIncomeRow — GRW / green', () => {
  it.each([
    ['GRW - 4m GREEN WASTE', 'green'],
    ['GRW - 8m GREEN WASTE', 'green'],
    ['GRW - 10m GREEN WASTE', 'green'],
    ['GRW - 16m GREEN WASTE', 'green'],
  ])('%s → %s', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })
})

describe('classifyTradingIncomeRow — WMF / general (audit P0-1: was rev_other for $882k YTD)', () => {
  it.each([
    ['WMF - 10M', 'general'],
    ['WMF - 12M', 'general'],
    ['WMF - 12m Light', 'general'],
    ['WMF - 16m', 'general'],
    ['WMF - 23m', 'general'],
    ['WMF - 4m Heavy', 'general'],
    ['WMF - 4m Light', 'general'],
    ['WMF - 6m Heavy', 'general'],
    ['WMF - 6m Light', 'general'],
    ['WMF - 8m Heavy', 'general'],
    ['WMF - 8m Light', 'general'],
    ['Revenue - Waste Management Fees (WMF)', 'general'],
    ['General Waste Tonnage', 'general'],
    ['Revenue - Transport', 'general'],
    ['Recycling Income', 'general'],
    ['LONG TERM BIN RENTAL 1 MONTH', 'general'],
    ['Fuel Levy', 'general'],
    ['Revenue - Recycling M3 RATE TIPPING $50/M3', 'general'],
  ])('%s → %s', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })
})

describe('classifyTradingIncomeRow — CON / general (concrete bins, was rev_other)', () => {
  it.each([
    ['CON - 4m FOR JOBS NOT RECYCLING', 'general'],
    ['CON - 6m FOR JOBS NOT RECYCLING', 'general'],
    ['CON - 8m FOR JOBS NOT RECYCLING', 'general'],
  ])('%s → %s', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })
})

describe('classifyTradingIncomeRow — other (catchall)', () => {
  it.each([
    ['Revenue - Council Permits', 'other'],
    ['Machinery Hire', 'other'],
    ['PLASTIC AND TAPE', 'other'],
    ['Other fees', 'other'],
  ])('%s → other', (name, expected) => {
    expect(classifyTradingIncomeRow(name)).toBe(expected)
  })

  it('empty string → other', () => {
    expect(classifyTradingIncomeRow('')).toBe('other')
  })
  it('null → other', () => {
    expect(classifyTradingIncomeRow(null)).toBe('other')
  })
})

// ── classifyCOSRow ──────────────────────────────────────────────────────────

describe('classifyCOSRow — bin-coded tipping (audit P1: 30 of 36 rows were "other")', () => {
  it.each([
    ['ASB - 1.1 (325)', 'disposal'],
    ['ASB - 10m (321)', 'disposal'],
    ['ASB - 4m (324)', 'disposal'],
    ['ASB - 8m (328)', 'disposal'],
    ['W - 4m Heavy (305)', 'disposal'],
    ['W - 6m Heavy (307)', 'disposal'],
    ['W - 8m Light (308)', 'disposal'],
    ['WMF - 12M (313)', 'disposal'],
    ['WMF - 16m (314)', 'disposal'],
    ['WMF - 23m (315)', 'disposal'],
    ['S - 4m (344)', 'disposal'],
    ['S - 6m (346)', 'disposal'],
    ['S - 8m (348)', 'disposal'],
    ['C - 6m (356)', 'disposal'],
    ['GW - 6m (336)', 'disposal'],
    ['GW - 8m (338)', 'disposal'],
  ])('%s → %s', (name, expected) => {
    expect(classifyCOSRow(name)).toBe(expected)
  })
})

describe('classifyCOSRow — explicit disposal/tipping/recycling-cost language', () => {
  it.each([
    ['Tipping by Bin - Asbestos (A)', 'disposal'],
    ['Tipping by Bin - Soil (S)', 'disposal'],
    ['Recycling costs - General Waste', 'disposal'],
    ['Recycling Costs - Soil Tipping', 'disposal'],
    ['Recycling Costs - Concrete Tipping', 'disposal'],
    ['Recycling costs - Green Waste', 'disposal'],
    ['Contaminated soil tipping costs', 'disposal'],
  ])('%s → %s', (name, expected) => {
    expect(classifyCOSRow(name)).toBe(expected)
  })
})

describe('classifyCOSRow — non-disposal (consumables, COGS catch-all)', () => {
  it.each([
    ['PLASTIC, TAPE AND BAGS FOR ASBESTOS', 'other'],
    ['Cost of Goods Sold', 'other'],
  ])('%s → %s', (name, expected) => {
    expect(classifyCOSRow(name)).toBe(expected)
  })
})

// ── mapPLToFinancials — sign preservation (audit P0-2) ──────────────────────

describe('mapPLToFinancials — preserves sign on negative trading-income rows (audit P0-2)', () => {
  it('a negative WMF row reduces revenue, not inflates it (Math.abs() bug)', () => {
    const sections = {
      'trading income': {
        _total: 0,
        _rows: [
          { name: 'WMF - 6m Heavy', amount: 1000 },
          { name: 'WMF - 6m Heavy', amount: -1500 }, // customer credit
        ],
      },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2025-10')
    // Net of credit: 1000 + (-1500) = -500
    // The previous Math.abs() bug would have produced 1000 + 1500 = 2500 (a $3,000 swing)
    expect(result.rev_general).toBe(-500)
    expect(result.rev_total).toBe(-500)
  })

  it('a positive ASB row + negative SOI credit are tracked in their own buckets', () => {
    const sections = {
      'trading income': {
        _total: 0,
        _rows: [
          { name: 'ASB - 8m', amount: 10400 },
          { name: 'SOI - 6m FOR JOBS NOT RECYCLING', amount: -1200 }, // refund
        ],
      },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2025-08')
    expect(result.rev_asbestos).toBe(10400)
    expect(result.rev_soil).toBe(-1200)
    expect(result.rev_total).toBe(10400 + -1200)
  })
})

describe('mapPLToFinancials — rev_general is now populated (audit P0-1)', () => {
  it('all 11 WMF SKUs in a month roll up into rev_general (was rev_other)', () => {
    const sections = {
      'trading income': {
        _total: 0,
        _rows: [
          { name: 'WMF - 4m Heavy', amount: 16563.64 },
          { name: 'WMF - 6m Heavy', amount: 24916 },
          { name: 'WMF - 8m Heavy', amount: 12610 },
          { name: 'WMF - 12M', amount: 8890.42 },
          { name: 'CON - 6m FOR JOBS NOT RECYCLING', amount: 500 },
          { name: 'Revenue - Transport', amount: 0 },
          { name: 'General Waste Tonnage', amount: 3754 },
          { name: 'ASB - 4m', amount: 12636.36 },
          { name: 'SOI - 6m FOR JOBS NOT RECYCLING', amount: 4200 },
          { name: 'GRW - 8m GREEN WASTE', amount: 1414 },
        ],
      },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2025-07')
    // WMF + CON + Transport + General Waste Tonnage all general
    const expectedGeneral = 16563.64 + 24916 + 12610 + 8890.42 + 500 + 0 + 3754
    expect(result.rev_general).toBeCloseTo(expectedGeneral, 2)
    expect(result.rev_asbestos).toBe(12636.36)
    expect(result.rev_soil).toBe(4200)
    expect(result.rev_green).toBe(1414)
    // Nothing should fall through to rev_other in this fixture
    expect(result.rev_other).toBe(0)
    expect(result._diagnostic.unclassified_trading_income).toEqual([])
  })

  it('schema column rev_general is no longer hard-coded to 0', () => {
    const sections = {
      'trading income': {
        _total: 0,
        _rows: [{ name: 'WMF - 6m Heavy', amount: 25000 }],
      },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2026-02')
    expect(result.rev_general).toBe(25000)
    expect(result.rev_total).toBe(25000)
  })
})

describe('mapPLToFinancials — COS classification (audit P1)', () => {
  it('bin-coded tipping rows roll into cos_disposal not cos_other', () => {
    const sections = {
      'trading income': { _total: 0, _rows: [] },
      'cost of sales': {
        _total: 0,
        _rows: [
          { name: 'W - 4m Heavy (305)', amount: 6041.36 },
          { name: 'WMF - 12M (313)', amount: 1942.07 },
          { name: 'ASB - 8m (328)', amount: 5645.39 },
          { name: 'S - 6m (346)', amount: 1088.16 },
          { name: 'GW - 6m (336)', amount: 0 },
          { name: 'C - 6m (356)', amount: 0 },
          { name: 'Tipping by Bin - Soil (S)', amount: 120 },
          { name: 'Recycling costs - General Waste', amount: 15334.98 },
          { name: 'PLASTIC, TAPE AND BAGS FOR ASBESTOS', amount: 100 },
        ],
      },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2025-07')
    const expectedDisposal = 6041.36 + 1942.07 + 5645.39 + 1088.16 + 0 + 0 + 120 + 15334.98
    expect(result.cos_disposal).toBeCloseTo(expectedDisposal, 2)
    expect(result.cos_other).toBe(100) // Just the consumables row
    expect(result.cos_wages).toBe(0) // (Binned-IT has no wages in COS)
    expect(result.cos_fuel).toBe(0) // (Binned-IT has no fuel in COS)
  })
})

// ── findCashBalance — section-aware (audit P0-3) ─────────────────────────────

describe('findCashBalance — handles "Binned-It Pty Ltd" bank row by section context (audit P0-3)', () => {
  const fixture = {
    Rows: [
      {
        RowType: 'Section',
        Title: 'Assets',
        Rows: [
          {
            RowType: 'Section',
            Title: 'Bank',
            Rows: [
              { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '77811.38' }] },
              { RowType: 'SummaryRow', Cells: [{ Value: 'Total Bank' }, { Value: '77811.38' }] },
            ],
          },
          {
            RowType: 'Section',
            Title: 'Current Assets',
            Rows: [
              { RowType: 'Row', Cells: [{ Value: 'Accounts Receivable' }, { Value: '118082.03' }] },
            ],
          },
        ],
      },
      {
        RowType: 'Section',
        Title: 'Liabilities',
        Rows: [
          {
            RowType: 'Section',
            Title: 'Current Liabilities',
            Rows: [
              { RowType: 'Row', Cells: [{ Value: 'Westpac Business Cash Reserve' }, { Value: '106.36' }] },
            ],
          },
        ],
      },
    ],
  }

  it('finds the operating account by Bank section, not by row name keyword', () => {
    expect(findCashBalance(fixture)).toBe(77811.38)
  })

  it('does NOT include Westpac Business Cash Reserve (which is in Liabilities)', () => {
    expect(findCashBalance(fixture)).toBe(77811.38)
  })

  it('returns 0 for an empty/malformed report', () => {
    expect(findCashBalance({})).toBe(0)
    expect(findCashBalance(null)).toBe(0)
    expect(findCashBalance({ Rows: [] })).toBe(0)
  })
})

describe('parseBalanceSheet — full integration with the cash fix', () => {
  it('reconciles the Binned-IT 30 Apr 2026 balance sheet structure', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [
            {
              RowType: 'Section',
              Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '77811.38' }] },
              ],
            },
            {
              RowType: 'Section',
              Title: 'Current Assets',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Accounts Receivable' }, { Value: '118082.03' }] },
                { RowType: 'SummaryRow', Cells: [{ Value: 'Total Current Assets' }, { Value: '145000' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '300000' }] },
          ],
        },
      ],
    }
    const result = parseBalanceSheet(fixture)
    expect(result.cash_balance).toBe(77811.38)
    expect(result.accounts_receivable).toBe(118082.03)
  })
})

// ── parseAgedReceivables — 6 ageing buckets (audit P1) ──────────────────────

describe('parseAgedReceivables — captures Older bucket (audit P1: was Cells[1..5])', () => {
  it('reads all 6 ageing cells per debtor row', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Row',
          Cells: [
            { Value: 'ABC Customer' },
            { Value: '1000' },  // current
            { Value: '500' },   // 30 days
            { Value: '200' },   // 60 days
            { Value: '100' },   // 90 days
            { Value: '50' },    // older  ← was being dropped
            { Value: '1850' },  // total
          ],
        },
      ],
    }
    const result = parseAgedReceivables(fixture)
    expect(result.byBucket.older).toBe(50)
    expect(result.perDebtor[0].name).toBe('ABC Customer')
    expect(result.perDebtor[0].total).toBe(1850)
    expect(result.perDebtor[0].older).toBe(50)
  })

  it('sorts debtors by total descending', () => {
    const fixture = {
      Rows: [
        { RowType: 'Row', Cells: [{ Value: 'Small' }, { Value: '100' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '100' }] },
        { RowType: 'Row', Cells: [{ Value: 'Big' }, { Value: '1000' }, { Value: '500' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '1500' }] },
        { RowType: 'Row', Cells: [{ Value: 'Medium' }, { Value: '500' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '500' }] },
      ],
    }
    const result = parseAgedReceivables(fixture)
    expect(result.perDebtor.map(d => d.name)).toEqual(['Big', 'Medium', 'Small'])
  })

  it('skips the "Total" row', () => {
    const fixture = {
      Rows: [
        { RowType: 'Row', Cells: [{ Value: 'ABC' }, { Value: '500' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '500' }] },
        { RowType: 'Row', Cells: [{ Value: 'Total' }, { Value: '500' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '500' }] },
      ],
    }
    const result = parseAgedReceivables(fixture)
    expect(result.perDebtor.length).toBe(1)
    expect(result.perDebtor[0].name).toBe('ABC')
  })

  it('computes days_overdue from the most-overdue non-zero bucket', () => {
    const cases = [
      { cells: [100, 0, 0, 0, 0], expected: 0 },
      { cells: [0, 50, 0, 0, 0], expected: 30 },
      { cells: [0, 0, 50, 0, 0], expected: 60 },
      { cells: [0, 0, 0, 50, 0], expected: 90 },
      { cells: [0, 0, 0, 0, 50], expected: 90 }, // older counts as 90+
    ]
    for (const { cells, expected } of cases) {
      const fixture = {
        Rows: [{
          RowType: 'Row',
          Cells: [{ Value: 'Customer' }, ...cells.map(v => ({ Value: String(v) })), { Value: String(cells.reduce((s, v) => s + v, 0)) }],
        }],
      }
      expect(parseAgedReceivables(fixture).perDebtor[0]?.days_overdue).toBe(expected)
    }
  })
})

// ── parsePLSections (recursive section walker) ──────────────────────────────

describe('parsePLSections', () => {
  it('extracts trading income rows + total from a Xero-shaped report', () => {
    const report = {
      Rows: [
        {
          RowType: 'Section',
          Title: 'Trading Income',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'WMF - 4m Heavy' }, { Value: '16563.64' }] },
            { RowType: 'Row', Cells: [{ Value: 'ASB - 4m' }, { Value: '12636.36' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '29200.00' }] },
          ],
        },
      ],
    }
    const sections = parsePLSections(report)
    expect(sections['trading income']._rows.length).toBe(2)
    expect(sections['trading income']._total).toBe(29200)
  })

  it('handles a missing/null report safely', () => {
    expect(parsePLSections(null)).toEqual({})
    expect(parsePLSections({})).toEqual({})
  })
})
