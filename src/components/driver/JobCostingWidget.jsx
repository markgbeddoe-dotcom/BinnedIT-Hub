import React, { useState, useEffect } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../../theme'
import { getJobCostVariances } from '../../api/driver'

export default function JobCostingWidget() {
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
