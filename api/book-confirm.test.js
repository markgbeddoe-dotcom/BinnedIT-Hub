/**
 * @file api/book-confirm.test.js
 *
 * Vitest tests for `sendSmsConfirmation` — the Twilio SMS path of the
 * book-confirm Edge Function. Covers:
 *   - happy path: env vars set → fetch is called with the right URL,
 *     Authorization header, and From/To/Body params
 *   - missing config: TWILIO_ACCOUNT_SID absent → fetch is NOT called,
 *     returns { ok: true, smsSent: false, reason: 'twilio_not_configured' }
 *   - Twilio 4xx: response is logged but the call does not throw — booking
 *     flow stays green
 *
 * Closes Sprint 13 #21 (audit `docs/audits/2026-05-06/audit-personas.md`
 * P0-9 — `api/book-confirm.js:15-17` was a console.log placeholder).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendSmsConfirmation } from './book-confirm.js'

const TWILIO_URL_RE = /^https:\/\/api\.twilio\.com\/2010-04-01\/Accounts\/AC123\/Messages\.json$/

describe('sendSmsConfirmation (Twilio SMS path)', () => {
  let originalFetch
  let originalEnv
  let warnSpy
  let errorSpy
  let logSpy

  beforeEach(() => {
    originalFetch = globalThis.fetch
    originalEnv = {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN:  process.env.TWILIO_AUTH_TOKEN,
      TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    }
    // silence noisy console output during the negative-path tests
    warnSpy  = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logSpy   = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    process.env.TWILIO_ACCOUNT_SID = originalEnv.TWILIO_ACCOUNT_SID
    process.env.TWILIO_AUTH_TOKEN  = originalEnv.TWILIO_AUTH_TOKEN
    process.env.TWILIO_FROM_NUMBER = originalEnv.TWILIO_FROM_NUMBER
    if (originalEnv.TWILIO_ACCOUNT_SID === undefined) delete process.env.TWILIO_ACCOUNT_SID
    if (originalEnv.TWILIO_AUTH_TOKEN  === undefined) delete process.env.TWILIO_AUTH_TOKEN
    if (originalEnv.TWILIO_FROM_NUMBER === undefined) delete process.env.TWILIO_FROM_NUMBER
    vi.restoreAllMocks()
  })

  it('calls Twilio with the right URL, Authorization header, and From/To/Body params when env vars are set', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN  = 'secret-token'
    process.env.TWILIO_FROM_NUMBER = '+61400000000'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ sid: 'SM_TEST_SID' }),
      text: async () => '',
    })
    globalThis.fetch = fetchMock

    const result = await sendSmsConfirmation({
      customerPhone: '+61411222333',
      bookingRef:    'ABC123',
      deliveryDate:  '2026-05-15',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]

    // URL contains the account SID
    expect(url).toMatch(TWILIO_URL_RE)

    // POST + correct content type
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

    // HTTP Basic auth header — base64 of "AC123:secret-token"
    const expectedBasic = `Basic ${btoa('AC123:secret-token')}`
    expect(init.headers.Authorization).toBe(expectedBasic)

    // Body has From / To / Body params
    const params = new URLSearchParams(init.body)
    expect(params.get('From')).toBe('+61400000000')
    expect(params.get('To')).toBe('+61411222333')
    const bodyText = params.get('Body')
    expect(bodyText).toContain('Thanks for booking with SkipSync')
    expect(bodyText).toContain('15 May 2026')
    expect(bodyText).toContain('Confirmation #ABC123')
    expect(bodyText).toContain('Reply STOP to opt out')

    // Result reflects success
    expect(result).toEqual({ ok: true, smsSent: true, sid: 'SM_TEST_SID' })
  })

  it('does NOT call fetch and returns twilio_not_configured when TWILIO_ACCOUNT_SID is missing', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    process.env.TWILIO_AUTH_TOKEN  = 'secret-token'
    process.env.TWILIO_FROM_NUMBER = '+61400000000'

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const result = await sendSmsConfirmation({
      customerPhone: '+61411222333',
      bookingRef:    'ABC123',
      deliveryDate:  '2026-05-15',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      smsSent: false,
      reason: 'twilio_not_configured',
    })
  })

  it('logs but does not throw when Twilio returns a 4xx', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123'
    process.env.TWILIO_AUTH_TOKEN  = 'secret-token'
    process.env.TWILIO_FROM_NUMBER = '+61400000000'

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ code: 21211, message: 'Invalid To number' }),
      text: async () => '{"code":21211,"message":"Invalid To number"}',
    })
    globalThis.fetch = fetchMock

    // Calling MUST NOT throw — assert that by simply awaiting it. If the
    // helper threw, the test would fail with the thrown error before it
    // ever reached the assertions below.
    const result = await sendSmsConfirmation({
      customerPhone: 'not-a-phone',
      bookingRef:    'ABC123',
      deliveryDate:  '2026-05-15',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The 4xx must be logged via console.error so ops can see the failure,
    // but the call itself must NOT throw — the booking flow stays green.
    expect(errorSpy).toHaveBeenCalled()
    const loggedMessage = errorSpy.mock.calls.flat().join(' ')
    expect(loggedMessage).toMatch(/Twilio responded 400/)
    expect(result).toEqual({
      ok: true,
      smsSent: false,
      reason: 'twilio_error',
      status: 400,
    })
  })
})
