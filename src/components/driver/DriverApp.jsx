import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { B, fontHead, fontBody } from '../../theme'
import DriverLogin from './DriverLogin'
import JobQueue from './JobQueue'
import VehicleChecklist from './VehicleChecklist'
import { getTodayChecklist, getChecklistBlockShiftRule, getTodayJobs } from '../../api/driver'
import { useLocationPublisher } from '../../hooks/useLocationPublisher'

// PLACEHOLDER — integrator/Mark: replace with the real Binned-IT dispatch
// number (or read from platform_settings). Used by the failed-gate
// "Call Dispatch" button only.
const DISPATCH_PHONE = '+61390000000'

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
  const [todayChecklist, setTodayChecklist] = useState(null) // today's vehicle_checklists row or null
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [blockOnFail, setBlockOnFail] = useState(true) // rules engine: checklist_block_shift (fail closed)
  const [jobCount, setJobCount] = useState(null) // teaser count for the gate screen
  const [menuOpen, setMenuOpen] = useState(false)

  // HARD GATE (GAP-005 / FR7.2.5): checklistDone ONLY when today's row has
  // passed === true — the DB generated column is the single source of truth.
  const checklistDone = todayChecklist?.passed === true
  // Warn-mode relaxation (FR7.2.8): a FAILED checklist only unlocks jobs if
  // Mark has explicitly set rule checklist_block_shift=false. A MISSING
  // checklist never unlocks anything.
  const jobsUnlocked = checklistDone || (Boolean(todayChecklist) && !blockOnFail)

  // WP-C (R3): publish live GPS to dispatch while the shift is active.
  // Consent-gated (ADR-701) — publishes nothing until the driver opts in.
  const {
    publishing: gpsPublishing,
    consentGiven: gpsConsent,
    grantConsent: grantGpsConsent,
  } = useLocationPublisher({
    enabled: Boolean(session?.user?.id) && jobsUnlocked,
    driverId: session?.user?.id || null,
    truckId: todayChecklist?.truck_id || null,
  })

  // On mount, load today's checklist row + the block-shift rule
  useEffect(() => {
    if (!session?.user?.id) return
    let alive = true
    setChecklistLoading(true)
    Promise.all([
      getTodayChecklist(session.user.id).catch(() => null),
      getChecklistBlockShiftRule().catch(() => true),
    ]).then(([row, block]) => {
      if (!alive) return
      setTodayChecklist(row)
      setBlockOnFail(block !== false) // anything but explicit false blocks
      setChecklistLoading(false)
    })
    return () => { alive = false }
  }, [session])

  // Teaser job count for the gate screen ("3 jobs waiting") — count only,
  // no job details leak pre-checklist. Best-effort.
  useEffect(() => {
    if (!session?.user?.id) return
    getTodayJobs(session.user.id)
      .then(jobs => setJobCount(jobs.length))
      .catch(() => setJobCount(null))
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
  // onClose is ONLY passed when today's checklist already passed (menu re-entry
  // view). When used as the pre-shift gate there is no close-X escape (FR7.2.4).
  if (screen === 'checklist') {
    return (
      <div style={shellStyle}>
        <VehicleChecklist
          driverId={session.user.id}
          onComplete={(row) => {
            if (row) setTodayChecklist(row)
            setScreen('jobs')
          }}
          onClose={checklistDone ? () => setScreen('jobs') : undefined}
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
          {gpsPublishing && (
            <span style={{ color: B.blue, fontSize: 16 }} title="Sharing live location with dispatch">📡</span>
          )}
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

      {/* Warn-mode banner — only when a FAILED checklist exists AND the
          checklist_block_shift rule was explicitly relaxed (FR7.2.8). */}
      {!checklistLoading && jobsUnlocked && !checklistDone && (
        <div
          onClick={() => setScreen('checklist')}
          data-testid="driver-checklist-warn-banner"
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
                Checklist Failed — Defect Logged
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                Shift allowed by dispatch rule. Tap to re-run the checklist.
              </div>
            </div>
          </div>
          <span style={{ color: B.amber, fontSize: 20 }}>›</span>
        </div>
      )}

      {/* WP-C (R3): first-use location consent — shown once the shift is
          active and consent has loaded as not-yet-given. */}
      {!checklistLoading && jobsUnlocked && gpsConsent === false && (
        <div
          data-testid="driver-gps-consent-banner"
          style={{
            background: '#0F1B2B',
            border: `1px solid ${B.blue}`,
            padding: '12px 16px',
            margin: '12px 16px',
            borderRadius: 8,
          }}
        >
          <div style={{ color: B.white, fontSize: 14, lineHeight: 1.5 }}>
            📡 Share your live location with dispatch while on shift? It powers the
            live map and only runs while the app is open.
          </div>
          <button
            onClick={grantGpsConsent}
            data-testid="driver-gps-consent-allow"
            style={{
              marginTop: 10, width: '100%', minHeight: 44,
              background: B.blue, color: B.white, border: 'none', borderRadius: 8,
              fontFamily: fontHead, fontSize: 14, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
            }}
          >
            Share Location
          </button>
        </div>
      )}

      {/* Main content — HARD GATE: jobs are not reachable until today's
          checklist passes (or warn-mode rule relaxes a failed one). */}
      <div style={{ padding: '16px', paddingBottom: 32 }}>
        {checklistLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: B.yellow, fontSize: 36 }}>⏳</div>
            <div style={{ color: '#aaa', fontSize: 15 }}>Checking pre-start status…</div>
          </div>
        ) : !jobsUnlocked ? (
          <ChecklistGate
            failed={Boolean(todayChecklist) && todayChecklist.passed === false}
            jobCount={jobCount}
            onStartChecklist={() => setScreen('checklist')}
          />
        ) : (
          <JobQueue
            driverId={session.user.id}
            checklistDone={jobsUnlocked}
            onOpenChecklist={() => setScreen('checklist')}
          />
        )}
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

/**
 * ChecklistGate — blocking screen shown instead of the job queue until
 * today's checklist passes (ux-spec-v7 §3.1). Two variants:
 *  - default: lock + "PRE-START REQUIRED" + START CHECKLIST
 *  - failed:  amber "CHECKLIST FAILED — DEFECT LOGGED" + RE-RUN + CALL DISPATCH
 * Teaser shows a job COUNT only — no actionable detail leaks pre-checklist.
 */
function ChecklistGate({ failed, jobCount, onStartChecklist }) {
  return (
    <div
      data-testid="driver-checklist-gate"
      style={{ textAlign: 'center', paddingTop: '8vh', paddingBottom: 24 }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{failed ? '⚠️' : '🔒'}</div>

      <div style={{
        fontFamily: fontHead, fontSize: 22, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: failed ? B.amber : B.yellow,
        marginBottom: 12,
      }}>
        {failed ? 'Checklist Failed — Defect Logged' : 'Pre-Start Required'}
      </div>

      <div style={{ color: '#ccc', fontSize: 15, lineHeight: 1.5, maxWidth: 320, margin: '0 auto 24px' }}>
        {failed
          ? 'Fleet manager notified. Fix the issue and re-run the checklist, or wait for dispatch.'
          : "You can't see today's jobs until your vehicle checklist is complete."}
      </div>

      <button
        onClick={onStartChecklist}
        data-testid={failed ? 'gate-rerun-checklist' : 'gate-start-checklist'}
        style={{
          width: '100%', maxWidth: 360, minHeight: 56,
          background: failed ? B.amber : B.yellow, color: B.black,
          border: 'none', borderRadius: 8,
          fontFamily: fontHead, fontSize: 18, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
        }}
      >
        {failed ? 'Re-Run Checklist' : '✅ Start Checklist'}
      </button>

      {failed && (
        <a
          href={`tel:${DISPATCH_PHONE}`}
          data-testid="gate-call-dispatch"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', maxWidth: 360, minHeight: 48, margin: '10px auto 0',
            background: 'none', color: '#aaa', border: '1px solid #444',
            borderRadius: 8, fontFamily: fontHead, fontSize: 15,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            textDecoration: 'none', boxSizing: 'border-box',
          }}
        >
          📞 Call Dispatch
        </a>
      )}

      {!failed && typeof jobCount === 'number' && jobCount > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ color: '#888', fontSize: 14, marginBottom: 10 }}>
            {jobCount} job{jobCount !== 1 ? 's' : ''} waiting for you
          </div>
          {/* Blurred ghost rows — motivation without leaking detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360, margin: '0 auto' }}>
            {Array.from({ length: Math.min(jobCount, 3) }).map((_, i) => (
              <div key={i} style={{
                height: 18, borderRadius: 4, background: '#1A1A2E',
                opacity: 0.7 - i * 0.15, filter: 'blur(1px)',
              }} />
            ))}
          </div>
        </div>
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
