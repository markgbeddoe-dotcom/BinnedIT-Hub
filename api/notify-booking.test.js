/**
 * @file api/notify-booking.test.js
 *
 * Vitest tests for /api/notify-booking (GAP-044 — customer status notifications).
 *
 * Strategy (same as api/postal-send.test.js): stub global.fetch and route by URL —
 *   /auth/v1/user                → JWT verification
 *   /rest/v1/business_rules      → notify_customer_on_status kill-switch
 *   /rest/v1/bookings            → booking load
 *   api.resend.com/emails        → email provider
 *   api.twilio.com/...Messages   → SMS provider
 *   /rest/v1/notifications       → best-effort log insert
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler, { buildMessages, normalizeAuPhone, formatDate } from './notify-booking.js'

const BOOKING_ID = '33333333-3333-4333-8333-333333333333'

const BOOKING_ROW = {
  id: BOOKING_ID,
  customer_name: 'Donna Chen',
  customer_email: 'donna@example.com',
  customer_phone: '0412 345 678',
  bin_size: '6m³',
  suburb: 'Seaford',
  delivery_date: '2026-06-12',
  collection_date: '2026-06-19',
  scheduled_date: '2026-06-12',
  status: 'confirmed',
}

const ENV_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'RESEND_FROM',
]

function makeRequest(body, { token = 'fake.jwt.token', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://example.test/api/notify-booking', {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
}

/**
 * Configurable happy-path fetch stub.
 *   opts.rule          — business_rules rows array, or 'error' for a 500 (table missing)
 *   opts.bookingRows   — rows returned from the bookings select
 *   opts.captures      — { resend, twilio, log } callbacks receive parsed payloads
 */
function mockFetch(opts = {}) {
  const { rule = [], bookingRows = [BOOKING_ROW], captures = {} } = opts
  return vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'user-1', email: 'mark@binnedit.com.au' }), { status: 200 })
    }
    if (u.includes('/rest/v1/business_rules')) {
      if (rule === 'error') {
        return new Response(JSON.stringify({ message: 'relation "business_rules" does not exist' }), { status: 404 })
      }
      return new Response(JSON.stringify(rule), { status: 200 })
    }
    if (u.includes('/rest/v1/bookings')) {
      return new Response(JSON.stringify(bookingRows), { status: 200 })
    }
    if (u.includes('api.resend.com/emails')) {
      let parsed = null
      try { parsed = init.body ? JSON.parse(init.body) : null } catch { /* noop */ }
      if (captures.resend) captures.resend(parsed)
      return new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 })
    }
    if (u.includes('api.twilio.com')) {
      if (captures.twilio) captures.twilio(String(init.body || ''))
      return new Response(JSON.stringify({ sid: 'SM123' }), { status: 201 })
    }
    if (u.includes('/rest/v1/notifications')) {
      let parsed = null
      try { parsed = init.body ? JSON.parse(init.body) : null } catch { /* noop */ }
      if (captures.log) captures.log(parsed)
      return new Response(null, { status: 201 })
    }
    return new Response('not mocked: ' + u, { status: 500 })
  })
}

describe('api/notify-booking', () => {
  let originalFetch
  let savedEnv

  beforeEach(() => {
    originalFetch = global.fetch
    savedEnv = {}
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k]
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
    process.env.SUPABASE_ANON_KEY = 'fake-anon-key' // makes verifySupabaseJWT actually call /auth/v1/user
    process.env.RESEND_API_KEY = 'fake-resend-key'
    process.env.TWILIO_ACCOUNT_SID = 'ACfake'
    process.env.TWILIO_AUTH_TOKEN = 'fake-token'
    process.env.TWILIO_FROM_NUMBER = '+61400000000'
    delete process.env.RESEND_FROM
  })

  afterEach(() => {
    global.fetch = originalFetch
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k]
      else process.env[k] = savedEnv[k]
    }
    vi.restoreAllMocks()
  })

  // ── Contract / auth ──────────────────────────────────────────────────────

  it('returns 405 for non-POST methods', async () => {
    global.fetch = mockFetch()
    const req = new Request('https://example.test/api/notify-booking', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake.jwt' },
    })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('returns 401 when no Authorization header is provided', async () => {
    global.fetch = mockFetch()
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }, { token: null }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when JWT verification fails', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 })
      }
      return new Response('unexpected', { status: 500 })
    })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when bookingId is missing', async () => {
    global.fetch = mockFetch()
    const res = await handler(makeRequest({ newStatus: 'confirmed' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/bookingId/)
  })

  it('returns 400 when newStatus is missing', async () => {
    global.fetch = mockFetch()
    const res = await handler(makeRequest({ bookingId: BOOKING_ID }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/newStatus/)
  })

  it('returns 404 when the booking does not exist', async () => {
    global.fetch = mockFetch({ bookingRows: [] })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(404)
  })

  // ── Kill-switch rule ─────────────────────────────────────────────────────

  it('skips (no sends) when notify_customer_on_status rule is disabled', async () => {
    const fetchMock = mockFetch({ rule: [{ value: true, enabled: false }] })
    global.fetch = fetchMock
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, skipped: true, reason: 'disabled_by_rule' })
    const calledUrls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calledUrls.some(u => u.includes('api.resend.com'))).toBe(false)
    expect(calledUrls.some(u => u.includes('api.twilio.com'))).toBe(false)
  })

  it('skips when the rule row has value=false', async () => {
    global.fetch = mockFetch({ rule: [{ value: false, enabled: true }] })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    const json = await res.json()
    expect(json.skipped).toBe(true)
  })

  it('defaults to enabled when the business_rules table is missing (query errors)', async () => {
    global.fetch = mockFetch({ rule: 'error' })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.email.sent).toBe(true)
    expect(json.sms.sent).toBe(true)
  })

  // ── Status routing ───────────────────────────────────────────────────────

  it('returns skipped for statuses with no customer template (e.g. cancelled)', async () => {
    global.fetch = mockFetch()
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'cancelled' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ ok: true, skipped: true, reason: 'no_template_for_status' })
  })

  // ── Happy paths ──────────────────────────────────────────────────────────

  it('sends email + SMS + logs on confirmed, with delivery date in both bodies', async () => {
    let resendPayload = null
    let twilioBody = null
    let logPayload = null
    global.fetch = mockFetch({
      captures: {
        resend: p => { resendPayload = p },
        twilio: b => { twilioBody = b },
        log: p => { logPayload = p },
      },
    })

    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.email).toMatchObject({ sent: true, id: 'resend-msg-1' })
    expect(json.sms).toMatchObject({ sent: true, sid: 'SM123' })
    expect(json.logged).toBe(true)

    // Email payload
    expect(resendPayload.to).toEqual(['donna@example.com'])
    expect(resendPayload.subject).toContain('12 Jun 2026')
    expect(resendPayload.text).toContain('confirmed')
    expect(resendPayload.text).toContain('12 Jun 2026')
    expect(resendPayload.html).toBeTruthy()

    // SMS payload — Twilio form-encoded body, phone normalised to E.164
    const params = new URLSearchParams(twilioBody)
    expect(params.get('To')).toBe('+61412345678')
    expect(params.get('From')).toBe('+61400000000')
    expect(params.get('Body')).toContain('12 Jun 2026')

    // Log row → public.notifications
    expect(logPayload).toMatchObject({
      type: 'general',
      related_table: 'bookings',
      related_id: BOOKING_ID,
    })
    expect(logPayload.title).toContain('confirmed')
  })

  it('en_route template says the driver is on the way (and in_progress aliases to it)', async () => {
    let twilioBody = null
    global.fetch = mockFetch({ captures: { twilio: b => { twilioBody = b } } })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'en_route' }))
    expect(res.status).toBe(200)
    expect(new URLSearchParams(twilioBody).get('Body').toLowerCase()).toContain('on the way')

    const alias = buildMessages('in_progress', BOOKING_ROW)
    expect(alias.sms.toLowerCase()).toContain('on the way')
  })

  it('completed template mentions pickup complete and the invoice', async () => {
    let resendPayload = null
    global.fetch = mockFetch({ captures: { resend: p => { resendPayload = p } } })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'completed' }))
    expect(res.status).toBe(200)
    expect(resendPayload.text.toLowerCase()).toContain('invoice')
    expect(resendPayload.subject.toLowerCase()).toContain('pickup complete')
  })

  // ── Channel degradation (fail-soft) ──────────────────────────────────────

  it('is email-only when Twilio env vars are missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_FROM_NUMBER
    global.fetch = mockFetch()
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.email.sent).toBe(true)
    expect(json.sms).toMatchObject({ sent: false, reason: 'twilio_not_configured' })
  })

  it('is SMS-only when the booking has no email; reports no_email', async () => {
    global.fetch = mockFetch({ bookingRows: [{ ...BOOKING_ROW, customer_email: null }] })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    const json = await res.json()
    expect(json.email).toMatchObject({ sent: false, reason: 'no_email' })
    expect(json.sms.sent).toBe(true)
  })

  it('still returns 200 ok when a provider errors (Resend 500)', async () => {
    global.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u' }), { status: 200 })
      if (u.includes('/rest/v1/business_rules')) return new Response('[]', { status: 200 })
      if (u.includes('/rest/v1/bookings')) return new Response(JSON.stringify([BOOKING_ROW]), { status: 200 })
      if (u.includes('api.resend.com')) return new Response(JSON.stringify({ message: 'boom' }), { status: 500 })
      if (u.includes('api.twilio.com')) { void init; return new Response(JSON.stringify({ sid: 'SM9' }), { status: 201 }) }
      if (u.includes('/rest/v1/notifications')) return new Response(null, { status: 201 })
      return new Response('not mocked: ' + u, { status: 500 })
    })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'confirmed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.email).toMatchObject({ sent: false, reason: 'resend_error', status: 500 })
    expect(json.sms.sent).toBe(true)
  })

  it('never fails the request when the notifications log insert errors', async () => {
    global.fetch = vi.fn(async (url, init = {}) => {
      const u = String(url)
      void init
      if (u.includes('/auth/v1/user')) return new Response(JSON.stringify({ id: 'u' }), { status: 200 })
      if (u.includes('/rest/v1/business_rules')) return new Response('[]', { status: 200 })
      if (u.includes('/rest/v1/bookings')) return new Response(JSON.stringify([BOOKING_ROW]), { status: 200 })
      if (u.includes('api.resend.com')) return new Response(JSON.stringify({ id: 'r1' }), { status: 200 })
      if (u.includes('api.twilio.com')) return new Response(JSON.stringify({ sid: 'SM9' }), { status: 201 })
      if (u.includes('/rest/v1/notifications')) return new Response('CHECK violation', { status: 400 })
      return new Response('not mocked: ' + u, { status: 500 })
    })
    const res = await handler(makeRequest({ bookingId: BOOKING_ID, newStatus: 'completed' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.logged).toBe(false)
  })

  // ── Pure helpers ─────────────────────────────────────────────────────────

  it('normalizeAuPhone handles AU mobiles, E.164 passthrough and junk', () => {
    expect(normalizeAuPhone('0412 345 678')).toBe('+61412345678')
    expect(normalizeAuPhone('+61 412 345 678')).toBe('+61412345678')
    expect(normalizeAuPhone('61412345678')).toBe('+61412345678')
    expect(normalizeAuPhone('(03) 9555 2000')).toBe('+61395552000')
    expect(normalizeAuPhone('')).toBe(null)
    expect(normalizeAuPhone(null)).toBe(null)
    expect(normalizeAuPhone('12345')).toBe('12345') // unknown shape passes through
  })

  it('formatDate formats and never throws on bad input', () => {
    expect(formatDate('2026-06-12')).toBe('12 Jun 2026')
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate('next tuesday')).toBe('next tuesday')
  })

  it('buildMessages returns null for non-customer-facing statuses', () => {
    expect(buildMessages('pending', BOOKING_ROW)).toBe(null)
    expect(buildMessages('cancelled', BOOKING_ROW)).toBe(null)
    expect(buildMessages('garbage', BOOKING_ROW)).toBe(null)
    expect(buildMessages('', BOOKING_ROW)).toBe(null)
  })
})
