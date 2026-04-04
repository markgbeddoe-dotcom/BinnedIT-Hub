import { supabase } from '../lib/supabase'

/** Fetch today's jobs for a driver (or all scheduled jobs for today) */
export async function getTodayJobs(driverId = null) {
  const today = new Date().toISOString().slice(0, 10)
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('scheduled_date', today)
    .in('status', ['scheduled', 'in_progress', 'confirmed'])
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
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`driver_id.eq.${driverId},driver_name_assigned.is.null`)
    .gte('scheduled_date', today)
    .in('status', ['scheduled', 'in_progress', 'confirmed', 'pending'])
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

/** Submit vehicle pre-start checklist */
export async function submitChecklist({ driverId, truckId, checks, notes }) {
  const { data, error } = await supabase
    .from('vehicle_checklists')
    .insert({
      driver_id: driverId,
      truck_id: truckId || null,
      check_date: new Date().toISOString().slice(0, 10),
      tyres_ok: checks.tyres || false,
      lights_ok: checks.lights || false,
      hydraulics_ok: checks.hydraulics || false,
      brakes_ok: checks.brakes || false,
      mirrors_ok: checks.mirrors || false,
      seatbelt_ok: checks.seatbelt || false,
      fire_extinguisher_ok: checks.fireExtinguisher || false,
      first_aid_ok: checks.firstAid || false,
      water_fuel_ok: checks.waterFuel || false,
      load_restraints_ok: checks.loadRestraints || false,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Check if driver has completed today's checklist */
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
