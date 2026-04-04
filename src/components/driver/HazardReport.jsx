import React, { useState, useEffect } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { submitHazardReport } from '../../api/driver'

const HAZARD_TYPES = [
  { key: 'asbestos',    label: 'Asbestos',       icon: '☠️' },
  { key: 'electrical',  label: 'Electrical',      icon: '⚡' },
  { key: 'structural',  label: 'Structural',      icon: '🏚️' },
  { key: 'access',      label: 'Access Issue',    icon: '🚧' },
  { key: 'spill',       label: 'Chemical Spill',  icon: '💧' },
  { key: 'animal',      label: 'Animal/Wildlife', icon: '🐍' },
  { key: 'other',       label: 'Other',           icon: '⚠️' },
]

export default function HazardReport({ driverId, bookingId, address, onSubmit, onClose }) {
  const [hazardType, setHazardType] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [locStatus, setLocStatus] = useState('pending') // pending | found | denied

  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocStatus('found')
      },
      () => setLocStatus('denied'),
      { timeout: 8000, maximumAge: 30000 }
    )
  }, [])

  async function handleSubmit() {
    if (!hazardType) { setError('Please select a hazard type'); return }
    if (!description.trim()) { setError('Please describe the hazard'); return }
    setLoading(true)
    setError('')
    try {
      const report = await submitHazardReport({
        bookingId,
        reportedBy: driverId,
        hazardType,
        description: description.trim(),
        lat: location?.lat,
        lng: location?.lng,
        address: address || null,
        photoUrl: null,
      })
      onSubmit(report)
    } catch (err) {
      setError('Failed to submit report. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D1A',
      zIndex: 150,
      overflowY: 'auto',
      fontFamily: fontBody,
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 22, color: B.red, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hazard Report
            </div>
            {address && (
              <div style={{ color: '#aaa', fontSize: 13, marginTop: 2 }}>{address}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'pointer' }}>×</button>
        </div>

        {/* GPS status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 20, padding: '10px 14px',
          background: '#111', borderRadius: 8,
          border: `1px solid ${locStatus === 'found' ? B.green : '#333'}`,
        }}>
          <span style={{ fontSize: 16 }}>{locStatus === 'found' ? '📍' : '🔍'}</span>
          <span style={{ color: locStatus === 'found' ? B.green : '#888', fontSize: 13 }}>
            {locStatus === 'pending' && 'Getting your location…'}
            {locStatus === 'found' && `Location captured (${location?.lat?.toFixed(4)}, ${location?.lng?.toFixed(4)})`}
            {locStatus === 'denied' && 'Location unavailable — enter address manually'}
          </span>
        </div>

        {/* Hazard type grid */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: '#aaa', fontSize: 12, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hazard Type *
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {HAZARD_TYPES.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setHazardType(key)}
                style={{
                  padding: '14px 12px',
                  background: hazardType === key ? '#3D1515' : '#1A1A2E',
                  border: `2px solid ${hazardType === key ? B.red : '#333'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ color: hazardType === key ? B.white : '#aaa', fontSize: 14 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Description *
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Describe the hazard clearly — what you saw, location on site, immediate risk…"
            style={{
              width: '100%', padding: '12px', background: '#111',
              border: `1px solid ${description.trim() ? B.yellow : '#333'}`,
              borderRadius: 8, color: B.white, fontSize: 15,
              resize: 'vertical', boxSizing: 'border-box', fontFamily: fontBody,
            }}
          />
        </div>

        {error && (
          <div style={{ background: '#3D1515', border: `1px solid ${B.red}`, borderRadius: 8, padding: '10px 14px', color: B.red, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '16px', background: '#222', color: '#aaa', border: 'none',
              borderRadius: 8, fontSize: 16, fontFamily: fontHead, textTransform: 'uppercase',
              letterSpacing: '0.06em', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              flex: 2, padding: '16px',
              background: loading ? '#555' : B.red,
              color: B.white, border: 'none', borderRadius: 8,
              fontSize: 18, fontFamily: fontHead, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Submitting…' : '🚨 Report Hazard'}
          </button>
        </div>
      </div>
    </div>
  )
}
