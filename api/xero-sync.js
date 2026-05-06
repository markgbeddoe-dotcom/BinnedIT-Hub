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
import {
  parsePLSections,
  mapPLToFinancials,
  parseBalanceSheet,
  parseAgedReceivables,
} from './lib/xero-mapper.js'

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

async function fetchAgedReceivables(accessToken, tenantId, fromDate, toDate) {
  const params = new URLSearchParams({ fromDate, toDate })
  const res = await fetch(`${XERO_API}/Reports/AgedReceivablesByContact?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Xero AR fetch failed: ${res.status}${body ? ` — ${body}` : ''}`)
  }
  const data = await res.json()
  return data.Reports?.[0]
}

// Mapping helpers live in api/lib/xero-mapper.js (Vitest-tested).
// See docs/audits/2026-05-06/audit-reconciliation.md for the rewrite rationale.

// ── Supabase writers ──────────────────────────────────────────────────────────

// Plain INSERT for log tables (no unique constraint, no conflict possible)
async function insertToSupabase(table, data, serviceKey) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase ${table} insert failed: ${err}`)
  }
}

// DELETE existing monthly_reports row for the month, then INSERT fresh — returns the new uuid
async function deleteAndInsertMonthlyReport(reportMonth, serviceKey) {
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/monthly_reports?report_month=eq.${encodeURIComponent(reportMonth)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    }
  )
  if (!delRes.ok) {
    const err = await delRes.text()
    throw new Error(`Supabase monthly_reports delete failed: ${err}`)
  }

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/monthly_reports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      report_month: reportMonth,
      status: 'complete',
      updated_at: new Date().toISOString(),
    }),
  })
  if (!insRes.ok) {
    const err = await insRes.text()
    throw new Error(`Supabase monthly_reports insert failed: ${err}`)
  }
  const rows = await insRes.json()
  if (!rows?.[0]?.id) throw new Error('monthly_reports insert returned no id')
  return rows[0].id
}

// DELETE existing row(s) for the month, then INSERT fresh — avoids UNIQUE constraint requirement
async function deleteAndInsert(table, reportId, reportMonth, data, serviceKey) {
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?report_month=eq.${encodeURIComponent(reportMonth)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    }
  )
  if (!delRes.ok) {
    const err = await delRes.text()
    throw new Error(`Supabase ${table} delete failed: ${err}`)
  }

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ report_id: reportId, report_month: reportMonth, ...data }),
  })
  if (!insRes.ok) {
    const err = await insRes.text()
    throw new Error(`Supabase ${table} insert failed: ${err}`)
  }
}

// ── Single-month sync ─────────────────────────────────────────────────────────

async function syncMonth(month, accessToken, tenantId, serviceKey, userId) {
  const [year, mon] = month.split('-').map(Number)
  const fromDate = `${month}-01`
  const lastDay  = new Date(year, mon, 0).getDate()
  const toDate   = `${month}-${String(lastDay).padStart(2, '0')}`

  // P&L and Balance Sheet are required — let these throw if they fail
  const [plReport, bsReport] = await Promise.all([
    fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate),
    fetchBalanceSheet(accessToken, tenantId, toDate),
  ])

  // AR: fetch all-contacts aged receivables summary (no contactID needed for summary view)
  let arReport = null
  try {
    arReport = await fetchAgedReceivables(accessToken, tenantId, fromDate, toDate)
  } catch (arErr) {
    console.warn('XERO_AR_FETCH_WARN: AR fetch failed (non-fatal):', arErr.message)
  }

  const plSections  = parsePLSections(plReport)
  const financials  = mapPLToFinancials(plSections, month)
  const balanceSheet = parseBalanceSheet(bsReport)
  const arData      = arReport ? parseAgedReceivables(arReport) : null
  const reportMonth = `${month}-01`

  // Step 1: DELETE + INSERT monthly_reports — returns the uuid needed as FK
  const reportId = await deleteAndInsertMonthlyReport(reportMonth, serviceKey)

  // Step 2: DELETE + INSERT financials_monthly (no UNIQUE on report_month — must use delete/insert)
  await deleteAndInsert('financials_monthly', reportId, reportMonth, financials, serviceKey)

  // Step 3: DELETE + INSERT balance_sheet_monthly
  if (balanceSheet.total_assets !== undefined) {
    await deleteAndInsert('balance_sheet_monthly', reportId, reportMonth, balanceSheet, serviceKey)
  }

  // Step 4: DELETE all existing debtors_monthly rows for this month, then INSERT one per debtor.
  // Re-enabled 2026-05-07 — see api/lib/xero-mapper.js parseAgedReceivables (audit P0-4 + P1).
  let debtorsWritten = 0
  if (arData?.perDebtor?.length) {
    await deleteDebtorsForMonth(reportMonth, serviceKey)
    for (const d of arData.perDebtor) {
      await insertToSupabase('debtors_monthly', {
        report_id: reportId,
        report_month: reportMonth,
        debtor_name: d.name,
        current_amount: d.current,
        overdue_30: d.days30,
        overdue_60: d.days60,
        overdue_90plus: d.days90 + d.older,   // schema combines 90+ and older
        total_outstanding: d.total,
      }, serviceKey)
      debtorsWritten++
    }
  }

  await insertToSupabase('xero_sync_log', {
    sync_month: reportMonth,
    status: 'success',
    message: `Synced P&L + BS + AR from Xero: ${tenantId}`,
    rows_written: {
      financials: 1,
      balance_sheet: balanceSheet.total_assets ? 1 : 0,
      debtors: debtorsWritten,
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
    arTotal: arData?.total ?? null,
    debtorsWritten,
  }
}

// Delete all debtors_monthly rows for a given report_month (per-debtor wipe-and-rewrite).
async function deleteDebtorsForMonth(reportMonth, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/debtors_monthly?report_month=eq.${encodeURIComponent(reportMonth)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase debtors_monthly delete failed: ${err}`)
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
        await insertToSupabase('xero_sync_log', {
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
      await insertToSupabase('xero_sync_log', {
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
