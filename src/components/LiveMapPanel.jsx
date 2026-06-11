import React, { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { geocodeBookingIfNeeded, bookingAddressString } from '../lib/geocode'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { fontHead, fontBody } from '../theme'

/**
 * LiveMapPanel — WP-C (R3), ux-spec-v7 §2, ADR-701/702, FR7.3.5/7.3.7.
 *
 * Standalone embedded live map for dispatch:
 *  - OSM tiles + mandatory attribution (ODbL licence condition — never strip),
 *  - live driver markers from `latest_driver_locations`, polled every 10 s via
 *    TanStack Query (poll pauses automatically while the tab is hidden),
 *  - staleness: >5 min → grey marker + 🕐 badge; >30 min → off the map, listed
 *    in a collapsible "Offline" row under the legend,
 *  - today's bookings as teardrop pins colour-matched to the kanban columns,
 *    with on-demand geocoding (1 req/s, cached on the booking row),
 *  - auto-fit bounds when the marker set changes + manual ⛶ Fit control,
 *  - explicit loading / empty / error states; renders sensibly when the
 *    driver_locations table is missing (Supabase error → error strip, pins
 *    still show — hardcoded-fallback convention).
 *
 * Props (all optional):
 *   bookings        array — booking rows; when omitted the panel fetches
 *                   today's bookings itself (scheduled_date = today)
 *   onSelectBooking (bookingId) => void — wired by the integrator so popup
 *                   [Open card] can jump to the kanban card
 *   height          px number — map viewport height (default 520 / 380 mobile)
 */

// ── Fix Leaflet default marker icons under Vite (known bundler issue):
//    point at CDN-hosted images instead of broken relative asset URLs.
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// ── Local dark dispatch tokens (mirrors DispatchBoard's D set — that file is
//    owned by another work package and exports nothing; do not import it).
const D = {
  bg: '#1A1A2E',
  surface: '#16213E',
  card: '#2D2D44',
  border: '#3D3D5C',
  text: '#E8E8F0',
  textSub: '#B0B0C8',
  textMuted: '#7878A0',
  accent: '#F59E0B',
}

// Kanban column palette (ux-spec §2.2 — same hues as DispatchBoard COLUMNS so
// the mental model transfers).
const PIN_COLORS = {
  pending: '#F59E0B',
  confirmed: '#F59E0B',
  scheduled: '#3B82F6',
  en_route: '#3B82F6',
  arrived: '#8B5CF6',
  in_progress: '#8B5CF6',
  completed: '#10B981',
}

const STALE_MS = 5 * 60 * 1000      // >5 min → grey + clock badge
const OFFLINE_MS = 30 * 60 * 1000   // >30 min → off map, into Offline list
const STALE_GREY = '#8A8AA3'
const MELBOURNE_SE_CENTER = [-38.1, 145.13] // Seaford
const MAX_GEOCODES_PER_MOUNT = 15

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function minutesAgo(ts, now) {
  return Math.max(0, Math.round((now - new Date(ts).getTime()) / 60000))
}

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function todayLocalISO() {
  // Local (Melbourne) calendar date, YYYY-MM-DD — never UTC (risk-register #2).
  return new Date().toLocaleDateString('en-CA')
}

// ── Driver marker: rotated heading arrow + name·truck pill (FR7.3.7) ──
function driverDivIcon({ name, truckId, heading, color, staleMins }) {
  const rot = Number.isFinite(Number(heading)) ? Number(heading) : 0
  const label = escapeHtml([name || 'Driver', truckId].filter(Boolean).join(' · '))
  const badge = staleMins != null
    ? `<span style="margin-left:4px;background:${STALE_GREY}33;border-radius:3px;padding:0 3px;">🕐 ${staleMins}m</span>`
    : ''
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;width:150px;">
      <div style="background:#0D0D1A;color:${staleMins != null ? STALE_GREY : '#fff'};border:1px solid ${staleMins != null ? STALE_GREY : D.accent};border-radius:6px;padding:2px 7px;font-family:${fontBody};font-size:11px;font-weight:600;white-space:nowrap;max-width:146px;overflow:hidden;text-overflow:ellipsis;">${label}${badge}</div>
      <div style="transform:rotate(${rot}deg);font-size:24px;line-height:1;color:${color};text-shadow:0 1px 3px rgba(0,0,0,0.7);">▲</div>
    </div>`
  return L.divIcon({
    className: 'ss-driver-marker',
    html,
    iconSize: [150, 48],
    iconAnchor: [75, 44],
    popupAnchor: [0, -44],
  })
}

// ── Job pin: CSS teardrop colour-coded by status ──
function jobPinDivIcon(color, { faded = false } = {}) {
  const size = faded ? 14 : 18
  const html = `
    <div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;opacity:${faded ? 0.6 : 1};box-shadow:0 1px 4px rgba(0,0,0,0.5);"></div>`
  return L.divIcon({
    className: 'ss-job-pin',
    html,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, size + 4],
    popupAnchor: [0, -(size + 4)],
  })
}

// ── Auto-fit bounds when the SET of markers changes (not on every GPS tick,
//    which would fight the dispatcher's panning) ──
function AutoFit({ map, points }) {
  const keyRef = useRef('')
  useEffect(() => {
    if (!map || points.length === 0) return
    const key = points.map(p => p.key).sort().join('|')
    if (key === keyRef.current) return
    keyRef.current = key
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]))
    map.fitBounds(bounds.pad(0.2), { maxZoom: 14 })
  }, [map, points])
  return null
}

export default function LiveMapPanel({ bookings: bookingsProp, onSelectBooking, height }) {
  const { isMobile } = useBreakpoint()
  const mapHeight = height || (isMobile ? 380 : 520)
  const [map, setMap] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [showOffline, setShowOffline] = useState(false)
  const [showUnpinned, setShowUnpinned] = useState(false)
  const [geoCache, setGeoCache] = useState({}) // bookingId -> {lat,lng} from this session
  const geoAttempted = useRef(new Set())
  const todayStr = todayLocalISO()

  // Recompute staleness every 30 s without waiting for a poll.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // ── Live driver positions: 10 s poll (pauses while tab hidden — TanStack
  //    refetchIntervalInBackground defaults false; battery/quota courtesy) ──
  const driversQuery = useQuery({
    queryKey: ['latest-driver-locations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('latest_driver_locations').select('*')
      if (error) throw error
      return data || []
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    retry: 1,
  })
  // On error TanStack keeps the last successful data — last-known markers stay
  // on the map and age into grey naturally (ux-spec §2.2 error state).
  const driverRows = driversQuery.data || []

  // ── Today's bookings: use the prop when given, else self-fetch ──
  const bookingsQuery = useQuery({
    queryKey: ['live-map-bookings', todayStr],
    enabled: !bookingsProp,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, customer_name, address, suburb, postcode, bin_size, waste_type, status, scheduled_date, driver_name, driver_name_assigned, driver_id, lat, lng, geocoded_at')
        .eq('scheduled_date', todayStr)
        .neq('status', 'cancelled')
      if (error) throw error
      return data || []
    },
    refetchInterval: 60000,
  })
  const sourceBookings = bookingsProp || bookingsQuery.data || []

  // Today's jobs only: scheduled for today, or live right now regardless of date.
  const todayBookings = useMemo(() => (
    sourceBookings.filter(b =>
      b && b.status !== 'cancelled' &&
      (b.scheduled_date === todayStr || ['en_route', 'arrived', 'in_progress'].includes(b.status))
    )
  ), [sourceBookings, todayStr])

  // ── Geocode-on-demand for today's un-geocoded bookings (1 req/s via the
  //    serial queue inside geocode.js; capped per mount per Nominatim policy) ──
  useEffect(() => {
    let cancelled = false
    const candidates = todayBookings
      .filter(b =>
        b.lat == null && b.lng == null && !b.geocoded_at &&
        !geoAttempted.current.has(b.id) && !geoCache[b.id] &&
        bookingAddressString(b)
      )
      .slice(0, MAX_GEOCODES_PER_MOUNT)
    if (candidates.length === 0) return undefined
    candidates.forEach(b => geoAttempted.current.add(b.id))
    ;(async () => {
      for (const b of candidates) {
        const coords = await geocodeBookingIfNeeded(b)
        if (cancelled) return
        if (coords) setGeoCache(prev => ({ ...prev, [b.id]: coords }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayBookings])

  // ── Classify drivers by data age ──
  const { liveDrivers, offlineDrivers } = useMemo(() => {
    const live = []
    const offline = []
    for (const d of driverRows) {
      const lat = Number(d.lat)
      const lng = Number(d.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      const age = now - new Date(d.recorded_at).getTime()
      const row = { ...d, lat, lng, age }
      if (age > OFFLINE_MS) offline.push(row)
      else live.push(row)
    }
    return { liveDrivers: live, offlineDrivers: offline }
  }, [driverRows, now])

  // ── Resolve booking pin positions (row cache or session geocode) ──
  const { pinnedBookings, unpinnedBookings } = useMemo(() => {
    const pinned = []
    const unpinned = []
    for (const b of todayBookings) {
      let lat = b.lat != null ? Number(b.lat) : null
      let lng = b.lng != null ? Number(b.lng) : null
      if ((lat == null || lng == null) && geoCache[b.id]) {
        lat = geoCache[b.id].lat
        lng = geoCache[b.id].lng
      }
      if (Number.isFinite(lat) && Number.isFinite(lng)) pinned.push({ ...b, lat, lng })
      else unpinned.push(b)
    }
    return { pinnedBookings: pinned, unpinnedBookings: unpinned }
  }, [todayBookings, geoCache])

  const fitPoints = useMemo(() => ([
    ...liveDrivers.map(d => ({ key: `d:${d.driver_id}`, lat: d.lat, lng: d.lng })),
    ...pinnedBookings.map(b => ({ key: `b:${b.id}`, lat: b.lat, lng: b.lng })),
  ]), [liveDrivers, pinnedBookings])

  const fitNow = () => {
    if (!map || fitPoints.length === 0) return
    map.fitBounds(L.latLngBounds(fitPoints.map(p => [p.lat, p.lng])).pad(0.2), { maxZoom: 14 })
  }

  const bookingById = useMemo(() => {
    const m = {}
    for (const b of sourceBookings) m[b.id] = b
    return m
  }, [sourceBookings])

  const noDriversEver = !driversQuery.isLoading && !driversQuery.isError &&
    liveDrivers.length === 0 && offlineDrivers.length === 0

  function driverStatus(d) {
    if (d.age > STALE_MS) {
      return { color: STALE_GREY, word: `Last seen ${minutesAgo(d.recorded_at, now)} min ago`, staleMins: minutesAgo(d.recorded_at, now) }
    }
    const speed = Number(d.speed_kmh)
    if (Number.isFinite(speed) && speed >= 8) return { color: '#3B82F6', word: 'Moving', staleMins: null }
    if (d.booking_id) return { color: '#F59E0B', word: 'On job', staleMins: null }
    return { color: D.textSub, word: 'Idle', staleMins: null }
  }

  function assignedLabel(b) {
    return b.driver_name_assigned || b.driver_name || null
  }

  return (
    <div data-testid="live-map-panel" style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 12, overflow: 'hidden', fontFamily: fontBody }}>
      {/* ── Error strip (non-blocking; auto-retry via TanStack) ── */}
      {driversQuery.isError && (
        <div data-testid="live-map-error" style={{
          background: '#3A2A12', borderBottom: `1px solid ${D.accent}`,
          color: '#FFC75A', fontSize: 12, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span aria-hidden="true">⚠</span> Live positions unavailable — retrying…
        </div>
      )}

      {/* ── Map viewport ── */}
      <div style={{ position: 'relative', height: mapHeight }}>
        <MapContainer
          center={MELBOURNE_SE_CENTER}
          zoom={11}
          style={{ height: '100%', width: '100%', background: '#0D0D1A' }}
          ref={setMap}
          scrollWheelZoom
        >
          {/* ODbL licence condition: OSM attribution must stay (ADR-702). */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <AutoFit map={map} points={fitPoints} />

          {/* Live + stale (<30 min) driver markers */}
          {liveDrivers.map(d => {
            const st = driverStatus(d)
            const job = d.booking_id ? bookingById[d.booking_id] : null
            return (
              <Marker
                key={`drv-${d.driver_id}`}
                position={[d.lat, d.lng]}
                icon={driverDivIcon({
                  name: d.full_name,
                  truckId: d.truck_id,
                  heading: d.heading,
                  color: st.color,
                  staleMins: st.staleMins,
                })}
                zIndexOffset={500}
              >
                <Popup>
                  <div style={{ fontFamily: fontBody, fontSize: 13, minWidth: 180 }}>
                    <div style={{ fontFamily: fontHead, fontSize: 15, fontWeight: 700 }}>
                      {d.full_name || 'Driver'}{d.truck_id ? ` · ${d.truck_id}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}>{st.word}</div>
                    {Number.isFinite(Number(d.speed_kmh)) && (
                      <div>Speed: {Math.round(Number(d.speed_kmh))} km/h</div>
                    )}
                    <div>Last seen: {minutesAgo(d.recorded_at, now)} min ago — {fmtTime(d.recorded_at)}</div>
                    <div style={{ marginTop: 4 }}>
                      Job: {job ? `${job.customer_name}${job.suburb ? ` (${job.suburb})` : ''}` : '—'}
                    </div>
                    {job && onSelectBooking && (
                      <button
                        data-testid="live-map-view-job"
                        onClick={() => onSelectBooking(job.id)}
                        style={{
                          marginTop: 8, minHeight: 32, padding: '4px 12px', cursor: 'pointer',
                          background: D.accent, color: '#0A0A0A', border: 'none', borderRadius: 6,
                          fontFamily: fontHead, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}
                      >
                        View job
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

          {/* Today's job pins */}
          {pinnedBookings.map(b => {
            const color = PIN_COLORS[b.status] || '#999'
            const done = b.status === 'completed'
            return (
              <Marker
                key={`job-${b.id}`}
                position={[b.lat, b.lng]}
                icon={jobPinDivIcon(color, { faded: done })}
              >
                <Popup>
                  <div style={{ fontFamily: fontBody, fontSize: 13, minWidth: 180 }}>
                    <div style={{ fontFamily: fontHead, fontSize: 15, fontWeight: 700 }}>{b.customer_name}</div>
                    <div style={{ marginTop: 4 }}>
                      {[b.bin_size, b.waste_type].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div>{bookingAddressString(b) || 'No address'}</div>
                    <div style={{ marginTop: 4 }}>
                      {assignedLabel(b)
                        ? <>👤 {assignedLabel(b)}</>
                        : <span style={{ color: '#B45309', fontWeight: 700 }}>⚠ Unassigned</span>}
                    </div>
                    {onSelectBooking && (
                      <button
                        data-testid="live-map-open-card"
                        onClick={() => onSelectBooking(b.id)}
                        style={{
                          marginTop: 8, minHeight: 32, padding: '4px 12px', cursor: 'pointer',
                          background: D.accent, color: '#0A0A0A', border: 'none', borderRadius: 6,
                          fontFamily: fontHead, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}
                      >
                        Open card
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>

        {/* Manual fit-bounds control (44px tap target) */}
        <button
          data-testid="live-map-fit"
          onClick={fitNow}
          title="Fit map to all markers"
          aria-label="Fit map to all markers"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 1000,
            minWidth: 44, minHeight: 44, cursor: 'pointer',
            background: '#0D0D1A', color: D.text, border: `1px solid ${D.border}`,
            borderRadius: 8, fontSize: 18,
          }}
        >
          ⛶
        </button>

        {/* Loading chip — tiles render immediately, positions chip top-centre */}
        {driversQuery.isLoading && (
          <div data-testid="live-map-loading" style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
            background: '#0D0D1A', color: D.textSub, border: `1px solid ${D.border}`,
            borderRadius: 16, padding: '6px 14px', fontSize: 12,
          }}>
            Loading live positions…
          </div>
        )}

        {/* Empty state — friendly overlay; job pins still show underneath */}
        {noDriversEver && (
          <div data-testid="live-map-empty" style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 1000, pointerEvents: 'none',
            background: '#0D0D1AEE', border: `1px solid ${D.border}`, borderRadius: 12,
            padding: '18px 22px', maxWidth: 320, textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, marginBottom: 6 }} aria-hidden="true">🛰</div>
            <div style={{ color: D.text, fontFamily: fontHead, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              No live drivers
            </div>
            <div style={{ color: D.textSub, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              Driver app publishes location during shifts.
            </div>
          </div>
        )}
      </div>

      {/* ── Legend strip + offline list + ungeocoded banner ── */}
      <div data-testid="live-map-legend" style={{ padding: '10px 14px', borderTop: `1px solid ${D.border}`, background: D.surface }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', fontSize: 11, color: D.textSub }}>
          {[['#F59E0B', 'Pending'], ['#3B82F6', 'Scheduled'], ['#8B5CF6', 'In Prog'], ['#10B981', 'Done']].map(([c, label]) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} aria-hidden="true" />
              {label}
            </span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: D.accent }} aria-hidden="true">▲</span> Driver
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: STALE_GREY }} aria-hidden="true">▲</span> Stale &gt;5m
          </span>
        </div>

        {/* Offline (>30 min) drivers — facts on the map stay reachable as text */}
        {offlineDrivers.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button
              data-testid="live-map-offline-toggle"
              onClick={() => setShowOffline(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
                color: D.textSub, fontSize: 12, minHeight: 32,
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: fontBody,
              }}
            >
              <span aria-hidden="true">{showOffline ? '▾' : '▸'}</span>
              Offline ({offlineDrivers.length})
            </button>
            {showOffline && (
              <div style={{ paddingLeft: 16 }}>
                {offlineDrivers.map(d => (
                  <div key={d.driver_id} style={{ color: D.textSub, fontSize: 12, padding: '3px 0' }}>
                    🕐 {d.full_name || 'Driver'}{d.truck_id ? ` · ${d.truck_id}` : ''} — last seen {minutesAgo(d.recorded_at, now)} min ago ({fmtTime(d.recorded_at)})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Jobs without coordinates yet (geocode pending/failed) */}
        {unpinnedBookings.length > 0 && (
          <div data-testid="live-map-ungeocoded" style={{
            marginTop: 8, background: '#3A2A1222', border: '1px solid #F59E0B',
            borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#FFC75A',
          }}>
            <button
              onClick={() => setShowUnpinned(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: '#FFC75A', fontSize: 12, fontFamily: fontBody, minHeight: 28,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span aria-hidden="true">⚠</span>
              {unpinnedBookings.length} job{unpinnedBookings.length === 1 ? '' : 's'} not on map yet (no geocode)
              <span style={{ textDecoration: 'underline' }}>{showUnpinned ? 'hide list' : 'show list'}</span>
            </button>
            {showUnpinned && (
              <div style={{ marginTop: 6, paddingLeft: 18 }}>
                {unpinnedBookings.map(b => (
                  <div key={b.id} style={{ padding: '2px 0', color: D.textSub }}>
                    {b.customer_name}{b.suburb ? ` — ${b.suburb}` : ''}{!bookingAddressString(b) ? ' (no address)' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
