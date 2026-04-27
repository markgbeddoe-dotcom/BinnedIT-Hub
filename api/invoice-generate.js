/**
 * @file api/invoice-generate.js — Vercel Edge Function
 *
 * Generates an invoice when a booking is marked as completed.
 * - Creates an invoice record in the invoices table
 * - Calculates ex-GST amount, GST (10%), and total from booking price
 * - Optionally creates a draft invoice in Xero when XERO_WRITE_ENABLED=true
 *   (defaults to false — set explicitly when ready to enable Xero writes)
 *
 * Request:  POST { booking_id: string }
 * Auth:     Bearer <user JWT>
 * Response: { success: true, invoice: { id, invoice_number, total, status } }
 */
export const config = { runtime: 'edge' }

import { getXeroTokenSilent } from './lib/xero-token.js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const XERO_API     = 'https://api.xero.com/api.xro/2.0'

// Set XERO_WRITE_ENABLED=true in Vercel env vars when ready to push invoices to Xero.
// Defaults to false so local invoice creation always works without Xero side-effects.
const XERO_WRITE_ENABLED = process.env.XERO_WRITE_ENABLED === 'true'

// Revenue account code — update XERO_REVENUE_ACCOUNT_CODE in Vercel env vars to match
// your Xero chart of accounts if your code differs from the Xero default of 200.
const XERO_REVENUE_ACCOUNT_CODE = process.env.XERO_REVENUE_ACCOUNT_CODE || '200'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate invoice number: INV-YYYY-NNNNN */
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

/** Create a draft invoice in Xero; returns xero_invoice_id or null */
async function createXeroInvoice(accessToken, tenantId, invoice, booking) {
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
        AccountCode: XERO_REVENUE_ACCOUNT_CODE,
        TaxType: 'OUTPUT2',   // 10% GST on income (Australian)
      }],
      Date: new Date().toISOString().slice(0, 10),
      DueDate: invoice.due_date,
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

    // 3. Calculate amounts (booking.price is ex-GST; add 10% to get total)
    const amount      = Math.round(parseFloat(booking.price || booking.estimated_cost || 0) * 100) / 100
    const gst         = Math.round(amount * 0.1 * 100) / 100
    const totalIncGst = Math.round((amount + gst) * 100) / 100

    // 4. Due date: 14 days net
    const dueDateObj = new Date()
    dueDateObj.setDate(dueDateObj.getDate() + 14)
    const due_date = dueDateObj.toISOString().slice(0, 10)

    // 5. Generate invoice number
    const invoice_number = await nextInvoiceNumber(serviceKey)

    const invoicePayload = {
      booking_id,
      invoice_number,
      customer_name:    booking.customer_name,
      customer_email:   booking.customer_email || null,
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

    // 7. Optionally create a draft invoice in Xero
    //    Disabled by default — set XERO_WRITE_ENABLED=true in Vercel env vars to enable.
    if (XERO_WRITE_ENABLED) {
      const xeroToken = await getXeroTokenSilent(serviceKey)
      if (xeroToken) {
        try {
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
        } catch { /* non-fatal — local invoice already created */ }
      }
    } else {
      console.log(`[invoice-generate] Xero write disabled — invoice ${invoice_number} created locally only. Set XERO_WRITE_ENABLED=true to push to Xero.`)
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
