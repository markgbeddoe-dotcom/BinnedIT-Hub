// Vercel Edge Function — Postal Letter Dispatch (Sprint 13 — Collections §1.2)
//
// POST /api/postal-send
//
// Queues a formal demand letter for postal dispatch (Email + Registered Post
// per audit-personas §1.2). This endpoint is a contract STUB only: it does NOT
// dispatch through any postal provider yet. It writes a row to
// public.postal_letter_queue with status='queued' so the Collections workflow
// has a real audit trail and downstream dispatcher (Phase 3) has work to pick
// up.
//
// TODO: Phase 3 — wire to PostGrid/Sendle/AusPost Click & Send API.
//
// Request body:
//   {
//     to: { name, company, address1, address2, suburb, state, postcode, country },
//     letterText: string,
//     letterTitle?: string,
//     registeredPost?: boolean,   // defaults to false
//     context?: { invoiceId, level, ... }
//   }
//
// Response:
//   200 { ok: true, queue_id: uuid, status: 'queued', estimated_dispatch: 'YYYY-MM-DD' }
//   400 invalid body / missing required fields
//   401 missing/invalid bearer
//   500 supabase / server config errors
//
// Auth: Bearer JWT (verified against Supabase /auth/v1/user — same pattern as
// api/invite.js). The verified user id is recorded as requested_by.

export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dkjwyzjzdcgrepbgiuei.supabase.co'

// AUS Post registered mail target SLA: ~3 business days. We add 2 calendar days
// to give the dispatcher a queue window. Keep this synthetic for now — Phase 3
// will replace with provider-quoted dispatch ETA.
function estimatedDispatchDate(now = new Date()) {
  const d = new Date(now)
  d.setDate(d.getDate() + 2)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // ── 1. Auth ─────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return jsonResponse({ error: 'Server misconfiguration: missing service key' }, 500)
  }

  // Verify the caller's JWT and resolve their user id.
  const userToken = authHeader.slice(7)
  let callerUser
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        apikey: serviceKey,
      },
    })
    if (!userRes.ok) {
      return jsonResponse({ error: 'Could not verify caller identity' }, 401)
    }
    callerUser = await userRes.json()
  } catch (err) {
    return jsonResponse({ error: 'Auth verification failed: ' + (err.message || 'unknown') }, 500)
  }

  // ── 2. Parse + validate body ────────────────────────────────────────────────
  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const {
    to,
    letterText,
    letterTitle,
    registeredPost,
    context,
  } = body || {}

  const recipient = to || {}

  const missing = []
  if (!letterText || typeof letterText !== 'string' || !letterText.trim()) missing.push('letterText')
  if (!recipient.name || typeof recipient.name !== 'string' || !recipient.name.trim()) missing.push('to.name')
  if (!recipient.address1 || typeof recipient.address1 !== 'string' || !recipient.address1.trim()) missing.push('to.address1')
  if (!recipient.postcode || typeof recipient.postcode !== 'string' || !String(recipient.postcode).trim()) missing.push('to.postcode')

  if (missing.length > 0) {
    return jsonResponse({ error: 'Missing required fields', missing }, 400)
  }

  // ── 3. Insert into postal_letter_queue ──────────────────────────────────────
  const row = {
    status: 'queued',
    letter_title: letterTitle || 'Letter of Demand',
    letter_text: letterText,
    recipient_name: recipient.name || null,
    recipient_company: recipient.company || null,
    recipient_address1: recipient.address1 || null,
    recipient_address2: recipient.address2 || null,
    recipient_suburb: recipient.suburb || null,
    recipient_state: recipient.state || null,
    recipient_postcode: recipient.postcode || null,
    recipient_country: recipient.country || 'AU',
    registered_post: registeredPost === true, // explicit boolean — undefined → false
    context: context && typeof context === 'object' ? context : {},
    requested_by: callerUser?.id || null,
  }

  let inserted
  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/postal_letter_queue`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    })

    if (!insertRes.ok) {
      const errBody = await insertRes.text().catch(() => '')
      return jsonResponse({ error: 'Failed to enqueue postal letter', detail: errBody || `HTTP ${insertRes.status}` }, 502)
    }

    const data = await insertRes.json()
    inserted = Array.isArray(data) ? data[0] : data
  } catch (err) {
    return jsonResponse({ error: 'Postal queue insert failed: ' + (err.message || 'unknown') }, 500)
  }

  // TODO: Phase 3 — wire to PostGrid/Sendle API. Until then, the queue row sits
  // at status='queued' until a dispatcher worker picks it up (or a human does).
  // The Collections UI should surface 'queued' letters in a "Pending postal
  // dispatch" tray so we don't pretend we sent something we haven't.

  return jsonResponse({
    ok: true,
    queue_id: inserted?.id || null,
    status: 'queued',
    estimated_dispatch: estimatedDispatchDate(),
  }, 200)
}
