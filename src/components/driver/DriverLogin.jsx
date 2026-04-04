import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { B, fontHead, fontBody } from '../../theme'

export default function DriverLogin({ onLogin }) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await signIn(email.trim(), password)
    setLoading(false)
    if (err) {
      setError('Invalid email or password')
    } else {
      onLogin()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: B.black,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: fontBody,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          fontFamily: fontHead,
          fontSize: 36,
          fontWeight: 700,
          color: B.yellow,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          SkipSync
        </div>
        <div style={{ color: '#888', fontSize: 14, marginTop: 4 }}>Driver Portal</div>
      </div>

      {/* Login card */}
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: '#1A1A2E',
        borderRadius: 12,
        padding: 28,
        border: `1px solid #333`,
      }}>
        <div style={{ fontFamily: fontHead, fontSize: 20, color: B.white, marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Sign In
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '14px 12px',
                background: '#0D0D1A',
                border: '1px solid #444',
                borderRadius: 8,
                color: B.white,
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#aaa', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '14px 12px',
                background: '#0D0D1A',
                border: '1px solid #444',
                borderRadius: 8,
                color: B.white,
                fontSize: 16,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{ background: '#3D1515', border: '1px solid #E74C3C', borderRadius: 8, padding: '10px 14px', color: '#E74C3C', fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: loading ? '#888' : B.yellow,
              color: B.black,
              border: 'none',
              borderRadius: 8,
              fontSize: 18,
              fontFamily: fontHead,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>

      <div style={{ marginTop: 24, color: '#555', fontSize: 12 }}>
        SkipSync Driver Portal v3.0
      </div>
    </div>
  )
}
