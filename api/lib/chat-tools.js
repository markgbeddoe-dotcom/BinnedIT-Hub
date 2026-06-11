/**
 * @file api/lib/chat-tools.js
 *
 * Tool implementations for the AI chat agent (/api/chat).
 *
 * Each tool is a pure-ish async function taking ({ SUPABASE_URL, SERVICE_KEY }, input)
 * and returning { summary, data } or throwing an Error. chat.js wires them into
 * the Anthropic tool-use loop via createToolExecutor() / runToolSafe().
 *
 * All data access goes through the Supabase REST API (PostgREST) with
 * service-role headers — same convention as every other api/* function.
 *
 * Schema sources of truth:
 *   - bookings:            supabase/migrations/008_bookings.sql + 009 (driver_id,
 *                          driver_name_assigned) — status CHECK: pending|confirmed|
 *                          scheduled|in_progress|completed|cancelled (en_route/arrived
 *                          accepted in app flows)
 *   - profiles roles:      022_roles_expansion.sql — owner|manager|bookkeeper|viewer|
 *                          investor|driver|fleet_manager
 *   - fleet_assets trucks: src/hooks/useDrivers.js — id, identifier, description
 *   - vehicle_checklists:  009 — check_date (NOT checklist_date), passed (generated)
 *   - business_rules:      026_business_rules.sql
 *   - audit_log:           010_phase6_audit_team_compliance.sql — action CHECK only
 *                          allows INSERT|UPDATE|DELETE, so AI assignments log
 *                          action='UPDATE' with ai_action:'ai_assign_job' in new_values.
 *
 * Status transition rule REPLICATES src/hooks/useBookings.js assignmentStatusFor()
 * exactly: only a `pending` job with BOTH a driver and a date becomes `scheduled`.
 * en_route / arrived / in_progress / completed are never touched.
 */

export const ASSIGN_JOB_CAP = 20

/** Roles allowed to call the assign_job write tool. */
export const WRITE_ROLES = ['owner', 'manager', 'fleet_manager']

/** Active (not-yet-finished) job statuses — mirrors src/api/driver.js. */
export const ACTIVE_STATUSES = [
  'pending', 'confirmed', 'scheduled',
  'en_route', 'arrived', 'in_progress',
]

/**
 * Melbourne calendar date as YYYY-MM-DD (en-CA trick — see src/api/driver.js).
 * UTC dates roll over at 10/11am Melbourne, which would target yesterday.
 */
export function melbourneToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * EXACT replica of assignmentStatusFor in src/hooks/useBookings.js (WP-A / FR7.1.6):
 * a pending job becomes scheduled once it has BOTH a driver and a date.
 * Every other status (incl. confirmed, en_route, arrived, in_progress, completed)
 * is preserved untouched.
 */
export function assignmentStatusFor(currentStatus, driverId, scheduledDate) {
  if (currentStatus === 'pending' && driverId && scheduledDate) return 'scheduled'
  return currentStatus
}

// ── Tool JSON schemas ────────────────────────────────────────────────────────
// ORDER MATTERS for prompt caching: this array is byte-stable — same order,
// same content, every request. Never reorder or conditionally mutate entries.

export const TOOL_DEFINITIONS = [
  {
    name: 'get_jobs',
    description:
      'Read bookings (skip bin jobs) from the live dispatch database. Call this whenever the user asks about jobs, bookings, schedules, deliveries, pickups, workload, or specific customers — and ALWAYS call it before assigning or rescheduling any work so you act on current data, never from memory. Use date:"today" with unassigned_only:true to find jobs that still need a driver.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Filter by scheduled_date. Either "today" (Melbourne time) or a date in YYYY-MM-DD format. Omit for all dates.',
        },
        status: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['pending', 'confirmed', 'scheduled', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled'],
          },
          description: 'Filter to these statuses only. Omit for all statuses.',
        },
        unassigned_only: {
          type: 'boolean',
          description: 'When true, return only jobs with no driver assigned (driver_id is null).',
        },
        limit: {
          type: 'number',
          description: 'Max rows to return (default 20, hard cap 50).',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_roster',
    description:
      "Read today's operational roster: all drivers, all active trucks, whether each driver has passed today's pre-start vehicle checklist, and how many active jobs each driver already has today. Call this before assigning work (assign_job), when the user asks who is available, which drivers passed their checklist, truck availability, or driver workload. Prefer checklist-passed drivers and balance job counts when planning assignments.",
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_business_rules',
    description:
      'Read the management-configured business rules (dispatch, routing, tipping, billing, safety and pricing parameters such as max_jobs_per_truck_day, checklist_block_shift, fuel_cost_per_km). Call this before bulk-scheduling work, and whenever the user asks what a rule/threshold/limit is set to or how the system would behave. Respect enabled=false rules as inactive.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'assign_job',
    description:
      'Assign or reschedule ONE booking: set its driver, truck and/or scheduled date. This WRITES to the live dispatch database. Call get_jobs and get_roster first so you assign real bookings to real drivers. A pending job with both a driver and a date automatically becomes scheduled; jobs already en route, arrived or in progress keep their status; completed and cancelled jobs cannot be assigned. For bulk scheduling, call this once per booking (max 20 per conversation turn), preferring checklist-passed drivers, balancing load across drivers, and respecting the max_jobs_per_truck_day business rule.',
    input_schema: {
      type: 'object',
      properties: {
        booking_id: {
          type: 'string',
          description: 'UUID of the booking to assign (from get_jobs).',
        },
        driver_id: {
          type: 'string',
          description: 'UUID of the driver to assign (from get_roster). Omit to leave the current driver unchanged.',
        },
        truck_id: {
          type: 'string',
          description: 'Truck identifier text (the "identifier" field from get_roster trucks, e.g. "TRK-01"). Omit to leave unchanged.',
        },
        scheduled_date: {
          type: 'string',
          description: 'Date to schedule the job for, YYYY-MM-DD. Omit to leave unchanged.',
        },
      },
      required: ['booking_id'],
    },
  },
]

/**
 * Role gating — server-side, derived from the verified JWT only.
 *   null/undefined role  → no tools (unauthenticated knowledge-base mode)
 *   any authenticated    → read-only tools (get_jobs, get_roster, get_business_rules)
 *   owner|manager|fleet_manager → additionally assign_job (the only write)
 * Returns a subset of TOOL_DEFINITIONS preserving order (byte-stable per role).
 */
export function toolsForRole(role) {
  if (!role) return []
  const canWrite = WRITE_ROLES.includes(role)
  return TOOL_DEFINITIONS.filter((t) => t.name !== 'assign_job' || canWrite)
}

// ── REST helpers ─────────────────────────────────────────────────────────────

function serviceHeaders(SERVICE_KEY, extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    ...extra,
  }
}

async function restGet({ SUPABASE_URL, SERVICE_KEY }, pathAndQuery) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: serviceHeaders(SERVICE_KEY),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Supabase query failed (${res.status}): ${text.slice(0, 200)}`)
  }
  return res.json()
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function resolveDate(date) {
  if (!date || date === 'today') return melbourneToday()
  if (!DATE_RE.test(date)) throw new Error(`Invalid date "${date}" — use "today" or YYYY-MM-DD`)
  return date
}

// ── Tools ────────────────────────────────────────────────────────────────────

const JOB_SELECT = 'id,customer_name,address,suburb,bin_size,waste_type,status,driver_id,driver_name,truck_id,scheduled_date,estimated_cost'

/**
 * get_jobs — read bookings with optional date / status / unassigned filters.
 * @returns {Promise<{summary: string, data: object[]}>}
 */
export async function getJobs(cfg, input = {}) {
  const params = [`select=${JOB_SELECT}`]

  let dateLabel = null
  if (input.date) {
    const d = resolveDate(input.date)
    params.push(`scheduled_date=eq.${d}`)
    dateLabel = input.date === 'today' ? `today (${d})` : d
  }

  if (Array.isArray(input.status) && input.status.length > 0) {
    params.push(`status=in.(${input.status.map((s) => String(s)).join(',')})`)
  }

  if (input.unassigned_only) {
    params.push('driver_id=is.null')
  }

  const limit = Math.min(Math.max(1, Number(input.limit) || 20), 50)
  params.push('order=scheduled_date.asc.nullslast,created_at.asc')
  params.push(`limit=${limit}`)

  const rows = await restGet(cfg, `bookings?${params.join('&')}`)

  const bits = []
  if (input.unassigned_only) bits.push('unassigned')
  if (Array.isArray(input.status) && input.status.length) bits.push(input.status.join('/'))
  const qualifier = bits.length ? `${bits.join(' ')} ` : ''
  const summary = `${rows.length} ${qualifier}job${rows.length === 1 ? '' : 's'}${dateLabel ? ` for ${dateLabel}` : ''}`
  return { summary, data: rows }
}

/**
 * get_roster — drivers (profiles role=driver) + active trucks (fleet_assets) +
 * per-driver today checklist pass + per-driver count of today's active jobs.
 * @returns {Promise<{summary: string, data: {date, drivers, trucks}}>}
 */
export async function getRoster(cfg, _input = {}) {
  const today = melbourneToday()

  const [drivers, trucks, checklists, todaysJobs] = await Promise.all([
    restGet(cfg, 'profiles?role=eq.driver&select=id,full_name&order=full_name.asc'),
    restGet(cfg, 'fleet_assets?asset_type=eq.truck&is_active=eq.true&select=id,identifier,description&order=identifier.asc'),
    // vehicle_checklists date column is check_date (migration 009); passed is generated.
    restGet(cfg, `vehicle_checklists?check_date=eq.${today}&select=driver_id,passed`).catch(() => []),
    restGet(cfg, `bookings?scheduled_date=eq.${today}&status=in.(${ACTIVE_STATUSES.join(',')})&driver_id=not.is.null&select=driver_id`).catch(() => []),
  ])

  const passedByDriver = {}
  for (const c of checklists) {
    if (c.passed) passedByDriver[c.driver_id] = true
  }
  const jobCountByDriver = {}
  for (const j of todaysJobs) {
    jobCountByDriver[j.driver_id] = (jobCountByDriver[j.driver_id] || 0) + 1
  }

  const driverRows = drivers.map((d) => ({
    id: d.id,
    full_name: d.full_name,
    checklist_passed_today: !!passedByDriver[d.id],
    active_jobs_today: jobCountByDriver[d.id] || 0,
  }))

  const passedCount = driverRows.filter((d) => d.checklist_passed_today).length
  const summary = `${driverRows.length} driver${driverRows.length === 1 ? '' : 's'} (${passedCount} checklist-passed today), ${trucks.length} active truck${trucks.length === 1 ? '' : 's'}`
  return { summary, data: { date: today, drivers: driverRows, trucks } }
}

/**
 * get_business_rules — rule_key, name, category, value, enabled.
 * @returns {Promise<{summary: string, data: object[]}>}
 */
export async function getBusinessRules(cfg, _input = {}) {
  const rows = await restGet(cfg, 'business_rules?select=rule_key,name,category,value,enabled&order=rule_key.asc')
  return { summary: `${rows.length} business rule${rows.length === 1 ? '' : 's'}`, data: rows }
}

/**
 * assign_job — the only write tool. Validates the booking is assignable and the
 * driver exists in the roster, PATCHes the booking (driver_id + driver_name +
 * driver_name_assigned kept in sync — ADR-708 risk 10), applies the exact
 * assignmentStatusFor transition, and fire-and-forgets an audit_log row.
 *
 * cfg: { SUPABASE_URL, SERVICE_KEY, actorId } — actorId is the VERIFIED user id.
 * @returns {Promise<{summary: string, data: object}>}
 */
export async function assignJob(cfg, input = {}) {
  const { booking_id, driver_id, truck_id, scheduled_date } = input

  if (!booking_id || typeof booking_id !== 'string' || !UUID_RE.test(booking_id)) {
    throw new Error('assign_job requires a valid booking_id (uuid from get_jobs)')
  }
  if (driver_id === undefined && truck_id === undefined && scheduled_date === undefined) {
    throw new Error('assign_job needs at least one of driver_id, truck_id or scheduled_date')
  }
  if (driver_id !== undefined && driver_id !== null && !UUID_RE.test(String(driver_id))) {
    throw new Error('driver_id must be a driver uuid from get_roster')
  }
  if (scheduled_date !== undefined && scheduled_date !== null && !DATE_RE.test(String(scheduled_date))) {
    throw new Error('scheduled_date must be YYYY-MM-DD')
  }

  // 1. Booking must exist and be assignable
  const bookings = await restGet(
    cfg,
    `bookings?id=eq.${booking_id}&select=id,customer_name,status,driver_id,driver_name,driver_name_assigned,truck_id,scheduled_date&limit=1`
  )
  const booking = bookings[0]
  if (!booking) throw new Error(`Booking ${booking_id} not found`)
  if (booking.status === 'completed' || booking.status === 'cancelled') {
    throw new Error(`Booking ${booking_id} is ${booking.status} and cannot be assigned`)
  }

  // 2. Driver (when given) must exist in the roster — also resolves full_name
  let driverName
  if (driver_id) {
    const drivers = await restGet(cfg, `profiles?id=eq.${driver_id}&role=eq.driver&select=id,full_name&limit=1`)
    if (!drivers[0]) throw new Error(`Driver ${driver_id} not found in roster (profiles where role=driver)`)
    driverName = drivers[0].full_name || null
  }

  // 3. Build the PATCH — only fields the model asked to change.
  //    driver_id (uuid, source of truth) + driver_name_assigned AND legacy
  //    driver_name written together, mirroring useAssignDriver.
  const patch = { updated_at: new Date().toISOString() }
  if (driver_id !== undefined) {
    patch.driver_id = driver_id || null
    patch.driver_name = driver_id ? driverName : null
    patch.driver_name_assigned = driver_id ? driverName : null
  }
  if (truck_id !== undefined) patch.truck_id = truck_id || null
  if (scheduled_date !== undefined) patch.scheduled_date = scheduled_date || null

  // Status per the EXACT DispatchBoard rule, evaluated on effective values
  const effectiveDriver = driver_id !== undefined ? driver_id : booking.driver_id
  const effectiveDate = scheduled_date !== undefined ? scheduled_date : booking.scheduled_date
  const nextStatus = assignmentStatusFor(booking.status, effectiveDriver, effectiveDate)
  if (nextStatus !== booking.status) patch.status = nextStatus

  const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}`, {
    method: 'PATCH',
    headers: serviceHeaders(cfg.SERVICE_KEY, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Assignment failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const updatedRows = await res.json().catch(() => [])
  const updated = updatedRows[0] || { ...booking, ...patch }

  // 4. Fire-and-forget audit log (public.audit_log, migration 010).
  //    Its action CHECK only allows INSERT|UPDATE|DELETE, so the AI marker
  //    'ai_assign_job' goes in new_values. Skips silently if the table is absent.
  try {
    fetch(`${cfg.SUPABASE_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: serviceHeaders(cfg.SERVICE_KEY, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        table_name: 'bookings',
        record_id: booking_id,
        action: 'UPDATE',
        changed_by: cfg.actorId || null,
        old_values: {
          driver_id: booking.driver_id, truck_id: booking.truck_id,
          scheduled_date: booking.scheduled_date, status: booking.status,
        },
        new_values: { ...patch, ai_action: 'ai_assign_job' },
      }),
    }).catch(() => {})
  } catch { /* never block the assignment on audit */ }

  const parts = []
  if (driver_id !== undefined) parts.push(driver_id ? `driver ${driverName || driver_id}` : 'driver cleared')
  if (truck_id !== undefined) parts.push(truck_id ? `truck ${truck_id}` : 'truck cleared')
  if (scheduled_date !== undefined) parts.push(scheduled_date ? `date ${scheduled_date}` : 'date cleared')
  const statusNote = patch.status ? ` → status ${patch.status}` : ''
  const summary = `Assigned ${booking.customer_name || booking_id}: ${parts.join(', ')}${statusNote}`
  return { summary, data: updated }
}

// ── Executor (per-request state: role gating + assign_job cap) ──────────────

const TOOL_FNS = {
  get_jobs: getJobs,
  get_roster: getRoster,
  get_business_rules: getBusinessRules,
  assign_job: assignJob,
}

/**
 * Per-request tool executor. Holds the assign_job call counter and enforces
 * role gating server-side (defence in depth — ungranted tools are also never
 * sent to the model).
 *
 * @param {{SUPABASE_URL: string, SERVICE_KEY: string, actorId?: string, role?: string}} ctx
 * @returns {(name: string, input: object) => Promise<{summary: string, data: any}>}
 */
export function createToolExecutor(ctx) {
  const allowed = new Set(toolsForRole(ctx.role).map((t) => t.name))
  let assignCalls = 0

  return async function execute(name, input) {
    if (!TOOL_FNS[name]) throw new Error(`Unknown tool: ${name}`)
    if (!allowed.has(name)) {
      throw new Error(
        name === 'assign_job'
          ? 'Permission denied: only owner, manager or fleet_manager can assign jobs'
          : `Permission denied for tool ${name}`
      )
    }
    if (name === 'assign_job') {
      assignCalls += 1
      if (assignCalls > ASSIGN_JOB_CAP) {
        throw new Error(`assign_job cap reached: max ${ASSIGN_JOB_CAP} assignments per request`)
      }
    }
    return TOOL_FNS[name]({
      SUPABASE_URL: ctx.SUPABASE_URL,
      SERVICE_KEY: ctx.SERVICE_KEY,
      actorId: ctx.actorId,
    }, input || {})
  }
}

/**
 * Run one tool call, converting any thrown error into an is_error tool result
 * instead of failing the whole request.
 *
 * @returns {Promise<{summary: string, content: string, is_error: boolean}>}
 *   content — string to send back as the tool_result content
 *   summary — short human-readable line for the UI tool event
 */
export async function runToolSafe(executor, name, input) {
  try {
    const { summary, data } = await executor(name, input)
    return { summary, content: JSON.stringify({ summary, data }), is_error: false }
  } catch (err) {
    const message = err?.message || 'Tool execution failed'
    return { summary: message, content: `Error: ${message}`, is_error: true }
  }
}
