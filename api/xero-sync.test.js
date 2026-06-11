/**
 * @file api/xero-sync.test.js
 *
 * Sprint 17 #17C — cash/accrual basis support tests.
 *
 * These tests document the wire-level contract for the basis switch:
 *   1. fetchProfitAndLoss appends paymentsOnly=true for cash, false for accrual.
 *   2. syncMonth stamps `accounting_basis` on every row written and scopes
 *      its DELETEs by basis (so a cash sync never wipes accrual rows).
 *
 * Heavy use of fetch-mocking — no Supabase, no Xero. We assert on URL/body
 * shape only because the runtime is Vercel Edge (global fetch).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchProfitAndLoss, syncMonth, deleteAndInsert, monthRange } from './xero-sync.js'

// Minimal Xero P&L fixture — enough for parsePLSections + mapPLToFinancials
// to return a shape that exercises every branch in syncMonth without crashing.
const FAKE_PL_REPORT = {
  Reports: [{
    Rows: [
      {
        RowType: 'Section',
        Title: 'Trading Income',
        Rows: [
          { RowType: 'Row', Cells: [{ Value: 'WMF - 4m' }, { Value: '1000' }] },
          { RowType: 'SummaryRow', Cells: [{ Value: 'Total Trading Income' }, { Value: '1000' }] },
        ],
      },
      {
        RowType: 'Section',
        Title: 'Less Cost of Sales',
        Rows: [
          { RowType: 'Row', Cells: [{ Value: 'W - 4m Tipping' }, { Value: '300' }] },
          { RowType: 'SummaryRow', Cells: [{ Value: 'Total Cost of Sales' }, { Value: '300' }] },
        ],
      },
    ],
  }],
}

const FAKE_BS_REPORT = {
  Reports: [{
    Rows: [
      {
        RowType: 'Section',
        Title: 'Assets',
        Rows: [
          {
            RowType: 'Section',
            Title: 'Bank',
            Rows: [
              { RowType: 'Row', Cells: [{ Value: 'Westpac Operating' }, { Value: '5000' }] },
            ],
          },
          { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '5000' }] },
        ],
      },
    ],
  }],
}

// Empty AR — keeps debtor INSERT loop short
const FAKE_AR_REPORT = { Reports: [{ Rows: [] }] }

// WP-I (2026-06-10) — GAP-020 regression fixture. Two debtors with non-zero
// ageing buckets, Xero AgedReceivablesByContact column order:
// [name, current, <30d, 30-60d, 60-90d, older, total]
const FAKE_AR_REPORT_WITH_DEBTORS = {
  Reports: [{
    Rows: [
      {
        RowType: 'Section',
        Title: '',
        Rows: [
          {
            RowType: 'Row',
            Cells: [
              { Value: 'ABC Constructions' },
              { Value: '1000' },   // current
              { Value: '500' },    // 30 days
              { Value: '200' },    // 60 days
              { Value: '100' },    // 90 days
              { Value: '50' },     // older — the bucket the pre-audit Cells[1..5] parser dropped
              { Value: '1850' },   // total
            ],
          },
          {
            RowType: 'Row',
            Cells: [
              { Value: 'Seaford Demolition' },
              { Value: '0' }, { Value: '0' }, { Value: '0' }, { Value: '0' },
              { Value: '4200' },   // entirely in Older
              { Value: '4200' },
            ],
          },
          {
            RowType: 'Row',
            Cells: [
              { Value: 'Total' },
              { Value: '1000' }, { Value: '500' }, { Value: '200' }, { Value: '100' },
              { Value: '4250' }, { Value: '6050' },
            ],
          },
        ],
      },
    ],
  }],
}

/**
 * Build a fetch mock that routes by URL substring. Returns the spy so tests
 * can inspect every call site (URL + method + body).
 * @param {object} arReport - Xero AR response payload (default: empty report).
 */
function installFetchMock(arReport = FAKE_AR_REPORT) {
  const calls = []
  const mock = vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body, headers: init.headers })
    const u = String(url)

    // Xero P&L
    if (u.includes('/Reports/ProfitAndLoss')) {
      return new Response(JSON.stringify(FAKE_PL_REPORT), { status: 200 })
    }
    // Xero Balance Sheet
    if (u.includes('/Reports/BalanceSheet')) {
      return new Response(JSON.stringify(FAKE_BS_REPORT), { status: 200 })
    }
    // Xero Aged Receivables
    if (u.includes('/Reports/AgedReceivablesByContact')) {
      return new Response(JSON.stringify(arReport), { status: 200 })
    }
    // Supabase monthly_reports SELECT (get-or-create) — return empty so it falls through
    if (u.includes('/rest/v1/monthly_reports') && (init.method === undefined || init.method === 'GET')) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    // Supabase monthly_reports DELETE
    if (u.includes('/rest/v1/monthly_reports') && init.method === 'DELETE') {
      return new Response('', { status: 200 })
    }
    // Supabase monthly_reports INSERT — must return id
    if (u.includes('/rest/v1/monthly_reports') && init.method === 'POST') {
      return new Response(JSON.stringify([{ id: 'fake-uuid-123' }]), { status: 201 })
    }
    // All other Supabase REST calls (DELETE/INSERT into financials_monthly etc.)
    if (u.includes('/rest/v1/')) {
      return new Response('', { status: 200 })
    }
    // Default — fail loudly so missing handlers surface
    return new Response(`unhandled mock url: ${u}`, { status: 500 })
  })
  globalThis.fetch = mock
  return { mock, calls }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

// ── fetchProfitAndLoss URL shape ─────────────────────────────────────────────

describe('fetchProfitAndLoss — basis → URL contract', () => {
  it('cash basis appends paymentsOnly=true', async () => {
    const { calls } = installFetchMock()
    await fetchProfitAndLoss('access', 'tenant', '2026-01-01', '2026-01-31', 'cash')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall).toBeDefined()
    expect(plCall.url).toContain('paymentsOnly=true')
    expect(plCall.url).toContain('fromDate=2026-01-01')
    expect(plCall.url).toContain('toDate=2026-01-31')
  })

  it('accrual basis appends paymentsOnly=false', async () => {
    const { calls } = installFetchMock()
    await fetchProfitAndLoss('access', 'tenant', '2026-01-01', '2026-01-31', 'accrual')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall.url).toContain('paymentsOnly=false')
  })

  it('default basis is cash (no arg)', async () => {
    const { calls } = installFetchMock()
    await fetchProfitAndLoss('access', 'tenant', '2026-01-01', '2026-01-31')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall.url).toContain('paymentsOnly=true')
  })

  it('passes Xero auth headers correctly', async () => {
    const { calls } = installFetchMock()
    await fetchProfitAndLoss('the-access-token', 'the-tenant-id', '2026-01-01', '2026-01-31', 'cash')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall.headers.Authorization).toBe('Bearer the-access-token')
    expect(plCall.headers['Xero-tenant-id']).toBe('the-tenant-id')
  })
})

// ── syncMonth basis stamping + scoped DELETE ────────────────────────────────

describe('syncMonth — writes accounting_basis on every row', () => {
  it('stamps accounting_basis=cash on financials_monthly INSERT', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')

    const finInsert = calls.find(c =>
      c.url.includes('/rest/v1/financials_monthly') && c.method === 'POST'
    )
    expect(finInsert).toBeDefined()
    const body = JSON.parse(finInsert.body)
    expect(body.accounting_basis).toBe('cash')
    expect(body.report_month).toBe('2026-01-01')
  })

  it('stamps accounting_basis=accrual when basis=accrual', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'accrual')

    const finInsert = calls.find(c =>
      c.url.includes('/rest/v1/financials_monthly') && c.method === 'POST'
    )
    const body = JSON.parse(finInsert.body)
    expect(body.accounting_basis).toBe('accrual')
  })

  it('scopes financials_monthly DELETE by accounting_basis (cash sync does not wipe accrual)', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')

    const finDelete = calls.find(c =>
      c.url.includes('/rest/v1/financials_monthly') && c.method === 'DELETE'
    )
    expect(finDelete).toBeDefined()
    expect(finDelete.url).toContain('accounting_basis=eq.cash')
    expect(finDelete.url).not.toContain('accounting_basis=eq.accrual')
  })

  it('scopes balance_sheet_monthly DELETE by basis as well', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'accrual')

    const bsDelete = calls.find(c =>
      c.url.includes('/rest/v1/balance_sheet_monthly') && c.method === 'DELETE'
    )
    expect(bsDelete).toBeDefined()
    expect(bsDelete.url).toContain('accounting_basis=eq.accrual')
  })

  it('uses paymentsOnly=true on the Xero call when basis=cash', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall.url).toContain('paymentsOnly=true')
  })

  it('uses paymentsOnly=false on the Xero call when basis=accrual', async () => {
    const { calls } = installFetchMock()
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'accrual')
    const plCall = calls.find(c => c.url.includes('/Reports/ProfitAndLoss'))
    expect(plCall.url).toContain('paymentsOnly=false')
  })

  it('returns summary including basis', async () => {
    installFetchMock()
    const summary = await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'accrual')
    expect(summary.basis).toBe('accrual')
    expect(summary.month).toBe('2026-01')
    expect(typeof summary.revenue).toBe('number')
  })
})

// ── syncMonth AR ingestion (WP-I 2026-06-10 — GAP-020 regression) ───────────
//
// GAP-020 claimed AR sync was still disabled via `void arData;` and that the
// ageing buckets were column-shifted (Cells[1..5], dropping Older). Both were
// fixed in commits 9039b1b ("re-enable AR sync") and f5fa527 (mapper rewrite,
// Cells[1..6]). These tests pin the live wire-level contract so the fix can
// never silently regress: per-debtor rows MUST be written to debtors_monthly
// with the Older bucket folded into overdue_90plus.

describe('syncMonth — AR ingestion writes per-debtor rows (GAP-020)', () => {
  it('writes one debtors_monthly INSERT per debtor (AR sync is ENABLED)', async () => {
    const { calls } = installFetchMock(FAKE_AR_REPORT_WITH_DEBTORS)
    const summary = await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')

    const debtorInserts = calls.filter(c =>
      c.url.includes('/rest/v1/debtors_monthly') && c.method === 'POST'
    )
    expect(debtorInserts.length).toBe(2) // 'Total' row must be skipped
    expect(summary.debtorsWritten).toBe(2)
  })

  it('captures the Older bucket into overdue_90plus (pre-audit Cells[1..5] dropped it)', async () => {
    const { calls } = installFetchMock(FAKE_AR_REPORT_WITH_DEBTORS)
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')

    const bodies = calls
      .filter(c => c.url.includes('/rest/v1/debtors_monthly') && c.method === 'POST')
      .map(c => JSON.parse(c.body))

    const abc = bodies.find(b => b.debtor_name === 'ABC Constructions')
    expect(abc).toBeDefined()
    expect(abc.current_amount).toBe(1000)
    expect(abc.overdue_30).toBe(500)
    expect(abc.overdue_60).toBe(200)
    // schema folds 90d + older into one column: 100 + 50
    expect(abc.overdue_90plus).toBe(150)
    expect(abc.total_outstanding).toBe(1850)

    // A debtor whose entire balance sits in Older must not vanish (the exact
    // failure mode of the old column-shifted parser).
    const seaford = bodies.find(b => b.debtor_name === 'Seaford Demolition')
    expect(seaford).toBeDefined()
    expect(seaford.overdue_90plus).toBe(4200)
    expect(seaford.total_outstanding).toBe(4200)
  })

  it('stamps report_month + accounting_basis on every debtor row and scopes the DELETE', async () => {
    const { calls } = installFetchMock(FAKE_AR_REPORT_WITH_DEBTORS)
    await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'accrual')

    const debtorDelete = calls.find(c =>
      c.url.includes('/rest/v1/debtors_monthly') && c.method === 'DELETE'
    )
    expect(debtorDelete).toBeDefined()
    expect(debtorDelete.url).toContain('report_month=eq.2026-01-01')
    expect(debtorDelete.url).toContain('accounting_basis=eq.accrual')

    const bodies = calls
      .filter(c => c.url.includes('/rest/v1/debtors_monthly') && c.method === 'POST')
      .map(c => JSON.parse(c.body))
    for (const b of bodies) {
      expect(b.report_month).toBe('2026-01-01')
      expect(b.accounting_basis).toBe('accrual')
    }
  })

  it('empty AR report → no debtors_monthly writes, sync still succeeds (non-fatal AR path)', async () => {
    const { calls } = installFetchMock(FAKE_AR_REPORT)
    const summary = await syncMonth('2026-01', 'access', 'tenant', 'service', 'user-1', 'cash')

    const debtorCalls = calls.filter(c => c.url.includes('/rest/v1/debtors_monthly'))
    expect(debtorCalls.length).toBe(0)
    expect(summary.debtorsWritten).toBe(0)
    expect(typeof summary.revenue).toBe('number')
  })
})

// ── deleteAndInsert direct ──────────────────────────────────────────────────

describe('deleteAndInsert — basis is mandatory in DELETE filter and INSERT body', () => {
  it('default basis cash is honoured when omitted', async () => {
    const { calls } = installFetchMock()
    await deleteAndInsert('financials_monthly', 'rid', '2026-01-01', { rev_total: 100 }, 'service')
    const del = calls.find(c => c.method === 'DELETE')
    const ins = calls.find(c => c.method === 'POST')
    expect(del.url).toContain('accounting_basis=eq.cash')
    expect(JSON.parse(ins.body).accounting_basis).toBe('cash')
  })

  it('passes through accrual basis to both DELETE and INSERT', async () => {
    const { calls } = installFetchMock()
    await deleteAndInsert('balance_sheet_monthly', 'rid', '2026-01-01', { cash_balance: 5000 }, 'service', 'accrual')
    const del = calls.find(c => c.method === 'DELETE')
    const ins = calls.find(c => c.method === 'POST')
    expect(del.url).toContain('accounting_basis=eq.accrual')
    const body = JSON.parse(ins.body)
    expect(body.accounting_basis).toBe('accrual')
    expect(body.cash_balance).toBe(5000)
  })
})

// ── monthRange (sanity for bulk path) ───────────────────────────────────────

describe('monthRange — bulk sync month enumeration', () => {
  it('inclusive of both endpoints', () => {
    expect(monthRange('2026-01', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('handles year wrap', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('single month', () => {
    expect(monthRange('2026-05', '2026-05')).toEqual(['2026-05'])
  })
})
