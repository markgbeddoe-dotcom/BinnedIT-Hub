/**
 * WasteAuditPanel.jsx — office review queue for AI waste audits (WP-D, R5,
 * FR7.5.4–FR7.5.6, ux-spec-v7 §5.3).
 *
 * Drivers' bin photos are classified by api/analyze-bin-photo.js; mismatches
 * land here for a human verdict. Approving drafts/approves an INTERNAL
 * billing adjustment — nothing in this flow writes to Xero
 * (XERO_WRITE_ENABLED doctrine): Sarah actions the real invoice by hand.
 *
 * Owner/manager get approve/reject; everyone else sees a read-only queue
 * (content gate here, not just at the route — RulesEnginePage convention).
 * Light office theme. Falls back to an empty-state card when the
 * waste_audits table is missing/unreachable — never a blank crash.
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { B, fontHead, fontBody } from '../theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  listAudits,
  approveAdjustment,
  rejectAdjustment,
  getSuggestedAdjustmentRate,
} from '../api/wasteAudit'

function photoUrl(jp) {
  if (!jp) return null
  if (jp.photo_url) return jp.photo_url
  if (jp.storage_path) {
    try {
      return supabase.storage.from('job-photos').getPublicUrl(jp.storage_path).data?.publicUrl || null
    } catch {
      return null
    }
  }
  return null
}

const STATUS_CHIP = {
  pending_review: { label: 'Pending Review', color: B.amber },
  confirmed:      { label: 'Confirmed',      color: B.green },
  dismissed:      { label: 'Dismissed',      color: B.textMuted },
}

function Chip({ label, color, testId }) {
  return (
    <span data-testid={testId} style={{
      background: color + '22', border: `1px solid ${color}`, color,
      borderRadius: 6, padding: '3px 10px', fontSize: 12,
      fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

export default function WasteAuditPanel() {
  const { session, isManager } = useAuth()
  const { isDesktop } = useBreakpoint()
  const qc = useQueryClient()
  const [tab, setTab] = useState('pending') // 'pending' | 'resolved'

  const { data: audits = [], isLoading, isError } = useQuery({
    queryKey: ['waste-audits', tab],
    queryFn: () => listAudits({ status: tab }),
    staleTime: 30_000,
  })

  const { data: suggestedRate } = useQuery({
    queryKey: ['waste-audit-suggested-rate'],
    queryFn: getSuggestedAdjustmentRate,
    staleTime: 5 * 60_000,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['waste-audits'] })

  return (
    <div style={{ fontFamily: fontBody, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: fontHead, fontSize: 24, color: B.textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Waste Audits
          </div>
          <div style={{ color: B.textMuted, fontSize: 13, marginTop: 2 }}>
            AI bin-photo checks. Adjustments are internal records only — Xero is never written.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'resolved'].map(key => (
            <button
              key={key}
              onClick={() => setTab(key)}
              data-testid={`waste-audit-tab-${key}`}
              style={{
                minHeight: 44, padding: '0 16px', borderRadius: 8,
                fontFamily: fontHead, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: tab === key ? B.yellow : B.white,
                color: B.textPrimary,
                border: `1px solid ${tab === key ? B.yellowDark : B.cardBorder}`,
                cursor: 'pointer',
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 32, textAlign: 'center', color: B.textMuted }}>
          Loading audits…
        </div>
      ) : isError ? (
        <div style={{ background: B.cardBg, border: `1px solid ${B.amber}`, borderRadius: 12, padding: 24, color: B.textSecondary }}>
          ⚠ Waste audits are unavailable (table missing or no access). Once migration 024 is applied
          and drivers start photographing bin contents, mismatches will queue here for review.
        </div>
      ) : audits.length === 0 ? (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32 }}>📷</div>
          <div style={{ color: B.textSecondary, fontSize: 15, marginTop: 8 }}>
            {tab === 'pending' ? 'No audits waiting for review.' : 'No resolved audits yet.'}
          </div>
        </div>
      ) : (
        audits.map(audit => (
          <AuditCard
            key={audit.id}
            audit={audit}
            canAct={isManager}
            userId={session?.user?.id}
            suggestedRate={suggestedRate}
            isDesktop={isDesktop}
            onResolved={invalidate}
          />
        ))
      )}
    </div>
  )
}

function AuditCard({ audit, canAct, userId, suggestedRate, isDesktop, onResolved }) {
  const draft = (audit.billing_adjustments || []).find(a => a.status === 'draft')
  const [amount, setAmount] = useState(draft?.amount ?? suggestedRate ?? '')
  const [reason, setReason] = useState(draft?.reason ?? '')
  const [error, setError] = useState('')

  // suggestedRate arrives async after mount — seed the field only while untouched
  useEffect(() => {
    if (amount === '' && suggestedRate != null) setAmount(suggestedRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedRate])

  const booking = audit.bookings
  const img = photoUrl(audit.job_photos)
  const chip = STATUS_CHIP[audit.status] || STATUS_CHIP.pending_review
  const mismatch = audit.matches_declared === false
  const confidencePct = audit.confidence != null ? Math.round(Number(audit.confidence) * 100) : null
  const resolved = audit.status !== 'pending_review'

  const approve = useMutation({
    mutationFn: () => approveAdjustment({ audit, adjustmentId: draft?.id, amount, reason, userId }),
    onSuccess: onResolved,
    onError: e => setError(e.message || 'Approve failed'),
  })
  const reject = useMutation({
    mutationFn: () => rejectAdjustment({ audit, adjustmentId: draft?.id, reason, userId }),
    onSuccess: onResolved,
    onError: e => setError(e.message || 'Dismiss failed'),
  })
  const busy = approve.isPending || reject.isPending

  return (
    <div
      data-testid="waste-audit-card"
      style={{
        background: B.cardBg,
        border: `1px solid ${mismatch && !resolved ? B.amber : B.cardBorder}`,
        borderRadius: 12, padding: 16, marginBottom: 12,
        display: 'flex', gap: 16,
        flexDirection: isDesktop ? 'row' : 'column',
      }}
    >
      {/* Photo */}
      <div style={{ flexShrink: 0, width: isDesktop ? 180 : '100%' }}>
        {img ? (
          <a href={img} target="_blank" rel="noopener noreferrer">
            <img
              src={img}
              alt="Bin contents"
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, border: `1px solid ${B.cardBorder}` }}
            />
          </a>
        ) : (
          <div style={{
            width: '100%', height: 140, borderRadius: 8, background: '#F0F2F1',
            border: `1px dashed ${B.cardBorder}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: B.textMuted, fontSize: 13,
          }}>
            No photo
          </div>
        )}
      </div>

      {/* Detail + actions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 17, color: B.textPrimary }}>
              {booking?.customer_name || 'Unknown booking'}
            </div>
            <div style={{ color: B.textMuted, fontSize: 13, marginTop: 2 }}>
              {[booking?.bin_size, booking?.address, booking?.suburb].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Chip label={chip.label} color={chip.color} />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Chip label={`Declared: ${audit.declared_waste_type || booking?.waste_type || '—'}`} color={B.blue} />
          <Chip
            label={`AI saw: ${audit.dominant_type || '—'}`}
            color={mismatch ? B.amber : B.green}
            testId="waste-audit-detected"
          />
          {confidencePct != null && (
            <Chip label={`${confidencePct}% confident`} color={confidencePct >= 70 ? B.green : B.textMuted} />
          )}
          {audit.driver_flagged && <Chip label="Driver flagged" color={B.purple} />}
        </div>

        {audit.rationale && (
          <div style={{ color: B.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
            {audit.rationale}
          </div>
        )}
        {audit.driver_note && (
          <div style={{
            marginTop: 8, padding: '8px 12px', background: '#F6F2FA',
            border: `1px solid ${B.purple}`, borderRadius: 8, color: B.textSecondary, fontSize: 13,
          }}>
            Driver: {audit.driver_note}
          </div>
        )}

        {/* Adjustment form — pending + manager only */}
        {!resolved && canAct && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.cardBorder}` }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ color: B.textMuted, fontSize: 13 }}>
                Adjustment $
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  data-testid="waste-audit-amount"
                  style={{
                    marginLeft: 6, width: 110, minHeight: 40, padding: '0 10px',
                    border: `1px solid ${B.cardBorder}`, borderRadius: 8,
                    fontFamily: fontBody, fontSize: 14, color: B.textPrimary,
                  }}
                />
              </label>
              <input
                type="text"
                placeholder="Reason (e.g. soil in general waste bin)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                data-testid="waste-audit-reason"
                style={{
                  flex: 1, minWidth: 200, minHeight: 40, padding: '0 12px',
                  border: `1px solid ${B.cardBorder}`, borderRadius: 8,
                  fontFamily: fontBody, fontSize: 14, color: B.textPrimary,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => { setError(''); approve.mutate() }}
                disabled={busy}
                data-testid="waste-audit-approve"
                style={{
                  minHeight: 44, padding: '0 18px', borderRadius: 8,
                  background: B.green, color: B.white, border: 'none',
                  fontFamily: fontHead, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                }}
              >
                {approve.isPending ? '…' : '✓ Approve Adjustment'}
              </button>
              <button
                onClick={() => { setError(''); reject.mutate() }}
                disabled={busy}
                data-testid="waste-audit-dismiss"
                style={{
                  minHeight: 44, padding: '0 18px', borderRadius: 8,
                  background: B.white, color: B.textPrimary, border: `1px solid ${B.cardBorder}`,
                  fontFamily: fontHead, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
                }}
              >
                {reject.isPending ? '…' : 'Dismiss (False Positive)'}
              </button>
            </div>
            <div style={{ color: B.textMuted, fontSize: 12, marginTop: 8 }}>
              Internal record only — Sarah invoices any approved amount manually in Xero.
            </div>
            {error && <div style={{ color: B.red, fontSize: 13, marginTop: 6 }}>{error}</div>}
          </div>
        )}

        {/* Resolved summary */}
        {resolved && (audit.billing_adjustments || []).length > 0 && (
          <div style={{ color: B.textMuted, fontSize: 13, marginTop: 10 }}>
            {(audit.billing_adjustments || []).map(a => (
              <div key={a.id}>
                Adjustment {a.status}{a.amount != null ? ` — $${Number(a.amount).toFixed(2)}` : ''}{a.reason ? ` (${a.reason})` : ''}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
