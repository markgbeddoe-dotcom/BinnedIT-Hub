import React, { useState, useMemo } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useFleetAssets, useUpcomingMaintenance, useAddMaintenanceRecord } from '../hooks/useFleet'
import { useBreakpoint } from '../hooks/useBreakpoint'

// ── Fallback data ──────────────────────────────────────────────────────────────
const FALLBACK_VEHICLES = [
  { id: 'v1', asset_type: 'truck', identifier: 'TRK-001', description: 'Mack — Primary Hook Lift', registration: 'ABC123', rego_expiry: '2026-06-30', year_of_manufacture: 2018, status: 'available', current_location: 'depot', odometer_km: 128400, next_service_due: '2026-05-01', is_active: true, notes: '' },
  { id: 'v2', asset_type: 'truck', identifier: 'TRK-002', description: 'Isuzu — Secondary Truck', registration: 'XYZ456', rego_expiry: '2026-05-15', year_of_manufacture: 2020, status: 'in-use', current_location: 'on-site', odometer_km: 87200, next_service_due: '2026-04-15', is_active: true, notes: '' },
  { id: 'v3', asset_type: 'trailer', identifier: 'TRL-001', description: 'Tipping Trailer', registration: 'TRL001', rego_expiry: '2026-08-20', year_of_manufacture: 2019, status: 'available', current_location: 'depot', odometer_km: null, next_service_due: null, is_active: true, notes: '' },
]

const FALLBACK_BINS = [
  { id: 'b1', asset_type: 'bin', identifier: 'BIN-4M-001', description: '4m³ General Waste', registration: null, rego_expiry: null, status: 'in-use', current_location: 'on-site', is_active: true, notes: 'Job #1042 — Seaford' },
  { id: 'b2', asset_type: 'bin', identifier: 'BIN-4M-002', description: '4m³ General Waste', registration: null, rego_expiry: null, status: 'available', current_location: 'depot', is_active: true, notes: '' },
  { id: 'b3', asset_type: 'bin', identifier: 'BIN-6M-001', description: '6m³ General Waste', registration: null, rego_expiry: null, status: 'in-use', current_location: 'on-site', is_active: true, notes: 'Job #1038 — Frankston' },
  { id: 'b4', asset_type: 'bin', identifier: 'BIN-6M-002', description: '6m³ General Waste', registration: null, rego_expiry: null, status: 'available', current_location: 'depot', is_active: true, notes: '' },
  { id: 'b5', asset_type: 'bin', identifier: 'BIN-8M-001', description: '8m³ General Waste', registration: null, rego_expiry: null, status: 'in-transit', current_location: 'in-transit', is_active: true, notes: 'Returning from Carrum Downs' },
  { id: 'b6', asset_type: 'bin', identifier: 'BIN-8M-ASB', description: '8m³ Asbestos', registration: null, rego_expiry: null, status: 'available', current_location: 'depot', is_active: true, notes: 'Licensed for asbestos only' },
  { id: 'b7', asset_type: 'bin', identifier: 'BIN-10M-001', description: '10m³ General Waste', registration: null, rego_expiry: null, status: 'maintenance', current_location: 'workshop', is_active: true, notes: 'Crack repair — due back 8 Apr' },
]

const FALLBACK_MAINTENANCE = [
  { id: 'm1', asset_id: 'v1', asset_identifier: 'TRK-001', maintenance_type: 'service', description: '50,000km service — oil, filters, brakes', performed_date: '2026-01-15', next_due_date: '2026-05-01', cost: 1240, performed_by: 'Mick\'s Trucks Frankston', notes: '' },
  { id: 'm2', asset_id: 'v2', asset_identifier: 'TRK-002', maintenance_type: 'registration', description: 'Annual rego renewal', performed_date: '2025-05-15', next_due_date: '2026-05-15', cost: 890, performed_by: 'VicRoads', notes: '' },
  { id: 'm3', asset_id: 'v1', asset_identifier: 'TRK-001', maintenance_type: 'repair', description: 'Hydraulic hose replacement', performed_date: '2025-12-03', next_due_date: null, cost: 480, performed_by: 'Mick\'s Trucks Frankston', notes: 'Monitor for further leaks' },
  { id: 'm4', asset_id: 'b7', asset_identifier: 'BIN-10M-001', maintenance_type: 'repair', description: 'Weld crack on front wall', performed_date: '2026-04-01', next_due_date: '2026-04-08', cost: 320, performed_by: 'Bay Welding', notes: 'Back in service after inspection' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24))
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_CONFIG = {
  available:   { label: 'Available',   bg: `${B.green}20`,  color: B.green  },
  'in-use':    { label: 'In Use',      bg: `${B.blue}20`,   color: B.blue   },
  'in-transit':{ label: 'In Transit',  bg: `${B.amber}20`,  color: B.amber  },
  maintenance: { label: 'Maintenance', bg: `${B.red}20`,    color: B.red    },
  retired:     { label: 'Retired',     bg: '#3D3D4F20',     color: B.textMuted },
}

const LOCATION_ICONS = { depot:'🏭', 'on-site':'📍', 'in-transit':'🚛', workshop:'🔧' }

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontFamily: fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function RegoBadge({ days }) {
  if (days === null) return null
  if (days <= 0) return <span style={{ fontSize: 10, background: `${B.red}20`, color: B.red, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>REGO OVERDUE</span>
  if (days <= 30) return <span style={{ fontSize: 10, background: `${B.red}20`, color: B.red, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>REGO DUE {days}d</span>
  if (days <= 90) return <span style={{ fontSize: 10, background: `${B.amber}20`, color: B.amber, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>REGO {days}d</span>
  return null
}

// ── Log Maintenance Modal ──────────────────────────────────────────────────────
function LogMaintenanceModal({ assets, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    asset_id: assets[0]?.id || '',
    maintenance_type: 'service',
    description: '',
    performed_date: today,
    next_due_date: '',
    cost: '',
    performed_by: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.asset_id || !form.performed_date) return
    setSaving(true)
    try { await onSave({ ...form, cost: form.cost ? parseFloat(form.cost) : null }); onClose() }
    finally { setSaving(false) }
  }

  const labelStyle = { fontSize: 11, fontFamily: fontHead, fontWeight: 600, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }
  const inputStyle = { width:'100%', boxSizing:'border-box', border:`1px solid ${B.cardBorder}`, borderRadius:6, padding:'7px 10px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.bg, outline:'none' }
  const selectStyle = { ...inputStyle }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:B.cardBg, borderRadius:14, padding:28, width:'100%', maxWidth:480, boxShadow:'0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily:fontHead, fontSize:18, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', marginBottom:20 }}>Log Maintenance</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={labelStyle}>Asset *</div>
            <select style={selectStyle} value={form.asset_id} onChange={e=>set('asset_id',e.target.value)}>
              {assets.map(a=><option key={a.id} value={a.id}>{a.identifier} — {a.description}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Type *</div>
            <select style={selectStyle} value={form.maintenance_type} onChange={e=>set('maintenance_type',e.target.value)}>
              {['service','repair','inspection','registration','other'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>Performed By</div>
            <input style={inputStyle} value={form.performed_by} onChange={e=>set('performed_by',e.target.value)} placeholder="Mechanic / provider" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={labelStyle}>Description</div>
            <input style={inputStyle} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Work performed…" />
          </div>
          <div>
            <div style={labelStyle}>Date Performed *</div>
            <input type="date" style={inputStyle} value={form.performed_date} onChange={e=>set('performed_date',e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Next Due Date</div>
            <input type="date" style={inputStyle} value={form.next_due_date} onChange={e=>set('next_due_date',e.target.value)} />
          </div>
          <div>
            <div style={labelStyle}>Cost ($)</div>
            <input type="number" style={inputStyle} value={form.cost} onChange={e=>set('cost',e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <div style={labelStyle}>Notes</div>
            <input style={inputStyle} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Additional notes…" />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:13, color:B.textSecondary, fontFamily:fontHead }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.asset_id||!form.performed_date} style={{ background:B.yellow, border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:13, fontFamily:fontHead, fontWeight:700, color:B.black, opacity:saving||!form.asset_id||!form.performed_date?0.6:1 }}>
            {saving ? 'Saving…' : 'Log Record'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FleetManagementPage() {
  const { isMobile } = useBreakpoint()
  const { data: supabaseAssets } = useFleetAssets()
  const addMaint = useAddMaintenanceRecord()

  const [activeTab, setActiveTab] = useState('vehicles')
  const [showLogMaint, setShowLogMaint] = useState(false)

  // Merge Supabase + fallback
  const allAssets = useMemo(() => {
    if (supabaseAssets && supabaseAssets.length > 0) return supabaseAssets
    return [...FALLBACK_VEHICLES, ...FALLBACK_BINS]
  }, [supabaseAssets])

  const vehicles = allAssets.filter(a => a.asset_type !== 'bin')
  const bins = allAssets.filter(a => a.asset_type === 'bin')

  // KPI stats
  const stats = useMemo(() => ({
    totalVehicles: vehicles.length,
    vehiclesAvailable: vehicles.filter(a => (a.status||'available') === 'available').length,
    vehiclesInUse: vehicles.filter(a => a.status === 'in-use').length,
    vehiclesMaint: vehicles.filter(a => a.status === 'maintenance').length,
    totalBins: bins.length,
    binsAvailable: bins.filter(b => (b.status||'available') === 'available').length,
    binsOnSite: bins.filter(b => b.status === 'in-use' || b.current_location === 'on-site').length,
    binsInTransit: bins.filter(b => b.status === 'in-transit' || b.current_location === 'in-transit').length,
    regoAlerts: vehicles.filter(a => { const d = daysUntil(a.rego_expiry); return d !== null && d <= 90; }).length,
  }), [vehicles, bins])

  const handleLogMaint = (record) => {
    addMaint.mutate(record)
  }

  const cardStyle = { background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'12px 16px' }
  const sectionLabel = { fontFamily:fontHead, fontSize:11, fontWeight:700, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:fontHead, fontSize:24, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.04em' }}>Fleet Management</div>
          <div style={{ fontSize:13, color:B.textMuted, marginTop:4 }}>Vehicles, bin inventory, maintenance records & rego tracking</div>
        </div>
        <button onClick={()=>setShowLogMaint(true)} style={{ background:B.yellow, border:'none', borderRadius:8, padding:'10px 18px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
          + Log Maintenance
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Vehicles Total', value: stats.totalVehicles, sub:`${stats.vehiclesAvailable} available`, color: B.yellow },
          { label:'Vehicles In Use', value: stats.vehiclesInUse, sub:`${stats.vehiclesMaint} in maintenance`, color: B.blue },
          { label:'Bins On Site', value: stats.binsOnSite, sub:`${stats.binsAvailable} at depot`, color: B.green },
          { label:'Rego Alerts', value: stats.regoAlerts, sub:'due within 90 days', color: stats.regoAlerts > 0 ? B.red : B.green },
        ].map(k => (
          <div key={k.label} style={{ ...cardStyle, borderLeft:`3px solid ${k.color}` }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.textPrimary, marginTop:4 }}>{k.value}</div>
            <div style={{ fontSize:10, color:B.textMuted, marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:`2px solid ${B.cardBorder}` }}>
        {[
          { id:'vehicles', label:'Vehicles' },
          { id:'bins', label:'Bin Inventory' },
          { id:'maintenance', label:'Maintenance Log' },
        ].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            background:'transparent', border:'none', padding:'8px 18px', cursor:'pointer',
            fontFamily:fontHead, fontSize:12, fontWeight:700, letterSpacing:'0.06em',
            color: activeTab===t.id ? B.textPrimary : B.textMuted,
            borderBottom: activeTab===t.id ? `3px solid ${B.yellow}` : '3px solid transparent',
            marginBottom:-2, transition:'all 0.15s', textTransform:'uppercase',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── VEHICLES TAB ── */}
      {activeTab === 'vehicles' && (
        <div>
          {/* Rego alerts banner */}
          {vehicles.some(v => { const d = daysUntil(v.rego_expiry); return d !== null && d <= 90; }) && (
            <div style={{ background:`${B.red}10`, border:`1px solid ${B.red}30`, borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>🚨</span>
              <div style={{ fontSize:13, color:B.textPrimary }}>
                <strong style={{ color:B.red }}>Rego expiring soon:</strong>{' '}
                {vehicles.filter(v=>{ const d=daysUntil(v.rego_expiry); return d!==null&&d<=90; }).map(v=>`${v.identifier} (${daysUntil(v.rego_expiry)}d)`).join(', ')}
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap:10 }}>
            {vehicles.map(v => {
              const regoDays = daysUntil(v.rego_expiry)
              const svcDays = daysUntil(v.next_service_due)
              const statusCfg = STATUS_CONFIG[v.status || 'available'] || STATUS_CONFIG.available
              return (
                <div key={v.id} style={{ ...cardStyle, borderLeft:`4px solid ${statusCfg.color}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                    <div>
                      <div style={{ fontFamily:fontHead, fontSize:15, fontWeight:700, color:B.textPrimary }}>{v.identifier}</div>
                      <div style={{ fontSize:12, color:B.textSecondary, marginTop:2 }}>{v.description}</div>
                    </div>
                    <StatusBadge status={v.status || 'available'} />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
                    {v.registration && <div style={{ color:B.textMuted }}>Rego: <span style={{ color:B.textPrimary }}>{v.registration}</span></div>}
                    {v.year_of_manufacture && <div style={{ color:B.textMuted }}>Year: <span style={{ color:B.textPrimary }}>{v.year_of_manufacture}</span></div>}
                    {v.rego_expiry && <div style={{ color:B.textMuted }}>Rego expiry: <span style={{ color:B.textPrimary }}>{fmtDate(v.rego_expiry)}</span></div>}
                    {v.odometer_km && <div style={{ color:B.textMuted }}>Odo: <span style={{ color:B.textPrimary }}>{v.odometer_km?.toLocaleString()}km</span></div>}
                    {v.current_location && <div style={{ color:B.textMuted }}>Location: <span style={{ color:B.textPrimary }}>{LOCATION_ICONS[v.current_location]} {v.current_location}</span></div>}
                    {v.next_service_due && <div style={{ color:B.textMuted }}>Next service: <span style={{ color: svcDays !== null && svcDays <= 30 ? B.red : B.textPrimary }}>{fmtDate(v.next_service_due)}</span></div>}
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    <RegoBadge days={regoDays} />
                    {svcDays !== null && svcDays <= 30 && <span style={{ fontSize:10, background:`${B.amber}20`, color:B.amber, padding:'2px 8px', borderRadius:4, fontWeight:700 }}>SERVICE DUE {svcDays}d</span>}
                  </div>
                  {v.notes && <div style={{ fontSize:11, color:B.textMuted, marginTop:8, fontStyle:'italic' }}>{v.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BIN INVENTORY TAB ── */}
      {activeTab === 'bins' && (
        <div>
          {/* Location summary */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:16 }}>
            {['depot','on-site','in-transit','workshop'].map(loc => {
              const count = bins.filter(b => b.current_location === loc || (loc === 'on-site' && b.status === 'in-use' && !b.current_location)).length
              return (
                <div key={loc} style={{ ...cardStyle, textAlign:'center', padding:'10px' }}>
                  <div style={{ fontSize:20 }}>{LOCATION_ICONS[loc]}</div>
                  <div style={{ fontFamily:fontHead, fontSize:18, fontWeight:700, color:B.textPrimary, marginTop:4 }}>{count}</div>
                  <div style={{ fontSize:10, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em' }}>{loc}</div>
                </div>
              )
            })}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {bins.map(b => {
              const statusCfg = STATUS_CONFIG[b.status || 'available'] || STATUS_CONFIG.available
              return (
                <div key={b.id} style={{ ...cardStyle, display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:statusCfg.color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{b.identifier}</div>
                    <div style={{ fontSize:12, color:B.textSecondary }}>{b.description}</div>
                    {b.notes && <div style={{ fontSize:11, color:B.textMuted, fontStyle:'italic', marginTop:2 }}>{b.notes}</div>}
                  </div>
                  <div style={{ textAlign:'right', display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                    <StatusBadge status={b.status || 'available'} />
                    <div style={{ fontSize:11, color:B.textMuted }}>{LOCATION_ICONS[b.current_location || 'depot']} {b.current_location || 'depot'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MAINTENANCE LOG TAB ── */}
      {activeTab === 'maintenance' && (
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={()=>setShowLogMaint(true)} style={{ background:'none', border:`1px solid ${B.yellow}`, borderRadius:8, padding:'7px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:11, fontWeight:700, color:B.yellow, letterSpacing:'0.06em', textTransform:'uppercase' }}>
              + Log Record
            </button>
          </div>

          {/* Table header */}
          {!isMobile && (
            <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 90px 90px 90px 100px', gap:10, padding:'6px 16px', fontSize:10, fontFamily:fontHead, fontWeight:700, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em' }}>
              <div>Asset</div><div>Description</div><div>Type</div><div>Date</div><div>Cost</div><div>Next Due</div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {FALLBACK_MAINTENANCE.map(m => (
              <div key={m.id} style={{ ...cardStyle, display: isMobile ? 'block' : 'grid', gridTemplateColumns:'120px 1fr 90px 90px 90px 100px', gap:10, alignItems:'center' }}>
                <div style={{ fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.textPrimary }}>{m.asset_identifier}</div>
                <div style={{ fontSize:12, color:B.textSecondary }}>{m.description}</div>
                <div>
                  <span style={{ fontSize:10, background:`${B.blue}15`, color:B.blue, padding:'2px 7px', borderRadius:3, fontFamily:fontHead, fontWeight:700, textTransform:'uppercase' }}>
                    {m.maintenance_type}
                  </span>
                </div>
                <div style={{ fontSize:12, color:B.textSecondary }}>{fmtDate(m.performed_date)}</div>
                <div style={{ fontSize:12, fontWeight:600, color:B.textPrimary }}>{m.cost ? fmtFull(m.cost) : '—'}</div>
                <div style={{ fontSize:12, color: m.next_due_date && daysUntil(m.next_due_date) !== null && daysUntil(m.next_due_date) <= 30 ? B.red : B.textSecondary }}>
                  {fmtDate(m.next_due_date)}
                </div>
                {m.performed_by && <div style={{ gridColumn:'1/-1', fontSize:11, color:B.textMuted, marginTop: isMobile ? 4 : 0 }}>By: {m.performed_by}</div>}
                {m.notes && <div style={{ gridColumn:'1/-1', fontSize:11, color:B.textMuted, fontStyle:'italic' }}>{m.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showLogMaint && (
        <LogMaintenanceModal
          assets={[...vehicles, ...bins]}
          onClose={()=>setShowLogMaint(false)}
          onSave={handleLogMaint}
        />
      )}
    </div>
  )
}
