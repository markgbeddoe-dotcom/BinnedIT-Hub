/**
 * @file api/xero-sync.js — Vercel Edge Function
 *
 * Fetches Profit & Loss, Balance Sheet, and Aged Receivables from Xero
 * for a given month (or range), maps the data to the Binned-IT schema,
 * and writes to Supabase: financials_monthly, balance_sheet_monthly, debtors_monthly.
 *
 * Single month:  POST { month: 'YYYY-MM', userId: string }
 * Bulk history:  POST { action: 'sync_all', from_month: 'YYYY-MM', to_month: 'YYYY-MM', userId: string }
 * Authorization: Bearer <user JWT>
 *
 * Returns: { success: true, summary: { revenue, cos, opex, netProfit } }
 *       or { success: true, results: [...] }  for bulk sync
 */
export const config = { runtime: 'edge' }

import { getValidToken, verifySupabaseJWT } from './lib/xero-token.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const XERO_API = 'https://api.xero.com/api.xro/2.0'

// ── Xero report fetchers ──────────────────────────────────────────────────────

async function fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate) {
  const params = new URLSearchParams({ fromDate, toDate })
  const res = await fetch(`${XERO_API}/Reports/ProfitAndLoss?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`Xero P&L fetch failed: ${res.status}`)
  const data = await res.json()
  return data.Reports?.[0]
}

async function fetchBalanceSheet(accessToken, tenantId, date) {
  const res = await fetch(`${XERO_API}/Reports/BalanceSheet?date=${date}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`Xero Balance Sheet fetch failed: ${res.status}`)
  const data = await res.json()
  return data.Reports?.[0]
}

async function fetchAgedReceivables(accessToken, tenantId, date) {
  const res = await fetch(`${XERO_API}/Reports/AgedReceivablesByContact?date=${date}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`Xero AR fetch failed: ${res.status}`)
  const data = await res.json()
  return data.Reports?.[0]
}

// ── P&L parser ────────────────────────────────────────────────────────────────

function parseAmount(val) {
  if (!val) return 0
  const n = parseFloat(String(val).replace(/[,$]/g, ''))
  return isNaN(n) ? 0 : n
}

// Returns { sectionTitle → { _total: number, _rows: [{name, amount}] } }
function parsePLSections(report) {
  const sections = {}
  if (!report?.Rows) return sections

  for (const row of report.Rows) {
    if (row.RowType === 'Section' && row.Title) {
      const title = row.Title.toLowerCase()
      sections[title] = { _total: 0, _rows: [] }
      for (const r of (row.Rows || [])) {
        if (r.RowType === 'Row' && r.Cells?.length >= 2) {
          const name = r.Cells[0]?.Value || ''
          const amount = parseAmount(r.Cells[1]?.Value)
          sections[title]._rows.push({ name, amount })
        }
        if (r.RowType === 'SummaryRow' && r.Cells?.length >= 2) {
          sections[title]._total = parseAmount(r.Cells[1]?.Value)
        }
      }
    }
  }
  return sections
}

function sumByKeywords(rows, ...keywords) {
  return rows
    .filter(r => keywords.some(k => r.name.toLowerCase().includes(k.toLowerCase())))
    .reduce((sum, r) => sum + r.amount, 0)
}

function mapPLToFinancials(sections, month) {
  const revKey = Object.keys(sections).find(k => k.includes('income') || k.includes('revenue') || k.includes('trading')) || ''
  const cosKey = Object.keys(sections).find(k => k.includes('cost of sale') || k.includes('direct cost')) || ''
  const opexKey = Object.keys(sections).find(k => k.includes('operating') || k.includes('overhead') || k.includes('expense')) || ''

  const revSection  = sections[revKey]  || { _total: 0, _rows: [] }
  const cosSection  = sections[cosKey]  || { _total: 0, _rows: [] }
  const opexSection = sections[opexKey] || { _total: 0, _rows: [] }

  const revTotal  = revSection._total
  const cosTotal  = cosSection._total
  const opexTotal = opexSection._total
  const grossProfit    = revTotal - cosTotal
  const grossMarginPct = revTotal > 0 ? (grossProfit / revTotal) * 100 : 0
  const netProfit      = grossProfit - opexTotal
  const netMarginPct   = revTotal > 0 ? (netProfit / revTotal) * 100 : 0

  const revRows = revSection._rows
  const revAsbestos    = sumByKeywords(revRows, 'asbestos', 'asb')
  const revSoil        = sumByKeywords(revRows, 'soil', 'contaminated')
  const revGreenWaste  = sumByKeywords(revRows, 'green', 'garden', 'vegetation')
  const revOther       = sumByKeywords(revRows, 'other', 'misc', 'sundry')
  const revGeneralWaste = Math.max(0, revTotal - revAsbestos - revSoil - revGreenWaste - revOther)

  const cosRows = cosSection._rows
  const cosWages   = sumByKeywords(cosRows, 'wage', 'driver wage', 'labour', 'labor')
  const cosFuel    = sumByKeywords(cosRows, 'fuel', 'petrol', 'diesel')
  const cosRepairs = sumByKeywords(cosRows, 'repair', 'maintenance', 'service', 'vehicle')
  const cosTipping = sumByKeywords(cosRows, 'tip', 'disposal', 'landfill', 'waste levy', 'tipping')
  const cosTolls   = sumByKeywords(cosRows, 'toll')
  const cosTarp    = sumByKeywords(cosRows, 'tarp', 'cover')

  const opexRows = opexSection._rows
  const opexRent   = sumByKeywords(opexRows, 'rent', 'lease')
  const opexWages  = sumByKeywords(opexRows, 'wage', 'salary', 'admin wage', 'office')
  const opexAdvert = sumByKeywords(opexRows, 'adverti', 'market', 'promo')
  const opexAcct   = sumByKeywords(opexRows, 'account', 'bookkeep', 'audit')
  const opexInsur  = sumByKeywords(opexRows, 'insur')
  const opexPhone  = sumByKeywords(opexRows, 'phone', 'mobile', 'internet', 'telco')

  return {
    report_month: `${month}-01`,
    rev_total: revTotal,
    rev_general_waste: revGeneralWaste,
    rev_asbestos: revAsbestos,
    rev_soil: revSoil,
    rev_green_waste: revGreenWaste,
    rev_other: revOther,
    cos_total: cosTotal,
    cos_wages: cosWages,
    cos_fuel: cosFuel,
    cos_repairs: cosRepairs,
    cos_tipping: cosTipping,
    cos_tolls: cosTolls,
    cos_tarpaulins: cosTarp,
    opex_total: opexTotal,
    opex_rent: opexRent,
    opex_wages: opexWages,
    opex_advertising: opexAdvert,
    opex_accounting: opexAcct,
    opex_insurance: opexInsur,
    opex_phone: opexPhone,
    gross_profit: grossProfit,
    gross_margin_pct: Math.round(grossMarginPct * 10) / 10,
    net_profit: netProfit,
    net_margin_pct: Math.round(netMarginPct * 10) / 10,
    data_source: 'xero',
    updated_at: new Date().toISOString(),
  }
}

// ── Balance sheet parser ──────────────────────────────────────────────────────

function parseBalanceSheet(report) {
  if (!report?.Rows) return {}

  let cash = 0, ar = 0, totalAssets = 0, totalLiabilities = 0, equity = 0
  let gst = 0, payg = 0

  for (const row of report.Rows) {
    if (row.RowType === 'Section') {
      const title = (row.Title || '').toLowerCase()
      const rows = row.Rows || []

      for (const r of rows) {
        if (r.RowType !== 'Row' && r.RowType !== 'SummaryRow') continue
        const name   = (r.Cells?.[0]?.Value || '').toLowerCase()
        const amount = parseAmount(r.Cells?.[1]?.Value)

        if (r.RowType === 'SummaryRow') {
          if (title.includes('asset'))    totalAssets = amount
          if (title.includes('liabilit')) totalLiabilities = amount
          if (title.includes('equity'))   equity = amount
        } else {
          if (name.includes('cash') || name.includes('bank') || name.includes('westpac')) cash += amount
          if (name.includes('receivable') || name.includes('debtors')) ar = amount
          if (name.includes('gst'))                                    gst  += Math.abs(amount)
          if (name.includes('payg') || name.includes('withholding'))   payg += Math.abs(amount)
        }
      }
    }
  }

  return {
    cash_and_bank: cash,
    accounts_receivable: ar,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    net_equity: equity,
    gst_liability: gst,
    payg_liability: payg,
    data_source: 'xero',
    updated_at: new Date().toISOString(),
  }
}

// ── AR aging parser ───────────────────────────────────────────────────────────

function parseAgedReceivables(report) {
  if (!report?.Rows) return { total: 0, current: 0, days30: 0, days60: 0, days90: 0, older: 0, topDebtors: [] }

  let total = 0, current = 0, days30 = 0, days60 = 0, days90 = 0, older = 0
  const topDebtors = []

  for (const row of report.Rows) {
    if (row.RowType === 'Row' && row.Cells?.length >= 6) {
      const name = row.Cells[0]?.Value || ''
      if (!name || name === 'Total') continue
      const cur      = parseAmount(row.Cells[1]?.Value)
      const d30      = parseAmount(row.Cells[2]?.Value)
      const d60      = parseAmount(row.Cells[3]?.Value)
      const d90      = parseAmount(row.Cells[4]?.Value)
      const old      = parseAmount(row.Cells[5]?.Value)
      const rowTotal = cur + d30 + d60 + d90 + old

      current += cur; days30 += d30; days60 += d60; days90 += d90; older += old; total += rowTotal

      // Calculate actual days overdue from the most overdue bucket that has a balance
      let daysOverdue = 0
      if (d90 + old > 0) daysOverdue = 90
      else if (d60 > 0)  daysOverdue = 60
      else if (d30 > 0)  daysOverdue = 30

      if (rowTotal > 0) topDebtors.push({ name, total: rowTotal, days_overdue: daysOverdue })
    }
  }

  topDebtors.sort((a, b) => b.total - a.total)
  return { total, current, days30, days60, days90, older, topDebtors: topDebtors.slice(0, 10) }
}

// ── Supabase writers ──────────────────────────────────────────────────────────

async function upsertToSupabase(table, data, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${table} upsert failed: ${err}`)
  }
}

// ── Single-month sync ─────────────────────────────────────────────────────────

async function syncMonth(month, accessToken, tenantId, serviceKey, userId) {
  const [year, mon] = month.split('-').map(Number)
  const fromDate = `${month}-01`
  const lastDay  = new Date(year, mon, 0).getDate()
  const toDate   = `${month}-${String(lastDay).padStart(2, '0')}`

  const [plReport, bsReport, arReport] = await Promise.all([
    fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate),
    fetchBalanceSheet(accessToken, tenantId, toDate),
    fetchAgedReceivables(accessToken, tenantId, toDate),
  ])

  const plSections  = parsePLSections(plReport)
  const financials  = mapPLToFinancials(plSections, month)
  const balanceSheet = parseBalanceSheet(bsReport)
  const arData      = parseAgedReceivables(arReport)

  await upsertToSupabase('monthly_reports', {
    report_month: `${month}-01`,
    status: 'final',
    data_source: 'xero',
    updated_at: new Date().toISOString(),
  }, serviceKey)

  await upsertToSupabase('financials_monthly', { ...financials, report_month: `${month}-01` }, serviceKey)

  if (balanceSheet.total_assets !== undefined) {
    await upsertToSupabase('balance_sheet_monthly', {
      report_month: `${month}-01`,
      ...balanceSheet,
    }, serviceKey)
  }

  if (arData.total > 0) {
    await upsertToSupabase('debtors_monthly', {
      report_month: `${month}-01`,
      ar_total: arData.total,
      ar_current: arData.current,
      ar_30_days: arData.days30,
      ar_60_days: arData.days60,
      ar_90_days: arData.days90,
      ar_older: arData.older,
      top_debtors: arData.topDebtors,
      updated_at: new Date().toISOString(),
    }, serviceKey)
  }

  await upsertToSupabase('xero_sync_log', {
    sync_month: `${month}-01`,
    status: 'success',
    message: `Synced from Xero: ${tenantId}`,
    rows_written: {
      financials: 1,
      balance_sheet: balanceSheet.total_assets ? 1 : 0,
      debtors: arData.total > 0 ? 1 : 0,
    },
    synced_by: userId || null,
    created_at: new Date().toISOString(),
  }, serviceKey)

  return {
    month,
    revenue: financials.rev_total,
    cos: financials.cos_total,
    grossMargin: financials.gross_margin_pct,
    netProfit: financials.net_profit,
    arTotal: arData.total,
  }
}

// ── Bulk history sync ─────────────────────────────────────────────────────────

/**
 * Generate an array of 'YYYY-MM' strings between from_month and to_month (inclusive).
 */
function monthRange(fromMonth, toMonth) {
  const months = []
  const [fy, fm] = fromMonth.split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

async function syncMonthRange(fromMonth, toMonth, accessToken, tenantId, serviceKey, userId) {
  const months = monthRange(fromMonth, toMonth)
  const results = []

  for (const month of months) {
    try {
      const summary = await syncMonth(month, accessToken, tenantId, serviceKey, userId)
      results.push({ month, ok: true, summary })
    } catch (err) {
      results.push({ month, ok: false, error: err.message })
      try {
        await upsertToSupabase('xero_sync_log', {
          sync_month: `${month}-01`,
          status: 'error',
          message: err.message,
          synced_by: userId || null,
          created_at: new Date().toISOString(),
        }, serviceKey)
      } catch { /* non-fatal */ }
    }
    // 500 ms delay between months to respect Xero rate limits
    if (months.indexOf(month) < months.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  return results
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }
  const bearerToken = authHeader.slice(7)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Verify JWT
  try {
    await verifySupabaseJWT(bearerToken)
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { action, month, from_month, to_month, userId } = body

  try {
    const { accessToken, tenantId } = await getValidToken(serviceKey)

    // ── Bulk history sync ──
    if (action === 'sync_all') {
      if (!from_month || !/^\d{4}-\d{2}$/.test(from_month) ||
          !to_month   || !/^\d{4}-\d{2}$/.test(to_month)) {
        return new Response(
          JSON.stringify({ error: 'from_month and to_month must be YYYY-MM format' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (from_month > to_month) {
        return new Response(
          JSON.stringify({ error: 'from_month must be before or equal to to_month' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      const results = await syncMonthRange(from_month, to_month, accessToken, tenantId, serviceKey, userId)
      const succeeded = results.filter(r => r.ok).length
      return new Response(
        JSON.stringify({ success: true, synced: results.length, succeeded, failed: results.length - succeeded, results }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Single month sync ──
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return new Response(JSON.stringify({ error: 'month must be YYYY-MM format' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const summary = await syncMonth(month, accessToken, tenantId, serviceKey, userId)
    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    try {
      await upsertToSupabase('xero_sync_log', {
        sync_month: month ? `${month}-01` : new Date().toISOString().slice(0, 7) + '-01',
        status: 'error',
        message: err.message,
        synced_by: userId || null,
        created_at: new Date().toISOString(),
      }, process.env.SUPABASE_SERVICE_ROLE_KEY)
    } catch { /* non-fatal */ }

    return new Response(JSON.stringify({ error: err.message || 'Sync failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
