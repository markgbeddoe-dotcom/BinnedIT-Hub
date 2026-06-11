import React, { useRef, useState, useEffect } from 'react'
import { B, fontHead, fontBody } from '../../theme'
import { analyzeBinPhoto, flagAudit } from '../../api/wasteAudit'

const PHOTO_LABELS = {
  delivery: 'Bin Delivery Photo',
  collection: 'Bin Collection Photo',
  tip_docket: 'Tip Docket Photo',
  hazard: 'Hazard Photo',
  other: 'Other Photo',
}

// Confidence display per ux-spec §5: colour + percentage + WORD (never colour alone)
function confidenceMeta(conf) {
  const pct = Math.round((conf || 0) * 100)
  if (pct >= 75) return { pct, word: 'High', color: B.green }
  if (pct >= 50) return { pct, word: 'Medium', color: B.amber }
  return { pct, word: 'Low', color: B.red }
}

const sheetBtn = (bg, color, extra = {}) => ({
  width: '100%', minHeight: 52, padding: '14px',
  background: bg, color, border: 'none', borderRadius: 8,
  fontSize: 16, fontFamily: fontHead, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
  ...extra,
})

/**
 * PhotoCapture — tap to open device camera, preview captured image, confirm upload.
 * For 'collection' photos with a bookingId, offers an AI load check after the
 * upload succeeds (WP-D / FR7.5.3, ux-spec §5). Driver-facing: NO dollar
 * amounts anywhere in this component.
 *
 * Props:
 *   type: 'delivery' | 'collection' | 'tip_docket' | 'hazard' | 'other'
 *   onCapture: (file) => void      — parent uploads the photo
 *   onClose: () => void
 *   uploading: bool
 *   bookingId?: string             — enables the AI flow for collection photos
 *   declaredWasteType?: string
 *   photoId?: string               — job_photos.id once the upload finished
 *   uploadComplete?: bool          — parent sets true after a successful upload
 */
export default function PhotoCapture({
  type = 'other', onCapture, onClose, uploading = false,
  bookingId = null, declaredWasteType = null, photoId = null, uploadComplete = false,
}) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)

  // AI flow state: 'capture' | 'offer' | 'analyzing' | 'result' | 'flag' | 'error'
  const [stage, setStage] = useState('capture')
  const [aiResult, setAiResult] = useState(null)       // { audit, low_confidence }
  const [aiError, setAiError] = useState('')
  const [flagNote, setFlagNote] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)
  const [flagged, setFlagged] = useState(false)

  const aiEnabled = type === 'collection' && !!bookingId

  // After a successful collection upload, move to the AI offer screen.
  useEffect(() => {
    if (aiEnabled && uploadComplete && stage === 'capture' && file) {
      setStage('offer')
    }
  }, [aiEnabled, uploadComplete, stage, file])

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function handleConfirm() {
    if (file) onCapture(file)
  }

  function handleRetake() {
    setPreview(null)
    setFile(null)
    setTimeout(() => inputRef.current?.click(), 100)
  }

  async function runAnalysis() {
    setStage('analyzing')
    setAiError('')
    try {
      const res = await analyzeBinPhoto({
        bookingId,
        file,
        declaredWasteType,
        photoId,
      })
      setAiResult(res)
      setStage('result')
    } catch (err) {
      setAiError(err?.message || 'AI check unavailable')
      setStage('error')
    }
  }

  async function submitFlag() {
    if (!aiResult?.audit?.id) return
    setFlagSaving(true)
    try {
      await flagAudit({ auditId: aiResult.audit.id, note: flagNote.trim() || null })
      setFlagged(true)
      setStage('result')
    } catch {
      setFlagged(false)
      setStage('result')
      setAiError('Could not save the flag — office will still see the audit.')
    } finally {
      setFlagSaving(false)
    }
  }

  const label = PHOTO_LABELS[type] || 'Photo'
  const audit = aiResult?.audit
  const mismatch = audit ? audit.matches_declared === false : false
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: stage === 'capture' ? 'center' : 'flex-end',
      padding: stage === 'capture' ? 20 : 0,
      fontFamily: fontBody,
      overflowY: 'auto',
    }}>
      {stage === 'capture' && (
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontFamily: fontHead, fontSize: 20, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </div>
            <button data-testid="photo-close" onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'pointer', lineHeight: 1, minWidth: 44, minHeight: 44 }}>×</button>
          </div>

          {/* Preview or prompt */}
          {preview ? (
            <div>
              <img
                src={preview}
                alt="Preview"
                style={{ width: '100%', borderRadius: 10, maxHeight: 340, objectFit: 'cover', border: `2px solid ${B.yellow}` }}
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                <button
                  onClick={handleRetake}
                  disabled={uploading}
                  style={{
                    flex: 1, padding: '16px', background: '#333', color: B.white, border: 'none', borderRadius: 8,
                    fontSize: 16, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer'
                  }}
                >
                  Retake
                </button>
                <button
                  data-testid="photo-use"
                  onClick={handleConfirm}
                  disabled={uploading}
                  style={{
                    flex: 2, padding: '16px', background: uploading ? '#888' : B.yellow, color: B.black, border: 'none', borderRadius: 8,
                    fontSize: 18, fontFamily: fontHead, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: uploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {uploading ? 'Uploading…' : 'Use Photo'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  width: '100%',
                  height: 240,
                  background: '#111',
                  border: `2px dashed ${B.yellow}`,
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 56 }}>📷</div>
                <div style={{ color: B.yellow, fontFamily: fontHead, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Tap to Take Photo
                </div>
                <div style={{ color: '#aaa', fontSize: 13 }}>Opens device camera</div>
              </div>
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  width: '100%', marginTop: 16, padding: '18px',
                  background: B.yellow, color: B.black, border: 'none', borderRadius: 8,
                  fontSize: 20, fontFamily: fontHead, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', cursor: 'pointer',
                }}
              >
                Open Camera
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── AI bottom sheet (offer / analyzing / result / flag / error) ── */}
      {stage !== 'capture' && (
        <div style={{
          width: '100%', maxWidth: 420,
          background: '#0D0D1A',
          borderRadius: '16px 16px 0 0',
          padding: '10px 18px 24px',
          boxSizing: 'border-box',
        }}>
          {/* drag handle */}
          <div style={{ width: 44, height: 4, background: '#444', borderRadius: 2, margin: '0 auto 12px' }} />
          <div style={{ fontFamily: fontHead, fontSize: 18, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            AI Load Check
          </div>

          {/* thumbnail */}
          {preview && (
            <img src={preview} alt="Collection" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #333', marginBottom: 14 }} />
          )}

          {stage === 'offer' && (
            <div>
              <div style={{ color: B.green, fontSize: 14, marginBottom: 12 }}>✓ Collection photo saved</div>
              {offline ? (
                <div style={{ background: '#1A1A2E', border: '1px solid #444', borderRadius: 8, padding: '12px', color: '#aaa', fontSize: 14, marginBottom: 12 }}>
                  📶 You're offline — AI check will run when back online. Office can also run it later.
                </div>
              ) : (
                <button data-testid="analyze-ai-btn" onClick={runAnalysis} style={sheetBtn(B.yellow, B.black, { marginBottom: 10 })}>
                  🤖 Analyze Contents (AI)
                </button>
              )}
              <button data-testid="ai-skip-btn" onClick={onClose} style={sheetBtn('#333', B.white)}>
                Done
              </button>
            </div>
          )}

          {stage === 'analyzing' && (
            <div>
              {/* shimmer chips */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[64, 88, 72].map((w, i) => (
                  <div key={i} style={{ width: w, height: 32, borderRadius: 16, background: '#1A1A2E', border: '1px solid #333' }} />
                ))}
              </div>
              <div style={{ color: '#aaa', fontSize: 15, textAlign: 'center', padding: '8px 0 16px' }}>
                Analysing photo… ~10s
              </div>
              <button onClick={onClose} style={sheetBtn('#333', B.white)}>
                Keep Working — Result Saved For Office
              </button>
            </div>
          )}

          {stage === 'result' && audit && (
            <div data-testid="ai-result-sheet">
              {/* Detected chips — dominant filled, others outlined */}
              <div style={{ color: '#aaa', fontSize: 11, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Detected In Bin
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {(Array.isArray(audit.detected_waste_types) ? audit.detected_waste_types : []).map((t) => {
                  const dom = t === audit.dominant_type
                  return (
                    <span key={t} style={{
                      minHeight: 32, display: 'inline-flex', alignItems: 'center',
                      padding: '4px 14px', borderRadius: 16, fontSize: 13,
                      background: dom ? B.yellow : 'transparent',
                      color: dom ? B.black : '#ccc',
                      border: dom ? 'none' : '1px solid #444',
                      fontWeight: dom ? 700 : 400,
                    }}>
                      {t}
                    </span>
                  )
                })}
              </div>

              {/* Confidence bar: colour + % + word */}
              <div style={{ color: '#aaa', fontSize: 11, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Confidence
              </div>
              {(() => {
                const m = confidenceMeta(Number(audit.confidence))
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 8, background: '#1A1A2E', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${m.pct}%`, height: '100%', background: m.color }} />
                    </div>
                    <span style={{ color: m.color, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {m.pct}% {m.word}
                    </span>
                  </div>
                )
              })()}

              {/* Declared vs detected */}
              <div style={{ color: '#aaa', fontSize: 11, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Declared vs Detected
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#333', border: '1px solid #333', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ background: mismatch ? '#1A1A2E' : '#0F2B1A', padding: '10px 12px' }}>
                  <div style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Declared</div>
                  <div style={{ color: B.white, fontSize: 14, marginTop: 2 }}>{audit.declared_waste_type || '—'}</div>
                </div>
                <div style={{ background: mismatch ? '#2B1A0F' : '#0F2B1A', padding: '10px 12px' }}>
                  <div style={{ color: '#aaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Detected</div>
                  <div style={{ color: B.white, fontSize: 14, marginTop: 2 }}>
                    {(audit.detected_waste_types || []).join(' + ') || audit.dominant_type || '—'}
                  </div>
                </div>
              </div>
              <div data-testid="ai-match-banner" style={{
                textAlign: 'center', fontSize: 13, fontWeight: 700, marginBottom: 12,
                color: mismatch ? '#FFC75A' : B.green,
              }}>
                {mismatch ? '✗ MISMATCH' : '✓ MATCHES'}
              </div>

              {/* Low confidence banner */}
              {aiResult?.low_confidence && (
                <div style={{ background: '#1A1A2E', border: `1px solid ${B.amber}`, borderRadius: 8, padding: '10px 12px', color: '#FFC75A', fontSize: 13, marginBottom: 12 }}>
                  ? AI isn't sure about this one — flagged for office review automatically.
                </div>
              )}

              {/* Neutral consequence copy — no fault language, NO dollar figures */}
              <div style={{ color: '#aaa', fontSize: 13, marginBottom: 14 }}>
                ⓘ Office will review this load. No action needed unless asked.
              </div>

              {aiError && (
                <div style={{ color: '#E07B7B', fontSize: 13, marginBottom: 10 }}>⚠ {aiError}</div>
              )}

              {flagged ? (
                <div style={{ background: '#0F2B1A', border: `1px solid ${B.green}`, borderRadius: 8, padding: '12px', color: B.green, fontSize: 14, marginBottom: 10, textAlign: 'center' }}>
                  ✓ Sent to office with your note
                </div>
              ) : (
                <button
                  data-testid="ai-flag-btn"
                  onClick={() => setStage('flag')}
                  style={sheetBtn('transparent', '#FFC75A', { border: `1px solid ${B.amber}`, marginBottom: 10 })}
                >
                  {mismatch ? '🚩 Add A Note For Office' : '🚩 Flag For Office Review'}
                </button>
              )}
              <button data-testid="ai-done-btn" onClick={onClose} style={sheetBtn('#333', B.white)}>
                Done
              </button>
            </div>
          )}

          {stage === 'flag' && (
            <div>
              <div style={{ color: '#ccc', fontSize: 14, marginBottom: 10 }}>
                Add context for the office (e.g. "customer added concrete after delivery"):
              </div>
              <textarea
                data-testid="ai-flag-note"
                value={flagNote}
                onChange={e => setFlagNote(e.target.value)}
                rows={3}
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#1A1A2E',
                  border: '1px solid #444', borderRadius: 8, color: B.white,
                  fontSize: 15, padding: 12, fontFamily: fontBody, marginBottom: 12,
                }}
              />
              <button
                data-testid="ai-flag-submit"
                onClick={submitFlag}
                disabled={flagSaving}
                style={sheetBtn(flagSaving ? '#888' : B.yellow, B.black, { marginBottom: 10 })}
              >
                {flagSaving ? 'Saving…' : 'Send To Office'}
              </button>
              <button onClick={() => setStage('result')} style={sheetBtn('#333', B.white)}>
                Back
              </button>
            </div>
          )}

          {stage === 'error' && (
            <div>
              <div style={{ background: '#2B1A0F', border: `1px solid ${B.amber}`, borderRadius: 8, padding: '12px', color: '#FFC75A', fontSize: 14, marginBottom: 14 }}>
                ⚠ AI check unavailable — photo saved. Office can review it later.
                {aiError ? <div style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>{aiError}</div> : null}
              </div>
              <button data-testid="ai-retry-btn" onClick={runAnalysis} style={sheetBtn(B.yellow, B.black, { marginBottom: 10 })}>
                Retry
              </button>
              <button onClick={onClose} style={sheetBtn('#333', B.white)}>
                Done
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input — uses camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}
