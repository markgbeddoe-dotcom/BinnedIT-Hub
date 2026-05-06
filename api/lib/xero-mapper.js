/**
 * @file api/lib/xero-mapper.js
 *
 * Pure mapping functions for Xero report data → SkipSync Supabase schema.
 * Extracted from api/xero-sync.js so it can be unit-tested via Vitest using
 * the parsed Xero exports under docs/audits/2026-05-06/parsed/ as fixtures.
 *
 * Audit-driven rewrite (2026-05-06 reconciliation cycle, see docs/audits/2026-05-06/):
 *   - P0-1: WMF/CON SKUs now correctly bucket into rev_general (was rev_other for ~64% of revenue).
 *   - P0-2: Negative trading-income rows (customer credits) now preserve sign instead of being
 *     Math.abs()-flipped to inflate revenue.
 *   - P0-3: Cash balance is now found by walking the Bank section under Assets, not by matching
 *     keyword 'cash'/'bank'/'westpac' on the row name. The Binned-It operating account is named
 *     'Binned-It Pty Ltd' which the keyword matcher missed entirely ($77,811 silently dropped).
 *   - P1: AR parser now reads Cells[1..6] (was [1..5]), capturing the Older bucket (was dropped).
 *   - P1: COS classifier handles bin-coded prefixes (W-, WMF-, ASB-, S-, GW-, C-, CON-) for
 *     tipping/disposal cost detection (was missing 30 of 36 rows = $337k).
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0
  // Accept parenthesised negatives like "(1,500)" → -1500
  const s = String(val).trim()
  const isNeg = s.startsWith('(') && s.endsWith(')')
  const cleaned = s.replace(/[()$,\s]/g, '')
  const n = parseFloat(cleaned)
  if (isNaN(n)) return 0
  return isNeg ? -n : n
}

// ── Trading Income classifier ────────────────────────────────────────────────
// Returns one of: 'general' | 'asbestos' | 'soil' | 'green' | 'other'
//
// Priority order:
//   1. Explicit SKU prefix (most reliable for Binned-IT chart of accounts)
//   2. Descriptive keywords (handles human-named rows like "Asbestos Waste Tonnage")
//   3. Default → 'other' (caller should log a warning)
//
// The classification dictionary lives here so it can be exported for inspection
// (e.g. by a "show me how each row was classified" debug view).

const PREFIXED_RULES = [
  { regex: /^\s*asb\b|^\s*asb\s*-/i, bucket: 'asbestos' },
  { regex: /^\s*grw\b|^\s*grw\s*-/i, bucket: 'green' },
  { regex: /^\s*soi\b|^\s*soi\s*-/i, bucket: 'soil' },
  { regex: /^\s*wmf\b|^\s*wmf\s*-/i, bucket: 'general' },
  { regex: /^\s*con\b|^\s*con\s*-/i, bucket: 'general' },
]

const KEYWORD_RULES = [
  // Asbestos overrides — anything containing "asbestos" wins (covers "ASBESTOS 2M",
  // "Asbestos Waste Tonnage", "Revenue - Asbestos (ASB)", etc.)
  { test: n => /asbestos/i.test(n), bucket: 'asbestos' },
  // Soil — note "contaminated" alone is enough since the only contaminated stream is soil
  { test: n => /contaminated|soil|\bsoi\b/i.test(n), bucket: 'soil' },
  // Green
  { test: n => /\bgreen\b|\bgrw\b/i.test(n), bucket: 'green' },
  // General waste — explicit phrasings
  { test: n => /waste management fees|general waste/i.test(n), bucket: 'general' },
  // Transport revenue (waste hauling)
  { test: n => /\btransport\b/i.test(n), bucket: 'general' },
  // Recycling income (gate-fee-shared revenue is general-waste-related)
  { test: n => /recycling\s+income|recycling\s+m3|m3\s+rate\s+tipping/i.test(n), bucket: 'general' },
  // Long-term bin rental
  { test: n => /long\s*term\s*bin\s*rental/i.test(n), bucket: 'general' },
  // Fuel Levy (surcharge on hauling)
  { test: n => /fuel\s+levy/i.test(n), bucket: 'general' },
  // Other (explicit)
  { test: n => /council\s+permit|machinery\s+hire|plastic|other\s+fees/i.test(n), bucket: 'other' },
]

export function classifyTradingIncomeRow(name) {
  const n = String(name || '').trim()
  if (!n) return 'other'

  for (const { regex, bucket } of PREFIXED_RULES) {
    if (regex.test(n)) return bucket
  }
  for (const { test, bucket } of KEYWORD_RULES) {
    if (test(n)) return bucket
  }
  return 'other'
}

// ── Cost of Sales classifier ─────────────────────────────────────────────────
// Returns one of: 'wages' | 'fuel' | 'disposal' | 'other'
//
// For Binned-IT specifically, COS contains tipping/disposal costs ONLY — wages
// and fuel are in OPEX. But the classifier is defensive (will catch wages/fuel
// if the chart of accounts changes).

export function classifyCOSRow(name) {
  const n = String(name || '').trim()
  if (!n) return 'other'

  if (/wage|salary|payroll|driver/i.test(n)) return 'wages'
  if (/fuel|petrol|diesel/i.test(n)) return 'fuel'

  // Explicit tipping/disposal/recycling-cost language
  if (/tipping|tip\b|disposal|landfill|waste\s*levy|recycling\s+cost/i.test(n)) return 'disposal'

  // Bin-coded SKU prefixes (Binned-IT pattern: prefix + space/dash + size + (account code))
  // Examples: W- 4m Heavy (305), WMF - 12M (313), ASB - 8m (328), S - 6m (346), GW - 6m (336), C - 6m (356)
  if (/^\s*(asb|wmf|w|s|gw|c|con)\s*-/i.test(n)) return 'disposal'

  return 'other'
}

// ── P&L sections walker (Xero API response shape) ────────────────────────────
// Returns { sectionTitle (lowercased): { _total, _rows: [{name, amount}] } }
// Recursively walks nested sections so e.g. Bank under Assets is reachable.

export function parsePLSections(report) {
  const sections = {}
  if (!report?.Rows) return sections

  function walk(rows) {
    for (const row of rows) {
      if (row?.RowType === 'Section' && row.Title) {
        const title = row.Title.toLowerCase()
        if (!sections[title]) sections[title] = { _total: 0, _rows: [] }
        for (const r of (row.Rows || [])) {
          if (r.RowType === 'Row' && r.Cells?.length >= 2) {
            const name = r.Cells[0]?.Value || ''
            const amount = parseAmount(r.Cells[1]?.Value)
            sections[title]._rows.push({ name, amount })
          }
          if (r.RowType === 'SummaryRow' && r.Cells?.length >= 2) {
            sections[title]._total = parseAmount(r.Cells[1]?.Value)
          }
          if (r.RowType === 'Section') walk([r])
        }
      }
    }
  }
  walk(report.Rows)
  return sections
}

// Get section total: SummaryRow value if non-zero, else sum of all Row amounts (signed)
export function sectionTotal(section) {
  if (!section) return 0
  if (section._total !== 0) return section._total
  return section._rows.reduce((sum, r) => sum + r.amount, 0)
}

// ── P&L → financials_monthly mapper ──────────────────────────────────────────

export function mapPLToFinancials(sections, month) {
  // Revenue: walk Trading Income with the new classifier; preserve sign.
  let revGeneral = 0, revAsbestos = 0, revSoil = 0, revGreen = 0, revOther = 0
  const unclassified = []

  // Use 'trading income' if available; fall back to 'income' or split sub-sections.
  const revSubKeys = Object.keys(sections).filter(k => k.startsWith('revenue -'))
  const tradingRows = sections['trading income']?._rows || []

  if (tradingRows.length > 0) {
    for (const row of tradingRows) {
      const bucket = classifyTradingIncomeRow(row.name)
      // Sign is PRESERVED (audit P0-2 fix). Customer credits (negative rows)
      // correctly reduce revenue rather than inflating it.
      const amt = row.amount
      if (bucket === 'asbestos') revAsbestos += amt
      else if (bucket === 'soil') revSoil += amt
      else if (bucket === 'green') revGreen += amt
      else if (bucket === 'general') revGeneral += amt
      else { revOther += amt; unclassified.push(row.name) }
    }
  } else if (revSubKeys.length > 0) {
    // Standard Xero structure: 'revenue - asbestos', 'revenue - soil', etc.
    for (const k of revSubKeys) {
      const total = sectionTotal(sections[k])
      if (k.includes('asbestos')) revAsbestos += total
      else if (k.includes('soil') || k.includes('contaminated')) revSoil += total
      else if (k.includes('green')) revGreen += total
      else revGeneral += total // Default WMF/Transport/etc. into general (was 'other')
    }
  } else if (sections['income']) {
    revGeneral += sectionTotal(sections['income'])
  }

  const revTotal = revGeneral + revAsbestos + revSoil + revGreen + revOther

  // Cost of Sales — classify each row, preserve sign for credits
  const cosSection =
    sections['less cost of sales'] ||
    sections['cost of sales'] ||
    sections['cost of goods sold'] ||
    { _total: 0, _rows: [] }

  let cosWages = 0, cosFuel = 0, cosDisposal = 0, cosOther = 0
  for (const row of cosSection._rows) {
    const bucket = classifyCOSRow(row.name)
    const amt = row.amount
    if (bucket === 'wages') cosWages += amt
    else if (bucket === 'fuel') cosFuel += amt
    else if (bucket === 'disposal') cosDisposal += amt
    else cosOther += amt
  }
  // Preserve absolute values for COS storage (Xero presents COS as positive in P&L)
  // but allow signed when source was signed (refunds reduce expense)
  const cosTotal = cosWages + cosFuel + cosDisposal + cosOther

  // Operating Expenses
  const opexMainSection =
    sections['less operating expenses'] ||
    sections['operating expenses'] ||
    sections['expenses'] ||
    { _total: 0, _rows: [] }
  const opexOtherSection = sections['other overheads'] || { _total: 0, _rows: [] }
  const opexStaffSection = sections['staffing overheads'] || { _total: 0, _rows: [] }

  const opexRows = opexMainSection._rows
  // Wages can be in a dedicated 'staffing overheads' section OR inline in main opex
  const opexWagesInline = opexRows
    .filter(r => /wage|salary|super|payroll/i.test(r.name))
    .reduce((s, r) => s + r.amount, 0)
  const opexStaffTotal = opexStaffSection._total || opexStaffSection._rows.reduce((s, r) => s + r.amount, 0)
  const opexAdmin = opexStaffTotal !== 0 ? opexStaffTotal : opexWagesInline

  const opexRent = opexRows.filter(r => /rent|lease/i.test(r.name)).reduce((s, r) => s + r.amount, 0)
  const opexAdvert = opexRows.filter(r => /adverti|market|promo/i.test(r.name)).reduce((s, r) => s + r.amount, 0)
  const opexInsur = opexRows.filter(r => /insur/i.test(r.name)).reduce((s, r) => s + r.amount, 0)

  const opexMainTotal = opexMainSection._total || opexRows.reduce((s, r) => s + r.amount, 0)
  const opexOtherTotal = opexOtherSection._total || opexOtherSection._rows.reduce((s, r) => s + r.amount, 0)
  const opexMainKnown = opexAdmin + opexRent + opexAdvert + opexInsur
  const opexOther = opexOtherTotal + Math.max(0, opexMainTotal - opexMainKnown)
  const opexTotal = opexMainTotal + opexOtherTotal + (opexStaffTotal !== 0 ? opexStaffTotal : 0)

  // Derived
  const grossProfit = revTotal - cosTotal
  const grossMarginPct = revTotal !== 0 ? (grossProfit / revTotal) * 100 : 0
  const netProfit = grossProfit - opexTotal
  const netMarginPct = revTotal !== 0 ? (netProfit / revTotal) * 100 : 0

  return {
    rev_general: revGeneral,
    rev_asbestos: revAsbestos,
    rev_soil: revSoil,
    rev_green: revGreen,
    rev_other: revOther,
    rev_total: revTotal,
    cos_wages: cosWages,
    cos_fuel: cosFuel,
    cos_disposal: cosDisposal,
    cos_other: cosOther,
    cos_total: cosTotal,
    gross_profit: grossProfit,
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    opex_rent: opexRent,
    opex_admin: opexAdmin,
    opex_advertising: opexAdvert,
    opex_insurance: opexInsur,
    opex_other: opexOther,
    opex_total: opexTotal,
    net_profit: netProfit,
    net_margin_pct: Math.round(netMarginPct * 10) / 10,
    revenue_total: revTotal,
    // Diagnostic — caller can log if non-empty
    _diagnostic: { unclassified_trading_income: unclassified, month },
  }
}

// ── Balance Sheet ────────────────────────────────────────────────────────────
//
// Cash-balance fix (audit P0-3): walk the Assets subtree and identify the Bank
// section by SECTION TITLE, not by row-name keyword. Sum every Row inside the
// Bank section. This catches accounts named "Binned-It Pty Ltd" that the
// keyword matcher missed entirely.
//
// Westpac Business Cash Reserve is in Liabilities — DO NOT pull it into cash.

export function findCashBalance(report) {
  if (!report?.Rows) return 0

  let cash = 0

  function walkInAssets(rows, inAssets, inBank) {
    for (const row of rows) {
      if (!row) continue
      if (row.RowType === 'Section') {
        const title = (row.Title || '').toLowerCase()
        const nowInAssets = inAssets || title.includes('asset')
        const nowInBank = nowInAssets && (inBank || title.includes('bank'))
        if (row.Rows) walkInAssets(row.Rows, nowInAssets, nowInBank)
      } else if (row.RowType === 'Row' && inBank && row.Cells?.length >= 2) {
        const amt = parseAmount(row.Cells[1]?.Value)
        cash += amt
      }
    }
  }
  walkInAssets(report.Rows, false, false)
  return cash
}

export function parseBalanceSheet(report) {
  if (!report?.Rows) return {}

  const cash = findCashBalance(report)

  let ar = 0, totalAssets = 0, totalLiabilities = 0, equity = 0
  let gst = 0, payg = 0, accountsPayable = 0, fixedAssets = 0, loanCurrent = 0, loanNonCurrent = 0

  function walk(rows, parentTitleLower) {
    for (const row of rows) {
      if (!row) continue
      if (row.RowType === 'Section') {
        const title = (row.Title || '').toLowerCase()
        const inheritedTitle = parentTitleLower || title
        if (row.Rows) walk(row.Rows, inheritedTitle)
        continue
      }
      if ((row.RowType !== 'Row' && row.RowType !== 'SummaryRow') || !row.Cells) continue

      const name = (row.Cells[0]?.Value || '').toLowerCase()
      const amount = parseAmount(row.Cells[1]?.Value)

      if (row.RowType === 'SummaryRow') {
        if (parentTitleLower?.includes('asset')) totalAssets = Math.max(totalAssets, Math.abs(amount))
        if (parentTitleLower?.includes('liabilit')) totalLiabilities = Math.max(totalLiabilities, Math.abs(amount))
        if (parentTitleLower?.includes('equity')) equity = amount
      } else {
        // Detail rows — only categorise if we know which top-level section we're in
        if (name.includes('receivable') || name.includes('debtors')) ar = amount
        if (name.includes('gst')) gst += Math.abs(amount)
        if (name.includes('payg') || name.includes('withholding')) payg += Math.abs(amount)
        if (parentTitleLower?.includes('liabilit')) {
          if (name.includes('payable')) accountsPayable += Math.abs(amount)
          if (name.includes('loan') && (name.includes('current') || name.includes('short'))) loanCurrent += Math.abs(amount)
          else if (name.includes('loan') && (name.includes('noncurrent') || name.includes('long'))) loanNonCurrent += Math.abs(amount)
        }
        if (parentTitleLower?.includes('asset')) {
          if (name.includes('fixed') || name.includes('equipment') || name.includes('vehicle')) fixedAssets += amount
        }
      }
    }
  }
  walk(report.Rows, null)

  return {
    cash_balance: cash,
    accounts_receivable: ar,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    net_equity: equity,
    gst_liability: gst,
    payg_liability: payg,
    accounts_payable: accountsPayable,
    fixed_assets: fixedAssets,
    loan_current: loanCurrent,
    loan_noncurrent: loanNonCurrent,
    total_loans: loanCurrent + loanNonCurrent,
  }
}

// ── Aged Receivables (per-debtor) ────────────────────────────────────────────
//
// Audit P1 fix: read Cells[1..6] (was [1..5]). Older bucket was being dropped.

export function parseAgedReceivables(report) {
  const empty = { total: 0, byBucket: { current: 0, days30: 0, days60: 0, days90: 0, older: 0 }, perDebtor: [] }
  if (!report?.Rows) return empty

  const perDebtor = []
  let current = 0, days30 = 0, days60 = 0, days90 = 0, older = 0, total = 0

  function walk(rows) {
    for (const row of rows) {
      if (!row) continue
      if (row.RowType === 'Section' && row.Rows) {
        walk(row.Rows)
        continue
      }
      if (row.RowType === 'Row' && row.Cells?.length >= 6) {
        const name = row.Cells[0]?.Value || ''
        if (!name || name.toLowerCase() === 'total') continue
        const cur = parseAmount(row.Cells[1]?.Value)
        const d30 = parseAmount(row.Cells[2]?.Value)
        const d60 = parseAmount(row.Cells[3]?.Value)
        const d90 = parseAmount(row.Cells[4]?.Value)
        const old = parseAmount(row.Cells[5]?.Value)
        // Cells[6] may exist as the row total — prefer it if present, else compute
        const reportedTotal = row.Cells.length >= 7 ? parseAmount(row.Cells[6]?.Value) : 0
        const computedTotal = cur + d30 + d60 + d90 + old
        const rowTotal = reportedTotal || computedTotal

        current += cur; days30 += d30; days60 += d60; days90 += d90; older += old; total += rowTotal

        let daysOverdue = 0
        if (d90 + old > 0) daysOverdue = 90
        else if (d60 > 0) daysOverdue = 60
        else if (d30 > 0) daysOverdue = 30

        if (rowTotal > 0) perDebtor.push({ name, total: rowTotal, current: cur, days30: d30, days60: d60, days90: d90, older: old, days_overdue: daysOverdue })
      }
    }
  }
  walk(report.Rows)
  perDebtor.sort((a, b) => b.total - a.total)

  return { total, byBucket: { current, days30, days60, days90, older }, perDebtor }
}
