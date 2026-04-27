/**
 * @file api/xero-invoice.js — Vercel Edge Function
 *
 * Creates a draft Xero invoice from a completed booking, then writes the
 * resulting Xero invoice ID back to the bookings row in Supabase.
 *
 * POST { bookingId: string, userId: string }
 * Authorization: Bearer <user JWT>
 *
 * Returns: { success: true, invoiceId, invoiceNumber }
 *       or { error: string } with an appropriate HTTP status
 */
export const config = { runtime: 'edge' }

import { getValidToken, verifySupabaseJWT } from './lib/xero-token.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const XERO_API     = 'https://api.xero.com/api.xro/2.0'

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchBooking(bookingId, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=*,customers(name,email)&limit=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase bookings fetch failed: ${res.status}${body ? ` — ${body}` : ''}`)
  }
  const rows = await res.json()
  if (!rows?.length) throw new Error(`Booking not found: ${bookingId}`)
  return rows[0]
}

async function patchBooking(bookingId, patch, serviceKey) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    }
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Supabase bookings patch failed: ${res.status}${body ? ` — ${body}` : ''}`)
  }
}

async function insertSyncLog(entry, serviceKey) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/xero_sync_log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(entry),
    })
  } catch { /* non-fatal */ }
}

// ── Xero helpers ──────────────────────────────────────────────────────────────

async function createXeroInvoice(invoice, accessToken, tenantId) {
  const res = await fetch(`${XERO_API}/Invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ Invoices: [invoice] }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Xero invoice creation failed: ${res.status}${body ? ` — ${body}` : ''}`)
  }
  const data = await res.json()
  const created = data.Invoices?.[0]
  if (!created?.InvoiceID) throw new Error('Xero returned no InvoiceID — invoice may not have been created')
  return created
}

// ── Booking → Xero invoice mapper ─────────────────────────────────────────────

function buildXeroInvoice(booking) {
  // Prefer joined customers record, then fall back to denormalised booking fields
  const customerName  = booking.customers?.name  || booking.customer_name  || 'Unknown Customer'
  const customerEmail = booking.customers?.email || booking.customer_email || null

  const unitAmount = parseFloat(booking.price || booking.total_price || 0)

  const binLabel = booking.bin_size || booking.service_type || 'service'
  const wasteLabel = booking.waste_type ? ` (${booking.waste_type})` : ''
  const description = `Skip bin hire — ${binLabel}${wasteLabel}`

  const today   = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // SKS- prefix + first 8 chars of the booking UUID as a human-readable reference
  const reference = `SKS-${(booking.id || '').slice(0, 8).toUpperCase()}`

  const contact = { Name: customerName }
  if (customerEmail) contact.EmailAddress = customerEmail

  return {
    Type: 'ACCREC',
    Contact: contact,
    Date: today,
    DueDate: dueDate,
    LineItems: [
      {
        Description: description,
        Quantity: 1,
        UnitAmount: unitAmount,
        AccountCode: '200',   // Standard revenue account
        TaxType: 'OUTPUT2',   // 10% GST (Australian)
      },
    ],
    Reference: reference,
    Status: 'DRAFT',
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const bearerToken = authHeader.slice(7)

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify JWT
  try {
    await verifySupabaseJWT(bearerToken)
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { bookingId, userId } = body
  if (!bookingId) {
    return new Response(JSON.stringify({ error: 'bookingId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // 1. Fetch booking from Supabase
    const booking = await fetchBooking(bookingId, serviceKey)

    // 2. Get valid Xero token
    const { accessToken, tenantId } = await getValidToken(serviceKey)

    // 3. Build and create Xero invoice
    const xeroInvoice = buildXeroInvoice(booking)
    console.log('XERO_INVOICE_CREATE:', { bookingId, reference: xeroInvoice.Reference, amount: xeroInvoice.LineItems[0]?.UnitAmount })
    const created = await createXeroInvoice(xeroInvoice, accessToken, tenantId)

    const invoiceId     = created.InvoiceID
    const invoiceNumber = created.InvoiceNumber || created.InvoiceID

    // 4. Write invoice ID back to the booking
    await patchBooking(bookingId, {
      xero_invoice_id:     invoiceId,
      xero_invoice_status: 'DRAFT',
      updated_at:          new Date().toISOString(),
    }, serviceKey)

    // 5. Log the event
    await insertSyncLog({
      sync_month:  new Date().toISOString().slice(0, 7) + '-01',
      status:      'success',
      message:     `Xero invoice created: ${invoiceNumber} for booking ${bookingId}`,
      rows_written: { invoices: 1 },
      synced_by:   userId || null,
      created_at:  new Date().toISOString(),
    }, serviceKey)

    console.log('XERO_INVOICE_SUCCESS:', { invoiceId, invoiceNumber, bookingId })

    return new Response(
      JSON.stringify({ success: true, invoiceId, invoiceNumber }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('XERO_INVOICE_ERROR:', err.message)

    await insertSyncLog({
      sync_month:  new Date().toISOString().slice(0, 7) + '-01',
      status:      'error',
      message:     `Xero invoice creation failed for booking ${bookingId}: ${err.message}`,
      synced_by:   userId || null,
      created_at:  new Date().toISOString(),
    }, serviceKey)

    return new Response(
      JSON.stringify({ error: err.message || 'Invoice creation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
