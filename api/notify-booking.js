/**
 * @file api/notify-booking.js — Vercel Edge Function
 *
 * GAP-044: Customer notifications on booking status change.
 * Previously the customer only heard from us at booking time (api/book-confirm.js);
 * nothing fired on confirmed/scheduled, en-route or completed. This endpoint is
 * called by the office app AFTER a booking status change is persisted, and sends
 * a templated email (Resend) + SMS (Twilio) to the customer.
 *
 * Endpoint: POST /api/notify-booking
 * Body:     { "bookingId": "uuid", "newStatus": "confirmed" | "scheduled" | "en_route" | "in_progress" | "completed" }
 * Auth:     Authorization: Bearer <Supabase user JWT> (verifySupabaseJWT, same as api/collections-send.js)
 *
 * Status → template:
 *   confirmed / scheduled    → booking confirmed + delivery date
 *   en_route / in_progress   → driver is on the way
 *                              (`en_route` is not in the bookings status CHECK as of
 *                              migration 008 — the driver flow uses `in_progress`;
 *                              both are accepted so a future en_route status Just Works)
 *   completed                → pickup done + invoice notice
 *   anything else            → 200 { ok: true, skipped: true } (no template, no send)
 *
 * Kill-switch: business_rules row `notify_customer_on_status` (read via service
 * role). Row missing / table missing / query error → DEFAULT TRUE (notify).
 * Row present with enabled=false, value=false or value.enabled=false → skip.
 *
 * Channels are BEST-EFFORT and fail-soft (same convention as book-confirm):
 *   - Email: requires RESEND_API_KEY + booking.customer_email
 *   - SMS:   requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
 *            + booking.customer_phone
 *   A failed/skipped channel never 500s the request — the status change is
 *   already saved; the response details what happened per channel.
 *
 * Logging: best-effort insert into public.notifications (migration 010) with
 * type='general', related_table='bookings' — never blocks the send.
 *
 * Xero: this endpoint NEVER touches Xero. The "completed" template only tells
 * the customer an invoice will follow; invoicing stays in the existing flow.
 */

import { verifySupabaseJWT } from './lib/xero-token.js'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const RESEND_API   = 'https://api.resend.com/emails'
const OFFICE_PHONE_DISPLAY = '03 9555 2000' // matches api/book-confirm.js footer

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fromAddress() {
  const configured = process.env.RESEND_FROM
  if (configured && configured.trim().length) return configured
  return 'Binned-IT Bookings <noreply@binned-it.com.au>'
}

/** "2026-06-12" → "12 Jun 2026". Never throws; returns input when unparseable. */
export function formatDate(str) {
  if (!str || typeof str !== 'string') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str)
  if (!m) return str
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const [, y, mo, d] = m
  return `${parseInt(d, 10)} ${months[parseInt(mo, 10) - 1]} ${y}`
}

/**
 * Light AU phone normalisation for Twilio (E.164 preferred).
 * "0412 345 678" → "+61412345678"; already-+61 / +anything passes through.
 * Unknown shapes are returned as-is (Twilio will reject and we fail soft).
 */
export function normalizeAuPhone(phone) {
  if (!phone || typeof phone !== 'string') return null
  const trimmed = phone.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '')
  const digits = trimmed.replace(/\D/g, '')
  if (/^0[2-9]\d{8}$/.test(digits)) return '+61' + digits.slice(1)
  if (/^61\d{9}$/.test(digits)) return '+' + digits
  return trimmed
}

/**
 * Build the per-status message set. Returns null when the status has no
 * customer-facing template (pending, cancelled, unknown...).
 * Exported for direct unit testing.
 */
export function buildMessages(newStatus, booking) {
  const status = String(newStatus || '').toLowerCase()
  const ref = booking?.id ? String(booking.id).slice(0, 8).toUpperCase() : 'PENDING'
  const name = booking?.customer_name || 'there'
  const bin = booking?.bin_size ? `${booking.bin_size} skip bin` : 'skip bin'
  const where = booking?.suburb ? ` in ${booking.suburb}` : ''
  const deliveryDate = formatDate(booking?.scheduled_date || booking?.delivery_date)
  const whenLine = deliveryDate ? ` on ${deliveryDate}` : ''

  if (status === 'confirmed' || status === 'scheduled') {
    return {
      subject: `Booking Confirmed — ${bin} delivery${whenLine} | Binned-IT #${ref}`,
      text:
`Hi ${name},

Good news — your ${bin} booking #${ref} is confirmed and scheduled for delivery${whenLine}${where}.

Our driver will call about 30 minutes before arrival. If anything changes, call us on ${OFFICE_PHONE_DISPLAY}.

Thanks for choosing Binned-IT!
Binned-IT Pty Ltd — Seaford VIC`,
      sms: `Binned-IT: your ${bin} booking #${ref} is confirmed — delivery${whenLine}. Driver will call 30 min before arrival. Reply STOP to opt out.`,
    }
  }

  if (status === 'en_route' || status === 'in_progress') {
    return {
      subject: `Your driver is on the way | Binned-IT #${ref}`,
      text:
`Hi ${name},

Your Binned-IT driver is on the way${where} for booking #${ref}.

Please make sure the drop-off/pickup spot is clear of vehicles and obstructions. Questions? Call ${OFFICE_PHONE_DISPLAY}.

Binned-IT Pty Ltd — Seaford VIC`,
      sms: `Binned-IT: your driver is on the way${where} for booking #${ref}. Please keep the access area clear. Reply STOP to opt out.`,
    }
  }

  if (status === 'completed') {
    return {
      subject: `Pickup complete — thank you | Binned-IT #${ref}`,
      text:
`Hi ${name},

All done — your ${bin} for booking #${ref} has been collected.

Your invoice will follow by email shortly. Questions about your bill? Call ${OFFICE_PHONE_DISPLAY}.

Thanks for choosing Binned-IT — we'd love to help with your next job.
Binned-IT Pty Ltd — Seaford VIC`,
      sms: `Binned-IT: pickup complete for booking #${ref}. Your invoice will follow by email. Thanks for choosing Binned-IT! Reply STOP to opt out.`,
    }
  }

  return null
}

/** Minimal HTML wrapper so HTML-capable clients don't render raw line breaks. */
function textToHtml(text) {
  const esc = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:24px;line-height:1.6;font-size:14px;white-space:pre-line;">${esc}</body></html>`
}

/**
 * Read the notify_customer_on_status business rule via service role.
 * DEFAULT TRUE on every failure path — the business_rules table is created by
 * tonight's migration 026 (another work package) and may not exist yet.
 */
async function isNotifyEnabled(serviceKey) {
  if (!serviceKey) return true
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/business_rules?rule_key=eq.notify_customer_on_status&select=value,enabled&limit=1`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    )
    if (!res.ok) return true // table missing / RLS / anything → default on
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return true
    const row = rows[0]
    if (row.enabled === false) return false
    if (row.value === false) return false
    if (row.value && typeof row.value === 'object' && row.value.enabled === false) return false
    return true
  } catch {
    return true
  }
}

async function loadBooking(serviceKey, bookingId) {
  const cols = 'id,customer_name,customer_email,customer_phone,bin_size,suburb,delivery_date,collection_date,scheduled_date,status'
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?id=eq.${encodeURIComponent(bookingId)}&select=${cols}&limit=1`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
  )
  if (!res.ok) {
    const err = new Error(`Failed to load booking (${res.status})`)
    err.status = 502
    throw err
  }
  const rows = await res.json()
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

/** Email via Resend. Fail-soft: always resolves with { sent, ... }. */
async function sendEmail(booking, messages) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { sent: false, reason: 'resend_not_configured' }
  if (!booking.customer_email) return { sent: false, reason: 'no_email' }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress(),
        to: [booking.customer_email],
        subject: messages.subject,
        text: messages.text,
        html: textToHtml(messages.text),
      }),
    })
    let data = {}
    try { data = await res.json() } catch { /* non-JSON */ }
    if (!res.ok) {
      console.error(`[notify-booking] Resend responded ${res.status}:`, data?.message || data?.error || '')
      return { sent: false, reason: 'resend_error', status: res.status }
    }
    return { sent: true, id: data.id || null }
  } catch (err) {
    console.error('[notify-booking] Resend fetch failed:', err?.message || err)
    return { sent: false, reason: 'fetch_failed' }
  }
}

/** SMS via Twilio REST (same raw-fetch pattern as api/book-confirm.js). Fail-soft. */
async function sendSms(booking, messages) {
  const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
  const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN
  const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER
  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    return { sent: false, reason: 'twilio_not_configured' }
  }
  const to = normalizeAuPhone(booking.customer_phone)
  if (!to) return { sent: false, reason: 'no_phone' }

  const params = new URLSearchParams()
  params.set('From', FROM_NUMBER)
  params.set('To', to)
  params.set('Body', messages.sms)

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    )
    if (!res.ok) {
      let errText = ''
      try { errText = await res.text() } catch { /* ignore */ }
      console.error(`[notify-booking] Twilio responded ${res.status}: ${errText}`)
      return { sent: false, reason: 'twilio_error', status: res.status }
    }
    let sid = null
    try { sid = (await res.json())?.sid || null } catch { /* non-fatal */ }
    return { sent: true, sid }
  } catch (err) {
    console.error('[notify-booking] Twilio fetch failed:', err?.message || err)
    return { sent: false, reason: 'fetch_failed' }
  }
}

/**
 * Best-effort log into public.notifications (migration 010). type CHECK only
 * allows a fixed set — 'general' is the safe bucket. Never blocks the send.
 */
async function logNotification(serviceKey, { booking, newStatus, email, sms }) {
  if (!serviceKey) return false
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        type: 'general',
        title: `Customer notified: booking ${String(booking.id).slice(0, 8).toUpperCase()} → ${newStatus}`,
        body: `email: ${email.sent ? 'sent' : email.reason} | sms: ${sms.sent ? 'sent' : sms.reason} | to: ${booking.customer_email || '-'} / ${booking.customer_phone || '-'}`,
        related_id: booking.id,
        related_table: 'bookings',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Auth (same pattern as api/collections-send.js) ──
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const jwt = authHeader.slice(7).trim()
  if (!jwt) return jsonResponse({ error: 'Unauthorized' }, 401)
  try {
    await verifySupabaseJWT(jwt)
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Unauthorized' }, 401)
  }

  // ── Parse + validate ──
  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const { bookingId, newStatus } = body || {}
  if (!bookingId || typeof bookingId !== 'string') {
    return jsonResponse({ error: 'bookingId is required' }, 400)
  }
  if (!newStatus || typeof newStatus !== 'string') {
    return jsonResponse({ error: 'newStatus is required' }, 400)
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500)
  }

  // ── Kill-switch rule (default ON when table/row missing) ──
  const enabled = await isNotifyEnabled(serviceKey)
  if (!enabled) {
    return jsonResponse({ ok: true, skipped: true, reason: 'disabled_by_rule' })
  }

  // ── Load booking ──
  let booking
  try {
    booking = await loadBooking(serviceKey, bookingId)
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Failed to load booking' }, err?.status || 502)
  }
  if (!booking) {
    return jsonResponse({ error: 'Booking not found' }, 404)
  }

  // ── Template lookup — non-customer-facing statuses are a silent success ──
  const messages = buildMessages(newStatus, booking)
  if (!messages) {
    return jsonResponse({ ok: true, skipped: true, reason: 'no_template_for_status', status: newStatus })
  }

  // ── Send both channels (each fail-soft) ──
  const [email, sms] = await Promise.all([
    sendEmail(booking, messages),
    sendSms(booking, messages),
  ])

  const logged = await logNotification(serviceKey, { booking, newStatus, email, sms })

  return jsonResponse({
    ok: true,
    bookingId: booking.id,
    status: newStatus,
    email,
    sms,
    logged,
  })
}
