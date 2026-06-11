import { supabase } from './supabase'

/**
 * geocode.js — WP-C (R3), ADR-702, FR7.3.4, NFR7.4.
 *
 * Nominatim (OpenStreetMap) forward geocoding with strict usage-policy
 * compliance:
 *   - max 1 request/second, enforced by a serial queue (never parallel),
 *   - identifying User-Agent header (browsers strip UA as a forbidden header
 *     and send Referer instead, which also satisfies the policy; the UA is
 *     honoured when this module runs under Node/tests),
 *   - results cached permanently on the booking row (lat/lng/geocoded_at) —
 *     an address is geocoded once per booking, ever. No bulk re-geocoding.
 *
 * Failure semantics (FR edge case — geocode fail → map omits pin, Navigate
 * still works via the raw address):
 *   - geocodeAddress: resolves {lat,lng} on success, null when Nominatim
 *     genuinely finds nothing; REJECTS on network/HTTP errors so callers can
 *     tell "not found" from "couldn't ask".
 *   - geocodeBookingIfNeeded: never throws. Caches a not-found result by
 *     stamping geocoded_at with null lat/lng (so we don't hammer Nominatim
 *     for a bad address); transient network errors leave the row untouched
 *     so a later attempt retries. Dispatch can clear geocoded_at after
 *     fixing an address to force a re-geocode.
 */

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'
export const NOMINATIM_USER_AGENT = 'SkipSync/1.0 (binnedit.com.au)'
const MIN_REQUEST_GAP_MS = 1100 // 1 req/s with margin

let queueTail = Promise.resolve()
let lastRequestAt = 0

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Forward-geocode a free-text address (Australia-biased).
 * @param {string} address
 * @returns {Promise<{lat:number,lng:number}|null>} null = address not found.
 * @throws on network / HTTP errors (transient — safe to retry later).
 */
export function geocodeAddress(address) {
  const q = (address || '').trim()
  if (!q) return Promise.resolve(null)

  const run = queueTail.then(async () => {
    const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastRequestAt = Date.now()

    const params = new URLSearchParams({
      q,
      format: 'json',
      limit: '1',
      countrycodes: 'au',
      addressdetails: '0',
    })
    const res = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_USER_AGENT,
      },
    })
    if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
    const rows = await res.json()
    if (!Array.isArray(rows) || rows.length === 0) return null
    const lat = Number(rows[0].lat)
    const lng = Number(rows[0].lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  })

  // Keep the serial queue alive even when this request fails.
  queueTail = run.catch(() => {})
  return run
}

/** Compose the geocodable address string from a booking row. */
export function bookingAddressString(booking) {
  if (!booking) return ''
  return [booking.address, booking.suburb, booking.postcode]
    .filter(Boolean)
    .map(s => String(s).trim())
    .filter(Boolean)
    .join(', ')
}

/**
 * Geocode a booking if it has no cached coordinates, and cache the result
 * on the bookings row (lat, lng, geocoded_at — migration 023).
 *
 * Null-safe: never throws. Returns {lat,lng} when coordinates are known
 * (cached or freshly geocoded), otherwise null — callers simply omit the pin.
 *
 * @param {object} booking — row with id, address/suburb/postcode, lat, lng, geocoded_at
 * @returns {Promise<{lat:number,lng:number}|null>}
 */
export async function geocodeBookingIfNeeded(booking) {
  try {
    if (!booking || !booking.id) return null

    // Already cached on the row — geocode once, ever (NFR7.4).
    if (booking.lat != null && booking.lng != null) {
      const lat = Number(booking.lat)
      const lng = Number(booking.lng)
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
    }

    // Previously attempted and not found — don't re-ask Nominatim.
    if (booking.geocoded_at) return null

    const address = bookingAddressString(booking)
    if (!address) return null

    let coords = null
    try {
      coords = await geocodeAddress(address)
    } catch {
      // Network/HTTP failure — transient. Leave the row untouched so a
      // later visit retries. Map just omits the pin for now.
      return null
    }

    // Cache result (or the definitive not-found) on the booking row.
    // Errors here (RLS, missing columns pre-migration, offline) are
    // non-fatal — we still return the coords for this render.
    const patch = coords
      ? { lat: coords.lat, lng: coords.lng, geocoded_at: new Date().toISOString() }
      : { geocoded_at: new Date().toISOString() }
    const { error: updErr } = await supabase
      .from('bookings')
      .update(patch)
      .eq('id', booking.id)
    if (updErr) {
      // Cache write failed — coords (if any) are still usable this session.
    }

    return coords
  } catch {
    return null
  }
}
