/**
 * @file api/xero-payment-sync.js — Vercel Edge Function
 *
 * Syncs Xero invoice payment status back into SkipSync.
 * For every invoice that has a xero_invoice_id and is not yet paid,
 * queries Xero to check if it has been paid, and updates Supabase accordingly.
 *
 * Request:  POST {} or GET (manual trigger / cron)
 * Auth:     Bearer <user JWT>
 * Response: { success: true, synced: N, paid: N, results: [...] }
 */
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const XERO_API     = 'https://api.xero.com/api.xro/2.0'

// ── Token management (shared pattern with xero-sync.js) ──────────────────────

async function getValidToken(serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/xero_tokens?select=*&limit=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  )
  const rows = await res.json()
  if (!rows?.length) throw new Error('Xero not connected. Go to Settings → Connect Xero first.')

  const token     = rows[0]
  const expiresAt = new Date(token.expires_at).getTime()

  if (expiresAt - Date.now() < 5 * 60 * 1000) {
    const clientId     = process.env.XERO_CLIENT_ID
    const clientSecret = process.env.XERO_CLIENT_SECRET
    const refreshRes   = await fetch('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
    })
    const refreshed = await refreshRes.json()
    if (!refreshed.access_token) throw new Error('Token refresh failed — please reconnect Xero in Settings.')

    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    await fetch(
      `${SUPABASE_URL}/rest/v1/xero_tokens?tenant_id=eq.${encodeURIComponent(token.tenant_id)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  refreshed.access_token,
          refresh_token: refreshed.refresh_token || token.refresh_token,
          expires_at:    newExpiry,
          updated_at:    new Date().toISOString(),
        }),
      }
    )
    return { accessToken: refreshed.access_token, tenantId: token.tenant_id }
  }

  return { accessToken: token.access_token, tenantId: token.tenant_id }
}

// ── Fetch invoice status from Xero ────────────────────────────────────────────

async function getXeroInvoiceStatus(accessToken, tenantId, xeroInvoiceId) {
  const res = await fetch(`${XERO_API}/Invoices/${xeroInvoiceId}`, {
    headers: {
      Authorization:   `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      Accept:           'application/json',
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  const inv  = data?.Invoices?.[0]
  if (!inv) return null
  return {
    status:  inv.Status,               // DRAFT | SUBMITTED | AUTHORISED | PAID | VOIDED | DELETED
    amountDue: parseFloat(inv.AmountDue || 0),
    fullyPaidOnDate: inv.FullyPaidOnDate || null,
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  const sbHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  }

  try {
    // Get valid Xero token
    const { accessToken, tenantId } = await getValidToken(serviceKey)

    // Fetch all SkipSync invoices with a Xero ID that aren't paid/cancelled yet
    const invoicesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?xero_invoice_id=not.is.null&status=in.(draft,sent,overdue)&select=id,invoice_number,xero_invoice_id,status,customer_name`,
      { headers: sbHeaders }
    )
    if (!invoicesRes.ok) throw new Error('Failed to fetch invoices from Supabase')
    const invoices = await invoicesRes.json()

    if (!invoices.length) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, paid: 0, message: 'No invoices to sync' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const results = []
    let paidCount = 0

    for (const inv of invoices) {
      try {
        const xeroStatus = await getXeroInvoiceStatus(accessToken, tenantId, inv.xero_invoice_id)
        if (!xeroStatus) {
          results.push({ invoice: inv.invoice_number, status: 'xero_not_found' })
          continue
        }

        const xeroState = xeroStatus.status  // PAID, VOIDED, AUTHORISED, etc.
        let   patch     = { xero_sync_status: 'synced' }
        let   changed   = false

        if (xeroState === 'PAID' && inv.status !== 'paid') {
          patch.status  = 'paid'
          patch.paid_at = xeroStatus.fullyPaidOnDate || new Date().toISOString()
          paidCount++
          changed = true
        } else if (xeroState === 'VOIDED' && inv.status !== 'cancelled') {
          patch.status = 'cancelled'
          changed = true
        }

        if (changed || inv.xero_sync_status !== 'synced') {
          await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
            method: 'PATCH',
            headers: sbHeaders,
            body: JSON.stringify(patch),
          })
        }

        results.push({
          invoice:   inv.invoice_number,
          customer:  inv.customer_name,
          xeroState,
          localStatus: patch.status || inv.status,
          changed,
        })
      } catch (err) {
        // Mark xero_sync_status as error for this invoice; don't abort the batch
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${inv.id}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ xero_sync_status: 'error' }),
        }).catch(() => {})
        results.push({ invoice: inv.invoice_number, status: 'error', error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ success: true, synced: invoices.length, paid: paidCount, results }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Xero payment sync failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
