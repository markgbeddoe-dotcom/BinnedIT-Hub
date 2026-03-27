import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const brand = {
    black: '#000000',
    yellow: '#F5C518',
    white: '#FFFFFF',
    gray: '#F4F4F6',
    border: '#E0DDE8',
    text: '#1A1A2E',
    muted: '#6B6B80',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', background: brand.black, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: '"DM Sans", sans-serif',
    }}>
      <div style={{
        background: brand.white, borderRadius: 12, padding: '48px 40px',
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo area */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/logo.jpg"
            alt="Binned-IT"
            style={{ height: 56, objectFit: 'contain', marginBottom: 16 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Oswald, sans-serif', color: brand.text }}>
            Dashboard Hub
          </div>
          <div style={{ fontSize: 13, color: brand.muted, marginTop: 4 }}>
            Management Intelligence Platform
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: brand.text, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@binnedit.com.au"
              style={{
                width: '100%', padding: '10px 14px', border: `1px solid ${brand.border}`,
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: brand.text, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 14px', border: `1px solid ${brand.border}`,
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

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
              width: '100%', padding: '12px', background: loading ? '#ccc' : brand.black,
              color: brand.white, border: 'none', borderRadius: 8, fontSize: 15,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Oswald, sans-serif', letterSpacing: '0.5px',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: brand.muted }}>
          Binned-IT Pty Ltd — Seaford, Melbourne
        </div>
      </div>
    </div>
  )
}
