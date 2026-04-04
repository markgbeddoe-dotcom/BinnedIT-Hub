import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { B, fontHead, fontBody } from '../../theme'
import DriverLogin from './DriverLogin'
import JobQueue from './JobQueue'
import VehicleChecklist from './VehicleChecklist'
import { getTodayChecklist } from '../../api/driver'

/**
 * DriverApp — Full-screen mobile driver portal at /driver
 * Dark background, SkipSync yellow/black branding.
 * Handles its own auth state (drivers log in via Supabase auth).
 */
export default function DriverApp() {
  const { session, loading, profile, signOut } = useAuth()
  const [screen, setScreen] = useState('jobs') // 'jobs' | 'checklist'
  const [checklistDone, setChecklistDone] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // On mount, check if driver has already done today's checklist
  useEffect(() => {
    if (!session?.user?.id) return
    getTodayChecklist(session.user.id)
      .then(c => { if (c) setChecklistDone(true) })
      .catch(() => {})
  }, [session])

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: B.black,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: fontBody,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: fontHead, fontSize: 32, color: B.yellow, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            SkipSync
          </div>
          <div style={{ color: '#555', fontSize: 14, marginTop: 8 }}>Loading…</div>
        </div>
      </div>
    )
  }

  // Not authenticated — show driver login
  if (!session) {
    return <DriverLogin onLogin={() => {}} />
  }

  // Pre-start checklist screen
  if (screen === 'checklist') {
    return (
      <VehicleChecklist
        driverId={session.user.id}
        onComplete={(passed) => {
          setChecklistDone(true)
          setScreen('jobs')
        }}
        onClose={() => setScreen('jobs')}
      />
    )
  }

  // Main driver dashboard
  const driverName = profile?.full_name || session.user.email?.split('@')[0] || 'Driver'

  return (
    <div style={{
      minHeight: '100vh',
      background: B.black,
      fontFamily: fontBody,
      color: B.white,
    }}>
      {/* Top nav bar */}
      <div style={{
        background: '#0D0D1A',
        borderBottom: `2px solid ${B.yellow}`,
        padding: '0 16px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: B.yellow,
            color: B.black,
            fontFamily: fontHead,
            fontWeight: 700,
            fontSize: 14,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            SS
          </div>
          <div style={{ fontFamily: fontHead, fontSize: 16, color: B.white, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Driver
          </div>
        </div>

        {/* Driver name + menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {checklistDone && (
            <span style={{ color: B.green, fontSize: 20 }} title="Pre-start checklist complete">✓</span>
          )}
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              background: 'none', border: 'none', color: '#888',
              fontSize: 24, cursor: 'pointer', lineHeight: 1,
            }}
          >
            ☰
          </button>
        </div>
      </div>

      {/* Checklist nudge banner (if not done yet) */}
      {!checklistDone && (
        <div
          onClick={() => setScreen('checklist')}
          style={{
            background: '#2B1A0F',
            border: `1px solid ${B.amber}`,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            margin: '12px 16px',
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ color: B.amber, fontFamily: fontHead, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Pre-Start Checklist Needed
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                Complete before starting jobs today
              </div>
            </div>
          </div>
          <span style={{ color: B.amber, fontSize: 20 }}>›</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: '16px', paddingBottom: 32, maxWidth: 520, margin: '0 auto' }}>
        <JobQueue
          driverId={session.user.id}
          onOpenChecklist={() => setScreen('checklist')}
        />
      </div>

      {/* Side menu overlay */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 260,
            background: '#0D0D1A', borderLeft: `2px solid ${B.yellow}`,
            zIndex: 201, padding: 24, display: 'flex', flexDirection: 'column',
          }}>
            <button
              onClick={() => setMenuOpen(false)}
              style={{ background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'pointer', alignSelf: 'flex-end' }}
            >
              ×
            </button>

            <div style={{ marginTop: 8, marginBottom: 24 }}>
              <div style={{ fontFamily: fontHead, fontSize: 18, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {driverName}
              </div>
              <div style={{ color: '#555', fontSize: 13, marginTop: 2 }}>{session.user.email}</div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <MenuBtn
                icon="📋"
                label="Today's Jobs"
                onClick={() => { setScreen('jobs'); setMenuOpen(false) }}
                active={screen === 'jobs'}
              />
              <MenuBtn
                icon="✅"
                label="Pre-Start Checklist"
                onClick={() => { setScreen('checklist'); setMenuOpen(false) }}
                badge={checklistDone ? '✓' : '!'}
                badgeColor={checklistDone ? B.green : B.amber}
              />
            </div>

            <button
              onClick={signOut}
              style={{
                padding: '14px', background: '#1A1A1A',
                border: '1px solid #333', borderRadius: 8,
                color: '#888', fontFamily: fontHead, fontSize: 14,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', marginTop: 20,
              }}
            >
              Sign Out
            </button>

            <div style={{ color: '#333', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
              SkipSync Driver v3.0
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MenuBtn({ icon, label, onClick, active, badge, badgeColor }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px', background: active ? '#1A1A2E' : 'none',
        border: `1px solid ${active ? B.yellow : 'transparent'}`,
        borderRadius: 8, cursor: 'pointer', textAlign: 'left', position: 'relative',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ color: active ? B.yellow : B.white, fontFamily: fontHead, fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      {badge && (
        <span style={{
          marginLeft: 'auto',
          background: badgeColor + '22',
          border: `1px solid ${badgeColor}`,
          color: badgeColor,
          borderRadius: 4,
          padding: '2px 6px',
          fontSize: 11,
          fontFamily: fontHead,
        }}>
          {badge}
        </span>
      )}
    </button>
  )
}
