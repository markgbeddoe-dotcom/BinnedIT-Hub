/**
 * @file api/invoice-generate.js — Vercel Edge Function
 *
 * Generates an invoice when a booking is marked as completed.
 * - Creates an invoice record in the invoices table
 * - Calculates ex-GST amount, GST (10%), and total from booking price
 * - Optionally creates a draft invoice in Xero (non-blocking)
 *
 * Request:  POST { booking_id: string }
 * Auth:     Bearer <user JWT>
 * Response: { success: true, invoice: { id, invoice_number, total, status } }
 */
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const XERO_API     = 'https://api.xero.com/api.xro/2.0'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate invoice number: INV-YYYY-NNNNNN */
async function nextInvoiceNumber(serviceKey) {
  const year = new Date().getFullYear()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/invoices?select=invoice_number&invoice_number=like.INV-${year}-*&order=created_at.desc&limit=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  )
  const rows = await res.json()
  let seq = 1
  if (rows?.length) {
    const parts = rows[0].invoice_number.split('-')
    seq = (parseInt(parts[2]) || 0) + 1
  }
  return `INV-${year}-${String(seq).padStart(5, '0')}`
}

/** Get Xero access token (returns null if Xero not connected — non-fatal) */
async function getXeroToken(serviceKey) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/xero_tokens?select=*&limit=1`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
    )
    const rows = await res.json()
    if (!rows?.length) return null

    const token = rows[0]
    const expiresAt = new Date(token.expires_at).getTime()
    if (expiresAt - Date.now() < 5 * 60 * 1000) {
      const clientId     = process.env.XERO_CLIENT_ID
      const clientSecret = process.env.XERO_CLIENT_SECRET
      if (!clientId || !clientSecret) return null
      const refreshRes = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token }),
      })
      const refreshed = await refreshRes.json()
      if (!refreshed.access_token) return null
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await fetch(`${SUPABASE_URL}/rest/v1/xero_tokens?tenant_id=eq.${encodeURIComponent(token.tenant_id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || token.refresh_token, expires_at: newExpiry, updated_at: new Date().toISOString() }),
      })
      return { accessToken: refreshed.access_token, tenantId: token.tenant_id }
    }
    return { accessToken: token.access_token, tenantId: token.tenant_id }
  } catch {
    return null
  }
}

/** Create a draft invoice in Xero; returns xero_invoice_id or null */
async function createXeroInvoice(accessToken, tenantId, invoice, booking) {
  const dueDate = invoice.due_date
  const xeroPayload = {
    Invoices: [{
      Type: 'ACCREC',
      Contact: {
        Name: invoice.customer_name,
        ...(invoice.customer_email ? { EmailAddress: invoice.customer_email } : {}),
      },
      LineItems: [{
        Description: `Skip bin hire — ${booking.bin_size || ''} ${booking.waste_type || ''}`.trim()
          + (booking.address ? ` @ ${booking.address}, ${booking.suburb || ''}`.trim() : ''),
        Quantity: 1,
        UnitAmount: parseFloat(invoice.amount),
        AccountCode: '200',   // Revenue account — update to match your Xero chart of accounts
        TaxType: 'OUTPUT2',   // 10% GST on income (Australian)
      }],
      Date: new Date().toISOString().slice(0, 10),
      DueDate: dueDate,
      InvoiceNumber: invoice.invoice_number,
      Reference: booking.id,
      Status: 'DRAFT',
      CurrencyCode: 'AUD',
    }],
  }

  const res = await fetch(`${XERO_API}/Invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(xeroPayload),
  })

  if (!res.ok) return null
  const data = await res.json()
  return data?.Invoices?.[0]?.InvoiceID || null
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

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let booking_id
  try {
    ({ booking_id } = await req.json())
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  if (!booking_id) {
    return new Response(JSON.stringify({ error: 'booking_id is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const sbHeaders = {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    'Content-Type': 'application/json',
  }

  try {
    // 1. Fetch the booking
    const bookingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}&select=*&limit=1`,
      { headers: sbHeaders }
    )
    const bookings = await bookingRes.json()
    if (!bookings?.length) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }
    const booking = bookings[0]

    if (booking.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Invoice can only be generated for completed bookings' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
    }

    // 2. Check no invoice already exists for this booking
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoices?booking_id=eq.${booking_id}&select=id,invoice_number&limit=1`,
      { headers: sbHeaders }
    )
    const existing = await existingRes.json()
    if (existing?.length) {
      return new Response(JSON.stringify({ success: true, invoice: existing[0], already_existed: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Calculate amounts (booking.price is total inc-GST)
    const totalIncGst = parseFloat(booking.price || booking.estimated_cost || 0)
    const gst         = Math.round((totalIncGst / 11) * 100) / 100
    const amount      = Math.round((totalIncGst - gst) * 100) / 100

    // 4. Due date: 14 days net
    const dueDateObj = new Date()
    dueDateObj.setDate(dueDateObj.getDate() + 14)
    const due_date = dueDateObj.toISOString().slice(0, 10)

    // 5. Generate invoice number
    const invoice_number = await nextInvoiceNumber(serviceKey)

    const invoicePayload = {
      booking_id,
      invoice_number,
      customer_name:  booking.customer_name,
      customer_email: booking.customer_email || null,
      amount,
      gst,
      total: totalIncGst,
      status: 'draft',
      due_date,
      xero_sync_status: 'pending',
    }

    // 6. Insert invoice into Supabase
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/invoices`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'return=representation' },
      body: JSON.stringify(invoicePayload),
    })
    if (!insertRes.ok) {
      const err = await insertRes.text()
      throw new Error(`Failed to create invoice: ${err}`)
    }
    const invoices = await insertRes.json()
    const invoice  = Array.isArray(invoices) ? invoices[0] : invoices

    // 7. Try to create Xero invoice (non-blocking — failure doesn't affect response)
    const xeroToken = await getXeroToken(serviceKey)
    if (xeroToken) {
      const xeroId = await createXeroInvoice(xeroToken.accessToken, xeroToken.tenantId, invoice, booking)
      if (xeroId) {
        await fetch(`${SUPABASE_URL}/rest/v1/invoices?id=eq.${invoice.id}`, {
          method: 'PATCH',
          headers: sbHeaders,
          body: JSON.stringify({ xero_invoice_id: xeroId, xero_sync_status: 'synced' }),
        })
        invoice.xero_invoice_id  = xeroId
        invoice.xero_sync_status = 'synced'
      }
    }

    return new Response(JSON.stringify({ success: true, invoice }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate invoice' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
