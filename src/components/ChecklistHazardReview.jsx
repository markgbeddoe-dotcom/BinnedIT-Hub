import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { B, fontHead, fontBody } from '../theme'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useBreakpoint } from '../hooks/useBreakpoint'

// ─────────────────────────────────────────────────────────────────────────────
// ChecklistHazardReview — GAP-050 (UAT 2026-06-10)
//
// Fleet-manager review views for driver compliance:
//   1. vehicle_checklists — list/filter by date range, driver, pass/fail;
//      failed items + defect notes visible (passed is a DB generated column).
//   2. hazard_reports — list/filter by status with open → acknowledged →
//      resolved transitions (existing status CHECK + resolved_by/resolved_at).
//
// Data access is inline (supabase-js) because src/api/driver.js is owned by
// another work package tonight; the integrator may later consolidate these
// queries there.
//
// RLS: SELECT on both tables is open to all authenticated users; UPDATE on
// hazard_reports requires current_user_role() IN ('owner','manager') — the
// fleet_manager role will see the buttons (isManager includes fleet_manager
// in AuthContext) but DB writes will fail until the policy is extended.
// Errors are surfaced inline rather than silently swallowed.
// Mounted inside FleetManagementPage ("Driver Compliance" tab).
// ─────────────────────────────────────────────────────────────────────────────

const CHECK_ITEMS = [
  ['tyres_ok', 'Tyres'],
  ['lights_ok', 'Lights'],
  ['hydraulics_ok', 'Hydraulics'],
  ['brakes_ok', 'Brakes'],
  ['mirrors_ok', 'Mirrors'],
  ['seatbelt_ok', 'Seatbelt'],
  ['fire_extinguisher_ok', 'Fire Extinguisher'],
  ['first_aid_ok', 'First Aid Kit'],
  ['water_fuel_ok', 'Water & Fuel'],
  ['load_restraints_ok', 'Load Restraints'],
]

const HAZARD_TYPE_LABELS = {
  asbestos: 'Asbestos', electrical: 'Electrical', structural: 'Structural',
  access: 'Access', spill: 'Spill', animal: 'Animal', other: 'Other',
}

const HAZARD_STATUS_CONFIG = {
  open:         { label: 'Open',         color: B.red },
  acknowledged: { label: 'Acknowledged', color: B.amber },
  resolved:     { label: 'Resolved',     color: B.green },
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ── Inline data access (graceful: [] on error, never crash) ──
async function fetchChecklists({ from, to }) {
  try {
    const { data, error } = await supabase
      .from('vehicle_checklists')
      .select('*')
      .gte('check_date', from)
      .lte('check_date', to)
      .order('check_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

async function fetchHazards() {
  try {
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return []
    return data || []
  } catch {
    return []
  }
}

async function fetchProfileNames() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
    if (error) return {}
    return Object.fromEntries((data || []).map(p => [p.id, p.full_name]))
  } catch {
    return {}
  }
}

async function updateHazardStatus({ id, status, userId }) {
  const updates = { status }
  if (status === 'resolved') {
    updates.resolved_by = userId || null
    updates.resolved_at = new Date().toISOString()
  } else {
    updates.resolved_by = null
    updates.resolved_at = null
  }
  const { data, error } = await supabase
    .from('hazard_reports')
    .update(updates)
    .eq('id', id)
    .select()
  if (error) throw error
  // RLS silently returns 0 rows when the caller lacks the UPDATE policy.
  if (!data || data.length === 0) {
    throw new Error('Update rejected — requires owner or manager role (RLS).')
  }
  return data[0]
}

export default function ChecklistHazardReview() {
  const qc = useQueryClient()
  const { user, isOwner, isManager } = useAuth()
  const { isMobile } = useBreakpoint()
  const canManage = isOwner || isManager

  const [view, setView] = useState('checklists') // 'checklists' | 'hazards'
  const [fromDate, setFromDate] = useState(isoDaysAgo(14))
  const [toDate, setToDate] = useState(isoDaysAgo(0))
  const [driverFilter, setDriverFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all') // all | passed | failed
  const [hazardStatusFilter, setHazardStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [actionError, setActionError] = useState(null)

  // ── Queries ────────────────────────────────────────────────
  const { data: checklists = [], isLoading: checklistsLoading } = useQuery({
    queryKey: ['fleet-checklists', fromDate, toDate],
    queryFn: () => fetchChecklists({ from: fromDate, to: toDate }),
    retry: false,
  })
  const { data: hazards = [], isLoading: hazardsLoading } = useQuery({
    queryKey: ['fleet-hazards'],
    queryFn: fetchHazards,
    retry: false,
  })
  const { data: profileNames = {} } = useQuery({
    queryKey: ['profile-names'],
    queryFn: fetchProfileNames,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const hazardMut = useMutation({
    mutationFn: updateHazardStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fleet-hazards'] })
      setActionError(null)
    },
    onError: (e) => setActionError(e?.message || 'Update failed'),
  })

  const driverName = (id) => profileNames[id] || (id ? `${String(id).slice(0, 8)}…` : 'Unknown')

  // ── Derived ────────────────────────────────────────────────
  const driverOptions = useMemo(() => {
    const ids = [...new Set(checklists.map(c => c.driver_id).filter(Boolean))]
    return ids.map(id => ({ id, name: driverName(id) }))
  }, [checklists, profileNames]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredChecklists = useMemo(() => checklists.filter(c => {
    if (driverFilter !== 'all' && c.driver_id !== driverFilter) return false
    if (resultFilter === 'passed' && !c.passed) return false
    if (resultFilter === 'failed' && c.passed) return false
    return true
  }), [checklists, driverFilter, resultFilter])

  const filteredHazards = useMemo(() => hazards.filter(h =>
    hazardStatusFilter === 'all' ? true : h.status === hazardStatusFilter
  ), [hazards, hazardStatusFilter])

  const stats = useMemo(() => {
    const total = checklists.length
    const passed = checklists.filter(c => c.passed).length
    return {
      total,
      passRate: total > 0 ? Math.round((passed / total) * 100) : null,
      failed: total - passed,
      openHazards: hazards.filter(h => h.status === 'open').length,
      ackHazards: hazards.filter(h => h.status === 'acknowledged').length,
    }
  }, [checklists, hazards])

  const failedItems = (c) => CHECK_ITEMS.filter(([key]) => !c[key]).map(([, label]) => label)

  // ── Styles ─────────────────────────────────────────────────
  const cardStyle = { background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '12px 16px' }
  const iStyle = {
    background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 12, color: B.textPrimary, outline: 'none', fontFamily: fontBody,
  }
  const chipBtn = (active) => ({
    background: active ? B.yellow : 'transparent',
    border: `1px solid ${active ? B.yellow : B.cardBorder}`,
    color: active ? B.black : B.textSecondary,
    borderRadius: 16, padding: '5px 14px', cursor: 'pointer',
    fontFamily: fontHead, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  })

  return (
    <div data-testid="checklist-hazard-review">
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Checklists (range)', value: stats.total, color: B.blue },
          { label: 'Pass Rate', value: stats.passRate === null ? '—' : `${stats.passRate}%`, color: stats.passRate !== null && stats.passRate < 100 ? B.amber : B.green },
          { label: 'Failed Checklists', value: stats.failed, color: stats.failed > 0 ? B.red : B.green },
          { label: 'Open Hazards', value: stats.openHazards, color: stats.openHazards > 0 ? B.red : B.green },
        ].map(k => (
          <div key={k.label} style={{ ...cardStyle, borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: B.textPrimary, marginTop: 4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button data-testid="view-checklists-button" onClick={() => setView('checklists')} style={chipBtn(view === 'checklists')}>
          Pre-Start Checklists
        </button>
        <button data-testid="view-hazards-button" onClick={() => setView('hazards')} style={chipBtn(view === 'hazards')}>
          Hazard Reports {stats.openHazards > 0 && `(${stats.openHazards} open)`}
        </button>
      </div>

      {actionError && (
        <div style={{ background: `${B.red}12`, border: `1px solid ${B.red}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: B.red }}>
          ✗ {actionError}
        </div>
      )}

      {/* ── CHECKLISTS VIEW ── */}
      {view === 'checklists' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={iStyle} data-testid="checklist-from-date" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={iStyle} data-testid="checklist-to-date" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>Driver</label>
              <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)} style={iStyle} data-testid="checklist-driver-filter">
                <option value="all">All drivers</option>
                {driverOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>Result</label>
              <select value={resultFilter} onChange={e => setResultFilter(e.target.value)} style={iStyle} data-testid="checklist-result-filter">
                <option value="all">All</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {checklistsLoading ? (
            <div style={{ color: B.textMuted, fontSize: 13, padding: 20 }}>Loading…</div>
          ) : filteredChecklists.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 28, color: B.textMuted, fontSize: 13 }}>
              No checklists found for this range. Drivers submit pre-start checklists from the driver app before each shift.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredChecklists.map(c => {
                const fails = failedItems(c)
                const expanded = expandedId === c.id
                return (
                  <div
                    key={c.id}
                    data-testid="checklist-row"
                    onClick={() => setExpandedId(expanded ? null : c.id)}
                    style={{
                      ...cardStyle, cursor: 'pointer',
                      borderLeft: `4px solid ${c.passed ? B.green : B.red}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, fontFamily: fontHead,
                        background: c.passed ? `${B.green}20` : `${B.red}20`,
                        color: c.passed ? B.green : B.red, textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>
                        {c.passed ? 'Passed' : `Failed (${fails.length})`}
                      </span>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: B.textPrimary }}>{driverName(c.driver_id)}</div>
                        <div style={{ fontSize: 11, color: B.textMuted }}>
                          {fmtDate(c.check_date)} · Truck: {c.truck_id || '—'}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: B.textMuted, whiteSpace: 'nowrap' }}>
                        {fmtDateTime(c.created_at)}
                      </span>
                    </div>

                    {/* Defect notes always visible on failed checklists */}
                    {!c.passed && fails.length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: B.red }}>
                        Failed items: {fails.join(', ')}
                      </div>
                    )}
                    {c.notes && (
                      <div style={{ marginTop: 6, fontSize: 12, color: B.textSecondary, fontStyle: 'italic' }}>
                        Notes: {c.notes}
                      </div>
                    )}

                    {/* Expanded: full item grid */}
                    {expanded && (
                      <div style={{
                        marginTop: 10, paddingTop: 10, borderTop: `1px solid ${B.cardBorder}`,
                        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: 6,
                      }}>
                        {CHECK_ITEMS.map(([key, label]) => (
                          <div key={key} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: c[key] ? B.green : B.red, fontWeight: 700 }}>{c[key] ? '✓' : '✗'}</span>
                            <span style={{ color: c[key] ? B.textSecondary : B.red }}>{label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HAZARDS VIEW ── */}
      {view === 'hazards' && (
        <div>
          {/* Status filter chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {['all', 'open', 'acknowledged', 'resolved'].map(s => (
              <button
                key={s}
                onClick={() => setHazardStatusFilter(s)}
                data-testid={`hazard-filter-${s}`}
                style={chipBtn(hazardStatusFilter === s)}
              >
                {s === 'all' ? 'All' : HAZARD_STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>

          {hazardsLoading ? (
            <div style={{ color: B.textMuted, fontSize: 13, padding: 20 }}>Loading…</div>
          ) : filteredHazards.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 28, color: B.textMuted, fontSize: 13 }}>
              No hazard reports{hazardStatusFilter !== 'all' ? ` with status "${hazardStatusFilter}"` : ''}. Drivers raise hazards from the driver app.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredHazards.map(h => {
                const cfg = HAZARD_STATUS_CONFIG[h.status] || HAZARD_STATUS_CONFIG.open
                return (
                  <div key={h.id} data-testid="hazard-row" style={{ ...cardStyle, borderLeft: `4px solid ${cfg.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, fontFamily: fontHead,
                        background: `${cfg.color}20`, color: cfg.color, textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 4, fontFamily: fontHead,
                        background: h.hazard_type === 'asbestos' ? `${B.red}20` : `${B.blue}15`,
                        color: h.hazard_type === 'asbestos' ? B.red : B.blue,
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>
                        {HAZARD_TYPE_LABELS[h.hazard_type] || h.hazard_type}
                      </span>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 13, color: B.textPrimary }}>{h.description}</div>
                        <div style={{ fontSize: 11, color: B.textMuted, marginTop: 3 }}>
                          Reported by {driverName(h.reported_by)} · {fmtDateTime(h.created_at)}
                          {h.address ? ` · ${h.address}` : (h.lat && h.lng ? ` · ${Number(h.lat).toFixed(4)}, ${Number(h.lng).toFixed(4)}` : '')}
                        </div>
                        {h.status === 'resolved' && h.resolved_at && (
                          <div style={{ fontSize: 11, color: B.green, marginTop: 3 }}>
                            Resolved by {driverName(h.resolved_by)} · {fmtDateTime(h.resolved_at)}
                          </div>
                        )}
                        {h.photo_url && (
                          <a href={h.photo_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: B.blue, textDecoration: 'none', fontWeight: 600 }}>
                            View photo ↗
                          </a>
                        )}
                      </div>

                      {/* Status transitions */}
                      {canManage && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {h.status === 'open' && (
                            <button
                              data-testid="hazard-acknowledge-button"
                              disabled={hazardMut.isPending}
                              onClick={() => hazardMut.mutate({ id: h.id, status: 'acknowledged', userId: user?.id })}
                              style={{
                                background: B.amber, border: 'none', borderRadius: 6, color: '#000',
                                padding: '6px 12px', cursor: 'pointer', fontFamily: fontHead,
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              }}
                            >
                              Acknowledge
                            </button>
                          )}
                          {(h.status === 'open' || h.status === 'acknowledged') && (
                            <button
                              data-testid="hazard-resolve-button"
                              disabled={hazardMut.isPending}
                              onClick={() => hazardMut.mutate({ id: h.id, status: 'resolved', userId: user?.id })}
                              style={{
                                background: B.green, border: 'none', borderRadius: 6, color: '#fff',
                                padding: '6px 12px', cursor: 'pointer', fontFamily: fontHead,
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              }}
                            >
                              Resolve
                            </button>
                          )}
                          {h.status === 'resolved' && (
                            <button
                              data-testid="hazard-reopen-button"
                              disabled={hazardMut.isPending}
                              onClick={() => hazardMut.mutate({ id: h.id, status: 'open', userId: user?.id })}
                              style={{
                                background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6,
                                color: B.textSecondary, padding: '6px 12px', cursor: 'pointer',
                                fontFamily: fontHead, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                              }}
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
