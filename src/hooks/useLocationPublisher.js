import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useLocationPublisher — WP-C (R3), ADR-701, FR7.3.3, NFR7.1/7.3.
 *
 * Wraps navigator.geolocation.watchPosition and publishes throttled inserts
 * into `driver_locations` (migration 023) while BOTH:
 *   1. `enabled` is true (shift active — checklist passed; caller decides), AND
 *   2. the driver has granted location consent (`profiles.location_consent_at`).
 *
 * Throttle rules (ADR-701):
 *   - never insert more often than every 15 s,
 *   - AND only when moved ≥ 25 m since the last insert (suppresses stationary
 *     noise) — with a 4-minute stationary heartbeat so a parked-but-online
 *     driver doesn't false-grey on the dispatch map (stale threshold is 5 min),
 *   - fixes with accuracy worse than 100 m are dropped (cell-tower junk).
 *
 * Battery courtesy: the watcher stops while the tab is hidden and restarts on
 * return (browsers suspend backgrounded PWAs anyway — documented PRD edge case).
 *
 * Returns { publishing, lastFix, error, consentGiven, grantConsent }
 *   publishing   boolean — watcher currently running and allowed to insert
 *   lastFix      { lat, lng, accuracyM, heading, speedKmh, at } | null
 *   error        human-readable string | null (insert failures are non-fatal)
 *   consentGiven null while loading, then boolean
 *   grantConsent async () => boolean — writes location_consent_at to own profile
 *
 * Usage (integrator wires into DriverApp after WP-B lands):
 *   const { publishing, consentGiven, grantConsent, error } = useLocationPublisher({
 *     enabled: checklistPassed,          // shift active
 *     driverId: session.user.id,
 *     truckId: todayChecklist?.truck_id, // optional
 *     bookingId: currentJobId,           // optional
 *   })
 */

export const MIN_PUBLISH_INTERVAL_MS = 15 * 1000
export const MIN_PUBLISH_DISTANCE_M = 25
export const MAX_ACCURACY_M = 100
export const STATIONARY_HEARTBEAT_MS = 4 * 60 * 1000

/** Great-circle distance in metres (good enough for a 25 m gate). */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)))
}

export function useLocationPublisher({
  enabled = false,
  driverId = null,
  truckId = null,
  bookingId = null,
  highAccuracy = true,
} = {}) {
  const [publishing, setPublishing] = useState(false)
  const [lastFix, setLastFix] = useState(null)
  const [error, setError] = useState(null)
  const [consentGiven, setConsentGiven] = useState(null) // null = loading

  // Per-job context can change without restarting the GPS watcher.
  const metaRef = useRef({ driverId, truckId, bookingId })
  metaRef.current = { driverId, truckId, bookingId }

  const lastInsertRef = useRef({ t: 0, lat: null, lng: null })

  // ── Load consent state from own profile (RLS: own-row read is allowed) ──
  useEffect(() => {
    let cancelled = false
    if (!driverId) { setConsentGiven(false); return undefined }
    supabase
      .from('profiles')
      .select('location_consent_at')
      .eq('id', driverId)
      .maybeSingle()
      .then(({ data, error: readErr }) => {
        if (cancelled) return
        // Column missing (migration not applied) or read failure → treat as
        // no consent: fail closed, never publish.
        if (readErr) { setConsentGiven(false); return }
        setConsentGiven(Boolean(data && data.location_consent_at))
      })
    return () => { cancelled = true }
  }, [driverId])

  // ── ADR-701 consent gate: first-use consent writes location_consent_at ──
  const grantConsent = useCallback(async () => {
    const id = metaRef.current.driverId
    if (!id) return false
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ location_consent_at: new Date().toISOString() })
      .eq('id', id)
    if (updErr) {
      setError('Could not save consent — check connection and try again')
      return false
    }
    setError(null)
    setConsentGiven(true)
    return true
  }, [])

  // ── Watcher lifecycle ──
  useEffect(() => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : null
    const active = enabled && consentGiven === true && Boolean(driverId) && Boolean(geo)
    if (!active) {
      setPublishing(false)
      if (enabled && consentGiven === true && !geo) {
        setError('Location not supported on this device/browser')
      }
      return undefined
    }

    let watchId = null
    let denied = false

    const stopWatch = () => {
      if (watchId != null) { geo.clearWatch(watchId); watchId = null }
    }

    const handleFix = (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords
      const fix = {
        lat: latitude,
        lng: longitude,
        accuracyM: accuracy != null && Number.isFinite(accuracy) ? Math.round(accuracy * 100) / 100 : null,
        heading: heading != null && Number.isFinite(heading) ? Math.round(heading * 10) / 10 : null,
        // geolocation speed is m/s; store km/h to one decimal
        speedKmh: speed != null && Number.isFinite(speed) && speed >= 0 ? Math.round(speed * 36) / 10 : null,
        at: Date.now(),
      }
      setLastFix(fix)

      // Accuracy gate — don't pollute the map with cell-tower fixes.
      if (fix.accuracyM != null && fix.accuracyM > MAX_ACCURACY_M) return

      // Throttle: ≥15 s since last insert, AND ≥25 m moved (or heartbeat due).
      const last = lastInsertRef.current
      const elapsed = fix.at - last.t
      if (elapsed < MIN_PUBLISH_INTERVAL_MS) return
      if (last.lat != null) {
        const moved = haversineMeters(last.lat, last.lng, fix.lat, fix.lng)
        if (moved < MIN_PUBLISH_DISTANCE_M && elapsed < STATIONARY_HEARTBEAT_MS) return
      }

      lastInsertRef.current = { t: fix.at, lat: fix.lat, lng: fix.lng }
      const meta = metaRef.current
      supabase
        .from('driver_locations')
        .insert({
          driver_id: meta.driverId,
          truck_id: meta.truckId || null,
          booking_id: meta.bookingId || null,
          lat: fix.lat,
          lng: fix.lng,
          heading: fix.heading,
          speed_kmh: fix.speedKmh,
          accuracy_m: fix.accuracyM,
        })
        .then(({ error: insertErr }) => {
          // Non-fatal (table missing / offline): keep watching, surface message.
          if (insertErr) setError('Could not publish location — will keep retrying')
          else setError(null)
        })
    }

    const handleGeoError = (err) => {
      if (err && err.code === 1) {
        // PERMISSION_DENIED — won't recover within this session; stop cleanly.
        denied = true
        stopWatch()
        setPublishing(false)
        setError('Location permission denied — jobs still work, but dispatch cannot see your position. Enable location for this site in your phone settings.')
      } else {
        // POSITION_UNAVAILABLE / TIMEOUT — transient; watcher keeps trying.
        setError('Waiting for GPS signal…')
      }
    }

    const startWatch = () => {
      if (watchId != null || denied) return
      watchId = geo.watchPosition(handleFix, handleGeoError, {
        enableHighAccuracy: Boolean(highAccuracy),
        maximumAge: 5000,
        timeout: 30000,
      })
      setPublishing(true)
    }

    const handleVisibility = () => {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'hidden') {
        stopWatch()
        setPublishing(false)
      } else {
        startWatch()
        if (watchId != null) setPublishing(true)
      }
    }

    startWatch()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
      stopWatch()
      setPublishing(false)
    }
  }, [enabled, consentGiven, driverId, highAccuracy])

  return { publishing, lastFix, error, consentGiven, grantConsent }
}

export default useLocationPublisher
