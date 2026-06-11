import React, { useState, useEffect, useRef } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { submitChecklist, getActiveTrucks } from '../../api/driver'

// Labels for the 10 items — keys must match CHECKLIST_ITEMS in api/driver.js
const CHECKS = [
  { key: 'tyres',            label: 'Tyres — pressure & condition' },
  { key: 'lights',           label: 'Lights — headlights, indicators, brake lights' },
  { key: 'hydraulics',       label: 'Hydraulics — bin lift system' },
  { key: 'brakes',           label: 'Brakes — service & park brake' },
  { key: 'mirrors',          label: 'Mirrors — all adjusted & intact' },
  { key: 'seatbelt',         label: 'Seatbelt — working & unfrayed' },
  { key: 'fireExtinguisher', label: 'Fire Extinguisher — present & in date' },
  { key: 'firstAid',         label: 'First Aid Kit — present & stocked' },
  { key: 'waterFuel',        label: 'Water & Fuel — levels OK' },
  { key: 'loadRestraints',   label: 'Load Restraints — chains/straps present' },
]

const MIN_NOTE_LEN = 5
const OTHER_TRUCK = '__other__'

/**
 * VehicleChecklist — hard pre-shift gate form (WP-B / GAP-005 / FR7.2.x).
 *
 * - Each item gets explicit PASS / FAIL buttons; unanswered ≠ failed.
 * - FAIL requires an inline note (min 5 chars).
 * - Truck selection REQUIRED — roster from fleet_assets, free-text fallback
 *   if the roster is empty/unreachable (gate must never deadlock).
 * - Submit disabled until every item answered + truck chosen + fail notes
 *   present, with a reason line so drivers never guess why.
 * - Submitting with any FAIL → confirmation sheet (defect + blocked shift).
 * - NO close-X when used as the pre-shift gate; pass `onClose` only for the
 *   menu re-entry view (after a pass) to get a close button back.
 *
 * Props:
 *   driverId   (uuid, required)
 *   onComplete (row) => void — receives the saved vehicle_checklists row
 *                              (gate on row.passed, not on existence)
 *   onClose    optional — renders × ONLY when provided
 */
export default function VehicleChecklist({ driverId, onComplete, onClose }) {
  const [answers, setAnswers] = useState({})        // key → 'pass' | 'fail'
  const [failNotes, setFailNotes] = useState({})    // key → note text
  const [collapsed, setCollapsed] = useState({})    // key → true when PASS row collapsed
  const [trucks, setTrucks] = useState([])
  const [trucksLoading, setTrucksLoading] = useState(true)
  const [truckSelect, setTruckSelect] = useState('') // value from <select>
  const [truckFreeText, setTruckFreeText] = useState('')
  const [truckTouched, setTruckTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const noteRefs = useRef({})

  useEffect(() => {
    let alive = true
    getActiveTrucks()
      .then(t => { if (alive) { setTrucks(t); setTrucksLoading(false) } })
      .catch(() => { if (alive) { setTrucks([]); setTrucksLoading(false) } })
    return () => { alive = false }
  }, [])

  // ── derived state ────────────────────────────────────────────
  const rosterEmpty = !trucksLoading && trucks.length === 0
  const useFreeText = rosterEmpty || truckSelect === OTHER_TRUCK
  const truckId = useFreeText ? truckFreeText.trim() : truckSelect.trim()
  const truckChosen = truckId !== ''

  const answeredCount = CHECKS.filter(c => answers[c.key] === 'pass' || answers[c.key] === 'fail').length
  const unansweredCount = CHECKS.length - answeredCount
  const failedKeys = CHECKS.filter(c => answers[c.key] === 'fail').map(c => c.key)
  const missingNoteKeys = failedKeys.filter(k => (failNotes[k] || '').trim().length < MIN_NOTE_LEN)
  const allPass = answeredCount === CHECKS.length && failedKeys.length === 0

  const reasons = []
  if (unansweredCount > 0) reasons.push(`${unansweredCount} unanswered`)
  if (!truckChosen) reasons.push('truck not selected')
  if (missingNoteKeys.length > 0) reasons.push(`note required on ${missingNoteKeys.length} failed item${missingNoteKeys.length !== 1 ? 's' : ''}`)
  const canSubmit = reasons.length === 0

  // ── handlers ─────────────────────────────────────────────────
  function setAnswer(key, value) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setCollapsed(prev => ({ ...prev, [key]: value === 'pass' }))
    if (value === 'fail') {
      // autofocus the note field once it renders
      setTimeout(() => noteRefs.current[key]?.focus(), 50)
    }
  }

  function reopenItem(key) {
    setCollapsed(prev => ({ ...prev, [key]: false }))
  }

  async function doSubmit() {
    setConfirmOpen(false)
    setLoading(true)
    setError('')
    try {
      const row = await submitChecklist({ driverId, truckId, answers, failNotes, notes })
      if (row?.passed) {
        // success interstitial, then advance — this is also where the
        // location publisher starts (wired by integrator in DriverApp)
        setSuccess(true)
        setTimeout(() => onComplete?.(row), 1500)
      } else {
        onComplete?.(row)
      }
    } catch (err) {
      // Never clear a 10-item form on error — all local state retained.
      setError('Failed to save — retrying won’t lose your answers.')
      setLoading(false)
    }
  }

  function handleSubmitClick() {
    setTruckTouched(true)
    if (!canSubmit || loading) return
    if (failedKeys.length > 0) {
      setConfirmOpen(true)
    } else {
      doSubmit()
    }
  }

  // ── success interstitial ─────────────────────────────────────
  if (success) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0D0D1A', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: fontBody,
      }} data-testid="checklist-success">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 64, color: B.green, lineHeight: 1 }}>✓</div>
          <div style={{ fontFamily: fontHead, fontSize: 26, color: B.green, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 16 }}>
            All Clear
          </div>
          <div style={{ color: '#ccc', fontSize: 16, marginTop: 8 }}>
            Have a safe shift
          </div>
        </div>
      </div>
    )
  }

  // ── form ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0D0D1A',
      zIndex: 100,
      overflowY: 'auto',
      fontFamily: fontBody,
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 20, paddingBottom: 40 }}>
        {/* Header — close × ONLY when onClose provided (menu re-entry view) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 22, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pre-Start Checklist
            </div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 2 }}>
              All 10 items + truck required to start shift
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close checklist"
              data-testid="checklist-close"
              style={{
                background: 'none', border: 'none', color: '#888', fontSize: 28,
                cursor: 'pointer', minWidth: 44, minHeight: 44, padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          )}
        </div>

        {/* Progress — "Check All" deliberately REMOVED (FR7.2.1) */}
        <div style={{ marginBottom: 20 }}>
          <div aria-live="polite" style={{ color: '#aaa', fontSize: 13, marginBottom: 6 }}>
            {answeredCount} / {CHECKS.length} answered
          </div>
          <div style={{ height: 6, background: '#222', borderRadius: 3 }}>
            <div style={{
              height: '100%',
              width: `${(answeredCount / CHECKS.length) * 100}%`,
              background: allPass && answeredCount === CHECKS.length ? B.green : B.yellow,
              borderRadius: 3,
              transition: 'width 0.2s',
            }} />
          </div>
        </div>

        {/* Truck — REQUIRED (FR7.2.2) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {rosterEmpty ? 'Truck ID (rego or fleet code)' : 'Truck / Vehicle ID'}{' '}
            <span style={{ color: B.red }}>*</span>
          </label>

          {!rosterEmpty && (
            <select
              value={truckSelect}
              onChange={e => { setTruckSelect(e.target.value); setTruckTouched(true) }}
              disabled={trucksLoading}
              data-testid="checklist-truck-select"
              style={{
                width: '100%', padding: '12px', background: '#111',
                border: `1px solid ${truckTouched && !truckChosen ? B.red : '#333'}`,
                borderRadius: 8, color: truckSelect ? B.white : '#888', fontSize: 16,
                boxSizing: 'border-box', minHeight: 48, appearance: 'auto',
              }}
            >
              <option value="">{trucksLoading ? 'Loading trucks…' : 'Select truck…'}</option>
              {trucks.map(t => (
                <option key={t.id} value={t.identifier}>
                  {t.identifier}{t.registration ? ` — ${t.registration}` : ''}{t.description ? ` (${t.description})` : ''}
                </option>
              ))}
              {!trucksLoading && <option value={OTHER_TRUCK}>Other / not listed…</option>}
            </select>
          )}

          {useFreeText && (
            <input
              type="text"
              value={truckFreeText}
              onChange={e => { setTruckFreeText(e.target.value); setTruckTouched(true) }}
              placeholder="e.g. T1, SS-001"
              data-testid="checklist-truck-input"
              style={{
                width: '100%', padding: '12px', background: '#111',
                border: `1px solid ${truckTouched && !truckChosen ? B.red : '#333'}`,
                borderRadius: 8, color: B.white, fontSize: 16, boxSizing: 'border-box',
                marginTop: rosterEmpty ? 0 : 8, minHeight: 48,
              }}
            />
          )}

          {truckTouched && !truckChosen && (
            <div style={{ color: B.red, fontSize: 13, marginTop: 6 }}>⚠ Required</div>
          )}
        </div>

        {/* Checklist items — explicit PASS / FAIL per item (unanswered ≠ failed) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {CHECKS.map(({ key, label }) => {
            const answer = answers[key] // undefined | 'pass' | 'fail'
            const isPass = answer === 'pass'
            const isFail = answer === 'fail'
            const noteMissing = isFail && (failNotes[key] || '').trim().length < MIN_NOTE_LEN

            // Collapsed compact row for passed items — tap to reopen
            if (isPass && collapsed[key]) {
              return (
                <button
                  key={key}
                  onClick={() => reopenItem(key)}
                  data-testid={`checklist-item-${key}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', minHeight: 48,
                    background: '#0F2B1A', border: `2px solid ${B.green}`,
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ color: B.green, fontSize: 18, lineHeight: 1 }}>✓</span>
                  <span style={{ color: B.white, fontSize: 15 }}>{label}</span>
                </button>
              )
            }

            return (
              <div
                key={key}
                data-testid={`checklist-item-${key}`}
                style={{
                  padding: '14px 16px',
                  background: isFail ? '#2B0F0F' : isPass ? '#0F2B1A' : '#1A1A2E',
                  border: `2px solid ${isFail ? B.red : isPass ? B.green : '#333'}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ color: answer ? B.white : '#aaa', fontSize: 15, marginBottom: 10 }}>
                  {isFail && <span style={{ color: B.red, marginRight: 8 }}>✗</span>}
                  {isPass && <span style={{ color: B.green, marginRight: 8 }}>✓</span>}
                  {label}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setAnswer(key, 'pass')}
                    data-testid={`checklist-pass-${key}`}
                    style={{
                      flex: 1, minHeight: 44,
                      background: isPass ? B.green : '#222',
                      color: isPass ? B.white : '#aaa',
                      border: `1px solid ${isPass ? B.green : '#444'}`,
                      borderRadius: 8, fontFamily: fontHead, fontSize: 14,
                      textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                    }}
                  >
                    Pass
                  </button>
                  <button
                    onClick={() => setAnswer(key, 'fail')}
                    data-testid={`checklist-fail-${key}`}
                    style={{
                      flex: 1, minHeight: 44,
                      background: isFail ? B.red : '#222',
                      color: isFail ? B.white : '#aaa',
                      border: `1px solid ${isFail ? B.red : '#444'}`,
                      borderRadius: 8, fontFamily: fontHead, fontSize: 14,
                      textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                    }}
                  >
                    Fail
                  </button>
                </div>

                {isFail && (
                  <div style={{ marginTop: 10 }}>
                    <textarea
                      ref={el => { noteRefs.current[key] = el }}
                      value={failNotes[key] || ''}
                      onChange={e => setFailNotes(prev => ({ ...prev, [key]: e.target.value }))}
                      rows={2}
                      placeholder="Describe the fault…"
                      data-testid={`checklist-fail-note-${key}`}
                      style={{
                        width: '100%', padding: '10px 12px', background: '#111',
                        border: `1px solid ${noteMissing ? B.red : '#333'}`,
                        borderRadius: 8, color: B.white, fontSize: 15, resize: 'vertical',
                        boxSizing: 'border-box', fontFamily: fontBody,
                      }}
                    />
                    {noteMissing && (
                      <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>
                        ⚠ Note required (min {MIN_NOTE_LEN} characters)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* General notes (optional) */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Anything else to report…"
            data-testid="checklist-notes"
            style={{
              width: '100%', padding: '12px', background: '#111', border: '1px solid #333',
              borderRadius: 8, color: B.white, fontSize: 15, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: fontBody,
            }}
          />
        </div>

        {error && (
          <div style={{ background: '#3D1515', border: `1px solid ${B.red}`, borderRadius: 8, padding: '10px 14px', color: B.red, fontSize: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span>{error}</span>
            <button
              onClick={handleSubmitClick}
              data-testid="checklist-retry"
              style={{
                background: 'none', border: `1px solid ${B.red}`, color: B.red,
                borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
                fontFamily: fontHead, fontSize: 13, textTransform: 'uppercase',
                minHeight: 36, flexShrink: 0,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Submit — disabled until everything answered + truck chosen (FR7.2.2) */}
        <button
          onClick={handleSubmitClick}
          disabled={!canSubmit || loading}
          data-testid="checklist-submit"
          style={{
            width: '100%', padding: '18px', minHeight: 56,
            background: (!canSubmit || loading) ? '#333' : (allPass ? B.green : B.amber),
            color: (!canSubmit || loading) ? '#888' : (allPass ? B.white : B.black),
            border: 'none', borderRadius: 8,
            fontSize: 20, fontFamily: fontHead, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: (!canSubmit || loading) ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : allPass ? '✓ Submit — All Clear' : 'Submit Checklist'}
        </button>

        {/* Reason line — don't make drivers guess why submit is disabled */}
        {!canSubmit && (
          <div data-testid="checklist-submit-reason" style={{ color: '#aaa', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            {reasons.join(' · ')}
          </div>
        )}
      </div>

      {/* Confirmation sheet — submitting with FAILs creates a defect + blocks shift */}
      {confirmOpen && (
        <>
          <div
            onClick={() => setConfirmOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 110 }}
          />
          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 111,
            maxWidth: 480, margin: '0 auto',
            background: '#1A1A2E', borderTop: `2px solid ${B.amber}`,
            borderRadius: '16px 16px 0 0', padding: 20,
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          }} data-testid="checklist-confirm-sheet">
            <div style={{ color: B.amber, fontFamily: fontHead, fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ⚠ {failedKeys.length} failed item{failedKeys.length !== 1 ? 's' : ''} will be logged as a defect
            </div>
            <div style={{ color: '#ccc', fontSize: 15, lineHeight: 1.5, marginBottom: 18 }}>
              Your fleet manager will be notified and your shift is blocked until cleared.
            </div>
            <button
              onClick={doSubmit}
              data-testid="checklist-confirm-defect"
              style={{
                width: '100%', minHeight: 52, background: B.amber, color: B.black,
                border: 'none', borderRadius: 8, fontFamily: fontHead, fontSize: 16,
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                cursor: 'pointer', marginBottom: 10,
              }}
            >
              Log Defect &amp; Notify
            </button>
            <button
              onClick={() => setConfirmOpen(false)}
              data-testid="checklist-confirm-back"
              style={{
                width: '100%', minHeight: 48, background: 'none', color: '#aaa',
                border: '1px solid #444', borderRadius: 8, fontFamily: fontHead,
                fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              Go Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
