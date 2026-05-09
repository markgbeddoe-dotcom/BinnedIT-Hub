/**
 * @file api/collections-send.js — Vercel Edge Function
 *
 * Actually sends a collections letter when the bookkeeper clicks "Send" in the
 * Collections page. Closes Sprint 13 item 13A — previously the UI only recorded
 * a `collections_events` row, leaving recipients without an email.
 *
 * Endpoint: POST /api/collections-send
 *
 * Body:
 *   {
 *     "invoiceId":      "uuid",
 *     "level":          1 | 2 | 3 | 4,
 *     "deliveryMethod": "email" | "post" | "email_post" | "manual",
 *     "letterText":     "...",                  // required — plain-text fallback
 *     "letterHtml":     "<!doctype html>..."    // optional — sent as multipart html alongside text
 *     "to":             { "email": "...", "name": "..." },
 *     "cc":             ["accounts@example.com"]
 *   }
 *
 * Sprint 18 #L4: when letterHtml is provided, Resend receives both `html` and
 * `text` — recipients with HTML-capable clients get the styled CFO-grade
 * letter (Montserrat headings, Calibri body, severity-aware framing, embedded
 * logo); recipients on plain-text clients still get the legible fallback.
 *
 * Behaviour by deliveryMethod:
 *   - "email" / "email_post" → send via Resend from accounts@<RESEND_FROM>
 *     (fallback accounts@binnedit.com.au)
 *   - "post"  / "email_post" → STUB — log a TODO + return postal_status: queued
 *     (real postal integration is Sprint 13 item 13C)
 *   - "manual"               → NOOP success so caller still records the event
 *
 * Auth: requires `Authorization: Bearer <Supabase JWT>` (verified via
 * verifySupabaseJWT in ./lib/xero-token.js, same as api/invite.js).
 *
 * Logs every send attempt to public.email_reminders_log (best-effort — the
 * table has a CHECK constraint scoped to invoice-chase reminder types, so
 * the insert may fail cleanly; we never block the email on a logging error).
 */

import { verifySupabaseJWT } from './lib/xero-token.js'

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'
const RESEND_API   = 'https://api.resend.com/emails'

const LEVEL_LABELS = {
  1: 'Level 1 — Overdue Notice',
  2: 'Level 2 — Formal Notice',
  3: 'Level 3 — Letter of Demand',
  4: 'Level 4 — Statutory Demand',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function fromAddress() {
  const configured = process.env.RESEND_FROM
  if (configured && configured.trim().length) return configured
  return 'SkipSync Accounts <accounts@binnedit.com.au>'
}

function buildSubject(level, invoiceId) {
  const label = LEVEL_LABELS[level] || `Level ${level}`
  const tail = invoiceId ? ` (ref ${String(invoiceId).slice(0, 8)})` : ''
  return `${label}${tail}`
}

function buildBody(letterText, level) {
  const label = LEVEL_LABELS[level] || `Level ${level}`
  return `${letterText}\n\n---\nThis letter is also being recorded in our system as ${label}.`
}

async function sendViaResend(apiKey, { to, cc, subject, text, html }) {
  const payload = {
    from: fromAddress(),
    to: [to],
    subject,
    text,
  }
  // Resend accepts html + text together → multipart MIME, recipients get the
  // best representation their client can render. We only include html when the
  // caller passed a non-empty doc — never send an empty <html></html>.
  if (typeof html === 'string' && html.trim().length) payload.html = html
  if (Array.isArray(cc) && cc.length) payload.cc = cc

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Resend error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    throw err
  }
  return data.id || null
}

async function logSendAttempt(serviceKey, { recipient_email, recipient_name, level, status, resend_id }) {
  if (!serviceKey) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/email_reminders_log`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_name: recipient_name || recipient_email || 'unknown',
        customer_email: recipient_email,
        reminder_type: `collections_level_${level}`,
        // Below are the schema fields we map onto:
        // - subject context lives in reminder_type label
        // - amount_overdue defaults to 0 (we don't have it here)
        amount_overdue: 0,
        sent_at: new Date().toISOString(),
        resend_id: resend_id || null,
        status,
      }),
    }).catch(() => {})
  } catch {
    // Best-effort logging — never break a real send because of a CHECK constraint.
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ──
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const jwt = authHeader.slice(7).trim()
  if (!jwt) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  try {
    await verifySupabaseJWT(jwt)
  } catch (err) {
    return jsonResponse({ error: err?.message || 'Unauthorized' }, 401)
  }

  // ── Parse body ──
  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { invoiceId, level, deliveryMethod, letterText, letterHtml, to, cc } = body || {}

  if (!invoiceId || typeof invoiceId !== 'string') {
    return jsonResponse({ error: 'invoiceId is required' }, 400)
  }
  if (!letterText || typeof letterText !== 'string') {
    return jsonResponse({ error: 'letterText is required' }, 400)
  }
  if (letterHtml !== undefined && typeof letterHtml !== 'string') {
    return jsonResponse({ error: 'letterHtml must be a string when provided' }, 400)
  }
  const lvl = parseInt(level, 10)
  if (!lvl || lvl < 1 || lvl > 4) {
    return jsonResponse({ error: 'level must be 1, 2, 3 or 4' }, 400)
  }
  const method = String(deliveryMethod || '').toLowerCase()
  if (!['email', 'post', 'email_post', 'manual'].includes(method)) {
    return jsonResponse({ error: 'deliveryMethod must be email, post, email_post or manual' }, 400)
  }

  // ── Manual: noop success ──
  if (method === 'manual') {
    return jsonResponse({ ok: true })
  }

  // For non-manual we need a recipient when emailing
  const wantsEmail = method === 'email' || method === 'email_post'
  const wantsPost  = method === 'post'  || method === 'email_post'

  if (wantsEmail) {
    if (!to || typeof to !== 'object' || !to.email) {
      return jsonResponse({ error: 'to.email is required when deliveryMethod includes email' }, 400)
    }
  }

  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY

  let emailId = null
  let postalStatus = null

  // ── Email branch ──
  if (wantsEmail) {
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    }
    const subject = buildSubject(lvl, invoiceId)
    const text    = buildBody(letterText, lvl)
    const ccList  = Array.isArray(cc) ? cc.filter(x => typeof x === 'string' && x.includes('@')) : []
    try {
      emailId = await sendViaResend(resendApiKey, {
        to: to.email,
        cc: ccList,
        subject,
        text,
        html: letterHtml,
      })
      await logSendAttempt(serviceKey, {
        recipient_email: to.email,
        recipient_name: to.name,
        level: lvl,
        status: 'sent',
        resend_id: emailId,
      })
    } catch (err) {
      await logSendAttempt(serviceKey, {
        recipient_email: to?.email,
        recipient_name: to?.name,
        level: lvl,
        status: 'failed',
        resend_id: null,
      })
      return jsonResponse({ error: err?.message || 'Email send failed' }, 502)
    }
  }

  // ── Postal stub ──
  if (wantsPost) {
    // TODO(Sprint 13 #13C): wire actual registered post integration (Australia Post API
    // or third-party mail-merge provider). For now we just queue intent so the caller
    // can show "Postal: queued" and we can audit the request later.
    console.log('[collections-send] TODO: postal dispatch not yet wired — queued only', {
      invoiceId, level: lvl, recipient: to?.email || to?.name || null,
    })
    postalStatus = 'queued'
  }

  const out = { ok: true }
  if (emailId !== null) out.email_id = emailId
  if (postalStatus !== null) out.postal_status = postalStatus
  return jsonResponse(out, 200)
}
