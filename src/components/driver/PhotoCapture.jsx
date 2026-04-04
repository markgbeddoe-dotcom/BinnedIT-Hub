import React, { useRef, useState } from 'react'
import { B, fontHead, fontBody } from '../../theme'

const PHOTO_LABELS = {
  delivery: 'Bin Delivery Photo',
  collection: 'Bin Collection Photo',
  tip_docket: 'Tip Docket Photo',
  hazard: 'Hazard Photo',
  other: 'Other Photo',
}

/**
 * PhotoCapture — tap to open device camera, preview captured image, confirm upload.
 * Props:
 *   type: 'delivery' | 'collection' | 'tip_docket' | 'hazard' | 'other'
 *   onCapture: (file) => void
 *   onClose: () => void
 *   uploading: bool
 */
export default function PhotoCapture({ type = 'other', onCapture, onClose, uploading = false }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [file, setFile] = useState(null)

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

  const label = PHOTO_LABELS[type] || 'Photo'

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.92)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: fontBody,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 20, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'pointer', lineHeight: 1 }}>×</button>
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
              <div style={{ color: '#666', fontSize: 13 }}>Opens device camera</div>
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
    </div>
  )
}
