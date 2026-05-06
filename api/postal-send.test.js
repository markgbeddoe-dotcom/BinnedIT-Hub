/**
 * @file api/postal-send.test.js
 *
 * Vitest tests for the postal-send Edge Function (Sprint 13 — Collections).
 *
 * The function is a queue stub — it does not call any postal provider. Tests
 * cover the contract:
 *   - 401 without a Bearer token
 *   - 400 on missing required fields
 *   - 200 with { ok: true, queue_id: <uuid>, status: 'queued' } on a valid body
 *   - registeredPost defaults to false when omitted
 *
 * Strategy: stub global.fetch to (a) succeed the Supabase /auth/v1/user check
 * and (b) return a representation row from the postal_letter_queue insert.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler from './postal-send.js'

const FAKE_USER_ID = '11111111-1111-4111-8111-111111111111'
const FAKE_QUEUE_ID = '22222222-2222-4222-8222-222222222222'

function makeRequest(body, { token = 'fake.jwt.token', method = 'POST' } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://example.test/api/postal-send', {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  })
}

function mockFetchHappy({ captureInsert } = {}) {
  return vi.fn(async (url, init = {}) => {
    const u = String(url)
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: FAKE_USER_ID, email: 'test@binnedit.com.au' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (u.includes('/rest/v1/postal_letter_queue')) {
      let parsedBody = null
      try { parsedBody = init.body ? JSON.parse(init.body) : null } catch { /* noop */ }
      if (captureInsert) captureInsert(parsedBody)
      return new Response(JSON.stringify([{ id: FAKE_QUEUE_ID, ...(parsedBody || {}) }]), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('not mocked: ' + u, { status: 500 })
  })
}

const VALID_BODY = {
  to: {
    name: 'Acme Pty Ltd',
    company: 'Acme Pty Ltd',
    address1: '12 Industrial Way',
    suburb: 'Seaford',
    state: 'VIC',
    postcode: '3198',
    country: 'AU',
  },
  letterText: 'You are hereby notified that invoice INV-001 is overdue...',
  letterTitle: 'Letter of Demand',
  registeredPost: true,
  context: { invoiceId: 'INV-001', level: 3 },
}

describe('api/postal-send', () => {
  let originalFetch
  let originalServiceKey

  beforeEach(() => {
    originalFetch = global.fetch
    originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role-key'
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalServiceKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
    }
    vi.restoreAllMocks()
  })

  it('returns 401 when no Authorization header is provided', async () => {
    global.fetch = mockFetchHappy()
    const req = makeRequest(VALID_BODY, { token: null })
    const res = await handler(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBeTruthy()
  })

  it('returns 405 for non-POST methods', async () => {
    global.fetch = mockFetchHappy()
    const req = new Request('https://example.test/api/postal-send', {
      method: 'GET',
      headers: { Authorization: 'Bearer fake.jwt' },
    })
    const res = await handler(req)
    expect(res.status).toBe(405)
  })

  it('returns 400 when letterText is missing', async () => {
    global.fetch = mockFetchHappy()
    const { letterText, ...rest } = VALID_BODY
    void letterText
    const req = makeRequest(rest)
    const res = await handler(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toContain('letterText')
  })

  it('returns 400 when to.name is missing', async () => {
    global.fetch = mockFetchHappy()
    const body = { ...VALID_BODY, to: { ...VALID_BODY.to, name: '' } }
    const req = makeRequest(body)
    const res = await handler(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toContain('to.name')
  })

  it('returns 400 when to.address1 is missing', async () => {
    global.fetch = mockFetchHappy()
    const body = { ...VALID_BODY, to: { ...VALID_BODY.to, address1: '' } }
    const req = makeRequest(body)
    const res = await handler(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toContain('to.address1')
  })

  it('returns 400 when to.postcode is missing', async () => {
    global.fetch = mockFetchHappy()
    const body = { ...VALID_BODY, to: { ...VALID_BODY.to, postcode: '' } }
    const req = makeRequest(body)
    const res = await handler(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toContain('to.postcode')
  })

  it('returns 400 with all four missing fields when nothing is provided', async () => {
    global.fetch = mockFetchHappy()
    const req = makeRequest({ to: {} })
    const res = await handler(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.missing).toEqual(expect.arrayContaining(['letterText', 'to.name', 'to.address1', 'to.postcode']))
  })

  it('returns ok: true with a uuid queue_id on a valid body', async () => {
    let capturedInsert = null
    global.fetch = mockFetchHappy({ captureInsert: (b) => { capturedInsert = b } })

    const req = makeRequest(VALID_BODY)
    const res = await handler(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.status).toBe('queued')
    expect(json.queue_id).toBe(FAKE_QUEUE_ID)
    // RFC 4122 UUID shape
    expect(json.queue_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    // estimated_dispatch is a YYYY-MM-DD string
    expect(json.estimated_dispatch).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Insert payload sanity
    expect(capturedInsert).toMatchObject({
      status: 'queued',
      letter_text: VALID_BODY.letterText,
      letter_title: 'Letter of Demand',
      recipient_name: 'Acme Pty Ltd',
      recipient_address1: '12 Industrial Way',
      recipient_postcode: '3198',
      recipient_country: 'AU',
      registered_post: true,
      requested_by: FAKE_USER_ID,
    })
  })

  it('defaults registered_post to false when registeredPost is omitted', async () => {
    let capturedInsert = null
    global.fetch = mockFetchHappy({ captureInsert: (b) => { capturedInsert = b } })

    const { registeredPost, ...bodyWithoutFlag } = VALID_BODY
    void registeredPost
    const req = makeRequest(bodyWithoutFlag)
    const res = await handler(req)
    expect(res.status).toBe(200)

    expect(capturedInsert).toBeTruthy()
    expect(capturedInsert.registered_post).toBe(false)
  })

  it('returns 401 when /auth/v1/user verification fails', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ error: 'invalid token' }), { status: 401 })
      }
      return new Response('unexpected', { status: 500 })
    })
    const req = makeRequest(VALID_BODY)
    const res = await handler(req)
    expect(res.status).toBe(401)
  })
})
