/**
 * tipDecision.js — pure tip-vs-return ranking engine (WP-E, R4)
 * FR7.4.3 / FR7.4.4 / FR7.4.8 — ADR-703.
 *
 * PURE functions only: no React, no Supabase, no I/O. Fully unit-testable
 * (see tipDecision.test.js) with no mocks.
 *
 * Cost model per option:
 *   total = km × fuel_cost_per_km
 *         + hours × driver_cost_per_hour
 *         + tip_fee(site, waste_type, tonnes)
 *         − recycling_credit(site, waste_type, tonnes)
 *         − redeploy_saving (when the bin goes straight to a next job
 *           instead of riding back to base)
 *
 * DISTANCE APPROXIMATION (ADR-703): road distance is estimated as
 * haversine (great-circle) × CIRCUITY_FACTOR 1.3. Melbourne SE suburban
 * road networks average 1.2–1.4× crow-flies distance. This systematically
 * underestimates around Port Phillip Bay geography (a site across the bay
 * looks "close"); the tip_search_radius_km rule bounds the damage and the
 * UI labels distances as approximate. The estimateLeg() seam below is the
 * single upgrade point for real routing (OSRM /table endpoint → Valhalla →
 * Google Distance Matrix, in that order — see ADR-703 upgrade path).
 * estimateLeg may become async at that point; callers should be prepared
 * to await rankTipOptions even though it currently resolves synchronously.
 */

export const CIRCUITY_FACTOR = 1.3

// Average truck speed used to convert distance → driving time. Suburban
// arterials with a loaded skip truck; deliberately conservative. Can be
// overridden per-call via rates.avg_speed_kmh.
export const AVG_SPEED_KMH = 40

// Hardcoded fallbacks — mirror the business_rules seeds (WP-F migration 026).
// Economic rules fail to defaults (ADR-704 convention).
export const DEFAULT_RATES = {
  fuel_cost_per_km: 0.68,
  driver_cost_per_hour: 45,
  tip_search_radius_km: 25,
  redeploy_bin_savings_min: 25,
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in km between {lat, lng} points. */
export function haversineKm(a, b) {
  if (!hasCoords(a) || !hasCoords(b)) return 0
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * estimateLeg(from, to) → { km, minutes }
 * THE routing seam (ADR-703): replace this one function with an OSRM /table
 * call to upgrade every consumer from approximation to real road distances.
 */
export function estimateLeg(from, to, avgSpeedKmh = AVG_SPEED_KMH) {
  if (!hasCoords(from) || !hasCoords(to)) return { km: 0, minutes: 0 }
  const km = haversineKm(from, to) * CIRCUITY_FACTOR
  const speed = Number(avgSpeedKmh) > 0 ? Number(avgSpeedKmh) : AVG_SPEED_KMH
  return { km, minutes: (km / speed) * 60 }
}

export function hasCoords(p) {
  // null/undefined must fail — Number(null) === 0 would silently place
  // un-geocoded rows at (0,0) and corrupt every distance estimate.
  return !!p && p.lat != null && p.lng != null &&
    Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
}

/** Case-insensitive lookup in a {waste_type: $/tonne} jsonb table. */
function rateFor(table, wasteType, fallback = 0) {
  if (!table || typeof table !== 'object') return fallback
  if (wasteType != null && table[wasteType] != null) return Number(table[wasteType]) || 0
  const wanted = String(wasteType || '').toLowerCase()
  for (const key of Object.keys(table)) {
    if (key.toLowerCase() === wanted) return Number(table[key]) || 0
  }
  if (table.default != null) return Number(table.default) || 0
  return fallback
}

/** FR7.4.8 — site must be active and accept the load's waste type.
 *  Missing/empty accepted_waste_types is treated as "accepts everything"
 *  (lenient — empty config shouldn't hide every site). */
function siteAccepts(site, wasteType) {
  if (!site || site.is_active === false) return false
  const accepted = site.accepted_waste_types
  if (!Array.isArray(accepted) || accepted.length === 0) return true
  const wanted = String(wasteType || '').toLowerCase()
  return accepted.some(w => String(w).toLowerCase() === wanted)
}

const round2 = n => Math.round(n * 100) / 100

/**
 * rankTipOptions({ currentLoc, load, tipSites, nextJobs, base, rates })
 *   currentLoc : {lat, lng} — truck's position at pickup (falls back to base)
 *   load       : { waste_type, est_weight_t, bin_size }
 *   tipSites   : tip_sites rows (lat, lng, rates_per_tonne,
 *                recycling_credit_per_tonne, accepted_waste_types, is_active)
 *   nextJobs   : driver's remaining jobs today — only those with usable
 *                {lat, lng} participate in redeploy pairing
 *   base       : {lat, lng} depot
 *   rates      : overrides for DEFAULT_RATES (from business_rules)
 *
 * Returns options sorted by totalCost ascending; options[0].recommended === true.
 * Shape: { type: 'tip_then_next_job' | 'return_to_base', tipSite, nextJob?,
 *          totalCost, breakdown: { distanceKm, fuelCost, timeHrs, labourCost,
 *          tipFee, recyclingCredit, redeploySaving }, recommended, note? }
 *
 * The recommendation is ADVISORY (FR7.4.7) — callers record the driver's
 * actual choice, whatever it is.
 */
export function rankTipOptions({ currentLoc, load, tipSites, nextJobs, base, rates } = {}) {
  const r = { ...DEFAULT_RATES, ...(rates || {}) }
  const baseLoc = hasCoords(base) ? { lat: Number(base.lat), lng: Number(base.lng) } : null
  const origin = hasCoords(currentLoc)
    ? { lat: Number(currentLoc.lat), lng: Number(currentLoc.lng) }
    : baseLoc
  const weight = Number(load?.est_weight_t) > 0 ? Number(load.est_weight_t) : 1
  const wasteType = load?.waste_type || ''
  const jobs = (nextJobs || []).filter(hasCoords)

  const buildReturnToBase = note => {
    const leg = origin && baseLoc ? estimateLeg(origin, baseLoc, r.avg_speed_kmh) : { km: 0, minutes: 0 }
    const fuelCost = leg.km * r.fuel_cost_per_km
    const timeHrs = leg.minutes / 60
    const labourCost = timeHrs * r.driver_cost_per_hour
    return {
      type: 'return_to_base',
      tipSite: null,
      nextJob: null,
      totalCost: round2(fuelCost + labourCost),
      breakdown: {
        distanceKm: round2(leg.km),
        fuelCost: round2(fuelCost),
        timeHrs: round2(timeHrs),
        labourCost: round2(labourCost),
        tipFee: 0,
        recyclingCredit: 0,
        redeploySaving: 0,
      },
      recommended: false,
      ...(note ? { note } : {}),
    }
  }

  // No usable origin at all → can't rank anything meaningfully.
  if (!origin) {
    return [{ ...buildReturnToBase('no location available'), recommended: true }]
  }

  // Eligible sites: active + accepts waste type + within search radius
  // (radius is crow-flies — the cheap pre-filter; legs use circuity).
  const eligible = (tipSites || []).filter(
    s =>
      hasCoords(s) &&
      siteAccepts(s, wasteType) &&
      haversineKm(origin, s) <= r.tip_search_radius_km
  )

  // Edge case (FR7.4.x): zero eligible sites → return-to-base only, with note.
  if (eligible.length === 0) {
    return [{ ...buildReturnToBase('no eligible tip site'), recommended: true }]
  }

  const options = eligible.map(site => {
    const sitePt = { lat: Number(site.lat), lng: Number(site.lng) }
    const leg1 = estimateLeg(origin, sitePt, r.avg_speed_kmh)

    // Pair each site with the best onward next job (shortest onward leg).
    let nextJob = null
    let onward = null
    for (const job of jobs) {
      const leg = estimateLeg(sitePt, { lat: Number(job.lat), lng: Number(job.lng) }, r.avg_speed_kmh)
      if (!onward || leg.km < onward.km) {
        onward = leg
        nextJob = job
      }
    }
    // No queued jobs with coords → after tipping, the truck heads home.
    if (!onward) onward = baseLoc ? estimateLeg(sitePt, baseLoc, r.avg_speed_kmh) : { km: 0, minutes: 0 }

    const distanceKm = leg1.km + onward.km
    const fuelCost = distanceKm * r.fuel_cost_per_km
    const timeHrs = (leg1.minutes + onward.minutes) / 60
    const labourCost = timeHrs * r.driver_cost_per_hour
    const tipFee = weight * rateFor(site.rates_per_tonne, wasteType)
    const recyclingCredit = weight * rateFor(site.recycling_credit_per_tonne, wasteType)
    // Redeploy saving: bin goes tip → next job directly, saving the
    // back-to-base bin shuffle (rule: redeploy_bin_savings_min, $).
    const redeploySaving = nextJob ? Number(r.redeploy_bin_savings_min) || 0 : 0

    return {
      type: 'tip_then_next_job',
      tipSite: site,
      nextJob,
      totalCost: round2(fuelCost + labourCost + tipFee - recyclingCredit - redeploySaving),
      breakdown: {
        distanceKm: round2(distanceKm),
        fuelCost: round2(fuelCost),
        timeHrs: round2(timeHrs),
        labourCost: round2(labourCost),
        tipFee: round2(tipFee),
        recyclingCredit: round2(recyclingCredit),
        redeploySaving: round2(redeploySaving),
      },
      recommended: false,
    }
  })

  // Return-to-base is always offered, never hidden (ux-spec §4.2).
  options.push(buildReturnToBase())

  options.sort((a, b) => a.totalCost - b.totalCost)
  if (options.length > 0) options[0] = { ...options[0], recommended: true }
  return options
}
