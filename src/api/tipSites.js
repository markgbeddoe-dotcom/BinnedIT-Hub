// WP-E (R4) — client data access for tip sites + truck loads.
// Reference data for the tip-vs-return decision engine (src/lib/tipDecision.js)
// and the load-on-truck lifecycle: recordLoad() at pickup, closeLoad() when
// the driver tips. Reads fail soft (hardcoded-fallback convention) — the
// decision screen degrades to return-to-base, never crashes.

import { supabase } from '../lib/supabase'

/** Active tip sites. Returns [] when the table is missing/empty/unreadable. */
export async function getTipSites() {
  try {
    const { data, error } = await supabase
      .from('tip_sites')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

/** All sites incl. inactive — office management views. Throws on error. */
export async function getAllTipSites() {
  const { data, error } = await supabase
    .from('tip_sites')
    .select('*')
    .order('name')
  if (error) throw error
  return data || []
}

/** Owner/manager: update a site's rates/credits/hours/active flag. */
export async function updateTipSite(id, patch) {
  const { data, error } = await supabase
    .from('tip_sites')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * The driver's current open load (picked up, not yet tipped), newest first.
 * Returns null when there is none or the table is unreadable.
 */
export async function getOpenLoad(driverId) {
  if (!driverId) return null
  try {
    const { data, error } = await supabase
      .from('truck_loads')
      .select('*')
      .eq('driver_id', driverId)
      .is('tipped_at', null)
      .order('loaded_at', { ascending: false })
      .limit(1)
    if (error) return null
    return data?.[0] || null
  } catch {
    return null
  }
}

/** One row per pickup. est_weight_t may be null — engine defaults to 1 t. */
export async function recordLoad({ driverId, truckId, bookingId, binSize, wasteType, estWeightT }) {
  const { data, error } = await supabase
    .from('truck_loads')
    .insert({
      driver_id: driverId,
      truck_id: truckId || null,
      booking_id: bookingId || null,
      bin_size: binSize || null,
      waste_type: wasteType || null,
      est_weight_t: estWeightT == null || estWeightT === '' ? null : Number(estWeightT),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Close a load out at a tip site. `recycled` records whether the load went
 * to a recycling stream (drives the credit line in cost actuals).
 */
export async function closeLoad({ loadId, tipSiteId, recycled = false }) {
  const { data, error } = await supabase
    .from('truck_loads')
    .update({
      tipped_at: new Date().toISOString(),
      tip_site_id: tipSiteId || null,
      recycled: !!recycled,
    })
    .eq('id', loadId)
    .select()
    .single()
  if (error) throw error
  return data
}
