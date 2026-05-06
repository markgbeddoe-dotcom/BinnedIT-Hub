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

// ── mapPLToFinancials — opex_wages / opex_super split (Sprint 15 #26) ───────

describe('mapPLToFinancials — splits opex_admin into opex_wages + opex_super (Sprint 15 #26)', () => {
  it('Binned-IT Jul 2025: Wages ~$58k → opex_wages, Super ~$7.5k → opex_super', () => {
    // Real Binned-IT staffing-overheads structure
    const sections = {
      'trading income': { _total: 0, _rows: [] },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
      'staffing overheads': {
        _total: 66442.57,
        _rows: [
          { name: 'Wages and Salaries', amount: 58942.57 },
          { name: 'Superannuation', amount: 7500.00 },
        ],
      },
    }
    const result = mapPLToFinancials(sections, '2025-07')
    expect(result.opex_wages).toBeCloseTo(58942.57, 2)
    expect(result.opex_super).toBeCloseTo(7500, 2)
    // Legacy aggregate is preserved for backward compat
    expect(result.opex_admin).toBeCloseTo(58942.57 + 7500, 2)
  })

  it('inline opex layout (no staffing-overheads section): also splits correctly', () => {
    const sections = {
      'trading income': { _total: 0, _rows: [] },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': {
        _total: 0,
        _rows: [
          { name: 'Wages and Salaries', amount: 45212.71 },
          { name: 'Superannuation', amount: 5500 },
          { name: 'Rent', amount: 4666.67 },
        ],
      },
    }
    const result = mapPLToFinancials(sections, '2025-12')
    expect(result.opex_wages).toBeCloseTo(45212.71, 2)
    expect(result.opex_super).toBeCloseTo(5500, 2)
    expect(result.opex_admin).toBeCloseTo(45212.71 + 5500, 2)
    expect(result.opex_rent).toBeCloseTo(4666.67, 2)
  })

  it('opex_admin remains in the output object (backward compat)', () => {
    const sections = {
      'trading income': { _total: 0, _rows: [] },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': { _total: 0, _rows: [] },
    }
    const result = mapPLToFinancials(sections, '2025-07')
    expect(result).toHaveProperty('opex_admin')
    expect(result).toHaveProperty('opex_wages')
    expect(result).toHaveProperty('opex_super')
  })

  it('"Payroll Tax" row counts as wages (not super) since it lacks "super"', () => {
    const sections = {
      'trading income': { _total: 0, _rows: [] },
      'cost of sales': { _total: 0, _rows: [] },
      'operating expenses': {
        _total: 0,
        _rows: [
          { name: 'Salaries', amount: 40000 },
          { name: 'Payroll Tax', amount: 2200 },
          { name: 'Superannuation', amount: 4400 },
        ],
      },
    }
    const result = mapPLToFinancials(sections, '2025-08')
    expect(result.opex_wages).toBeCloseTo(40000 + 2200, 2)
    expect(result.opex_super).toBeCloseTo(4400, 2)
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

// ── findCashBalance — Liabilities exclusion (Sprint 15 #24) ─────────────────

describe('findCashBalance — strict Liabilities exclusion (Sprint 15 #24)', () => {
  it('two bank-named rows in Assets and Liabilities: only the Assets one counts', () => {
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
                { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '50000' }] },
              ],
            },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Liabilities',
          Rows: [
            {
              // Adversarial: section literally called "Bank" inside Liabilities.
              // Older code that promoted "Bank" anywhere in the tree to inBank=true
              // would have double-counted this. Explicit Liabilities exclusion blocks it.
              RowType: 'Section',
              Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Westpac Business Cash Reserve' }, { Value: '12345' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(findCashBalance(fixture)).toBe(50000)
  })

  it('Westpac Business Cash Reserve in Current Liabilities is excluded', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Assets',
          Rows: [
            { RowType: 'Section', Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '77811.38' }] },
              ],
            },
          ],
        },
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Westpac Business Cash Reserve' }, { Value: '106.36' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(findCashBalance(fixture)).toBe(77811.38)
  })
})

describe('parseBalanceSheet — Westpac liability never bleeds into cash (Sprint 15 #24)', () => {
  it('Westpac Business Cash Reserve contributes ONLY to total_liabilities', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Assets',
          Rows: [
            { RowType: 'Section', Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '77811.38' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '300000' }] },
          ],
        },
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Westpac Business Cash Reserve' }, { Value: '106.36' }] },
                { RowType: 'Row', Cells: [{ Value: 'Accounts Payable' }, { Value: '5000' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Liabilities' }, { Value: '5106.36' }] },
          ],
        },
      ],
    }
    const result = parseBalanceSheet(fixture)
    expect(result.cash_balance).toBe(77811.38) // ONLY the Assets-side bank
    expect(result.total_liabilities).toBe(5106.36)
    expect(result.accounts_payable).toBe(5000)
  })
})

// ── parseBalanceSheet — column coverage (audit P2 #28) ──────────────────────

describe('parseBalanceSheet — column coverage for accounts_payable / fixed_assets / loans (Sprint 15 #28)', () => {
  it('accounts_payable populated from Liabilities → "Accounts Payable" row', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Accounts Payable' }, { Value: '12345.67' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(parseBalanceSheet(fixture).accounts_payable).toBe(12345.67)
  })

  it('fixed_assets populated from Assets → "Fixed Assets" / "Plant and Equipment" / "Vehicles"', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Assets',
          Rows: [
            { RowType: 'Section', Title: 'Fixed Assets',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Plant and Equipment' }, { Value: '85000' }] },
                { RowType: 'Row', Cells: [{ Value: 'Motor Vehicles' }, { Value: '120000' }] },
              ],
            },
          ],
        },
      ],
    }
    const result = parseBalanceSheet(fixture)
    // Plant and Equipment + Motor Vehicles → both match (equipment / vehicle keywords)
    expect(result.fixed_assets).toBe(85000 + 120000)
  })

  it('loan_current populated from Liabilities → "Loan - Current Portion"', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Loan - Current Portion' }, { Value: '15000' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(parseBalanceSheet(fixture).loan_current).toBe(15000)
  })

  it('loan_noncurrent populated from Liabilities → "Long Term Loan"', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Non-Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Long Term Loan' }, { Value: '85000' }] },
              ],
            },
          ],
        },
      ],
    }
    expect(parseBalanceSheet(fixture).loan_noncurrent).toBe(85000)
  })

  it('total_loans = loan_current + loan_noncurrent (computed)', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Loan - Current Portion' }, { Value: '15000' }] },
              ],
            },
            { RowType: 'Section', Title: 'Non-Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Long Term Loan' }, { Value: '85000' }] },
              ],
            },
          ],
        },
      ],
    }
    const result = parseBalanceSheet(fixture)
    expect(result.loan_current).toBe(15000)
    expect(result.loan_noncurrent).toBe(85000)
    expect(result.total_loans).toBe(100000)
  })

  it('full Xero-shaped fixture: every BS column populated correctly', () => {
    const fixture = {
      Rows: [
        {
          RowType: 'Section', Title: 'Assets',
          Rows: [
            { RowType: 'Section', Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Binned-It Pty Ltd' }, { Value: '77811.38' }] },
              ],
            },
            { RowType: 'Section', Title: 'Current Assets',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Accounts Receivable' }, { Value: '118082.03' }] },
              ],
            },
            { RowType: 'Section', Title: 'Fixed Assets',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Plant and Equipment' }, { Value: '50000' }] },
                { RowType: 'Row', Cells: [{ Value: 'Motor Vehicles' }, { Value: '95000' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '340893.41' }] },
          ],
        },
        {
          RowType: 'Section', Title: 'Liabilities',
          Rows: [
            { RowType: 'Section', Title: 'Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Accounts Payable' }, { Value: '8500' }] },
                { RowType: 'Row', Cells: [{ Value: 'GST' }, { Value: '12000' }] },
                { RowType: 'Row', Cells: [{ Value: 'PAYG Withholding' }, { Value: '6500' }] },
                { RowType: 'Row', Cells: [{ Value: 'Loan - Current Portion' }, { Value: '15000' }] },
                { RowType: 'Row', Cells: [{ Value: 'Westpac Business Cash Reserve' }, { Value: '106.36' }] },
              ],
            },
            { RowType: 'Section', Title: 'Non-Current Liabilities',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Long Term Loan' }, { Value: '85000' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Liabilities' }, { Value: '127106.36' }] },
          ],
        },
        {
          RowType: 'Section', Title: 'Equity',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Equity' }, { Value: '213787.05' }] },
          ],
        },
      ],
    }
    const result = parseBalanceSheet(fixture)
    expect(result.cash_balance).toBe(77811.38)
    expect(result.accounts_receivable).toBe(118082.03)
    expect(result.fixed_assets).toBe(50000 + 95000)
    expect(result.accounts_payable).toBe(8500)
    expect(result.gst_liability).toBe(12000)
    expect(result.payg_liability).toBe(6500)
    expect(result.loan_current).toBe(15000)
    expect(result.loan_noncurrent).toBe(85000)
    expect(result.total_loans).toBe(100000)
    expect(result.total_liabilities).toBe(127106.36)
    expect(result.net_equity).toBe(213787.05)
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

// ── Sprint 17 #17E — basis flag flow-through (cash vs accrual) ──────────────
//
// Companion documents:
//   - docs/audits/2026-05-07-cash-accrual-uat.md (persona UAT plan)
//   - e2e/cash-accrual-toggle.spec.js (Playwright assertions)
//
// The Sprint 10 reconciliation regression that this section guards:
// historically, /api/xero-sync hit the Xero accrual P&L by default and wrote
// the accrual net_profit ($30,511.71 for Feb 2026) into financials_monthly.
// Mark, who reads the dashboard as cash, was looking at an accrual figure
// without realising it. Sibling 17C (xero-sync.js + xero-mapper.js) is
// changing the default to cash and adding a basis option so the basis is
// recorded explicitly on every row.
//
// The fixtures below are constructed so that:
//   - the CASH section input produces net_profit === -17638.72
//   - the ACCRUAL section input produces net_profit === 30511.71
// matching the canonical UAT values. These are derived from the Feb 2026
// cash-vs-accrual P&L delta (accrual revenue includes ~$48k of unpaid
// invoiced revenue that cash does not).

describe('mapPLToFinancials — basis flag flows through (Sprint 17E reconciliation)', () => {
  // Construct minimal fixtures that produce the canonical Feb 2026 net profit
  // values. The shape is intentionally simple: one revenue row + one COS row +
  // one opex row, with amounts arithmetically sized to the target net profit.
  //
  // Cash basis: Revenue $100,000 - COS $40,000 - Opex $77,638.72 = -$17,638.72
  // Accrual:    Revenue $148,150.43 - COS $40,000 - Opex $77,638.72 = $30,511.71
  //
  // Δ revenue = $48,150.43 = the AR-side accrual recognition that the cash
  // basis omits. This reproduces the documented swing exactly.

  const cashSections = {
    'trading income': {
      _total: 0,
      _rows: [{ name: 'WMF - 6m Heavy', amount: 100000 }],
    },
    'cost of sales': {
      _total: 0,
      _rows: [{ name: 'Tipping by Bin - General Waste', amount: 40000 }],
    },
    'operating expenses': {
      _total: 0,
      _rows: [{ name: 'Wages and Salaries', amount: 77638.72 }],
    },
  }

  const accrualSections = {
    'trading income': {
      _total: 0,
      _rows: [{ name: 'WMF - 6m Heavy', amount: 148150.43 }],
    },
    'cost of sales': {
      _total: 0,
      _rows: [{ name: 'Tipping by Bin - General Waste', amount: 40000 }],
    },
    'operating expenses': {
      _total: 0,
      _rows: [{ name: 'Wages and Salaries', amount: 77638.72 }],
    },
  }

  it('cash-basis fixture produces net_profit of -$17,638.72 (Feb 2026 canonical)', () => {
    const result = mapPLToFinancials(cashSections, '2026-02')
    // Cash net profit MUST be -17638.72 — this is the value sibling 17C is
    // ensuring gets written to financials_monthly when basis defaults to cash.
    expect(result.net_profit).toBeCloseTo(-17638.72, 2)
  })

  it('accrual-basis fixture produces net_profit of $30,511.71 (Feb 2026 canonical)', () => {
    const result = mapPLToFinancials(accrualSections, '2026-02')
    // Accrual is what /api/xero-sync was writing pre-Sprint-17 — kept here as
    // the regression assertion: if cash and accrual ever produce the same
    // number, the mapper has lost its sensitivity to the source data.
    expect(result.net_profit).toBeCloseTo(30511.71, 2)
  })

  it('the cash-vs-accrual delta is +$48,150.43 (the load-bearing swing)', () => {
    const cash = mapPLToFinancials(cashSections, '2026-02').net_profit
    const accrual = mapPLToFinancials(accrualSections, '2026-02').net_profit
    expect(accrual - cash).toBeCloseTo(48150.43, 2)
  })

  it('mapper accepts an opts argument without throwing (forward-compat for Sprint 17C)', () => {
    // 17C will add: function mapPLToFinancials(sections, month, opts = {}).
    // Today the mapper ignores extra args — JS does not throw on additional
    // arguments. This test guards the call shape so that when 17C lands the
    // existing call sites do not break.
    expect(() => mapPLToFinancials(cashSections, '2026-02', { basis: 'cash' })).not.toThrow()
    expect(() => mapPLToFinancials(accrualSections, '2026-02', { basis: 'accrual' })).not.toThrow()
    expect(() => mapPLToFinancials(cashSections, '2026-02', undefined)).not.toThrow()
  })

  // Future contract — will fail until 17C lands. Marked .todo so it appears
  // in the test report as "needs implementation" without blocking the build.
  // Once 17C lands, change `.todo` → `it(...)` and the assertions become
  // load-bearing.
  it.todo('output object contains a `basis` field reflecting opts.basis (default "cash")')
  it.todo('passing { basis: "accrual" } sets result.basis === "accrual"')
  it.todo('passing { basis: "cash" } sets result.basis === "cash"')
  it.todo('omitting opts defaults result.basis to "cash" (Sprint 17 default flip)')
})
