import { supabase } from '../lib/supabase'

/**
 * Today's date in Melbourne local time as YYYY-MM-DD.
 * ADR-708 risk #2: UTC dates roll over at 10/11am Melbourne — using UTC
 * would re-lock the checklist gate (and empty the job queue) mid-shift.
 * en-CA locale formats as ISO YYYY-MM-DD.
 */
function melbourneToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Melbourne',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

// Active driver-queue statuses — drivers should see jobs in any of
// these states. Includes the v1 state-machine additions (en_route,
// arrived) plus legacy values still in flight.
const ACTIVE_DRIVER_STATUSES = [
  'pending', 'confirmed', 'scheduled',
  'en_route', 'arrived', 'in_progress',
]

/** Fetch today's jobs for a driver (or all scheduled jobs for today) */
export async function getTodayJobs(driverId = null) {
  const today = melbourneToday() // UTC would target yesterday before ~10-11am AEST
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('scheduled_date', today)
    .in('status', ACTIVE_DRIVER_STATUSES)
    .order('scheduled_date', { ascending: true })

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/** Fetch jobs for a specific driver for today + upcoming unfinished */
export async function getDriverJobs(driverId) {
  const today = melbourneToday() // UTC would target yesterday before ~10-11am AEST
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`driver_id.eq.${driverId},driver_name_assigned.is.null`)
    .gte('scheduled_date', today)
    .in('status', ACTIVE_DRIVER_STATUSES)
    .order('scheduled_date', { ascending: true })
    .limit(20)

  if (error) throw error
  return data || []
}

/** Record a job event (start/complete with GPS) */
export async function recordJobEvent({ bookingId, eventType, driverId, lat, lng, accuracyM, notes }) {
  const { data, error } = await supabase
    .from('job_events')
    .insert({
      booking_id: bookingId,
      event_type: eventType,
      driver_id: driverId,
      lat: lat || null,
      lng: lng || null,
      accuracy_m: accuracyM || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Update booking status (start_job → in_progress, complete_job → completed) */
export async function updateJobStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Update actual job costs on a booking */
export async function updateJobActualCosts(bookingId, { actualFuel, actualTipFee, actualDriverTime, actualTotalCost }) {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      actual_fuel: actualFuel,
      actual_tip_fee: actualTipFee,
      actual_driver_time: actualDriverTime,
      actual_total_cost: actualTotalCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .select()
    .single()

  if (error) throw error
  return data
}

/** Upload a job photo to Supabase Storage and record in job_photos table */
export async function uploadJobPhoto({ bookingId, photoType, file, uploadedBy, notes }) {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${bookingId}/${photoType}_${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('job-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (uploadError) throw uploadError

  const { data: { publicUrl } } = supabase.storage
    .from('job-photos')
    .getPublicUrl(path)

  const { data, error } = await supabase
    .from('job_photos')
    .insert({
      booking_id: bookingId,
      photo_type: photoType,
      storage_path: path,
      photo_url: publicUrl,
      uploaded_by: uploadedBy,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Get all photos for a booking */
export async function getJobPhotos(bookingId) {
  const { data, error } = await supabase
    .from('job_photos')
    .select('*')
    .eq('booking_id', bookingId)
    .order('uploaded_at', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Check whether a booking has at least one delivery photo.
 * Used by JobCard to gate the "Mark Complete" button.
 * Returns false on any error (fail-closed — driver must take a photo).
 */
export async function hasDeliveryPhoto(bookingId) {
  try {
    const { data, error } = await supabase
      .from('job_photos')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('photo_type', 'delivery')
      .limit(1)
    if (error) return false
    return (data || []).length > 0
  } catch {
    return false
  }
}

// The 10 pre-start checklist items — key → vehicle_checklists boolean column.
// Single source of truth for both the UI (labels live in VehicleChecklist.jsx)
// and the submit validation below.
export const CHECKLIST_ITEMS = Object.freeze({
  tyres:            'tyres_ok',
  lights:           'lights_ok',
  hydraulics:       'hydraulics_ok',
  brakes:           'brakes_ok',
  mirrors:          'mirrors_ok',
  seatbelt:         'seatbelt_ok',
  fireExtinguisher: 'fire_extinguisher_ok',
  firstAid:         'first_aid_ok',
  waterFuel:        'water_fuel_ok',
  loadRestraints:   'load_restraints_ok',
})

/**
 * Active truck roster for the checklist truck selector.
 * Returns [] on any error (UI falls back to free-text input — the
 * pre-shift gate must never deadlock on missing fleet data).
 */
export async function getActiveTrucks() {
  try {
    const { data, error } = await supabase
      .from('fleet_assets')
      .select('id, identifier, description, registration')
      .eq('asset_type', 'truck')
      .eq('is_active', true)
      .order('identifier', { ascending: true })
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

/**
 * Rules-engine lookup: does a FAILED checklist block the shift?
 * Reads business_rules rule_key 'checklist_block_shift'.
 * Safety category — fails CLOSED: missing table/row/error → true (block).
 * Only an explicit enabled rule with value === false relaxes to warn mode.
 */
export async function getChecklistBlockShiftRule() {
  try {
    const { data, error } = await supabase
      .from('business_rules')
      .select('rule_key, value, enabled')
      .eq('rule_key', 'checklist_block_shift')
      .limit(1)
    if (error || !data || data.length === 0) return true
    const row = data[0]
    if (!row.enabled) return true // disabled rule → safety default
    const v = row.value
    if (typeof v === 'boolean') return v
    if (v && typeof v === 'object' && typeof v.value === 'boolean') return v.value
    return true
  } catch {
    return true
  }
}

/**
 * Submit vehicle pre-start checklist.
 *
 * `answers` maps each CHECKLIST_ITEMS key to 'pass' | 'fail' — an
 * unanswered item is NOT a fail, it is invalid input. Throws unless:
 *  - all 10 items are answered 'pass' or 'fail'
 *  - truckId is present (non-empty)
 *  - every 'fail' carries a note in failNotes (≥ 5 chars)
 * (Defence in depth against any UI bypass — AC7.2.5.)
 *
 * On any FAIL, a defect record is also written to hazard_reports
 * (hazard_type 'other', best-effort) so the fleet manager sees it.
 */
export async function submitChecklist({ driverId, truckId, answers = {}, failNotes = {}, notes }) {
  if (!driverId) throw new Error('Checklist rejected: missing driver id')

  const truck = (truckId || '').trim()
  if (!truck) throw new Error('Checklist rejected: truck must be selected')

  const keys = Object.keys(CHECKLIST_ITEMS)
  const unanswered = keys.filter(k => answers[k] !== 'pass' && answers[k] !== 'fail')
  if (unanswered.length > 0) {
    throw new Error(`Checklist rejected: ${unanswered.length} item(s) unanswered (${unanswered.join(', ')})`)
  }

  const failedKeys = keys.filter(k => answers[k] === 'fail')
  const missingNotes = failedKeys.filter(k => !(failNotes[k] || '').trim() || (failNotes[k] || '').trim().length < 5)
  if (missingNotes.length > 0) {
    throw new Error(`Checklist rejected: failed item(s) need a note of at least 5 characters (${missingNotes.join(', ')})`)
  }

  // Compose notes: per-item defect notes + general notes (no per-item columns in schema)
  const noteParts = []
  if (failedKeys.length > 0) {
    noteParts.push('DEFECTS: ' + failedKeys.map(k => `${k}: ${(failNotes[k] || '').trim()}`).join(' | '))
  }
  if ((notes || '').trim()) noteParts.push((notes || '').trim())

  const row = {
    driver_id: driverId,
    truck_id: truck,
    check_date: new Date().toISOString().slice(0, 10),
    notes: noteParts.length > 0 ? noteParts.join('\n') : null,
  }
  for (const [key, column] of Object.entries(CHECKLIST_ITEMS)) {
    row[column] = answers[key] === 'pass'
  }

  const { data, error } = await supabase
    .from('vehicle_checklists')
    .insert(row)
    .select()
    .single()

  if (error) throw error

  // Defect record for fleet manager visibility — best-effort, never blocks
  // the checklist save (the checklist row itself is the source of truth).
  if (failedKeys.length > 0) {
    try {
      await supabase.from('hazard_reports').insert({
        reported_by: driverId,
        hazard_type: 'other',
        description:
          `VEHICLE DEFECT — pre-start checklist failed (truck ${truck}). ` +
          failedKeys.map(k => `${k}: ${(failNotes[k] || '').trim()}`).join('; '),
        status: 'open',
      })
    } catch {
      /* non-fatal */
    }
  }

  return data
}

/**
 * Today's checklist row for a driver (latest if multiple), or null.
 * Returns the full row INCLUDING the generated `passed` column —
 * callers must gate on `row.passed === true`, not mere row existence.
 */
export async function getTodayChecklist(driverId) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('vehicle_checklists')
    .select('*')
    .eq('driver_id', driverId)
    .eq('check_date', today)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return null
  return data?.[0] || null
}

/** Submit a hazard report */
export async function submitHazardReport({ bookingId, reportedBy, hazardType, description, lat, lng, address, photoUrl }) {
  const { data, error } = await supabase
    .from('hazard_reports')
    .insert({
      booking_id: bookingId || null,
      reported_by: reportedBy,
      hazard_type: hazardType,
      description,
      lat: lat || null,
      lng: lng || null,
      address: address || null,
      photo_url: photoUrl || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Fetch jobs with biggest cost variances (for dashboard widget) */
export async function getJobCostVariances(limit = 10) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, customer_name, address, bin_size, scheduled_date, status,
      estimated_fuel, estimated_tip_fee, estimated_driver_time,
      actual_fuel, actual_tip_fee, actual_driver_time, actual_total_cost,
      price
    `)
    .not('actual_total_cost', 'is', null)
    .not('price', 'is', null)
    .order('scheduled_date', { ascending: false })
    .limit(50)

  if (error) throw error

  const withVariance = (data || []).map(job => {
    const estimatedTotal =
      (job.estimated_fuel || 0) +
      (job.estimated_tip_fee || 0) +
      (job.estimated_driver_time || 0) * 45 // $45/hr driver rate
    const actualTotal = job.actual_total_cost || 0
    const variance = actualTotal - estimatedTotal
    const variancePct = estimatedTotal > 0 ? (variance / estimatedTotal) * 100 : 0
    return { ...job, estimatedTotal, actualTotal, variance, variancePct }
  })

  return withVariance
    .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))
    .slice(0, limit)
}
