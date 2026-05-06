import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { B, fontHead, fontBody } from '../theme'

// Sprint 11A polish (audit-ux.md §2.2):
//   - drop hardcoded `you@binnedit.com.au` placeholder (white-label leak)
//   - add Forgot Password link
//   - add "I'm a driver" deep-link to /driver
//   - drop the local `brand` palette in favour of theme.js tokens
//   - footer no longer leaks single tenant name to non-Binned-IT installs

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click Forgot password.')
      return
    }
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setResetSent(true)
  }

  return (
    <div style={{
      minHeight: '100vh', background: B.black, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: fontBody, padding: 16,
    }}>
      <div style={{
        background: B.white, borderRadius: 12, padding: '48px 40px',
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo.jpg"
            alt="SkipSync"
            style={{ height: 56, objectFit: 'contain', marginBottom: 16 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fontHead, color: B.textPrimary }}>
            SkipSync
          </div>
          <div style={{ fontSize: 13, color: B.textMuted, marginTop: 4 }}>
            Operations Intelligence Platform
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: B.textPrimary, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@example.com"
              style={{
                width: '100%', padding: '10px 14px', border: `1px solid ${B.cardBorder}`,
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: B.textPrimary, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 14px', border: `1px solid ${B.cardBorder}`,
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              style={{
                background: 'none', border: 'none', color: B.blue, fontSize: 12,
                cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit',
              }}
            >
              Forgot password?
            </button>
          </div>

          {resetSent && (
            <div style={{
              background: '#E6F7E6', border: '1px solid #A0E0A0', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#1E5E1E',
            }}>
              Password reset email sent. Check your inbox.
            </div>
          )}

          {error && (
            <div style={{
              background: '#FFF0F0', border: '1px solid #F5A0A0', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#C0392B',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: loading ? '#ccc' : B.black,
              color: B.white, border: 'none', borderRadius: 8, fontSize: 15,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: fontHead, letterSpacing: '0.5px',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Driver portal entry */}
        <div style={{
          marginTop: 24, paddingTop: 20, borderTop: `1px solid ${B.cardBorder}`,
          textAlign: 'center', fontSize: 13, color: B.textSecondary,
        }}>
          Are you a driver? <a
            href="/driver"
            style={{ color: B.blue, fontWeight: 600, textDecoration: 'none' }}
          >Open the Driver app →</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: B.textMuted }}>
          SkipSync · Operations Intelligence Platform
        </div>
      </div>
    </div>
  )
}
