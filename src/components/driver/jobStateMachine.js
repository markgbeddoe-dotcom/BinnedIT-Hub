// SkipSync driver job state machine v1
//
// Lifecycle: pending → en_route → arrived → in_progress → completed
// Terminal:  cancelled (from anywhere except completed)
//
// Pure helpers — no React, no Supabase. Used by JobCard for gating
// and tested in jobStateMachine.test.js.

export const JOB_STATES = Object.freeze({
  PENDING:     'pending',
  EN_ROUTE:    'en_route',
  ARRIVED:     'arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
})

// Backwards-compat: legacy bookings created before this migration may
// still carry 'scheduled' or 'confirmed'. Treat those as pre-en_route
// (drivable but not yet on the road) so existing rows keep working.
export const LEGACY_PRE_EN_ROUTE = ['pending', 'confirmed', 'scheduled']

// Allowed forward transitions for the driver app. Cancellation is
// modelled separately (allowed from any non-terminal state by ops, not
// by the driver, so we don't expose it here).
const FORWARD = {
  pending:     ['en_route', 'cancelled'],
  confirmed:   ['en_route', 'cancelled'],   // legacy
  scheduled:   ['en_route', 'cancelled'],   // legacy
  en_route:    ['arrived', 'cancelled'],
  arrived:     ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed:   [],
  cancelled:   [],
}

/**
 * Can the driver transition this job to `next` given current `status`?
 * Pure — does not consider gates (photo / checklist). Use
 * `nextAllowedActions()` for the gated answer.
 */
export function canTransition(status, next) {
  const allowed = FORWARD[status] || []
  return allowed.includes(next)
}

/**
 * Returns the set of driver-actionable transitions for a given job
 * status, taking the photo + checklist gates into account.
 *
 * @param {string} status              current bookings.status value
 * @param {object} opts
 * @param {boolean} opts.hasDeliveryPhoto    at least one 'delivery' photo on job_photos
 * @param {boolean} opts.checklistDoneToday  driver has submitted today's vehicle_checklist
 * @returns {{ action: string, target: string, blocked: boolean, reason?: string }[]}
 */
export function nextAllowedActions(status, opts = {}) {
  const { hasDeliveryPhoto = false, checklistDoneToday = false } = opts
  const out = []

  // pending / confirmed / scheduled → en_route
  if (LEGACY_PRE_EN_ROUTE.includes(status)) {
    out.push({ action: 'depart', target: 'en_route', blocked: false })
  }

  // en_route → arrived (requires checklist)
  if (status === 'en_route') {
    if (checklistDoneToday) {
      out.push({ action: 'mark_arrived', target: 'arrived', blocked: false })
    } else {
      out.push({
        action: 'mark_arrived',
        target: 'arrived',
        blocked: true,
        reason: 'Complete the pre-start vehicle checklist first',
      })
    }
  }

  // arrived → in_progress (no extra gate beyond the implicit "you're on site")
  if (status === 'arrived') {
    out.push({ action: 'start_job', target: 'in_progress', blocked: false })
  }

  // in_progress → completed (requires delivery photo)
  if (status === 'in_progress') {
    if (hasDeliveryPhoto) {
      out.push({ action: 'complete_job', target: 'completed', blocked: false })
    } else {
      out.push({
        action: 'complete_job',
        target: 'completed',
        blocked: true,
        reason: 'Take a delivery photo before completing',
      })
    }
  }

  return out
}

/** Convenience wrapper: is the given (status → target) move currently allowed? */
export function isActionAllowed(status, target, opts = {}) {
  const actions = nextAllowedActions(status, opts)
  const a = actions.find(x => x.target === target)
  return Boolean(a && !a.blocked)
}

/** Human label for a status — used by UI badges. */
export const STATUS_LABEL = Object.freeze({
  pending:     'Pending',
  confirmed:   'Confirmed',
  scheduled:   'Scheduled',
  en_route:    'En Route',
  arrived:     'Arrived',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
})

/** Statuses that should be visible in the active driver queue. */
export const ACTIVE_STATUSES = Object.freeze([
  'pending', 'confirmed', 'scheduled',
  'en_route', 'arrived', 'in_progress',
])
