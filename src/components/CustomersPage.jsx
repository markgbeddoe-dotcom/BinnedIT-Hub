import React, { useState, useMemo } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useCustomerNotes, useAddCustomerNote } from '../hooks/useCustomers'
import { useBreakpoint } from '../hooks/useBreakpoint'

// ── Fallback data when Supabase unavailable ────────────────────────────────────
const FALLBACK_CUSTOMERS = [
  { id: '1', name: 'Remeed Solutions', email: 'accounts@remeed.com.au', phone: '03 9000 0001', suburb: 'Seaford', total_jobs: 48, total_revenue: 89200, last_order_date: '2026-02-15', churn_risk: 'low', notes: 'Regular commercial account — demolition & reno' },
  { id: '2', name: 'Fieldmans Waste', email: 'billing@fieldmans.com.au', phone: '03 9000 0002', suburb: 'Frankston', total_jobs: 42, total_revenue: 72300, last_order_date: '2026-02-10', churn_risk: 'low', notes: 'High-volume general waste — monthly billing' },
  { id: '3', name: 'Roach Demolition', email: 'office@roachdemo.com.au', phone: '0412 000 003', suburb: 'Seaford', total_jobs: 36, total_revenue: 68500, last_order_date: '2026-01-28', churn_risk: 'medium', notes: 'Demolition contractor — occasional asbestos jobs' },
  { id: '4', name: "Scotty's Suburban", email: 'scott@suburbankip.com.au', phone: '0412 000 004', suburb: 'Carrum Downs', total_jobs: 22, total_revenue: 29100, last_order_date: '2026-01-15', churn_risk: 'medium', notes: 'Residential removals — intermittent' },
  { id: '5', name: 'Melbourne Grammar School', email: 'facilities@melgrammar.vic.edu.au', phone: '03 9000 0005', suburb: 'South Yarra', total_jobs: 18, total_revenue: 21400, last_order_date: '2026-02-01', churn_risk: 'low', notes: 'School maintenance contract' },
  { id: '6', name: 'TREC Plumbing', email: 'admin@trecplumbing.com.au', phone: '0413 000 006', suburb: 'Frankston', total_jobs: 14, total_revenue: 16200, last_order_date: '2025-12-10', churn_risk: 'high', notes: 'Infrequent orders — at risk of churn' },
  { id: '7', name: 'ServiceStream', email: 'procurement@servicestream.com.au', phone: '03 9000 0007', suburb: 'Richmond', total_jobs: 11, total_revenue: 14800, last_order_date: '2025-11-20', churn_risk: 'high', notes: 'Large corp — orders dried up Q4' },
  { id: '8', name: 'Salt Projects', email: 'projects@saltgroup.com.au', phone: '0414 000 008', suburb: 'Cheltenham', total_jobs: 9, total_revenue: 12100, last_order_date: '2026-02-20', churn_risk: 'low', notes: 'New builder account' },
  { id: '9', name: 'IMEG Nominees', email: 'property@imeg.com.au', phone: '03 9000 0009', suburb: 'Brighton', total_jobs: 8, total_revenue: 10400, last_order_date: '2025-10-05', churn_risk: 'high', notes: 'Property developer — no orders 5+ months' },
  { id: '10', name: 'Shayona Property', email: 'admin@shayona.com.au', phone: '0415 000 010', suburb: 'Dandenong', total_jobs: 7, total_revenue: 9600, last_order_date: '2025-11-01', churn_risk: 'high', notes: 'Residential development — project may be complete' },
]

const CHURN_CONFIG = {
  low:    { label: 'Low Risk',    bg: `${B.green}20`,  color: B.green,  dot: B.green  },
  medium: { label: 'Med Risk',    bg: `${B.amber}20`,  color: B.amber,  dot: B.amber  },
  high:   { label: 'High Risk',   bg: `${B.red}20`,    color: B.red,    dot: B.red    },
}

function ChurnBadge({ risk }) {
  const cfg = CHURN_CONFIG[risk] || CHURN_CONFIG.low
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background: cfg.bg, color: cfg.color, fontFamily: fontHead, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: cfg.dot, flexShrink:0 }} />
      {cfg.label}
    </span>
  )
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(d) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d)) / 86400000)
}

// ── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', suburb: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { fontSize: 11, fontFamily: fontHead, fontWeight: 600, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }
  const inputStyle = { width: '100%', boxSizing: 'border-box', border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, fontFamily: fontBody, color: B.textPrimary, background: B.bg, outline: 'none' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background: B.cardBg, borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: fontHead, fontSize: 18, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 20 }}>Add Customer</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={labelStyle}>Name *</div>
            <input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Company or person name" />
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <input style={inputStyle} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="accounts@example.com" type="email" />
          </div>
          <div>
            <div style={labelStyle}>Phone</div>
            <input style={inputStyle} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="03 9000 0000" />
          </div>
          <div>
            <div style={labelStyle}>Address</div>
            <input style={inputStyle} value={form.address} onChange={e=>set('address',e.target.value)} placeholder="123 Main St" />
          </div>
          <div>
            <div style={labelStyle}>Suburb</div>
            <input style={inputStyle} value={form.suburb} onChange={e=>set('suburb',e.target.value)} placeholder="Seaford" />
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <div style={labelStyle}>Notes</div>
            <textarea style={{ ...inputStyle, height: 64, resize:'vertical' }} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Account notes..." />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ background:'none', border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:13, color:B.textSecondary, fontFamily:fontHead }}>Cancel</button>
          <button onClick={handleSave} disabled={saving||!form.name.trim()} style={{ background: B.yellow, border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:13, fontFamily:fontHead, fontWeight:700, color:B.black, opacity:saving||!form.name.trim()?0.6:1 }}>
            {saving ? 'Saving…' : 'Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customer Detail Panel ─────────────────────────────────────────────────────
function CustomerDetail({ customer, onClose, onUpdateChurn }) {
  const { data: notes = [] } = useCustomerNotes(customer.id?.startsWith('f') ? null : customer.id)
  const addNote = useAddCustomerNote()
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setSavingNote(true)
    try {
      await addNote.mutateAsync({ customerId: customer.id, note: newNote.trim() })
      setNewNote('')
    } finally {
      setSavingNote(false)
    }
  }

  const inputStyle = { width:'100%', boxSizing:'border-box', border:`1px solid ${B.cardBorder}`, borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.bg, outline:'none', resize:'vertical', height:60 }

  return (
    <div style={{ background: B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:12, padding:24, marginTop:2 }}>
      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontFamily:fontHead, fontSize:16, fontWeight:700, color:B.textPrimary }}>{customer.name}</div>
          <div style={{ fontSize:12, color:B.textMuted, marginTop:2 }}>{customer.suburb || '—'} · Joined {fmtDate(customer.created_at)}</div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:B.textMuted, padding:4 }}>✕</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Total Revenue', value: fmtFull(customer.total_revenue || 0) },
          { label:'Total Jobs', value: customer.total_jobs || 0 },
          { label:'Last Order', value: fmtDate(customer.last_order_date) },
        ].map(k => (
          <div key={k.label} style={{ background:B.bg, borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</div>
            <div style={{ fontSize:15, fontWeight:700, color:B.textPrimary, marginTop:3 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Contact info */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
        {customer.email && <div style={{ fontSize:12, color:B.textSecondary }}><span style={{ color:B.textMuted }}>Email: </span>{customer.email}</div>}
        {customer.phone && <div style={{ fontSize:12, color:B.textSecondary }}><span style={{ color:B.textMuted }}>Phone: </span>{customer.phone}</div>}
        {customer.address && <div style={{ fontSize:12, color:B.textSecondary, gridColumn:'1/-1' }}><span style={{ color:B.textMuted }}>Address: </span>{customer.address}{customer.suburb ? `, ${customer.suburb}` : ''}</div>}
      </div>

      {/* Notes */}
      {customer.notes && (
        <div style={{ background:`${B.blue}10`, border:`1px solid ${B.blue}30`, borderRadius:8, padding:'10px 12px', marginBottom:16 }}>
          <div style={{ fontSize:10, color:B.blue, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Account Notes</div>
          <div style={{ fontSize:13, color:B.textSecondary }}>{customer.notes}</div>
        </div>
      )}

      {/* Churn risk */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <span style={{ fontSize:12, color:B.textMuted }}>Churn Risk:</span>
        <ChurnBadge risk={customer.churn_risk} />
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {['low','medium','high'].map(r => (
            <button key={r} onClick={()=>onUpdateChurn(customer.id, r)}
              style={{ fontSize:10, padding:'3px 10px', borderRadius:4, border:`1px solid ${CHURN_CONFIG[r].color}`, background: customer.churn_risk===r?CHURN_CONFIG[r].bg:'transparent', color:CHURN_CONFIG[r].color, cursor:'pointer', fontFamily:fontHead, fontWeight:700, textTransform:'uppercase' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Add note */}
      <div style={{ borderTop:`1px solid ${B.cardBorder}`, paddingTop:14 }}>
        <div style={{ fontSize:11, fontFamily:fontHead, fontWeight:600, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Add Note</div>
        <textarea style={inputStyle} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Add a note about this customer…" />
        <button onClick={handleAddNote} disabled={savingNote||!newNote.trim()} style={{ marginTop:8, background:B.yellow, border:'none', borderRadius:6, padding:'7px 16px', cursor:'pointer', fontSize:12, fontFamily:fontHead, fontWeight:700, color:B.black, opacity:savingNote||!newNote.trim()?0.6:1 }}>
          {savingNote ? 'Saving…' : 'Add Note'}
        </button>
        {notes.length > 0 && (
          <div style={{ marginTop:12 }}>
            {notes.map(n => (
              <div key={n.id} style={{ borderLeft:`3px solid ${B.cardBorder}`, paddingLeft:10, marginBottom:8 }}>
                <div style={{ fontSize:12, color:B.textSecondary }}>{n.note}</div>
                <div style={{ fontSize:10, color:B.textMuted, marginTop:2 }}>{fmtDate(n.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { isMobile } = useBreakpoint()
  const [search, setSearch] = useState('')
  const [churnFilter, setChurnFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: supabaseCustomers, isError } = useCustomers({ search, churnFilter })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()

  // Use fallback when Supabase empty/unavailable
  const customers = useMemo(() => {
    if (supabaseCustomers && supabaseCustomers.length > 0) return supabaseCustomers
    let list = FALLBACK_CUSTOMERS
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.suburb||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q))
    }
    if (churnFilter !== 'all') list = list.filter(c => c.churn_risk === churnFilter)
    return list
  }, [supabaseCustomers, search, churnFilter, isError])

  // Summary stats
  const stats = useMemo(() => {
    const all = FALLBACK_CUSTOMERS // always use full set for stats
    return {
      total: all.length,
      highRisk: all.filter(c => c.churn_risk === 'high').length,
      totalRevenue: all.reduce((s, c) => s + (c.total_revenue || 0), 0),
      avgJobsPerCustomer: Math.round(all.reduce((s, c) => s + (c.total_jobs || 0), 0) / all.length),
    }
  }, [])

  const handleUpdateChurn = (id, risk) => {
    if (id.startsWith('f') || id.length < 10) return // fallback row
    updateCustomer.mutate({ id, updates: { churn_risk: risk } })
  }

  const handleAddCustomer = async (form) => {
    await createCustomer.mutateAsync({ ...form, churn_risk: 'low', total_jobs: 0, total_revenue: 0 })
  }

  const cardStyle = { background: B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'12px 16px' }
  const inputStyle = { border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.bg, outline:'none' }

  return (
    <div style={{ maxWidth:1000, margin:'0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>

      {/* Page header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:fontHead, fontSize:24, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.04em' }}>Customers</div>
          <div style={{ fontSize:13, color:B.textMuted, marginTop:4 }}>CRM — account management, churn risk & job history</div>
        </div>
        <button onClick={()=>setShowAdd(true)} style={{ background:B.yellow, border:'none', borderRadius:8, padding:'10px 18px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black, letterSpacing:'0.06em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
          + Add Customer
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Customers', value: stats.total, color: B.blue },
          { label:'High Churn Risk', value: stats.highRisk, color: B.red },
          { label:'Total Revenue YTD', value: fmtFull(stats.totalRevenue), color: B.green },
          { label:'Avg Jobs / Customer', value: stats.avgJobsPerCustomer, color: B.amber },
        ].map(k => (
          <div key={k.label} style={{ ...cardStyle, borderLeft:`3px solid ${k.color}` }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:B.textPrimary, marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input
          style={{ ...inputStyle, flex:1, minWidth:200 }}
          placeholder="Search by name, suburb or email…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        <div style={{ display:'flex', gap:6 }}>
          {['all','low','medium','high'].map(r => (
            <button key={r} onClick={()=>setChurnFilter(r)}
              style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${churnFilter===r?B.yellow:B.cardBorder}`, background:churnFilter===r?B.yellow:'transparent', color:churnFilter===r?B.black:B.textSecondary, cursor:'pointer', fontFamily:fontHead, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.04em' }}>
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {customers.length === 0 ? (
          <div style={{ ...cardStyle, textAlign:'center', padding:'40px 20px', color:B.textMuted }}>No customers found</div>
        ) : customers.map(c => {
          const isExpanded = expandedId === c.id
          const since = daysSince(c.last_order_date)

          return (
            <div key={c.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                style={{ width:'100%', background: isExpanded ? `${B.yellow}08` : B.cardBg, border:`1px solid ${isExpanded ? B.yellow : B.cardBorder}`, borderRadius: isExpanded ? '10px 10px 0 0' : 10, padding: isMobile ? '12px 14px' : '12px 16px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12, transition:'all 0.15s' }}>

                {/* Churn dot */}
                <div style={{ width:10, height:10, borderRadius:'50%', background:CHURN_CONFIG[c.churn_risk]?.dot || B.green, flexShrink:0 }} />

                {/* Name + suburb */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize:11, color:B.textMuted, marginTop:1 }}>{c.suburb || '—'} · {c.email || 'No email'}</div>
                </div>

                {/* Stats */}
                {!isMobile && (
                  <>
                    <div style={{ textAlign:'right', minWidth:90 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:B.textPrimary }}>{fmtFull(c.total_revenue || 0)}</div>
                      <div style={{ fontSize:10, color:B.textMuted }}>{c.total_jobs || 0} jobs</div>
                    </div>
                    <div style={{ textAlign:'right', minWidth:90 }}>
                      <div style={{ fontSize:12, color: since > 90 ? B.red : since > 60 ? B.amber : B.textSecondary }}>{fmtDate(c.last_order_date)}</div>
                      <div style={{ fontSize:10, color:B.textMuted }}>{since < 999 ? `${since}d ago` : '—'}</div>
                    </div>
                  </>
                )}

                <ChurnBadge risk={c.churn_risk} />
                <span style={{ fontSize:12, color:B.textMuted, marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <CustomerDetail
                  customer={c}
                  onClose={() => setExpandedId(null)}
                  onUpdateChurn={handleUpdateChurn}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Churn summary callout */}
      {customers.some(c => c.churn_risk === 'high') && churnFilter === 'all' && !search && (
        <div style={{ marginTop:20, background:`${B.red}10`, border:`1px solid ${B.red}30`, borderRadius:10, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.red, textTransform:'uppercase' }}>
              {customers.filter(c=>c.churn_risk==='high').length} high-risk accounts need attention
            </div>
            <div style={{ fontSize:12, color:B.textSecondary, marginTop:2 }}>
              These customers haven't placed orders in 60+ days. Consider a follow-up call or offer.
            </div>
          </div>
          <button onClick={()=>setChurnFilter('high')} style={{ marginLeft:'auto', background:B.red, border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontFamily:fontHead, fontSize:11, fontWeight:700, color:'#fff', textTransform:'uppercase', whiteSpace:'nowrap' }}>
            View All
          </button>
        </div>
      )}

      {showAdd && <AddCustomerModal onClose={()=>setShowAdd(false)} onSave={handleAddCustomer} />}
    </div>
  )
}
