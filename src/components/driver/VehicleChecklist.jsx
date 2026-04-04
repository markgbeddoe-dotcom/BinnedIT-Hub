import React, { useState } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { submitChecklist } from '../../api/driver'

const CHECKS = [
  { key: 'tyres',           label: 'Tyres — pressure & condition' },
  { key: 'lights',          label: 'Lights — headlights, indicators, brake lights' },
  { key: 'hydraulics',      label: 'Hydraulics — bin lift system' },
  { key: 'brakes',          label: 'Brakes — service & park brake' },
  { key: 'mirrors',         label: 'Mirrors — all adjusted & intact' },
  { key: 'seatbelt',        label: 'Seatbelt — working & unfrayed' },
  { key: 'fireExtinguisher', label: 'Fire Extinguisher — present & in date' },
  { key: 'firstAid',        label: 'First Aid Kit — present & stocked' },
  { key: 'waterFuel',       label: 'Water & Fuel — levels OK' },
  { key: 'loadRestraints',  label: 'Load Restraints — chains/straps present' },
]

export default function VehicleChecklist({ driverId, onComplete, onClose }) {
  const [checks, setChecks] = useState(Object.fromEntries(CHECKS.map(c => [c.key, false])))
  const [truckId, setTruckId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const allPassed = CHECKS.every(c => checks[c.key])
  const passedCount = CHECKS.filter(c => checks[c.key]).length

  function toggle(key) {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function checkAll() {
    setChecks(Object.fromEntries(CHECKS.map(c => [c.key, true])))
  }

  async function handleSubmit() {
    setLoading(true)
    setError('')
    try {
      await submitChecklist({ driverId, truckId, checks, notes })
      onComplete(allPassed)
    } catch (err) {
      setError('Failed to save checklist. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D1A',
      zIndex: 100,
      overflowY: 'auto',
      fontFamily: fontBody,
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 22, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pre-Start Checklist
            </div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>
              Complete before starting your shift
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'pointer' }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: '#aaa', fontSize: 13 }}>{passedCount} / {CHECKS.length} items checked</span>
            {!allPassed && (
              <button
                onClick={checkAll}
                style={{ background: 'none', border: 'none', color: B.yellow, fontSize: 13, cursor: 'pointer', padding: 0 }}
              >
                Check All
              </button>
            )}
          </div>
          <div style={{ height: 6, background: '#222', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              width: `${(passedCount / CHECKS.length) * 100}%`,
              background: allPassed ? B.green : B.yellow,
              borderRadius: 3,
              transition: 'width 0.2s',
            }} />
          </div>
        </div>

        {/* Truck ID */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Truck / Vehicle ID (optional)
          </label>
          <input
            type="text"
            value={truckId}
            onChange={e => setTruckId(e.target.value)}
            placeholder="e.g. T1, SS-001"
            style={{
              width: '100%', padding: '12px', background: '#111', border: '1px solid #333',
              borderRadius: 8, color: B.white, fontSize: 16, boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Checklist items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CHECKS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px',
                background: checks[key] ? '#0F2B1A' : '#1A1A2E',
                border: `2px solid ${checks[key] ? B.green : '#333'}`,
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: checks[key] ? B.green : '#333',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: 18,
              }}>
                {checks[key] ? '✓' : ''}
              </div>
              <span style={{ color: checks[key] ? B.white : '#aaa', fontSize: 15 }}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Notes (defects, issues)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Any issues to report…"
            style={{
              width: '100%', padding: '12px', background: '#111', border: '1px solid #333',
              borderRadius: 8, color: B.white, fontSize: 15, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: fontBody,
            }}
          />
        </div>

        {!allPassed && (
          <div style={{
            background: '#2B1A0F', border: `1px solid ${B.amber}`, borderRadius: 8,
            padding: '12px 16px', color: B.amber, fontSize: 14, marginBottom: 16,
          }}>
            ⚠ {CHECKS.length - passedCount} items not yet checked
          </div>
        )}

        {error && (
          <div style={{ background: '#3D1515', border: `1px solid ${B.red}`, borderRadius: 8, padding: '10px 14px', color: B.red, fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '18px',
            background: loading ? '#555' : (allPassed ? B.green : B.yellow),
            color: allPassed ? B.white : B.black,
            border: 'none', borderRadius: 8,
            fontSize: 20, fontFamily: fontHead, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : allPassed ? '✓ Submit — All Clear' : 'Submit Checklist'}
        </button>
      </div>
    </div>
  )
}
