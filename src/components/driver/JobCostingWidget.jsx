import React, { useState, useEffect } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../../theme'
import { getJobCostVariances } from '../../api/driver'
import { computeJobCosting } from '../../lib/jobCosting'

/**
 * JobCostingWidget — dual-mode.
 *
 * 1. Dashboard mode (no `booking` prop): fetches the top jobs by cost variance
 *    and renders a card stack. Used on summary pages.
 *
 * 2. Inline mode (`booking` prop supplied): renders a compact revenue /
 *    cost-so-far / margin readout for ONE job. Used inside DispatchBoard's
 *    expanded JobCard so Mark sees live job costing per job (PRD-v6 §1).
 *
 * The `compact` prop forces inline mode with a tighter visual footprint —
 * suitable for embedding inside a kanban tile.
 */
export default function JobCostingWidget({ booking = null, compact = false }) {
  if (booking) return <InlineJobCosting booking={booking} compact={compact} />
  return <VarianceList />
}

// ─── Inline (per-card) mode ──────────────────────────────────────────────────
function InlineJobCosting({ booking, compact }) {
  const c = computeJobCosting(booking)

  const marginColor =
    c.marginSoFar < 0 ? B.red :
    c.marginPct < 20 ? B.amber || '#F59E0B' :
    B.green

  if (c.revenue === 0 && c.estimatedCost === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: compact ? '6px 8px' : '8px 10px',
        fontSize: 11,
        color: B.textMuted,
        fontFamily: fontBody,
      }}>
        No costing data yet — driver will log fuel/tip/time on completion.
      </div>
    )
  }

  return (
    <div
      data-testid="job-costing-inline"
      style={{
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 6,
        padding: compact ? '8px 10px' : '10px 12px',
        fontFamily: fontBody,
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <div style={{
          fontFamily: fontHead,
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#F59E0B',
          fontWeight: 700,
        }}>
          {c.hasActuals ? 'Live Job Costing' : 'Forecast Costing'}
        </div>
        <div style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          fontStyle: c.hasActuals ? 'normal' : 'italic',
        }}>
          {c.hasActuals ? 'Driver actuals' : 'Estimate only'}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
        fontSize: 11,
      }}>
        <Cell
          label="Revenue"
          value={fmtFull(c.revenue)}
          color="#E8E8F0"
        />
        <Cell
          label={c.hasActuals ? 'Cost (actual)' : 'Cost (est)'}
          value={fmtFull(c.costSoFar)}
          color="#B0B0C8"
        />
        <Cell
          label="Margin"
          value={`${c.marginSoFar < 0 ? '-' : ''}${fmtFull(Math.abs(c.marginSoFar))}`}
          color={marginColor}
          subText={`${c.marginPct >= 0 ? '' : '-'}${Math.abs(c.marginPct).toFixed(0)}%`}
        />
      </div>

      {c.hasActuals && Math.abs(c.estimateVariancePct) >= 10 && (
        <div style={{
          marginTop: 6,
          fontSize: 10,
          color: c.estimateVariance > 0 ? B.red : B.green,
          fontFamily: fontBody,
        }}>
          {c.estimateVariance > 0 ? 'Over' : 'Under'} estimate by{' '}
          {fmtFull(Math.abs(c.estimateVariance))} ({Math.abs(c.estimateVariancePct).toFixed(0)}%)
        </div>
      )}
    </div>
  )
}

function Cell({ label, value, color, subText }) {
  return (
    <div>
      <div style={{
        fontSize: 9,
        color: 'rgba(255,255,255,0.45)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 2,
        fontFamily: fontHead,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: fontHead,
        fontWeight: 700,
        fontSize: 13,
        color,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {subText && (
        <div style={{ fontSize: 10, color, opacity: 0.85, marginTop: 1 }}>
          {subText}
        </div>
      )}
    </div>
  )
}

// ─── Dashboard list mode (existing behaviour) ────────────────────────────────
function VarianceList() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getJobCostVariances(8)
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{
        background: B.cardBg, borderRadius: 10, padding: 20,
        border: `1px solid ${B.cardBorder}`, fontFamily: fontBody,
      }}>
        <div style={{ color: B.textMuted, fontSize: 14 }}>Loading job cost variances…</div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div style={{
        background: B.cardBg, borderRadius: 10, padding: 20,
        border: `1px solid ${B.cardBorder}`, fontFamily: fontBody,
      }}>
        <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textPrimary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Job Cost Variances
        </div>
        <div style={{ color: B.textMuted, fontSize: 14 }}>
          No jobs with actual costs recorded yet. Costs are logged by drivers when completing jobs.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: B.cardBg, borderRadius: 10, padding: 20,
      border: `1px solid ${B.cardBorder}`, fontFamily: fontBody,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Job Cost Variances
        </div>
        <div style={{ fontSize: 12, color: B.textMuted }}>Estimated vs Actual</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {jobs.map(job => {
          const isOver  = job.variance > 0
          const isUnder = job.variance < 0
          const varColor = isOver ? B.red : isUnder ? B.green : B.textMuted
          const absPct = Math.abs(job.variancePct)

          return (
            <div
              key={job.id}
              style={{
                background: B.bg,
                borderRadius: 8,
                padding: '12px 14px',
                border: `1px solid ${absPct > 20 ? (isOver ? B.red + '44' : B.green + '44') : B.cardBorder}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: B.textPrimary, fontSize: 14 }}>
                    {job.customer_name || 'Unknown'}
                  </div>
                  <div style={{ color: B.textMuted, fontSize: 12, marginTop: 2 }}>
                    {job.bin_size} · {job.waste_type || 'General'} · {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: varColor, fontFamily: fontHead, fontSize: 16, letterSpacing: '0.02em' }}>
                    {isOver ? '+' : ''}{fmtFull(job.variance)}
                  </div>
                  <div style={{ color: varColor, fontSize: 12, marginTop: 1 }}>
                    {isOver ? '▲' : '▼'} {absPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Cost breakdown bar */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: B.textMuted, fontSize: 11 }}>Est: {fmtFull(job.estimatedTotal)}</span>
                  <span style={{ color: B.textMuted, fontSize: 11 }}>Actual: {fmtFull(job.actualTotal)}</span>
                </div>
                <div style={{ height: 4, background: B.cardBorder, borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, job.estimatedTotal > 0 ? (job.actualTotal / job.estimatedTotal) * 100 : 0)}%`,
                    background: varColor,
                    borderRadius: 2,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12, color: B.textMuted, fontSize: 11 }}>
        Showing top {jobs.length} jobs by variance magnitude. Driver rate: $45/hr.
      </div>
    </div>
  )
}
