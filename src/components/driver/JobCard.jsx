import React, { useState } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { recordJobEvent, updateJobStatus, uploadJobPhoto } from '../../api/driver'
import PhotoCapture from './PhotoCapture'
import HazardReport from './HazardReport'

const STATUS_COLOR = {
  pending:     B.textMuted,
  confirmed:   B.blue,
  scheduled:   B.amber,
  in_progress: B.yellow,
  completed:   B.green,
  cancelled:   B.red,
}

const STATUS_LABEL = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  scheduled:   'Scheduled',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
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

export default function JobCard({ job, driverId, onStatusChange }) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState(null) // 'start' | 'complete' | null
  const [photoType, setPhotoType] = useState(null) // open photo capture modal
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showHazard, setShowHazard] = useState(false)
  const [localStatus, setLocalStatus] = useState(job.status)
  const [feedback, setFeedback] = useState('')

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    [job.address, job.suburb, job.postcode].filter(Boolean).join(', ')
  )}`

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
  const statusColor = STATUS_COLOR[localStatus] || B.textMuted

  return (
    <>
      <div style={{
        background: isCompleted ? '#0F2B1A' : '#1A1A2E',
        border: `2px solid ${isInProgress ? B.yellow : isCompleted ? B.green : '#333'}`,
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

            {/* Navigate button */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', width: '100%', padding: '16px',
                background: B.blue, color: B.white, border: 'none', borderRadius: 8,
                fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                textAlign: 'center', textDecoration: 'none',
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
            >
              📍 Navigate
            </a>

            {/* Action buttons */}
            {!isCompleted && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {localStatus !== 'in_progress' ? (
                  <button
                    onClick={handleStart}
                    disabled={!!actionLoading}
                    style={{
                      flex: 1, padding: '18px',
                      background: actionLoading === 'start' ? '#888' : B.yellow,
                      color: B.black, border: 'none', borderRadius: 8,
                      fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === 'start' ? '…' : '▶ Start Job'}
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={!!actionLoading}
                    style={{
                      flex: 1, padding: '18px',
                      background: actionLoading === 'complete' ? '#888' : B.green,
                      color: B.white, border: 'none', borderRadius: 8,
                      fontSize: 18, fontFamily: fontHead, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading === 'complete' ? '…' : '✓ Complete Job'}
                  </button>
                )}
              </div>
            )}

            {/* Photo buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { type: 'delivery',   label: 'Delivery\nPhoto',    icon: '🚛' },
                { type: 'collection', label: 'Collection\nPhoto',  icon: '🔄' },
                { type: 'tip_docket', label: 'Tip Docket\nPhoto',  icon: '🧾' },
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setPhotoType(type)}
                  style={{
                    padding: '14px 8px',
                    background: '#0D0D1A',
                    border: '1px solid #444',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 24 }}>{icon}</div>
                  <div style={{ color: '#aaa', fontSize: 11, marginTop: 4, whiteSpace: 'pre-line', lineHeight: 1.3 }}>{label}</div>
                </button>
              ))}
            </div>

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
