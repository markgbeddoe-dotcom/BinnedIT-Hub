import React from 'react'
import { B, fontHead } from '../../theme'

/**
 * NavigateButton — Google Maps directions deep link (WP-C, R3, FR7.3.6).
 * The Uber-style turn-by-turn handoff used by real driver apps: we never
 * render in-app turn-by-turn, we hand the destination to the phone's maps app.
 *
 * Destination precedence: lat/lng when both are usable (geocoded bookings,
 * tip sites), otherwise the address string. Renders nothing when neither
 * exists — callers don't need to guard.
 */
export default function NavigateButton({ lat, lng, address, label = '📍 Navigate', compact = false, testId }) {
  // null/undefined must fail the check — Number(null) === 0 would otherwise
  // send drivers to (0,0) for every un-geocoded booking.
  const hasCoords = lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  const destination = hasCoords ? `${Number(lat)},${Number(lng)}` : (address || '').trim()
  if (!destination) return null

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testId || 'navigate-button'}
      style={{
        display: 'block', width: '100%',
        padding: compact ? '10px 14px' : '16px',
        background: compact ? 'none' : B.blue,
        color: compact ? B.blue : B.white,
        border: compact ? `1px solid ${B.blue}` : 'none',
        borderRadius: 8,
        fontSize: compact ? 14 : 18, fontFamily: fontHead, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        textAlign: 'center', textDecoration: 'none',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </a>
  )
}
