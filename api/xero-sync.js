/**
 * @file api/xero-sync.js — Vercel Edge Function
 *
 * Fetches Profit & Loss, Balance Sheet, and Aged Receivables from Xero
 * for a given month (or range), maps the data to the Binned-IT schema,
 * and writes to Supabase: financials_monthly, balance_sheet_monthly, debtors_monthly.
 *
 * Single month:    POST { month: 'YYYY-MM', userId: string, basis?: 'cash'|'accrual' }
 * Both bases:      POST { action: 'sync_all_bases', month: 'YYYY-MM', userId: string }
 * Bulk history:    POST { action: 'sync_all', from_month: 'YYYY-MM', to_month: 'YYYY-MM',
 *                          userId: string, basis?: 'cash'|'accrual', bases?: ['cash','accrual'] }
 * Authorization:   Bearer <user JWT>
 *
 * Returns: { success: true, summary: { revenue, cos, opex, netProfit, basis } }
 *       or { success: true, results: [...] }   for bulk sync
 *       or { success: true, summaries: { cash, accrual } } for sync_all_bases
 *
 * Sprint 17 #17C — cash/accrual basis support. The Xero P&L endpoint accepts
 * `paymentsOnly=true` (cash basis) or `paymentsOnly=false` (accrual basis).
 * We store both with an `accounting_basis` discriminator column. See migration
 * supabase/migrations/020_accounting_basis.sql for the schema.
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

/**
 * Fetch P&L for a date range.
 * @param {string} basis - 'cash' (paymentsOnly=true) or 'accrual' (paymentsOnly=false). Default 'cash'.
 *
 * Sprint 17 #17C — basis arg added. Default is 'cash' to match the new app default
 * (the accountant works on cash basis). Pre-Sprint-17 behaviour was de facto accrual
 * because paymentsOnly was never sent.
 */
async function fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate, basis = 'cash') {
  const params = new URLSearchParams({ fromDate, toDate })
  // Xero accepts paymentsOnly as 'true' or 'false' string — explicit on both branches
  // so the choice is never ambiguous in network logs.
  params.append('paymentsOnly', basis === 'cash' ? 'true' : 'false')
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

// DELETE existing monthly_reports row for the month, then INSERT fresh — returns the new uuid.
//
// monthly_reports has NO accounting_basis column — it's the parent row for both cash AND accrual
// snapshots of the same month. So delete-and-insert is only safe to call ONCE per month-sync.
// For sync_all_bases we re-use the same uuid for both basis writes (resolved by upserting on
// the second pass: if it already exists for the month, just fetch the id).
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

// Get-or-create a monthly_reports row for a given month — used by the second pass of
// sync_all_bases so the second basis sync doesn't wipe the rows just written by the first.
async function getOrCreateMonthlyReport(reportMonth, serviceKey) {
  const selRes = await fetch(
    `${SUPABASE_URL}/rest/v1/monthly_reports?report_month=eq.${encodeURIComponent(reportMonth)}&select=id`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  )
  if (selRes.ok) {
    const rows = await selRes.json()
    if (rows?.[0]?.id) return rows[0].id
  }
  // Doesn't exist yet → fall back to delete-and-insert
  return deleteAndInsertMonthlyReport(reportMonth, serviceKey)
}

// DELETE existing row(s) for the month + basis, then INSERT fresh.
//
// Sprint 17 #17C — DELETE is now scoped by accounting_basis so syncing cash
// doesn't wipe accrual (and vice versa). The basis is also stamped onto the
// inserted row.
async function deleteAndInsert(table, reportId, reportMonth, data, serviceKey, basis = 'cash') {
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?report_month=eq.${encodeURIComponent(reportMonth)}&accounting_basis=eq.${basis}`,
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
    body: JSON.stringify({
      report_id: reportId,
      report_month: reportMonth,
      accounting_basis: basis,
      ...data,
    }),
  })
  if (!insRes.ok) {
    const err = await insRes.text()
    throw new Error(`Supabase ${table} insert failed: ${err}`)
  }
}

// ── Single-month sync ─────────────────────────────────────────────────────────

/**
 * Sync one month from Xero → Supabase under a single accounting basis.
 *
 * @param {string} basis - 'cash' or 'accrual'. Default 'cash'.
 * @param {boolean} reuseReport - If true, FETCH the existing monthly_reports.id rather than
 *   delete-and-insert. Used by sync_all_bases so the second basis pass doesn't wipe the
 *   first basis's child rows (which have ON DELETE CASCADE on monthly_reports.id).
 */
// Sprint 18 #X2 — also exported as a named binding so scripts/resync-xero.js
// can invoke the same code path from a Node runtime, bypassing the HTTP+JWT
// edge that's only suitable for browser-originated calls.
export async function syncMonth(month, accessToken, tenantId, serviceKey, userId, basis = 'cash', reuseReport = false) {
  const [year, mon] = month.split('-').map(Number)
  const fromDate = `${month}-01`
  const lastDay  = new Date(year, mon, 0).getDate()
  const toDate   = `${month}-${String(lastDay).padStart(2, '0')}`

  // P&L and Balance Sheet are required — let these throw if they fail
  const [plReport, bsReport] = await Promise.all([
    fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate, basis),
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
  const financialsRaw = mapPLToFinancials(plSections, month)
  // Sprint 18 #X3 — _diagnostic is an internal observability field returned by
  // the mapper for caller logging. It must NOT be sent to Supabase (no such
  // column). Strip before insert.
  const { _diagnostic, ...financials } = financialsRaw
  if (_diagnostic?.unclassified_trading_income?.length) {
    console.log('XERO_PL_UNCLASSIFIED:', { month, basis, names: _diagnostic.unclassified_trading_income })
  }
  const balanceSheet = parseBalanceSheet(bsReport)
  const arData      = arReport ? parseAgedReceivables(arReport) : null
  const reportMonth = `${month}-01`

  // Step 1: monthly_reports row — get-or-create when reusing (sync_all_bases second pass),
  // else delete-and-insert (default single-basis sync).
  const reportId = reuseReport
    ? await getOrCreateMonthlyReport(reportMonth, serviceKey)
    : await deleteAndInsertMonthlyReport(reportMonth, serviceKey)

  // Step 2: DELETE + INSERT financials_monthly for THIS basis only
  await deleteAndInsert('financials_monthly', reportId, reportMonth, financials, serviceKey, basis)

  // Step 3: DELETE + INSERT balance_sheet_monthly for THIS basis only
  if (balanceSheet.total_assets !== undefined) {
    await deleteAndInsert('balance_sheet_monthly', reportId, reportMonth, balanceSheet, serviceKey, basis)
  }

  // Step 4: DELETE all existing debtors_monthly rows for this month+basis, then INSERT one per debtor.
  // Re-enabled 2026-05-07 — see api/lib/xero-mapper.js parseAgedReceivables (audit P0-4 + P1).
  let debtorsWritten = 0
  if (arData?.perDebtor?.length) {
    await deleteDebtorsForMonth(reportMonth, serviceKey, basis)
    for (const d of arData.perDebtor) {
      await insertToSupabase('debtors_monthly', {
        report_id: reportId,
        report_month: reportMonth,
        accounting_basis: basis,
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
    message: `Synced P&L (${basis}) + BS + AR from Xero: ${tenantId}`,
    rows_written: {
      financials: 1,
      balance_sheet: balanceSheet.total_assets ? 1 : 0,
      debtors: debtorsWritten,
      basis,
    },
    synced_by: userId || null,
    created_at: new Date().toISOString(),
  }, serviceKey)

  return {
    month,
    basis,
    revenue: financials.rev_total,
    cos: financials.cos_total,
    grossMargin: financials.gross_margin_pct,
    netProfit: financials.net_profit,
    arTotal: arData?.total ?? null,
    debtorsWritten,
  }
}

// Delete all debtors_monthly rows for a given report_month + basis (per-debtor wipe-and-rewrite).
async function deleteDebtorsForMonth(reportMonth, serviceKey, basis = 'cash') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/debtors_monthly?report_month=eq.${encodeURIComponent(reportMonth)}&accounting_basis=eq.${basis}`,
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

/**
 * Sync a range of months. If `bases` is supplied (e.g. ['cash','accrual']) every month
 * is synced under each basis sequentially before moving to the next month. The first
 * basis pass writes the monthly_reports row; later basis passes reuse that uuid.
 */
async function syncMonthRange(fromMonth, toMonth, accessToken, tenantId, serviceKey, userId, bases) {
  const months = monthRange(fromMonth, toMonth)
  const results = []
  const basisList = bases && bases.length ? bases : ['cash']

  for (const month of months) {
    let firstBasisDone = false
    for (const basis of basisList) {
      try {
        const summary = await syncMonth(
          month, accessToken, tenantId, serviceKey, userId, basis,
          /* reuseReport */ firstBasisDone
        )
        results.push({ month, basis, ok: true, summary })
        firstBasisDone = true
      } catch (err) {
        results.push({ month, basis, ok: false, error: err.message })
        try {
          await insertToSupabase('xero_sync_log', {
            sync_month: `${month}-01`,
            status: 'error',
            message: `[${basis}] ${err.message}`,
            synced_by: userId || null,
            created_at: new Date().toISOString(),
          }, serviceKey)
        } catch { /* non-fatal */ }
      }
      // 250 ms between basis passes (same month, two Xero hits)
      if (basisList.indexOf(basis) < basisList.length - 1) {
        await new Promise(r => setTimeout(r, 250))
      }
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
  // Sprint 17 #17C — basis is optional, defaults to 'cash'. Only 'cash'|'accrual' accepted.
  const requestedBasis = body.basis === 'accrual' ? 'accrual' : 'cash'
  // Optional bases array: ['cash','accrual'] for the bulk path.
  const basesParam = Array.isArray(body.bases)
    ? body.bases.filter(b => b === 'cash' || b === 'accrual')
    : null

  try {
    const { accessToken, tenantId } = await getValidToken(serviceKey)

    // ── Sync same month under BOTH bases (cash then accrual) ──
    if (action === 'sync_all_bases') {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return new Response(JSON.stringify({ error: 'month must be YYYY-MM format' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      const cashSummary = await syncMonth(month, accessToken, tenantId, serviceKey, userId, 'cash', /* reuseReport */ false)
      const accrualSummary = await syncMonth(month, accessToken, tenantId, serviceKey, userId, 'accrual', /* reuseReport */ true)
      return new Response(
        JSON.stringify({ success: true, summaries: { cash: cashSummary, accrual: accrualSummary } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

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
      // Prefer `bases` array if supplied, else single `basis` (default cash)
      const basesForRange = basesParam && basesParam.length ? basesParam : [requestedBasis]
      const results = await syncMonthRange(
        from_month, to_month, accessToken, tenantId, serviceKey, userId, basesForRange
      )
      const succeeded = results.filter(r => r.ok).length
      return new Response(
        JSON.stringify({
          success: true,
          synced: results.length,
          succeeded,
          failed: results.length - succeeded,
          bases: basesForRange,
          results,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // ── Single month sync ──
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return new Response(JSON.stringify({ error: 'month must be YYYY-MM format' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const summary = await syncMonth(month, accessToken, tenantId, serviceKey, userId, requestedBasis)
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

// ── Test exports ──────────────────────────────────────────────────────────────
// Internal helpers exposed for Vitest + scripts/resync-xero.js. syncMonth is
// inline-exported above (Sprint 18 #X2); the rest are re-exported here.
// (Edge Function consumers only invoke `handler` via HTTP.)
export { fetchProfitAndLoss, deleteAndInsert, monthRange }
