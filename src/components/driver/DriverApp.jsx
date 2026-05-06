import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { B, fontHead, fontBody } from '../../theme'
import DriverLogin from './DriverLogin'
import JobQueue from './JobQueue'
import VehicleChecklist from './VehicleChecklist'
import { getTodayChecklist } from '../../api/driver'

/**
 * DriverApp — Full-screen mobile driver portal at /driver
 * Dark background, SkipSync yellow/black branding.
 * Handles its own auth state (drivers log in via Supabase auth).
 *
 * Mobile-fit polish (Sprint 12 #32):
 * - Uses useBreakpoint() so desktop browsers see a centred phone-width frame.
 * - iOS safe-area-inset padding so the notch/home-indicator doesn't clip UI.
 * - Tap targets ≥44px (Apple HIG) on the header burger and logo zone.
 * - Drawer width: min(280px, 85vw) so it fits 320px Galaxy Fold viewports.
 *
 * NOTE: For env(safe-area-inset-*) to actually return non-zero values on iOS,
 * index.html must include:
 *   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
 * (Sibling agent 12A owns index.html — this file does not edit it.)
 */
export default function DriverApp() {
  const { session, loading, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { isDesktop } = useBreakpoint()
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

  // Outer-shell style — safe-area insets on every code path so the notch and
  // home-indicator regions stay clear, plus a max-width frame on desktop so
  // the driver UI looks like a centred phone (not a stretched dashboard).
  const shellStyle = {
    minHeight: '100vh',
    background: B.black,
    fontFamily: fontBody,
    color: B.white,
    paddingTop: 'env(safe-area-inset-top, 0px)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)',
    maxWidth: isDesktop ? 520 : '100%',
    margin: isDesktop ? '0 auto' : 0,
    boxShadow: isDesktop ? '0 0 0 1px #1A1A1A' : 'none',
    position: 'relative',
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        ...shellStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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

  // Not authenticated — show driver login wrapped in the same safe-area shell
  // so the login screen also respects notch / home-indicator padding and the
  // desktop max-width frame.
  if (!session) {
    return (
      <div style={shellStyle}>
        <DriverLogin onLogin={() => {}} />
      </div>
    )
  }

  // Pre-start checklist screen — wrap so safe-area + desktop frame apply here too.
  if (screen === 'checklist') {
    return (
      <div style={shellStyle}>
        <VehicleChecklist
          driverId={session.user.id}
          onComplete={(passed) => {
            setChecklistDone(true)
            setScreen('jobs')
          }}
          onClose={() => setScreen('jobs')}
        />
      </div>
    )
  }

  // Main driver dashboard
  const driverName = profile?.full_name || session.user.email?.split('@')[0] || 'Driver'

  return (
    <div style={shellStyle}>
      {/* Top nav bar — height bumped to 56px (already ≥44px Apple HIG tap target),
          burger and logo zone are full-height buttons so the entire bar is tappable. */}
      <div style={{
        background: '#0D0D1A',
        borderBottom: `2px solid ${B.yellow}`,
        padding: '0 16px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 'env(safe-area-inset-top, 0px)',
        zIndex: 50,
      }}>
        {/* Burger — left side. min 44×44 tap target. */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          style={{
            background: 'none', border: 'none', color: '#aaa',
            fontSize: 24, cursor: 'pointer', lineHeight: 1,
            minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
          }}
        >
          ☰
        </button>

        {/* Logo — right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
          {checklistDone && (
            <span style={{ color: B.green, fontSize: 20 }} title="Pre-start checklist complete">✓</span>
          )}
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
            minHeight: 44,
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

      {/* Main content — inner max-width is now the shell's responsibility,
          so we just pad here. */}
      <div style={{ padding: '16px', paddingBottom: 32 }}>
        <JobQueue
          driverId={session.user.id}
          checklistDone={checklistDone}
          onOpenChecklist={() => setScreen('checklist')}
        />
      </div>

      {/* Side menu overlay. Drawer width caps at min(280px, 85vw) so it fits
          even on a 320px Galaxy Fold and never overlaps the close button. */}
      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: 0, left: 0, bottom: 0,
            width: 'min(280px, 85vw)',
            background: '#0D0D1A', borderRight: `2px solid ${B.yellow}`,
            zIndex: 201,
            padding: 24,
            paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))',
            paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
            paddingLeft: 'calc(24px + env(safe-area-inset-left, 0px))',
            display: 'flex', flexDirection: 'column',
          }}>
            <button
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              style={{
                background: 'none', border: 'none', color: '#888',
                fontSize: 28, cursor: 'pointer', alignSelf: 'flex-start',
                minWidth: 44, minHeight: 44,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>

            <div style={{ marginTop: 8, marginBottom: 24 }}>
              <div style={{ fontFamily: fontHead, fontSize: 18, color: B.yellow, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {driverName}
              </div>
              <div style={{ color: '#555', fontSize: 13, marginTop: 2, wordBreak: 'break-all' }}>{session.user.email}</div>
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
              <MenuBtn
                icon="🏠"
                label="Back to Hub"
                onClick={() => { setMenuOpen(false); navigate('/') }}
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
                minHeight: 44,
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
        minHeight: 44,
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
