import React, { useEffect, useState } from 'react'
import { B, fontHead } from '../../theme'
import { rankTipOptions, DEFAULT_RATES } from '../../lib/tipDecision'
import { getTipSites, getOpenLoad, recordLoad, closeLoad } from '../../api/tipSites'
import { getRule } from '../../api/rules'
import { getTodayJobs } from '../../api/driver'
import NavigateButton from './NavigateButton'

// PLACEHOLDER — integrator/Mark: replace with the real depot coordinates
// (or read from platform_settings). Seaford yard approximation.
const BASE_LOCATION = { lat: -38.104, lng: 145.128 }

function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000 }
    )
  })
}

/**
 * TipDecisionScreen — post-pickup tip-vs-return ranked options (WP-E, R4,
 * FR7.4.3–FR7.4.8, ux-spec-v7 §4.2). Full-screen overlay in the driver app.
 *
 * The recommendation is ADVISORY (FR7.4.7): every eligible option is shown
 * and the driver's actual choice is what gets recorded. Choosing a tip site
 * closes the open truck_loads row; returning to base leaves it open (it gets
 * tipped later from the yard).
 *
 * Distances are haversine × circuity approximations (ADR-703) and labelled
 * as such. Seeded tip rates are placeholders until Mark verifies them.
 */
export default function TipDecisionScreen({ job, driverId, onClose, onDecided }) {
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState([])
  const [load, setLoad] = useState(null)
  const [persisted, setPersisted] = useState(true) // false → table missing, choices not recorded
  const [choosing, setChoosing] = useState(null)   // option index while saving
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    let alive = true
    async function prepare() {
      // 1. The load being decided on — reuse the open one or record the pickup.
      let row = await getOpenLoad(driverId)
      if (!row && job) {
        try {
          row = await recordLoad({
            driverId,
            bookingId: job.id,
            binSize: job.bin_size,
            wasteType: job.waste_type,
            estWeightT: null, // unknown until weighbridge — engine defaults to 1 t
          })
        } catch {
          // truck_loads unreachable — still rank, just don't persist the choice.
          row = { id: null, waste_type: job.waste_type, bin_size: job.bin_size, est_weight_t: null }
          if (alive) setPersisted(false)
        }
      }

      // 2. Everything the engine needs, in parallel. All reads fail soft.
      const [sites, gps, todayJobs, fuel, labour, radius, redeploy] = await Promise.all([
        getTipSites(),
        getGPS(),
        getTodayJobs(driverId).catch(() => []),
        getRule('fuel_cost_per_km', DEFAULT_RATES.fuel_cost_per_km),
        getRule('driver_cost_per_hour', DEFAULT_RATES.driver_cost_per_hour),
        getRule('tip_search_radius_km', DEFAULT_RATES.tip_search_radius_km),
        getRule('redeploy_bin_savings_min', DEFAULT_RATES.redeploy_bin_savings_min),
      ])

      const nextJobs = (todayJobs || []).filter(j =>
        j.id !== job?.id &&
        !['completed', 'cancelled'].includes(j.status) &&
        j.lat != null && j.lng != null &&
        Number.isFinite(Number(j.lat)) && Number.isFinite(Number(j.lng))
      )

      const ranked = rankTipOptions({
        currentLoc: gps,
        load: row,
        tipSites: sites,
        nextJobs,
        base: BASE_LOCATION,
        rates: {
          fuel_cost_per_km: fuel,
          driver_cost_per_hour: labour,
          tip_search_radius_km: radius,
          redeploy_bin_savings_min: redeploy,
        },
      })

      if (!alive) return
      setLoad(row)
      setOptions(ranked)
      setLoading(false)
    }
    prepare()
    return () => { alive = false }
  }, [driverId, job])

  async function choose(option, idx) {
    setChoosing(idx)
    setFeedback('')
    try {
      if (option.type === 'tip_then_next_job' && load?.id) {
        const credited = (option.breakdown?.recyclingCredit || 0) > 0
        await closeLoad({ loadId: load.id, tipSiteId: option.tipSite.id, recycled: credited })
      }
      // return_to_base: load stays open — it gets tipped later from the yard.
      onDecided?.(option)
      onClose?.()
    } catch {
      setFeedback('Could not record the decision — check connection')
      setChoosing(null)
    }
  }

  return (
    <div
      data-testid="tip-decision-screen"
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: B.black, overflowY: 'auto',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div style={{
        background: '#0D0D1A', borderBottom: `2px solid ${B.yellow}`,
        padding: '0 16px', height: 56, position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontFamily: fontHead, fontSize: 18, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Tip or Return?
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          data-testid="tip-decision-close"
          style={{
            background: 'none', border: 'none', color: '#888', fontSize: 28,
            cursor: 'pointer', minWidth: 44, minHeight: 44, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: 16, maxWidth: 520, margin: '0 auto' }}>
        {/* Load summary */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {load?.bin_size && (
            <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: B.yellow, fontSize: 13 }}>
              {load.bin_size}
            </span>
          )}
          {load?.waste_type && (
            <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 13 }}>
              {load.waste_type}
            </span>
          )}
          <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 13 }}>
            {load?.est_weight_t ? `~${load.est_weight_t} t` : '~1 t (est.)'}
          </span>
        </div>

        {!persisted && (
          <div style={{ background: '#2B1A0F', border: `1px solid ${B.amber}`, borderRadius: 8, padding: '10px 14px', color: B.amber, fontSize: 13, marginBottom: 14 }}>
            ⚠ Load tracking unavailable — options shown, but your choice won't be recorded.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: '15vh' }}>
            <div style={{ color: B.yellow, fontSize: 36 }}>⏳</div>
            <div style={{ color: '#aaa', fontSize: 15, marginTop: 10 }}>Ranking tip options…</div>
          </div>
        ) : (
          <>
            {options.map((opt, idx) => {
              const isTip = opt.type === 'tip_then_next_job'
              const bd = opt.breakdown || {}
              return (
                <div
                  key={isTip ? `site-${opt.tipSite.id ?? opt.tipSite.name}` : 'return-to-base'}
                  data-testid={opt.recommended ? 'tip-option-recommended' : undefined}
                  style={{
                    background: '#1A1A2E',
                    border: `2px solid ${opt.recommended ? B.yellow : '#333'}`,
                    borderRadius: 12, padding: 16, marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      {opt.recommended && (
                        <div style={{
                          display: 'inline-block', background: B.yellow, color: B.black,
                          fontFamily: fontHead, fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: '0.08em', borderRadius: 4, padding: '2px 8px', marginBottom: 6,
                        }}>
                          ★ Recommended
                        </div>
                      )}
                      <div style={{ fontFamily: fontHead, fontSize: 18, color: B.white }}>
                        {isTip ? opt.tipSite.name : '🏠 Return to Base'}
                      </div>
                      {isTip && opt.tipSite.address && (
                        <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>{opt.tipSite.address}</div>
                      )}
                      {isTip && opt.nextJob && (
                        <div style={{ color: B.cyan, fontSize: 13, marginTop: 4 }}>
                          ↻ then redeploy to {opt.nextJob.customer_name || 'next job'}
                        </div>
                      )}
                      {opt.note && (
                        <div style={{ color: B.amber, fontSize: 13, marginTop: 4 }}>{opt.note}</div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: fontHead, fontSize: 24, color: opt.recommended ? B.yellow : B.white }}>
                        ${opt.totalCost.toFixed(0)}
                      </div>
                      <div style={{ color: '#666', fontSize: 11 }}>est. cost</div>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, color: '#888', fontSize: 12 }}>
                    <span>~{bd.distanceKm} km</span>
                    <span>fuel ${bd.fuelCost}</span>
                    <span>labour ${bd.labourCost}</span>
                    {bd.tipFee > 0 && <span>tip fee ${bd.tipFee}</span>}
                    {bd.recyclingCredit > 0 && <span style={{ color: B.green }}>−${bd.recyclingCredit} recycling</span>}
                    {bd.redeploySaving > 0 && <span style={{ color: B.green }}>−${bd.redeploySaving} redeploy</span>}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {isTip && (
                      <div style={{ flex: 1 }}>
                        <NavigateButton
                          lat={opt.tipSite.lat}
                          lng={opt.tipSite.lng}
                          address={opt.tipSite.address}
                          label="📍 Navigate"
                          compact
                          testId={`tip-navigate-${idx}`}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => choose(opt, idx)}
                      disabled={choosing !== null}
                      data-testid={`tip-choose-${idx}`}
                      style={{
                        flex: 1, minHeight: 44, padding: '10px 14px',
                        background: choosing === idx ? '#888' : (opt.recommended ? B.yellow : '#0D0D1A'),
                        color: opt.recommended ? B.black : B.white,
                        border: opt.recommended ? 'none' : '1px solid #444',
                        borderRadius: 8, fontFamily: fontHead, fontSize: 14, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        cursor: choosing !== null ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {choosing === idx ? '…' : (isTip ? '✓ Tipping Here' : '✓ Heading Back')}
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 4 }}>
              Distances are road estimates. Tip rates are seeded placeholders until verified.
              Recommendation is advisory — your call is what's recorded.
            </div>
          </>
        )}

        {feedback && (
          <div style={{
            marginTop: 12, padding: '10px 14px', background: '#2B1515',
            border: `1px solid ${B.red}`, borderRadius: 8, color: B.red, fontSize: 14,
          }}>
            {feedback}
          </div>
        )}
      </div>
    </div>
  )
}
