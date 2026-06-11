import React, { useState, useEffect } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { recordJobEvent, updateJobStatus, uploadJobPhoto, hasDeliveryPhoto } from '../../api/driver'
import PhotoCapture from './PhotoCapture'
import HazardReport from './HazardReport'
import NavigateButton from './NavigateButton'
import TipDecisionScreen from './TipDecisionScreen'
import { nextAllowedActions, isActionAllowed, STATUS_LABEL } from './jobStateMachine'

const STATUS_COLOR = {
  pending:     B.textMuted,
  confirmed:   B.blue,
  scheduled:   B.amber,
  en_route:    B.blue,
  arrived:     B.amber,
  in_progress: B.yellow,
  completed:   B.green,
  cancelled:   B.red,
}

function getGPS() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: pos.coords.accuracy }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000 }
    )
  })
}

export default function JobCard({ job, driverId, checklistDone = false, onStatusChange, onOpenChecklist }) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState(null) // 'depart' | 'arrive' | 'start' | 'complete' | null
  const [photoType, setPhotoType] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showHazard, setShowHazard] = useState(false)
  const [localStatus, setLocalStatus] = useState(job.status)
  const [feedback, setFeedback] = useState('')
  const [deliveryPhotoTaken, setDeliveryPhotoTaken] = useState(false)
  const [showTipDecision, setShowTipDecision] = useState(false)

  // On mount / status change, ask Supabase whether this job already
  // has a delivery photo (covers the case where it was uploaded in a
  // previous session). Failure is treated as "no photo" — fail-closed.
  useEffect(() => {
    let cancelled = false
    if (localStatus === 'in_progress' || localStatus === 'arrived') {
      hasDeliveryPhoto(job.id)
        .then(present => { if (!cancelled && present) setDeliveryPhotoTaken(true) })
        .catch(() => {})
    }
    return () => { cancelled = true }
  }, [job.id, localStatus])

  // Gates derived from state machine
  const gateOpts = { hasDeliveryPhoto: deliveryPhotoTaken, checklistDoneToday: checklistDone }
  const actions = nextAllowedActions(localStatus, gateOpts)
  const departAction   = actions.find(a => a.target === 'en_route')
  const arriveAction   = actions.find(a => a.target === 'arrived')
  const startAction    = actions.find(a => a.target === 'in_progress')
  const completeAction = actions.find(a => a.target === 'completed')

  async function handleDepart() {
    setActionLoading('depart')
    setFeedback('')
    try {
      const gps = await getGPS()
      await updateJobStatus(job.id, 'en_route')
      await recordJobEvent({
        bookingId: job.id,
        eventType: 'departed',
        driverId,
        lat: gps?.lat,
        lng: gps?.lng,
        accuracyM: gps?.accuracyM,
      })
      setLocalStatus('en_route')
      onStatusChange?.(job.id, 'en_route')
      setFeedback('✓ En route')
    } catch (err) {
      setFeedback('Failed to update — check connection')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleArrive() {
    // Hard gate: checklist must be done before arriving on site.
    if (!isActionAllowed(localStatus, 'arrived', gateOpts)) {
      setFeedback('Complete the pre-start vehicle checklist first')
      onOpenChecklist?.()
      return
    }
    setActionLoading('arrive')
    setFeedback('')
    try {
      const gps = await getGPS()
      await updateJobStatus(job.id, 'arrived')
      await recordJobEvent({
        bookingId: job.id,
        eventType: 'arrived',
        driverId,
        lat: gps?.lat,
        lng: gps?.lng,
        accuracyM: gps?.accuracyM,
      })
      setLocalStatus('arrived')
      onStatusChange?.(job.id, 'arrived')
      setFeedback('✓ Marked arrived')
    } catch (err) {
      setFeedback('Failed to mark arrived — check connection')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleStart() {
    setActionLoading('start')
    setFeedback('')
    try {
      const gps = await getGPS()
      await updateJobStatus(job.id, 'in_progress')
      await recordJobEvent({
        bookingId: job.id,
        eventType: 'start',
        driverId,
        lat: gps?.lat,
        lng: gps?.lng,
        accuracyM: gps?.accuracyM,
      })
      setLocalStatus('in_progress')
      onStatusChange?.(job.id, 'in_progress')
      setFeedback('✓ Job started')
    } catch (err) {
      setFeedback('Failed to start job — check connection')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleComplete() {
    // Hard gate: must have a delivery photo before completion.
    if (!isActionAllowed(localStatus, 'completed', gateOpts)) {
      setFeedback('Take a delivery photo before completing')
      setPhotoType('delivery')
      return
    }
    setActionLoading('complete')
    setFeedback('')
    try {
      const gps = await getGPS()
      await updateJobStatus(job.id, 'completed')
      await recordJobEvent({
        bookingId: job.id,
        eventType: 'complete',
        driverId,
        lat: gps?.lat,
        lng: gps?.lng,
        accuracyM: gps?.accuracyM,
      })
      setLocalStatus('completed')
      onStatusChange?.(job.id, 'completed')
      setFeedback('✓ Job completed')
    } catch (err) {
      setFeedback('Failed to complete job — check connection')
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePhotoCapture(file) {
    setPhotoUploading(true)
    try {
      await uploadJobPhoto({
        bookingId: job.id,
        photoType,
        file,
        uploadedBy: driverId,
      })
      setFeedback(`✓ ${photoType} photo saved`)
      if (photoType === 'delivery') setDeliveryPhotoTaken(true)
      setPhotoType(null)
    } catch (err) {
      setFeedback('Photo upload failed — saved locally')
      setPhotoType(null)
    } finally {
      setPhotoUploading(false)
    }
  }

  const isCompleted = localStatus === 'completed'
  const isInProgress = localStatus === 'in_progress'
  const isArrived = localStatus === 'arrived'
  const isEnRoute = localStatus === 'en_route'
  const statusColor = STATUS_COLOR[localStatus] || B.textMuted

  // Pick the border colour to reflect the current operational phase.
  const borderColor =
    isCompleted ? B.green :
    isInProgress ? B.yellow :
    isArrived ? B.amber :
    isEnRoute ? B.blue :
    '#333'

  return (
    <>
      <div style={{
        background: isCompleted ? '#0F2B1A' : '#1A1A2E',
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        opacity: isCompleted ? 0.7 : 1,
      }}>
        {/* Job header — always visible */}
        <div
          onClick={() => setExpanded(prev => !prev)}
          style={{ padding: '16px 18px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: fontHead, fontSize: 20, color: B.white, letterSpacing: '0.02em' }}>
                {job.customer_name || 'Customer'}
              </div>
              <div style={{ color: '#aaa', fontSize: 14, marginTop: 3 }}>
                {[job.address, job.suburb].filter(Boolean).join(', ')}
              </div>
            </div>
            <div style={{
              background: statusColor + '22',
              border: `1px solid ${statusColor}`,
              color: statusColor,
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              fontFamily: fontHead,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
            }}>
              {STATUS_LABEL[localStatus] || localStatus}
            </div>
          </div>

          {/* Bin info row */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {job.bin_size && (
              <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: B.yellow, fontSize: 13 }}>
                {job.bin_size}
              </span>
            )}
            {job.waste_type && (
              <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 13 }}>
                {job.waste_type}
              </span>
            )}
            {job.scheduled_date && (
              <span style={{ background: '#111', border: '1px solid #444', borderRadius: 6, padding: '4px 10px', color: '#aaa', fontSize: 13 }}>
                {new Date(job.scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>

          {/* Expand indicator */}
          <div style={{ textAlign: 'right', color: '#555', fontSize: 18, marginTop: 4 }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>

        {/* Expanded details + actions */}
        {expanded && (
          <div style={{ padding: '0 18px 18px' }}>
            {/* Special instructions */}
            {job.special_instructions && (
              <div style={{ background: '#0D0D1A', borderRadius: 8, padding: '12px', marginBottom: 16, border: `1px solid ${B.amber}` }}>
                <div style={{ color: B.amber, fontSize: 12, marginBottom: 4, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Special Instructions
                </div>
                <div style={{ color: B.white, fontSize: 14 }}>{job.special_instructions}</div>
              </div>
            )}

            {/* Navigate — geocoded coords when present, address text otherwise */}
            <div style={{ marginBottom: 12 }}>
              <NavigateButton
                lat={job.lat}
                lng={job.lng}
                address={[job.address, job.suburb, job.postcode].filter(Boolean).join(', ')}
              />
            </div>

            {/* Action buttons — driven by state machine */}
            {!isCompleted && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {/* Depart (pending/confirmed/scheduled → en_route) */}
                {departAction && (
                  <button
                    onClick={handleDepart}
                    disabled={!!actionLoading}
                    style={{
                      width: '100%', padding: '18px',
                      background: actionLoading === 'depart' ? '#888' : B.blue,
                      color: B.white, border: 'none', borderRadius: 8,
                      fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === 'depart' ? '…' : '🚚 Start Drive (En Route)'}
                  </button>
                )}

                {/* Mark Arrived (en_route → arrived) — gated by checklist */}
                {arriveAction && (
                  <>
                    <button
                      onClick={handleArrive}
                      disabled={!!actionLoading || arriveAction.blocked}
                      style={{
                        width: '100%', padding: '18px',
                        background: arriveAction.blocked ? '#444' : (actionLoading === 'arrive' ? '#888' : B.amber),
                        color: arriveAction.blocked ? '#888' : B.black,
                        border: 'none', borderRadius: 8,
                        fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        cursor: (actionLoading || arriveAction.blocked) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {actionLoading === 'arrive' ? '…' : '📍 Mark Arrived'}
                    </button>
                    {arriveAction.blocked && (
                      <div
                        onClick={onOpenChecklist}
                        style={{
                          background: '#2B1A0F',
                          border: `1px solid ${B.amber}`,
                          borderRadius: 8,
                          padding: '10px 14px',
                          color: B.amber,
                          fontSize: 13,
                          cursor: onOpenChecklist ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>⚠ {arriveAction.reason}</span>
                        {onOpenChecklist && <span style={{ fontSize: 18 }}>›</span>}
                      </div>
                    )}
                  </>
                )}

                {/* Start Job (arrived → in_progress) */}
                {startAction && (
                  <button
                    onClick={handleStart}
                    disabled={!!actionLoading}
                    style={{
                      width: '100%', padding: '18px',
                      background: actionLoading === 'start' ? '#888' : B.yellow,
                      color: B.black, border: 'none', borderRadius: 8,
                      fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === 'start' ? '…' : '▶ Start Job'}
                  </button>
                )}

                {/* Complete (in_progress → completed) — gated by delivery photo */}
                {completeAction && (
                  <>
                    <button
                      onClick={handleComplete}
                      disabled={!!actionLoading || completeAction.blocked}
                      style={{
                        width: '100%', padding: '18px',
                        background: completeAction.blocked ? '#444' : (actionLoading === 'complete' ? '#888' : B.green),
                        color: completeAction.blocked ? '#888' : B.white,
                        border: 'none', borderRadius: 8,
                        fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        cursor: (actionLoading || completeAction.blocked) ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {actionLoading === 'complete' ? '…' : '✓ Mark Complete'}
                    </button>
                    {completeAction.blocked && (
                      <div
                        onClick={() => setPhotoType('delivery')}
                        style={{
                          background: '#2B1A0F',
                          border: `1px solid ${B.amber}`,
                          borderRadius: 8,
                          padding: '10px 14px',
                          color: B.amber,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}
                      >
                        <span>📸 Take a delivery photo before completing</span>
                        <span style={{ fontSize: 18 }}>›</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Photo buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { type: 'delivery',   label: 'Delivery\nPhoto',    icon: '🚛' },
                { type: 'collection', label: 'Collection\nPhoto',  icon: '🔄' },
                { type: 'tip_docket', label: 'Tip Docket\nPhoto',  icon: '🧾' },
              ].map(({ type, label, icon }) => {
                const taken = type === 'delivery' && deliveryPhotoTaken
                return (
                  <button
                    key={type}
                    onClick={() => setPhotoType(type)}
                    style={{
                      padding: '14px 8px',
                      background: taken ? '#0F2B1A' : '#0D0D1A',
                      border: `1px solid ${taken ? B.green : '#444'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{taken ? '✅' : icon}</div>
                    <div style={{
                      color: taken ? B.green : '#aaa',
                      fontSize: 11, marginTop: 4,
                      whiteSpace: 'pre-line', lineHeight: 1.3,
                    }}>
                      {label}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Tip decision (WP-E, R4) — once the load is on the truck */}
            {(isInProgress || isCompleted) && (
              <button
                onClick={() => setShowTipDecision(true)}
                data-testid="job-tip-decision"
                style={{
                  width: '100%', padding: '14px', marginBottom: 12,
                  background: '#1A2B0F',
                  border: `1px solid ${B.teal}`,
                  borderRadius: 8, cursor: 'pointer',
                  color: B.teal, fontSize: 15,
                  fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em',
                }}
              >
                🗑 Tip or Return?
              </button>
            )}

            {/* Hazard report */}
            <button
              onClick={() => setShowHazard(true)}
              style={{
                width: '100%', padding: '14px',
                background: '#2B1515',
                border: `1px solid ${B.red}`,
                borderRadius: 8, cursor: 'pointer',
                color: B.red, fontSize: 15,
                fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              🚨 Report Hazard
            </button>

            {/* Feedback message */}
            {feedback && (
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: feedback.startsWith('✓') ? '#0F2B1A' : '#2B1515',
                border: `1px solid ${feedback.startsWith('✓') ? B.green : B.red}`,
                borderRadius: 8,
                color: feedback.startsWith('✓') ? B.green : B.red,
                fontSize: 14,
              }}>
                {feedback}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Photo capture modal */}
      {photoType && (
        <PhotoCapture
          type={photoType}
          onCapture={handlePhotoCapture}
          onClose={() => setPhotoType(null)}
          uploading={photoUploading}
        />
      )}

      {/* Tip-vs-return decision overlay */}
      {showTipDecision && (
        <TipDecisionScreen
          job={job}
          driverId={driverId}
          onClose={() => setShowTipDecision(false)}
          onDecided={(opt) => {
            setFeedback(opt.type === 'tip_then_next_job'
              ? `✓ Tipping at ${opt.tipSite?.name || 'site'}`
              : '✓ Returning to base')
          }}
        />
      )}

      {/* Hazard report modal */}
      {showHazard && (
        <HazardReport
          driverId={driverId}
          bookingId={job.id}
          address={[job.address, job.suburb].filter(Boolean).join(', ')}
          onSubmit={() => {
            setShowHazard(false)
            setFeedback('✓ Hazard reported')
          }}
          onClose={() => setShowHazard(false)}
        />
      )}
    </>
  )
}
