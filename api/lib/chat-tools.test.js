/**
 * @file api/lib/chat-tools.test.js
 *
 * Vitest tests for the AI chat agent tools (api/lib/chat-tools.js).
 *
 * Strategy (same as api/notify-booking.test.js): stub global.fetch and route
 * by URL + method —
 *   GET   /rest/v1/bookings           → job reads / booking load
 *   PATCH /rest/v1/bookings           → assignment write
 *   GET   /rest/v1/profiles           → driver roster lookup
 *   GET   /rest/v1/fleet_assets       → trucks
 *   GET   /rest/v1/vehicle_checklists → today's pre-start checklists
 *   GET   /rest/v1/business_rules     → rules
 *   POST  /rest/v1/audit_log          → fire-and-forget audit insert
 *
 * No import of api/lib/manual.js or api/chat.js — these tests cover the tool
 * layer only and must not depend on the (sibling-owned) manual content.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  TOOL_DEFINITIONS,
  toolsForRole,
  getJobs,
  getRoster,
  getBusinessRules,
  assignJob,
  assignmentStatusFor,
  createToolExecutor,
  runToolSafe,
  melbourneToday,
  ASSIGN_JOB_CAP,
} from './chat-tools.js'

const CFG = {
  SUPABASE_URL: 'https://fake.supabase.co',
  SERVICE_KEY: 'fake-service-role-key',
  actorId: '99999999-9999-4999-8999-999999999999',
}

const BOOKING_ID = '33333333-3333-4333-8333-333333333333'
const DRIVER_ID = '44444444-4444-4444-8444-444444444444'

const PENDING_BOOKING = {
  id: BOOKING_ID,
  customer_name: 'Donna Chen',
  status: 'pending',
  driver_id: null,
  driver_name: null,
  driver_name_assigned: null,
  truck_id: null,
  scheduled_date: null,
}

/**
 * Configurable fetch stub. opts:
 *   bookingRows — GET bookings rows
 *   driverRows  — GET profiles rows
 *   patch       — { capture } callback receives { url, body } of bookings PATCH
 *   audit       — callback receives parsed audit_log POST body
 *   patchStatus — HTTP status for the PATCH (default 200)
 */
function mockFetch(opts = {}) {
  const {
    bookingRows = [PENDING_BOOKING],
    driverRows = [{ id: DRIVER_ID, full_name: 'Jake Wilson' }],
    patch = null,
    audit = null,
    patchStatus = 200,
  } = opts

  return vi.fn(async (url, init = {}) => {
    const u = String(url)
    const method = (init.method || 'GET').toUpperCase()

    if (u.includes('/rest/v1/bookings') && method === 'PATCH') {
      let parsed = null
      try { parsed = init.body ? JSON.parse(init.body) : null } catch { /* noop */ }
      if (patch) patch({ url: u, body: parsed })
      if (patchStatus !== 200) return new Response('boom', { status: patchStatus })
      return new Response(JSON.stringify([{ ...bookingRows[0], ...parsed }]), { status: 200 })
    }
    if (u.includes('/rest/v1/bookings')) {
      return new Response(JSON.stringify(bookingRows), { status: 200 })
    }
    if (u.includes('/rest/v1/profiles')) {
      return new Response(JSON.stringify(driverRows), { status: 200 })
    }
    if (u.includes('/rest/v1/fleet_assets')) {
      return new Response(JSON.stringify([{ id: 't-1', identifier: 'TRK-01', description: 'Hino 500' }]), { status: 200 })
    }
    if (u.includes('/rest/v1/vehicle_checklists')) {
      return new Response(JSON.stringify([{ driver_id: DRIVER_ID, passed: true }]), { status: 200 })
    }
    if (u.includes('/rest/v1/business_rules')) {
      return new Response(JSON.stringify([
        { rule_key: 'max_jobs_per_truck_day', name: 'Max jobs per truck per day', category: 'dispatch', value: 8, enabled: true },
      ]), { status: 200 })
    }
    if (u.includes('/rest/v1/audit_log')) {
      let parsed = null
      try { parsed = init.body ? JSON.parse(init.body) : null } catch { /* noop */ }
      if (audit) audit(parsed)
      return new Response(null, { status: 201 })
    }
    return new Response('not mocked: ' + u, { status: 500 })
  })
}

describe('api/lib/chat-tools', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ── get_jobs query building ───────────────────────────────────────────────

  it('get_jobs builds the correct PostgREST query for today + unassigned', async () => {
    const fetchMock = mockFetch({ bookingRows: [PENDING_BOOKING] })
    global.fetch = fetchMock

    const { summary, data } = await getJobs(CFG, { date: 'today', unassigned_only: true })

    const calledUrl = String(fetchMock.mock.calls[0][0])
    const today = melbourneToday()
    expect(calledUrl).toContain('/rest/v1/bookings?')
    expect(calledUrl).toContain(`scheduled_date=eq.${today}`)
    expect(calledUrl).toContain('driver_id=is.null')
    expect(calledUrl).toContain('limit=20')
    expect(calledUrl).toContain(
      'select=id,customer_name,address,suburb,bin_size,waste_type,status,driver_id,driver_name,truck_id,scheduled_date,estimated_cost'
    )
    expect(data).toHaveLength(1)
    expect(summary).toContain('1 unassigned job')
    expect(summary).toContain('today')
  })

  it('get_jobs applies status filters, explicit dates, and clamps limit to 50', async () => {
    const fetchMock = mockFetch()
    global.fetch = fetchMock

    await getJobs(CFG, { date: '2026-06-12', status: ['pending', 'confirmed'], limit: 500 })
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('scheduled_date=eq.2026-06-12')
    expect(calledUrl).toContain('status=in.(pending,confirmed)')
    expect(calledUrl).toContain('limit=50')
    expect(calledUrl).not.toContain('driver_id=is.null')
  })

  it('get_jobs rejects malformed dates', async () => {
    global.fetch = mockFetch()
    await expect(getJobs(CFG, { date: 'next tuesday' })).rejects.toThrow(/Invalid date/)
  })

  // ── assignmentStatusFor (exact DispatchBoard rule) ────────────────────────

  it('assignmentStatusFor mirrors useBookings: pending+driver+date → scheduled, all else preserved', () => {
    expect(assignmentStatusFor('pending', DRIVER_ID, '2026-06-12')).toBe('scheduled')
    expect(assignmentStatusFor('pending', null, '2026-06-12')).toBe('pending')
    expect(assignmentStatusFor('pending', DRIVER_ID, null)).toBe('pending')
    expect(assignmentStatusFor('in_progress', DRIVER_ID, '2026-06-12')).toBe('in_progress')
    expect(assignmentStatusFor('en_route', DRIVER_ID, '2026-06-12')).toBe('en_route')
    expect(assignmentStatusFor('completed', DRIVER_ID, '2026-06-12')).toBe('completed')
  })

  // ── assign_job ────────────────────────────────────────────────────────────

  it('assign_job sets scheduled status for a pending booking given driver + date', async () => {
    let patched = null
    let auditRow = null
    global.fetch = mockFetch({
      bookingRows: [PENDING_BOOKING],
      patch: (p) => { patched = p },
      audit: (a) => { auditRow = a },
    })

    const { summary, data } = await assignJob(CFG, {
      booking_id: BOOKING_ID,
      driver_id: DRIVER_ID,
      truck_id: 'TRK-01',
      scheduled_date: '2026-06-12',
    })

    expect(patched.url).toContain(`/rest/v1/bookings?id=eq.${BOOKING_ID}`)
    expect(patched.body).toMatchObject({
      driver_id: DRIVER_ID,
      driver_name: 'Jake Wilson',
      driver_name_assigned: 'Jake Wilson',
      truck_id: 'TRK-01',
      scheduled_date: '2026-06-12',
      status: 'scheduled',
    })
    expect(data.status).toBe('scheduled')
    expect(summary).toContain('Jake Wilson')
    expect(summary).toContain('scheduled')

    // audit log row — fire-and-forget but observable through the mock
    await new Promise((r) => setTimeout(r, 0))
    expect(auditRow).toMatchObject({
      table_name: 'bookings',
      record_id: BOOKING_ID,
      action: 'UPDATE',
      changed_by: CFG.actorId,
    })
    expect(auditRow.new_values.ai_action).toBe('ai_assign_job')
  })

  it('assign_job preserves in_progress status (never touches active state machine)', async () => {
    let patched = null
    global.fetch = mockFetch({
      bookingRows: [{ ...PENDING_BOOKING, status: 'in_progress', driver_id: DRIVER_ID }],
      patch: (p) => { patched = p },
    })

    const { data } = await assignJob(CFG, {
      booking_id: BOOKING_ID,
      driver_id: DRIVER_ID,
      scheduled_date: '2026-06-12',
    })

    expect(patched.body.status).toBeUndefined() // status not in the PATCH at all
    expect(data.status).toBe('in_progress')
  })

  it('assign_job keeps a pending booking pending when only a truck is set', async () => {
    let patched = null
    global.fetch = mockFetch({ patch: (p) => { patched = p } })
    await assignJob(CFG, { booking_id: BOOKING_ID, truck_id: 'TRK-01' })
    expect(patched.body.status).toBeUndefined()
    expect(patched.body.truck_id).toBe('TRK-01')
    expect(patched.body.driver_id).toBeUndefined()
  })

  it('assign_job rejects completed bookings', async () => {
    const fetchMock = mockFetch({ bookingRows: [{ ...PENDING_BOOKING, status: 'completed' }] })
    global.fetch = fetchMock
    await expect(
      assignJob(CFG, { booking_id: BOOKING_ID, driver_id: DRIVER_ID, scheduled_date: '2026-06-12' })
    ).rejects.toThrow(/completed/)
    // no PATCH attempted
    const patchCalls = fetchMock.mock.calls.filter((c) => (c[1]?.method || 'GET') === 'PATCH')
    expect(patchCalls).toHaveLength(0)
  })

  it('assign_job rejects cancelled bookings and unknown bookings', async () => {
    global.fetch = mockFetch({ bookingRows: [{ ...PENDING_BOOKING, status: 'cancelled' }] })
    await expect(
      assignJob(CFG, { booking_id: BOOKING_ID, driver_id: DRIVER_ID })
    ).rejects.toThrow(/cancelled/)

    global.fetch = mockFetch({ bookingRows: [] })
    await expect(
      assignJob(CFG, { booking_id: BOOKING_ID, driver_id: DRIVER_ID })
    ).rejects.toThrow(/not found/)
  })

  it('assign_job rejects a driver_id that is not in the roster', async () => {
    global.fetch = mockFetch({ driverRows: [] })
    await expect(
      assignJob(CFG, { booking_id: BOOKING_ID, driver_id: DRIVER_ID })
    ).rejects.toThrow(/not found in roster/)
  })

  it('assign_job requires a valid uuid booking_id and at least one field', async () => {
    global.fetch = mockFetch()
    await expect(assignJob(CFG, { booking_id: 'nope' })).rejects.toThrow(/booking_id/)
    await expect(assignJob(CFG, { booking_id: BOOKING_ID })).rejects.toThrow(/at least one/)
  })

  // ── 20-call cap (per-request executor state) ──────────────────────────────

  it(`assign_job errors after ${ASSIGN_JOB_CAP} calls in one request`, async () => {
    global.fetch = mockFetch()
    const execute = createToolExecutor({ ...CFG, role: 'owner' })

    for (let i = 0; i < ASSIGN_JOB_CAP; i++) {
      const { summary } = await execute('assign_job', {
        booking_id: BOOKING_ID,
        driver_id: DRIVER_ID,
        scheduled_date: '2026-06-12',
      })
      expect(summary).toBeTruthy()
    }

    await expect(
      execute('assign_job', { booking_id: BOOKING_ID, driver_id: DRIVER_ID, scheduled_date: '2026-06-12' })
    ).rejects.toThrow(/cap reached/)

    // read tools keep working after the cap
    const { data } = await execute('get_business_rules', {})
    expect(data).toHaveLength(1)
  })

  // ── Role gating ───────────────────────────────────────────────────────────

  it('toolsForRole excludes assign_job for bookkeeper/driver/viewer/investor', () => {
    for (const role of ['bookkeeper', 'driver', 'viewer', 'investor']) {
      const names = toolsForRole(role).map((t) => t.name)
      expect(names).toEqual(['get_jobs', 'get_roster', 'get_business_rules'])
      expect(names).not.toContain('assign_job')
    }
  })

  it('toolsForRole includes assign_job for owner/manager/fleet_manager', () => {
    for (const role of ['owner', 'manager', 'fleet_manager']) {
      const names = toolsForRole(role).map((t) => t.name)
      expect(names).toEqual(['get_jobs', 'get_roster', 'get_business_rules', 'assign_job'])
    }
  })

  it('toolsForRole returns NO tools for a null role (unauthenticated)', () => {
    expect(toolsForRole(null)).toEqual([])
    expect(toolsForRole(undefined)).toEqual([])
    expect(toolsForRole('')).toEqual([])
  })

  it('toolsForRole preserves TOOL_DEFINITIONS order (byte-stable cache prefix)', () => {
    expect(TOOL_DEFINITIONS.map((t) => t.name)).toEqual([
      'get_jobs', 'get_roster', 'get_business_rules', 'assign_job',
    ])
    expect(toolsForRole('owner')).toEqual(TOOL_DEFINITIONS)
  })

  it('executor enforces gating server-side even if the model calls an ungranted tool', async () => {
    global.fetch = mockFetch()
    const execute = createToolExecutor({ ...CFG, role: 'driver' })
    await expect(
      execute('assign_job', { booking_id: BOOKING_ID, driver_id: DRIVER_ID })
    ).rejects.toThrow(/owner, manager or fleet_manager/)
    const execNone = createToolExecutor({ ...CFG, role: null })
    await expect(execNone('get_jobs', {})).rejects.toThrow(/Permission denied/)
  })

  // ── Errors become is_error tool results, not request failures ─────────────

  it('runToolSafe surfaces tool errors as is_error tool_result instead of throwing', async () => {
    global.fetch = mockFetch({ bookingRows: [{ ...PENDING_BOOKING, status: 'completed' }] })
    const execute = createToolExecutor({ ...CFG, role: 'manager' })

    const result = await runToolSafe(execute, 'assign_job', {
      booking_id: BOOKING_ID,
      driver_id: DRIVER_ID,
      scheduled_date: '2026-06-12',
    })

    expect(result.is_error).toBe(true)
    expect(result.content).toMatch(/^Error: /)
    expect(result.content).toContain('completed')
    expect(result.summary).toContain('completed')
  })

  it('runToolSafe returns a JSON content payload with summary + data on success', async () => {
    global.fetch = mockFetch()
    const execute = createToolExecutor({ ...CFG, role: 'viewer' })
    const result = await runToolSafe(execute, 'get_jobs', { date: 'today', unassigned_only: true })
    expect(result.is_error).toBe(false)
    const parsed = JSON.parse(result.content)
    expect(parsed.summary).toContain('unassigned')
    expect(parsed.data).toHaveLength(1)
  })

  it('runToolSafe flags Supabase failures (e.g. 500) as is_error without throwing', async () => {
    global.fetch = vi.fn(async () => new Response('relation does not exist', { status: 500 }))
    const execute = createToolExecutor({ ...CFG, role: 'owner' })
    const result = await runToolSafe(execute, 'get_business_rules', {})
    expect(result.is_error).toBe(true)
    expect(result.content).toContain('Error:')
  })

  // ── get_roster / get_business_rules shapes ────────────────────────────────

  it('get_roster merges drivers with checklist pass + today job counts and trucks', async () => {
    global.fetch = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/rest/v1/profiles')) {
        return new Response(JSON.stringify([
          { id: DRIVER_ID, full_name: 'Jake Wilson' },
          { id: '55555555-5555-4555-8555-555555555555', full_name: 'Sam Lee' },
        ]), { status: 200 })
      }
      if (u.includes('/rest/v1/fleet_assets')) {
        return new Response(JSON.stringify([{ id: 't-1', identifier: 'TRK-01', description: 'Hino 500' }]), { status: 200 })
      }
      if (u.includes('/rest/v1/vehicle_checklists')) {
        expect(u).toContain(`check_date=eq.${melbourneToday()}`)
        return new Response(JSON.stringify([{ driver_id: DRIVER_ID, passed: true }]), { status: 200 })
      }
      if (u.includes('/rest/v1/bookings')) {
        return new Response(JSON.stringify([{ driver_id: DRIVER_ID }, { driver_id: DRIVER_ID }]), { status: 200 })
      }
      return new Response('not mocked: ' + u, { status: 500 })
    })

    const { summary, data } = await getRoster(CFG, {})
    const jake = data.drivers.find((d) => d.id === DRIVER_ID)
    const sam = data.drivers.find((d) => d.full_name === 'Sam Lee')
    expect(jake).toMatchObject({ checklist_passed_today: true, active_jobs_today: 2 })
    expect(sam).toMatchObject({ checklist_passed_today: false, active_jobs_today: 0 })
    expect(data.trucks[0].identifier).toBe('TRK-01')
    expect(summary).toContain('2 drivers')
    expect(summary).toContain('1 checklist-passed')
  })

  it('get_business_rules returns rule_key/name/category/value/enabled rows', async () => {
    const fetchMock = mockFetch()
    global.fetch = fetchMock
    const { data } = await getBusinessRules(CFG, {})
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('business_rules?select=rule_key,name,category,value,enabled')
    expect(data[0]).toMatchObject({ rule_key: 'max_jobs_per_truck_day', value: 8, enabled: true })
  })
})
