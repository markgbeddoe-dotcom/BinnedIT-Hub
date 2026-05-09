/**
 * @file api/collections-send.test.js
 *
 * Vitest coverage for the Collections "Send" Edge Function.
 *
 * The handler is exercised end-to-end:
 *   - Auth: missing bearer → 401
 *   - Validation: missing invoiceId / letterText → 400
 *   - manual method: no Resend call, ok:true
 *   - email method: Resend success → email_id; Resend 5xx → 502
 *   - email_post method: Resend called AND postal_status === "queued"
 *
 * We mock:
 *   - ./lib/xero-token.js → verifySupabaseJWT always resolves (so the auth
 *     gate passes once the bearer is present and not literally empty).
 *   - globalThis.fetch → tracks calls and returns canned responses for the
 *     Resend endpoint and any Supabase logging POST (which we ignore).
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./lib/xero-token.js', () => ({
  verifySupabaseJWT: vi.fn(async () => ({ id: 'user-1', email: 'mark@binnedit.com.au' })),
}))

// Import AFTER the mock so the handler picks up our verifySupabaseJWT stub.
import handler from './collections-send.js'

const VALID_BEARER = 'Bearer fake-jwt-token'

function makeReq({ method = 'POST', authHeader, body } = {}) {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  if (body !== undefined) headers.set('content-type', 'application/json')
  return new Request('https://example.test/api/collections-send', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function fetchOk(body, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

const RESEND_URL = 'https://api.resend.com/emails'

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-resend-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  process.env.SUPABASE_URL = 'https://supabase.test'
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('auth gate', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({ body: { invoiceId: 'a', level: 1, deliveryMethod: 'manual', letterText: 'x' } }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalledWith(RESEND_URL, expect.anything())
  })

  it('returns 401 when Authorization header is an empty Bearer', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: 'Bearer ',
      body: { invoiceId: 'a', level: 1, deliveryMethod: 'manual', letterText: 'x' },
    }))
    expect(res.status).toBe(401)
  })
})

// ── Validation ───────────────────────────────────────────────────────────────

describe('body validation', () => {
  it('returns 400 when invoiceId is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: { level: 1, deliveryMethod: 'manual', letterText: 'hi' },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invoiceId/i)
  })

  it('returns 400 when letterText is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: { invoiceId: 'inv-1', level: 1, deliveryMethod: 'manual' },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/letterText/i)
  })

  it('returns 400 when level is out of range', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: { invoiceId: 'inv-1', level: 9, deliveryMethod: 'manual', letterText: 'x' },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when deliveryMethod is unknown', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: { invoiceId: 'inv-1', level: 1, deliveryMethod: 'sms', letterText: 'x' },
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when email method has no recipient email', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: { invoiceId: 'inv-1', level: 1, deliveryMethod: 'email', letterText: 'x', to: { name: 'Alice' } },
    }))
    expect(res.status).toBe(400)
  })
})

// ── Method behaviours ────────────────────────────────────────────────────────

describe('manual method', () => {
  it('returns ok without calling Resend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 2,
        deliveryMethod: 'manual',
        letterText: 'Dear customer…',
      },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.email_id).toBeUndefined()
    expect(body.postal_status).toBeUndefined()
    // No Resend call
    const resendCalls = fetchSpy.mock.calls.filter(c => c[0] === RESEND_URL)
    expect(resendCalls).toHaveLength(0)
  })
})

describe('email method', () => {
  it('calls Resend and returns email_id on success', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) {
        return fetchOk({ id: 'resend_msg_abc123' }, 200)
      }
      // Supabase logging — accept silently.
      return fetchOk({}, 201)
    })

    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 3,
        deliveryMethod: 'email',
        letterText: 'Letter of demand body…',
        to: { email: 'customer@example.com', name: 'Acme Co' },
        cc: ['accounts@example.com'],
      },
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.email_id).toBe('resend_msg_abc123')
    expect(body.postal_status).toBeUndefined()

    // Verify Resend was called with proper payload shape
    const resendCall = fetchSpy.mock.calls.find(c => c[0] === RESEND_URL)
    expect(resendCall).toBeTruthy()
    const init = resendCall[1]
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-resend-key')
    const payload = JSON.parse(init.body)
    expect(payload.to).toEqual(['customer@example.com'])
    expect(payload.cc).toEqual(['accounts@example.com'])
    expect(payload.subject).toMatch(/Level 3/)
    // The wrapper line confirming we are recording the level in our system.
    expect(payload.text).toMatch(/Letter of demand body/)
    expect(payload.text).toMatch(/recorded in our system/)
  })

  it('returns 502 when Resend fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) {
        return Promise.resolve(new Response(
          JSON.stringify({ message: 'Resend exploded' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ))
      }
      return fetchOk({}, 201)
    })

    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 1,
        deliveryMethod: 'email',
        letterText: 'Friendly nudge',
        to: { email: 'customer@example.com', name: 'Acme' },
      },
    }))

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toMatch(/Resend exploded|Resend error/)
  })
})

describe('letterHtml multipart (Sprint 18 #L4)', () => {
  it('omits html from Resend payload when letterHtml is not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) return fetchOk({ id: 'r_no_html' }, 200)
      return fetchOk({}, 201)
    })

    await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 1,
        deliveryMethod: 'email',
        letterText: 'plain only',
        to: { email: 'c@example.com' },
      },
    }))

    const resendCall = fetchSpy.mock.calls.find(c => c[0] === RESEND_URL)
    const payload = JSON.parse(resendCall[1].body)
    expect(payload.html).toBeUndefined()
    expect(payload.text).toMatch(/plain only/)
  })

  it('forwards letterHtml as `html` alongside `text` when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) return fetchOk({ id: 'r_with_html' }, 200)
      return fetchOk({}, 201)
    })

    const fancyHtml = '<!doctype html><html><body><h1 class="ss-letter">Hello</h1></body></html>'

    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 3,
        deliveryMethod: 'email',
        letterText: 'plain fallback',
        letterHtml: fancyHtml,
        to: { email: 'c@example.com', name: 'Acme' },
      },
    }))

    expect(res.status).toBe(200)
    const resendCall = fetchSpy.mock.calls.find(c => c[0] === RESEND_URL)
    const payload = JSON.parse(resendCall[1].body)
    expect(payload.html).toBe(fancyHtml)
    expect(payload.text).toMatch(/plain fallback/)
  })

  it('treats whitespace-only letterHtml as if not provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) return fetchOk({ id: 'r_blank_html' }, 200)
      return fetchOk({}, 201)
    })

    await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 1,
        deliveryMethod: 'email',
        letterText: 'plain text',
        letterHtml: '   \n\t  ',
        to: { email: 'c@example.com' },
      },
    }))

    const resendCall = fetchSpy.mock.calls.find(c => c[0] === RESEND_URL)
    const payload = JSON.parse(resendCall[1].body)
    expect(payload.html).toBeUndefined()
  })

  it('returns 400 when letterHtml is the wrong type', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 1,
        deliveryMethod: 'email',
        letterText: 'ok',
        letterHtml: { not: 'a string' },
        to: { email: 'c@example.com' },
      },
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/letterHtml/i)
  })
})

describe('email_post method', () => {
  it('calls Resend AND returns postal_status: queued', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      if (url === RESEND_URL) {
        return fetchOk({ id: 'resend_msg_xyz' }, 200)
      }
      return fetchOk({}, 201)
    })

    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 4,
        deliveryMethod: 'email_post',
        letterText: 'Statutory demand text',
        to: { email: 'customer@example.com', name: 'Acme' },
      },
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.email_id).toBe('resend_msg_xyz')
    expect(body.postal_status).toBe('queued')

    // Resend called exactly once
    const resendCalls = fetchSpy.mock.calls.filter(c => c[0] === RESEND_URL)
    expect(resendCalls).toHaveLength(1)
  })
})

describe('post method (stub only)', () => {
  it('does NOT call Resend, returns postal_status: queued', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => fetchOk({}, 201))
    const res = await handler(makeReq({
      authHeader: VALID_BEARER,
      body: {
        invoiceId: 'inv-1',
        level: 2,
        deliveryMethod: 'post',
        letterText: 'Posted letter body',
        to: { email: 'customer@example.com', name: 'Acme' },
      },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.email_id).toBeUndefined()
    expect(body.postal_status).toBe('queued')
    const resendCalls = fetchSpy.mock.calls.filter(c => c[0] === RESEND_URL)
    expect(resendCalls).toHaveLength(0)
  })
})
