import React, { useState, useMemo, useCallback } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import {
  useCustomers, useCreateCustomer, useUpdateCustomer,
  useCustomerContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useCustomerDirectors, useCreateDirector, useUpdateDirector, useDeleteDirector,
  useCustomerTradeRefs, useCreateTradeRef, useUpdateTradeRef,
  useCreditApplication, useCreateCreditApplication, useUpdateCreditApplication,
  useAccountContracts, useCreateAccountContract,
  useCustomerNotes, useAddCustomerNote,
  usePaymentHistory, useRunCreditorWatch,
} from '../hooks/useCustomers'
import { useCollectionsEvents } from '../hooks/useCollections'
import { generateAccountContract, generateDirectorGuarantee } from '../lib/legalTemplates'

// ── Fallback data ─────────────────────────────────────────────────────────────
const FALLBACK = [
  { id:'f1', name:'Remeed Solutions', email:'accounts@remeed.com.au', phone:'03 9000 0001', suburb:'Seaford', total_jobs:48, total_revenue:89200, last_order_date:'2026-02-15', churn_risk:'low', account_type:'account', account_status:'active', credit_status:'approved', credit_limit:15000, payment_terms_days:30, outstanding_balance:4200, overdue_balance:0, risk_score:8, abn:'12 345 678 901', on_time_payment_pct:96, total_payments:42, late_payments:2 },
  { id:'f2', name:'Fieldmans Waste', email:'billing@fieldmans.com.au', phone:'03 9000 0002', suburb:'Frankston', total_jobs:42, total_revenue:72300, last_order_date:'2026-02-10', churn_risk:'low', account_type:'account', account_status:'active', credit_status:'approved', credit_limit:10000, payment_terms_days:14, outstanding_balance:2800, overdue_balance:0, risk_score:5, abn:'23 456 789 012', on_time_payment_pct:98, total_payments:38, late_payments:1 },
  { id:'f3', name:'Roach Demolition', email:'office@roachdemo.com.au', phone:'0412 000 003', suburb:'Seaford', total_jobs:36, total_revenue:68500, last_order_date:'2026-01-28', churn_risk:'medium', account_type:'account', account_status:'active', credit_status:'review', credit_limit:8000, payment_terms_days:14, outstanding_balance:6400, overdue_balance:2100, days_overdue:12, risk_score:42, abn:'34 567 890 123', on_time_payment_pct:78, total_payments:30, late_payments:7 },
  { id:'f4', name:"Scotty's Suburban", email:'scott@suburbankip.com.au', phone:'0412 000 004', suburb:'Carrum Downs', total_jobs:22, total_revenue:29100, last_order_date:'2026-01-15', churn_risk:'medium', account_type:'commercial', account_status:'active', credit_status:'unrated', credit_limit:0, payment_terms_days:7, outstanding_balance:1100, overdue_balance:1100, days_overdue:18, risk_score:55, on_time_payment_pct:65, total_payments:18, late_payments:6 },
  { id:'f5', name:'Melbourne Grammar School', email:'facilities@melgrammar.vic.edu.au', phone:'03 9000 0005', suburb:'South Yarra', total_jobs:18, total_revenue:21400, last_order_date:'2026-02-01', churn_risk:'low', account_type:'account', account_status:'active', credit_status:'approved', credit_limit:20000, payment_terms_days:30, outstanding_balance:3800, overdue_balance:0, risk_score:3, on_time_payment_pct:100, total_payments:16, late_payments:0 },
  { id:'f6', name:'TREC Plumbing', email:'admin@trecplumbing.com.au', phone:'0413 000 006', suburb:'Frankston', total_jobs:14, total_revenue:16200, last_order_date:'2025-12-10', churn_risk:'high', account_type:'commercial', account_status:'active', credit_status:'unrated', credit_limit:0, payment_terms_days:7, outstanding_balance:2200, overdue_balance:2200, days_overdue:25, risk_score:72, on_time_payment_pct:52, total_payments:10, late_payments:5 },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '—'
const daysSince = d => d ? Math.floor((Date.now()-new Date(d))/86400000) : 999

const CREDIT_CFG = {
  unrated:  { label:'Unrated',  color:B.textMuted,  bg:`${B.textMuted}15`  },
  approved: { label:'Approved', color:B.green,       bg:`${B.green}15`      },
  review:   { label:'Review',   color:B.amber,       bg:`${B.amber}15`      },
  declined: { label:'Declined', color:B.red,         bg:`${B.red}15`        },
}
const ACCT_TYPE_CFG = {
  residential: { label:'Residential', color:B.blue   },
  commercial:  { label:'Commercial',  color:B.purple  },
  account:     { label:'Account',     color:B.cyan    },
  cod:         { label:'COD',         color:B.amber   },
}
const REF_CFG = {
  pending:        { label:'Pending',       color:B.amber },
  satisfactory:   { label:'Satisfactory',  color:B.green },
  unsatisfactory: { label:'Unsatisfactory',color:B.red   },
  no_response:    { label:'No Response',   color:B.textMuted },
}

function Badge({ label, color, bg }) {
  return <span style={{ display:'inline-flex', alignItems:'center', background: bg||`${color}18`, color, fontFamily:fontHead, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>{label}</span>
}

function RiskBar({ score }) {
  const color = score >= 60 ? B.red : score >= 30 ? B.amber : B.green
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:4, background:`${B.cardBorder}`, borderRadius:2, overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:2 }} />
      </div>
      <span style={{ fontSize:11, fontWeight:700, color, minWidth:24 }}>{score}</span>
    </div>
  )
}

const inputStyle = { width:'100%', boxSizing:'border-box', border:`1px solid ${B.cardBorder}`, borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.cardBg, outline:'none' }
const labelSt = { fontSize:11, fontFamily:fontHead, fontWeight:600, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' }
const btnPrimary = { background:B.yellow, border:'none', borderRadius:7, padding:'8px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black, letterSpacing:'0.05em', textTransform:'uppercase' }
const btnSecondary = { background:'none', border:`1px solid ${B.cardBorder}`, borderRadius:7, padding:'8px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12, color:B.textSecondary }
const btnDanger = { background:`${B.red}15`, border:`1px solid ${B.red}40`, borderRadius:7, padding:'6px 12px', cursor:'pointer', fontFamily:fontHead, fontSize:11, color:B.red }

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, action, children }) {
  return (
    <div style={{ background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${B.cardBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center', background:B.bg }}>
        <div style={{ fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.06em' }}>{title}</div>
        {action}
      </div>
      <div style={{ padding:16 }}>{children}</div>
    </div>
  )
}

// ── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name:'', email:'', phone:'', address:'', suburb:'', postcode:'', state:'VIC', abn:'', acn:'', account_type:'commercial', payment_terms_days:14, notes:'' })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:B.cardBg, borderRadius:14, padding:28, width:'100%', maxWidth:540, boxShadow:'0 12px 40px rgba(0,0,0,0.25)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ fontFamily:fontHead, fontSize:18, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', marginBottom:20 }}>New Customer Account</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelSt}>Business / Customer Name *</label>
            <input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Acme Pty Ltd" />
          </div>
          <div><label style={labelSt}>ABN</label><input style={inputStyle} value={form.abn} onChange={e=>set('abn',e.target.value)} placeholder="12 345 678 901" /></div>
          <div><label style={labelSt}>ACN</label><input style={inputStyle} value={form.acn} onChange={e=>set('acn',e.target.value)} placeholder="123 456 789" /></div>
          <div><label style={labelSt}>Email</label><input style={inputStyle} value={form.email} onChange={e=>set('email',e.target.value)} type="email" placeholder="accounts@example.com" /></div>
          <div><label style={labelSt}>Phone</label><input style={inputStyle} value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="03 9000 0000" /></div>
          <div style={{ gridColumn:'1/-1' }}><label style={labelSt}>Address</label><input style={inputStyle} value={form.address} onChange={e=>set('address',e.target.value)} placeholder="123 Main Street" /></div>
          <div><label style={labelSt}>Suburb</label><input style={inputStyle} value={form.suburb} onChange={e=>set('suburb',e.target.value)} placeholder="Seaford" /></div>
          <div><label style={labelSt}>Postcode</label><input style={inputStyle} value={form.postcode} onChange={e=>set('postcode',e.target.value)} placeholder="3198" /></div>
          <div>
            <label style={labelSt}>Account Type</label>
            <select style={inputStyle} value={form.account_type} onChange={e=>set('account_type',e.target.value)}>
              <option value="commercial">Commercial</option>
              <option value="account">Credit Account</option>
              <option value="residential">Residential</option>
              <option value="cod">COD (Cash on Delivery)</option>
            </select>
          </div>
          <div>
            <label style={labelSt}>Payment Terms</label>
            <select style={inputStyle} value={form.payment_terms_days} onChange={e=>set('payment_terms_days',parseInt(e.target.value))}>
              <option value={0}>COD</option>
              <option value={7}>NET 7</option>
              <option value={14}>NET 14</option>
              <option value={21}>NET 21</option>
              <option value={30}>NET 30</option>
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={labelSt}>Notes</label>
            <textarea style={{ ...inputStyle, height:60, resize:'vertical' }} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Account notes…" />
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Cancel</button>
          <button disabled={saving||!form.name.trim()} style={{ ...btnPrimary, opacity:saving||!form.name.trim()?0.6:1 }}
            onClick={async () => { setSaving(true); try { await onSave(form); onClose() } finally { setSaving(false) } }}>
            {saving ? 'Saving…' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────
function ContactsTab({ customerId }) {
  const { data: contacts = [] } = useCustomerContacts(customerId)
  const createContact = useCreateContact()
  const deleteContact = useDeleteContact()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', role:'billing', title:'', email:'', phone:'', mobile:'', receives_invoices:false, receives_statements:false, receives_bookings:false })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const ROLES = ['primary','billing','service','bookings','legal','general']

  const handleSave = async () => {
    await createContact.mutateAsync({ ...form, customer_id: customerId })
    setShowAdd(false)
    setForm({ name:'', role:'billing', title:'', email:'', phone:'', mobile:'', receives_invoices:false, receives_statements:false, receives_bookings:false })
  }

  return (
    <div>
      {contacts.length === 0 && !showAdd && (
        <div style={{ textAlign:'center', padding:'24px 0', color:B.textMuted, fontSize:13 }}>No contacts added yet</div>
      )}
      {contacts.map(c => (
        <div key={c.id} style={{ border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
              <span style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{c.name}</span>
              {c.title && <span style={{ fontSize:12, color:B.textMuted }}>{c.title}</span>}
              <Badge label={c.role} color={B.blue} />
              {c.is_primary && <Badge label="Primary" color={B.green} />}
            </div>
            <div style={{ fontSize:12, color:B.textSecondary, display:'flex', gap:16, flexWrap:'wrap' }}>
              {c.email && <span>✉ {c.email}</span>}
              {c.phone && <span>📞 {c.phone}</span>}
              {c.mobile && <span>📱 {c.mobile}</span>}
            </div>
            <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap' }}>
              {c.receives_invoices && <Badge label="Invoices" color={B.purple} />}
              {c.receives_statements && <Badge label="Statements" color={B.cyan} />}
              {c.receives_bookings && <Badge label="Bookings" color={B.amber} />}
            </div>
          </div>
          <button style={btnDanger} onClick={() => deleteContact.mutate(c.id)}>Remove</button>
        </div>
      ))}
      {showAdd ? (
        <div style={{ border:`1px solid ${B.yellow}`, borderRadius:8, padding:16, background:`${B.yellow}08` }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelSt}>Name *</label><input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} /></div>
            <div><label style={labelSt}>Role</label>
              <select style={inputStyle} value={form.role} onChange={e=>set('role',e.target.value)}>
                {ROLES.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
              </select>
            </div>
            <div><label style={labelSt}>Title / Position</label><input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Accounts Manager" /></div>
            <div><label style={labelSt}>Email</label><input style={inputStyle} value={form.email} onChange={e=>set('email',e.target.value)} type="email" /></div>
            <div><label style={labelSt}>Phone</label><input style={inputStyle} value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
            <div><label style={labelSt}>Mobile</label><input style={inputStyle} value={form.mobile} onChange={e=>set('mobile',e.target.value)} /></div>
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            {[['receives_invoices','Receives Invoices'],['receives_statements','Receives Statements'],['receives_bookings','Receives Booking Confirmations']].map(([k,l])=>(
              <label key={k} style={{ display:'flex', gap:6, alignItems:'center', fontSize:13, cursor:'pointer' }}>
                <input type="checkbox" checked={form[k]} onChange={e=>set(k,e.target.checked)} />
                {l}
              </label>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btnPrimary} onClick={handleSave} disabled={!form.name.trim()}>Save Contact</button>
            <button style={btnSecondary} onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={{ ...btnSecondary, width:'100%', marginTop:8 }} onClick={()=>setShowAdd(true)}>+ Add Contact</button>
      )}
    </div>
  )
}

// ── Directors Tab ─────────────────────────────────────────────────────────────
function DirectorsTab({ customer, customerId }) {
  const { data: directors = [] } = useCustomerDirectors(customerId)
  const createDir = useCreateDirector()
  const updateDir = useUpdateDirector()
  const deleteDir = useDeleteDirector()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', title:'Director', dob:'', address:'', suburb:'', state:'VIC', postcode:'', email:'', phone:'', is_guarantor:false })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    await createDir.mutateAsync({ ...form, customer_id: customerId })
    setShowAdd(false)
    setForm({ name:'', title:'Director', dob:'', address:'', suburb:'', state:'VIC', postcode:'', email:'', phone:'', is_guarantor:false })
  }

  const markSigned = (dir) => {
    updateDir.mutate({ id: dir.id, updates: { guarantee_signed: true, guarantee_signed_at: new Date().toISOString() } })
  }

  return (
    <div>
      {directors.length === 0 && !showAdd && (
        <div style={{ textAlign:'center', padding:'24px 0', color:B.textMuted, fontSize:13 }}>No directors added</div>
      )}
      {directors.map(d => (
        <div key={d.id} style={{ border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'12px 14px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                <span style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{d.name}</span>
                <span style={{ fontSize:12, color:B.textMuted }}>{d.title}</span>
                {d.is_guarantor && <Badge label="Guarantor" color={B.purple} />}
                {d.is_guarantor && d.guarantee_signed && <Badge label="✓ Signed" color={B.green} />}
                {d.is_guarantor && !d.guarantee_signed && <Badge label="⚠ Unsigned" color={B.red} />}
              </div>
              <div style={{ fontSize:12, color:B.textSecondary }}>
                {d.email && <span>✉ {d.email}  </span>}
                {d.phone && <span>📞 {d.phone}</span>}
              </div>
              {d.address && <div style={{ fontSize:12, color:B.textMuted, marginTop:2 }}>{d.address}, {d.suburb} {d.state} {d.postcode}</div>}
              {d.guarantee_signed_at && <div style={{ fontSize:11, color:B.green, marginTop:4 }}>Guarantee signed {fmtDate(d.guarantee_signed_at)}</div>}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {d.is_guarantor && !d.guarantee_signed && (
                <button style={{ ...btnPrimary, fontSize:10 }} onClick={()=>markSigned(d)}>Mark Signed</button>
              )}
              <button style={btnDanger} onClick={()=>deleteDir.mutate(d.id)}>Remove</button>
            </div>
          </div>
        </div>
      ))}
      {showAdd ? (
        <div style={{ border:`1px solid ${B.yellow}`, borderRadius:8, padding:16, background:`${B.yellow}08` }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelSt}>Full Name *</label><input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)} /></div>
            <div><label style={labelSt}>Title</label><input style={inputStyle} value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Director" /></div>
            <div><label style={labelSt}>Date of Birth</label><input style={inputStyle} type="date" value={form.dob} onChange={e=>set('dob',e.target.value)} /></div>
            <div><label style={labelSt}>Email</label><input style={inputStyle} value={form.email} onChange={e=>set('email',e.target.value)} /></div>
            <div><label style={labelSt}>Phone</label><input style={inputStyle} value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
            <div style={{ gridColumn:'1/-1' }}><label style={labelSt}>Home Address</label><input style={inputStyle} value={form.address} onChange={e=>set('address',e.target.value)} /></div>
            <div><label style={labelSt}>Suburb</label><input style={inputStyle} value={form.suburb} onChange={e=>set('suburb',e.target.value)} /></div>
            <div><label style={labelSt}>Postcode</label><input style={inputStyle} value={form.postcode} onChange={e=>set('postcode',e.target.value)} /></div>
          </div>
          <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, cursor:'pointer', marginBottom:12 }}>
            <input type="checkbox" checked={form.is_guarantor} onChange={e=>set('is_guarantor',e.target.checked)} />
            This director is a personal guarantor for the account
          </label>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btnPrimary} onClick={handleSave} disabled={!form.name.trim()}>Save Director</button>
            <button style={btnSecondary} onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={{ ...btnSecondary, width:'100%', marginTop:8 }} onClick={()=>setShowAdd(true)}>+ Add Director / Guarantor</button>
      )}
    </div>
  )
}

// ── Trade References Tab ──────────────────────────────────────────────────────
function TradeRefsTab({ customerId }) {
  const { data: refs = [] } = useCustomerTradeRefs(customerId)
  const createRef = useCreateTradeRef()
  const updateRef = useUpdateTradeRef()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ referee_business:'', referee_contact:'', referee_phone:'', referee_email:'', credit_limit_held:'', payment_terms_days:'' })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    await createRef.mutateAsync({ ...form, customer_id: customerId, credit_limit_held: parseFloat(form.credit_limit_held)||null, payment_terms_days: parseInt(form.payment_terms_days)||null })
    setShowAdd(false)
    setForm({ referee_business:'', referee_contact:'', referee_phone:'', referee_email:'', credit_limit_held:'', payment_terms_days:'' })
  }

  const setResult = (id, result) => {
    updateRef.mutate({ id, updates: { result, checked_at: result!=='pending' ? new Date().toISOString() : null } })
  }

  return (
    <div>
      {refs.length === 0 && !showAdd && (
        <div style={{ textAlign:'center', padding:'24px 0', color:B.textMuted, fontSize:13 }}>No trade references added. Minimum 2 required for credit approval.</div>
      )}
      {refs.map(r => (
        <div key={r.id} style={{ border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'12px 14px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                <span style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{r.referee_business}</span>
                <Badge label={REF_CFG[r.result]?.label||r.result} color={REF_CFG[r.result]?.color||B.textMuted} />
              </div>
              <div style={{ fontSize:12, color:B.textSecondary }}>
                {r.referee_contact && <span>{r.referee_contact}  </span>}
                {r.referee_phone && <span>📞 {r.referee_phone}  </span>}
                {r.referee_email && <span>✉ {r.referee_email}</span>}
              </div>
              {r.credit_limit_held && <div style={{ fontSize:12, color:B.textMuted, marginTop:2 }}>Credit held: {fmtFull(r.credit_limit_held)} · Terms: {r.payment_terms_days}d</div>}
              {r.checked_at && <div style={{ fontSize:11, color:B.green, marginTop:2 }}>Checked {fmtDate(r.checked_at)}</div>}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {r.result === 'pending' && <>
                <button style={{ ...btnPrimary, fontSize:10, background:B.green, color:'#fff' }} onClick={()=>setResult(r.id,'satisfactory')}>✓ Satisfactory</button>
                <button style={{ ...btnDanger, fontSize:10 }} onClick={()=>setResult(r.id,'unsatisfactory')}>✗ Unsatisfactory</button>
                <button style={{ ...btnSecondary, fontSize:10 }} onClick={()=>setResult(r.id,'no_response')}>No Response</button>
              </>}
            </div>
          </div>
        </div>
      ))}
      {showAdd ? (
        <div style={{ border:`1px solid ${B.yellow}`, borderRadius:8, padding:16, background:`${B.yellow}08` }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div style={{ gridColumn:'1/-1' }}><label style={labelSt}>Referee Business *</label><input style={inputStyle} value={form.referee_business} onChange={e=>set('referee_business',e.target.value)} placeholder="ABC Supplies Pty Ltd" /></div>
            <div><label style={labelSt}>Contact Name</label><input style={inputStyle} value={form.referee_contact} onChange={e=>set('referee_contact',e.target.value)} /></div>
            <div><label style={labelSt}>Phone</label><input style={inputStyle} value={form.referee_phone} onChange={e=>set('referee_phone',e.target.value)} /></div>
            <div><label style={labelSt}>Email</label><input style={inputStyle} value={form.referee_email} onChange={e=>set('referee_email',e.target.value)} /></div>
            <div><label style={labelSt}>Credit Limit Held ($)</label><input style={inputStyle} type="number" value={form.credit_limit_held} onChange={e=>set('credit_limit_held',e.target.value)} /></div>
            <div><label style={labelSt}>Payment Terms (days)</label><input style={inputStyle} type="number" value={form.payment_terms_days} onChange={e=>set('payment_terms_days',e.target.value)} /></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={btnPrimary} onClick={handleSave} disabled={!form.referee_business.trim()}>Add Reference</button>
            <button style={btnSecondary} onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button style={{ ...btnSecondary, width:'100%', marginTop:8 }} onClick={()=>setShowAdd(true)}>+ Add Trade Reference</button>
      )}
    </div>
  )
}

// ── Credit Application Tab ────────────────────────────────────────────────────
function CreditTab({ customer, customerId }) {
  const { data: app } = useCreditApplication(customerId)
  const { data: refs = [] } = useCustomerTradeRefs(customerId)
  const { data: directors = [] } = useCustomerDirectors(customerId)
  const createApp = useCreateCreditApplication()
  const updateApp = useUpdateCreditApplication()
  const runCW = useRunCreditorWatch()
  const updateCustomer = useUpdateCustomer()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)

  const startEdit = () => {
    setForm(app ? { ...app } : {
      customer_id: customerId,
      requested_credit_limit: '',
      requested_terms_days: customer?.payment_terms_days || 14,
      abn: customer?.abn || '',
      acn: customer?.acn || '',
      business_type: 'company',
      years_in_business: '',
      annual_turnover_est: '',
      director_guarantee_required: true,
      notes: '',
    })
    setEditing(true)
  }

  const handleSave = async () => {
    const payload = {
      ...form,
      customer_id: customerId,
      requested_credit_limit: parseFloat(form.requested_credit_limit) || null,
      requested_terms_days: parseInt(form.requested_terms_days) || 14,
      trade_refs_count: refs.length,
      trade_refs_satisfactory: refs.filter(r=>r.result==='satisfactory').length,
      director_guarantee_required: form.director_guarantee_required,
      director_guarantee_received: directors.some(d=>d.is_guarantor&&d.guarantee_signed),
    }
    if (app) await updateApp.mutateAsync({ id: app.id, updates: payload })
    else await createApp.mutateAsync(payload)
    setEditing(false)
  }

  const handleApprove = async () => {
    await updateApp.mutateAsync({ id: app.id, updates: {
      status: 'approved',
      approved_credit_limit: app.requested_credit_limit,
      approved_terms_days: app.requested_terms_days,
      reviewed_at: new Date().toISOString(),
    }})
    await updateCustomer.mutateAsync({ id: customerId, updates: {
      credit_status: 'approved',
      credit_limit: app.requested_credit_limit,
      payment_terms_days: app.requested_terms_days,
      account_status: 'active',
    }})
  }

  const handleDecline = async () => {
    await updateApp.mutateAsync({ id: app.id, updates: { status: 'declined', reviewed_at: new Date().toISOString() } })
    await updateCustomer.mutateAsync({ id: customerId, updates: { credit_status: 'declined' } })
  }

  const handleCreditorWatch = async () => {
    if (!customer?.abn) { alert('ABN required to run CreditorWatch check'); return }
    await runCW.mutateAsync({ customerId, abn: customer.abn })
  }

  const statusColors = { draft:B.textMuted, submitted:B.blue, under_review:B.amber, approved:B.green, declined:B.red }

  if (!app && !editing) {
    return (
      <div style={{ textAlign:'center', padding:'28px 0' }}>
        <div style={{ color:B.textMuted, fontSize:13, marginBottom:16 }}>No credit application on file</div>
        <button style={btnPrimary} onClick={startEdit}>Start Credit Application</button>
      </div>
    )
  }

  if (editing && form) {
    const set = (k,v) => setForm(f=>({...f,[k]:v}))
    return (
      <div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div><label style={labelSt}>ABN</label><input style={inputStyle} value={form.abn||''} onChange={e=>set('abn',e.target.value)} /></div>
          <div><label style={labelSt}>ACN</label><input style={inputStyle} value={form.acn||''} onChange={e=>set('acn',e.target.value)} /></div>
          <div>
            <label style={labelSt}>Business Type</label>
            <select style={inputStyle} value={form.business_type||'company'} onChange={e=>set('business_type',e.target.value)}>
              <option value="company">Company (Pty Ltd)</option>
              <option value="trust">Trust</option>
              <option value="partnership">Partnership</option>
              <option value="sole_trader">Sole Trader</option>
            </select>
          </div>
          <div><label style={labelSt}>Years in Business</label><input style={inputStyle} type="number" value={form.years_in_business||''} onChange={e=>set('years_in_business',e.target.value)} /></div>
          <div><label style={labelSt}>Credit Limit Requested ($)</label><input style={inputStyle} type="number" value={form.requested_credit_limit||''} onChange={e=>set('requested_credit_limit',e.target.value)} /></div>
          <div>
            <label style={labelSt}>Payment Terms Requested</label>
            <select style={inputStyle} value={form.requested_terms_days||14} onChange={e=>set('requested_terms_days',e.target.value)}>
              <option value={7}>NET 7</option><option value={14}>NET 14</option><option value={21}>NET 21</option><option value={30}>NET 30</option>
            </select>
          </div>
          <div><label style={labelSt}>Est. Annual Turnover ($)</label><input style={inputStyle} type="number" value={form.annual_turnover_est||''} onChange={e=>set('annual_turnover_est',e.target.value)} /></div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:13, cursor:'pointer' }}>
              <input type="checkbox" checked={!!form.director_guarantee_required} onChange={e=>set('director_guarantee_required',e.target.checked)} />
              Require Director's Guarantee
            </label>
          </div>
          <div style={{ gridColumn:'1/-1' }}><label style={labelSt}>Notes</label><textarea style={{ ...inputStyle, height:60, resize:'vertical' }} value={form.notes||''} onChange={e=>set('notes',e.target.value)} /></div>
        </div>
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button style={btnPrimary} onClick={handleSave}>Save Application</button>
          <button style={btnSecondary} onClick={()=>setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Badge label={app.status.replace('_',' ')} color={statusColors[app.status]||B.textMuted} />
          <span style={{ fontSize:12, color:B.textMuted }}>Updated {fmtDate(app.updated_at)}</span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {app.status === 'under_review' && <>
            <button style={{ ...btnPrimary, background:B.green, color:'#fff', fontSize:11 }} onClick={handleApprove}>✓ Approve</button>
            <button style={{ ...btnDanger, fontSize:11 }} onClick={handleDecline}>✗ Decline</button>
          </>}
          {app.status !== 'approved' && app.status !== 'declined' && (
            <button style={btnSecondary} onClick={startEdit}>Edit</button>
          )}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        {[
          ['Business Type', app.business_type],
          ['ABN', app.abn || customer?.abn],
          ['Years in Business', app.years_in_business],
          ['Est. Turnover', app.annual_turnover_est ? fmtFull(app.annual_turnover_est) : '—'],
          ['Credit Requested', app.requested_credit_limit ? fmtFull(app.requested_credit_limit) : '—'],
          ['Terms Requested', `NET ${app.requested_terms_days}`],
          ['Credit Approved', app.approved_credit_limit ? fmtFull(app.approved_credit_limit) : '—'],
          ['Terms Approved', app.approved_terms_days ? `NET ${app.approved_terms_days}` : '—'],
          ['Trade Refs', `${app.trade_refs_satisfactory} / ${app.trade_refs_count} satisfactory`],
          ['Dir. Guarantee', app.director_guarantee_received ? '✓ Received' : app.director_guarantee_required ? '⚠ Required — not yet received' : 'Not required'],
        ].map(([label, value]) => value && (
          <div key={label} style={{ background:B.bg, borderRadius:6, padding:'8px 10px' }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
            <div style={{ fontSize:13, color:B.textPrimary, marginTop:2 }}>{value || '—'}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop:14, padding:'12px 14px', background:`${B.blue}10`, border:`1px solid ${B.blue}30`, borderRadius:8 }}>
        <div style={{ fontFamily:fontHead, fontSize:11, color:B.blue, textTransform:'uppercase', marginBottom:8 }}>CreditorWatch</div>
        {customer?.creditorwatch_score ? (
          <div style={{ fontSize:13 }}>Score: <strong>{customer.creditorwatch_score}</strong> · Checked {fmtDate(customer.creditorwatch_checked_at)}</div>
        ) : (
          <div style={{ fontSize:13, color:B.textMuted, marginBottom:8 }}>No credit check on file</div>
        )}
        <button style={{ ...btnSecondary, fontSize:11, marginTop:customer?.creditorwatch_score?8:0 }} onClick={handleCreditorWatch} disabled={runCW.isPending}>
          {runCW.isPending ? 'Checking…' : customer?.creditorwatch_score ? '↻ Re-run Check' : 'Run CreditorWatch Check'}
        </button>
        {runCW.isError && <div style={{ fontSize:11, color:B.red, marginTop:6 }}>{runCW.error?.message}</div>}
      </div>

      {app.status === 'draft' && (
        <button style={{ ...btnPrimary, marginTop:12, background:B.blue, color:'#fff' }}
          onClick={()=>updateApp.mutate({ id:app.id, updates:{ status:'submitted', submitted_at:new Date().toISOString() }})}>
          Submit for Review
        </button>
      )}
    </div>
  )
}

// ── Contract Tab ──────────────────────────────────────────────────────────────
function ContractTab({ customer, customerId }) {
  const { data: contracts = [] } = useAccountContracts(customerId)
  const { data: directors = [] } = useCustomerDirectors(customerId)
  const createContract = useCreateAccountContract()
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState(null)

  const handleGenerate = async (type) => {
    setGenerating(true)
    try {
      const guarantor = directors.find(d=>d.is_guarantor)
      const content = type === 'contract'
        ? generateAccountContract(customer, guarantor)
        : generateDirectorGuarantee(customer, guarantor)
      setPreview({ type, content })
    } finally {
      setGenerating(false)
    }
  }

  const handleConfirmSign = async () => {
    await createContract.mutateAsync({
      customer_id: customerId,
      version: '1.0',
      payment_terms_days: customer.payment_terms_days,
      credit_limit: customer.credit_limit,
      director_guarantee_included: directors.some(d=>d.is_guarantor&&d.guarantee_signed),
      ppsr_consent_given: true,
    })
    setPreview(null)
  }

  return (
    <div>
      {contracts.length > 0 && (
        <div style={{ marginBottom:16 }}>
          {contracts.map(c => (
            <div key={c.id} style={{ border:`1px solid ${B.green}40`, borderRadius:8, padding:'10px 14px', marginBottom:8, background:`${B.green}08` }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:16 }}>✓</span>
                <div>
                  <div style={{ fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.green }}>Account T&Cs — v{c.version}</div>
                  <div style={{ fontSize:12, color:B.textSecondary }}>
                    Accepted {fmtDate(c.signed_at || c.created_at)}
                    {c.signed_by_name && <span> by {c.signed_by_name}</span>}
                    {c.ppsr_consent_given && <span> · PPSR consent ✓</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <button style={btnPrimary} onClick={()=>handleGenerate('contract')} disabled={generating}>
          {generating ? 'Generating…' : '📄 Generate Account T&Cs'}
        </button>
        {directors.some(d=>d.is_guarantor) && (
          <button style={{ ...btnSecondary }} onClick={()=>handleGenerate('guarantee')} disabled={generating}>
            📋 Generate Director's Guarantee
          </button>
        )}
      </div>

      {preview && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:720, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 16px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontFamily:fontHead, fontSize:15, fontWeight:700 }}>
                {preview.type === 'contract' ? 'Account Terms & Conditions' : "Director's Personal Guarantee"}
              </div>
              <button onClick={()=>setPreview(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', fontFamily:'"Times New Roman",serif', fontSize:13, lineHeight:1.7, color:'#000', whiteSpace:'pre-wrap' }}>
              {preview.content}
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #ddd', display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button style={btnSecondary} onClick={()=>window.print()}>🖨 Print</button>
              {preview.type === 'contract' && (
                <button style={btnPrimary} onClick={handleConfirmSign}>✓ Record as Accepted</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payment Conduct Tab ───────────────────────────────────────────────────────
function ConductTab({ customer, customerId }) {
  const { data: history = [] } = usePaymentHistory(customerId)
  const { data: events = [] } = useCollectionsEvents(customerId)

  const onTime = history.filter(p=>p.days_late<=0).length
  const late = history.filter(p=>p.days_late>0).length
  const avgLate = late > 0 ? Math.round(history.filter(p=>p.days_late>0).reduce((s,p)=>s+p.days_late,0)/late) : 0

  const score = customer?.risk_score || 0
  const scoreColor = score >= 60 ? B.red : score >= 30 ? B.amber : B.green

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'On-Time Payments', value:`${customer?.on_time_payment_pct||100}%`, color:B.green },
          { label:'Late Payments', value:customer?.late_payments||0, color:B.red },
          { label:'Avg Days Late', value:avgLate||'—', color:B.amber },
        ].map(k=>(
          <div key={k.label} style={{ background:B.bg, borderRadius:8, padding:'10px 12px' }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:k.color, marginTop:2 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Account Risk Score</div>
        <RiskBar score={score} />
        <div style={{ fontSize:12, color:scoreColor, marginTop:4 }}>
          {score >= 60 ? '⚠ High risk — consider security over assets or reduced credit limit'
           : score >= 30 ? 'Medium risk — monitor closely'
           : '✓ Low risk — good payment conduct'}
        </div>
        {score >= 60 && (
          <div style={{ marginTop:8, padding:'10px 12px', background:`${B.red}10`, border:`1px solid ${B.red}30`, borderRadius:8, fontSize:12, color:B.textSecondary }}>
            Consider registering a security interest over this customer's assets on the PPSR (ppsr.gov.au) to protect against insolvency. A PPSR registration costs ~$10 and can recover your exposure in liquidation.
          </div>
        )}
      </div>

      {history.length > 0 ? (
        <div>
          <div style={{ fontFamily:fontHead, fontSize:11, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Payment History</div>
          {history.slice(0,10).map(p=>(
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${B.cardBorder}` }}>
              <div style={{ fontSize:13, color:B.textSecondary }}>{p.invoice_number || '—'}</div>
              <div style={{ fontSize:13, fontWeight:600, color:B.textPrimary }}>{fmtFull(p.amount)}</div>
              <div style={{ fontSize:12, color: p.days_late > 0 ? B.red : B.green }}>
                {p.days_late > 0 ? `${p.days_late}d late` : p.days_late < 0 ? `${Math.abs(p.days_late)}d early` : 'On time'}
              </div>
              <div style={{ fontSize:11, color:B.textMuted }}>{fmtDate(p.paid_date)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'16px 0', color:B.textMuted, fontSize:13 }}>Payment history will appear here as invoices are paid</div>
      )}

      {events.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontFamily:fontHead, fontSize:11, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Collections History</div>
          {events.slice(0,5).map(e=>(
            <div key={e.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'8px 0', borderBottom:`1px solid ${B.cardBorder}` }}>
              <Badge label={`L${e.level}`} color={[B.amber,B.amber,B.red,B.red][e.level-1]} />
              <div style={{ flex:1, fontSize:12, color:B.textSecondary }}>{e.action_type.replace(/_/g,' ')}</div>
              <div style={{ fontSize:11, color:B.textMuted }}>{fmtDate(e.sent_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Customer Detail Panel ─────────────────────────────────────────────────────
const DETAIL_TABS = ['Account','Contacts','Directors','Trade Refs','Credit','Contract','Conduct']

function CustomerDetail({ customer, onClose }) {
  const [tab, setTab] = useState('Account')
  const updateCustomer = useUpdateCustomer()
  const { data: notes = [] } = useCustomerNotes(customer.id?.startsWith('f') ? null : customer.id)
  const addNote = useAddCustomerNote()
  const [newNote, setNewNote] = useState('')
  const cid = customer.id?.startsWith('f') ? null : customer.id

  const handleField = (k,v) => {
    if (!cid) return
    updateCustomer.mutate({ id: cid, updates: { [k]: v } })
  }

  const acctTypeCfg = ACCT_TYPE_CFG[customer.account_type] || ACCT_TYPE_CFG.commercial
  const creditCfg = CREDIT_CFG[customer.credit_status] || CREDIT_CFG.unrated
  const since = daysSince(customer.last_order_date)

  return (
    <div style={{ background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:'0 0 12px 12px', borderTop:'none' }}>
      {/* Customer header */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${B.cardBorder}`, display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:6 }}>
            <div style={{ fontFamily:fontHead, fontSize:17, fontWeight:700, color:B.textPrimary }}>{customer.name}</div>
            <Badge label={acctTypeCfg.label} color={acctTypeCfg.color} />
            <Badge label={creditCfg.label} color={creditCfg.color} bg={creditCfg.bg} />
            {customer.account_status !== 'active' && <Badge label={customer.account_status} color={B.red} />}
          </div>
          <div style={{ fontSize:12, color:B.textMuted, display:'flex', gap:16, flexWrap:'wrap' }}>
            {customer.abn && <span>ABN: {customer.abn}</span>}
            {customer.acn && <span>ACN: {customer.acn}</span>}
            <span>Terms: NET {customer.payment_terms_days||14}</span>
            {customer.credit_limit > 0 && <span>Limit: {fmtFull(customer.credit_limit)}</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {customer.overdue_balance > 0 && (
            <div style={{ background:`${B.red}15`, border:`1px solid ${B.red}40`, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:B.red, fontFamily:fontHead, textTransform:'uppercase' }}>Overdue</div>
              <div style={{ fontSize:16, fontWeight:700, color:B.red }}>{fmtFull(customer.overdue_balance)}</div>
              {customer.days_overdue > 0 && <div style={{ fontSize:10, color:B.red }}>{customer.days_overdue}d overdue</div>}
            </div>
          )}
          {customer.outstanding_balance > 0 && (
            <div style={{ background:B.bg, border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'8px 12px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase' }}>Outstanding</div>
              <div style={{ fontSize:16, fontWeight:700, color:B.textPrimary }}>{fmtFull(customer.outstanding_balance)}</div>
            </div>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:B.textMuted, padding:4, alignSelf:'flex-start' }}>✕</button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${B.cardBorder}`, overflowX:'auto' }}>
        {DETAIL_TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'10px 16px', border:'none', borderBottom:`2px solid ${tab===t?B.yellow:'transparent'}`, background:'none', cursor:'pointer', fontFamily:fontHead, fontSize:11, fontWeight:700, color:tab===t?B.yellow:B.textMuted, textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding:20 }}>

        {tab === 'Account' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { label:'Total Revenue', value:fmtFull(customer.total_revenue||0), color:B.green },
                { label:'Total Jobs', value:customer.total_jobs||0, color:B.blue },
                { label:'Last Order', value:since < 999 ? `${since}d ago` : '—', color:since>90?B.red:B.textPrimary },
              ].map(k=>(
                <div key={k.label} style={{ background:B.bg, borderRadius:8, padding:'10px 12px' }}>
                  <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:k.color, marginTop:2 }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              {[
                { label:'Account Status', field:'account_status', type:'select', opts:['prospect','application','active','suspended','closed'] },
                { label:'Account Type', field:'account_type', type:'select', opts:['residential','commercial','account','cod'] },
                { label:'Payment Terms', field:'payment_terms_days', type:'select', opts:[0,7,14,21,30], labels:['COD','NET 7','NET 14','NET 21','NET 30'] },
                { label:'Credit Limit ($)', field:'credit_limit', type:'number' },
              ].map(f => (
                <div key={f.field}>
                  <label style={labelSt}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select style={inputStyle} value={customer[f.field]||''} onChange={e=>handleField(f.field, f.field==='payment_terms_days'?parseInt(e.target.value):e.target.value)} disabled={!cid}>
                      {f.opts.map((o,i)=><option key={o} value={o}>{f.labels?f.labels[i]:o}</option>)}
                    </select>
                  ) : (
                    <input style={inputStyle} type={f.type||'text'} value={customer[f.field]||''} onChange={e=>handleField(f.field,e.target.value)} disabled={!cid} />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              {[
                { label:'Email', field:'email' }, { label:'Phone', field:'phone' },
                { label:'Address', field:'address' }, { label:'Suburb', field:'suburb' },
                { label:'ABN', field:'abn' }, { label:'ACN', field:'acn' },
              ].map(f=>(
                <div key={f.field}>
                  <label style={labelSt}>{f.label}</label>
                  <input style={inputStyle} value={customer[f.field]||''} onChange={e=>handleField(f.field,e.target.value)} disabled={!cid} />
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:16, marginBottom:16 }}>
              {[
                ['ppsr_registered','PPSR Registered'],
                ['director_guarantee_required','Dir. Guarantee Required'],
                ['director_guarantee_received','Dir. Guarantee Received'],
              ].map(([k,l])=>(
                <label key={k} style={{ display:'flex', gap:6, alignItems:'center', fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!customer[k]} onChange={e=>handleField(k,e.target.checked)} disabled={!cid} />
                  {l}
                </label>
              ))}
            </div>

            {/* Notes */}
            <div style={{ borderTop:`1px solid ${B.cardBorder}`, paddingTop:14 }}>
              <div style={{ fontFamily:fontHead, fontSize:11, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Account Notes</div>
              <textarea style={{ ...inputStyle, height:56, resize:'vertical', marginBottom:8 }} value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Add a note…" />
              <button style={{ ...btnPrimary, fontSize:11 }} disabled={!newNote.trim()||!cid}
                onClick={async ()=>{ await addNote.mutateAsync({ customerId:cid, note:newNote }); setNewNote('') }}>
                Add Note
              </button>
              {notes.slice(0,5).map(n=>(
                <div key={n.id} style={{ borderLeft:`3px solid ${B.cardBorder}`, paddingLeft:10, marginTop:10 }}>
                  <div style={{ fontSize:12, color:B.textSecondary }}>{n.note}</div>
                  <div style={{ fontSize:10, color:B.textMuted, marginTop:2 }}>{fmtDate(n.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Contacts'   && <ContactsTab customerId={cid} />}
        {tab === 'Directors'  && <DirectorsTab customer={customer} customerId={cid} />}
        {tab === 'Trade Refs' && <TradeRefsTab customerId={cid} />}
        {tab === 'Credit'     && <CreditTab customer={customer} customerId={cid} />}
        {tab === 'Contract'   && <ContractTab customer={customer} customerId={cid} />}
        {tab === 'Conduct'    && <ConductTab customer={customer} customerId={cid} />}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { isMobile } = useBreakpoint()
  const [search, setSearch] = useState('')
  const [accountType, setAccountType] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: supabaseCustomers, isError } = useCustomers({ search })
  const createCustomer = useCreateCustomer()

  const customers = useMemo(() => {
    const list = (supabaseCustomers && supabaseCustomers.length > 0 && !isError) ? supabaseCustomers : FALLBACK
    if (!supabaseCustomers || supabaseCustomers.length === 0) {
      let fl = FALLBACK
      if (search) { const q=search.toLowerCase(); fl=fl.filter(c=>c.name.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q)||c.suburb?.toLowerCase().includes(q)) }
      if (accountType !== 'all') fl = fl.filter(c=>c.account_type===accountType)
      return fl
    }
    return accountType !== 'all' ? list.filter(c=>c.account_type===accountType) : list
  }, [supabaseCustomers, search, accountType, isError])

  const stats = useMemo(() => ({
    total: customers.length,
    overdueCount: customers.filter(c=>c.overdue_balance>0).length,
    overdueAmount: customers.reduce((s,c)=>s+parseFloat(c.overdue_balance||0),0),
    highRisk: customers.filter(c=>(c.risk_score||0)>=60).length,
  }), [customers])

  const cardBorder = { background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'12px 16px' }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:fontHead, fontSize:24, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.04em' }}>Customer Accounts</div>
          <div style={{ fontSize:13, color:B.textMuted, marginTop:4 }}>CRM — credit management, contacts, directors & account conduct</div>
        </div>
        <button onClick={()=>setShowAdd(true)} style={btnPrimary}>+ New Account</button>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          { label:'Total Accounts', value:stats.total, color:B.blue },
          { label:'Accounts Overdue', value:stats.overdueCount, color:B.red },
          { label:'Total Overdue $', value:fmtFull(stats.overdueAmount), color:B.red },
          { label:'High Risk', value:stats.highRisk, color:B.amber },
        ].map(k=>(
          <div key={k.label} style={{ ...cardBorder, borderLeft:`3px solid ${k.color}` }}>
            <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.color, marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input style={{ border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'8px 12px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.cardBg, outline:'none', flex:1, minWidth:200 }}
          placeholder="Search by name, suburb, email or ABN…" value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{ display:'flex', gap:6 }}>
          {['all','account','commercial','residential','cod'].map(t=>(
            <button key={t} onClick={()=>setAccountType(t)}
              style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${accountType===t?B.yellow:B.cardBorder}`, background:accountType===t?B.yellow:'transparent', color:accountType===t?B.black:B.textSecondary, cursor:'pointer', fontFamily:fontHead, fontSize:10, fontWeight:700, textTransform:'uppercase' }}>
              {t === 'all' ? 'All' : ACCT_TYPE_CFG[t]?.label || t}
            </button>
          ))}
        </div>
      </div>

      {/* Customer list */}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {customers.map(c => {
          const isExpanded = expandedId === c.id
          const creditCfg = CREDIT_CFG[c.credit_status] || CREDIT_CFG.unrated
          const acctCfg = ACCT_TYPE_CFG[c.account_type] || ACCT_TYPE_CFG.commercial
          return (
            <div key={c.id}>
              <button onClick={()=>setExpandedId(isExpanded?null:c.id)}
                style={{ width:'100%', background:isExpanded?`${B.yellow}08`:B.cardBg, border:`1px solid ${isExpanded?B.yellow:B.cardBorder}`, borderRadius:isExpanded?'10px 10px 0 0':10, padding:'11px 16px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12, transition:'all 0.15s' }}>

                <div style={{ width:10, height:10, borderRadius:'50%', background:c.overdue_balance>0?B.red:c.risk_score>=60?B.amber:B.green, flexShrink:0 }} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize:11, color:B.textMuted }}>{c.suburb||'—'} · {c.abn||c.email||'No ABN'}</div>
                </div>

                {!isMobile && (
                  <>
                    <Badge label={acctCfg.label} color={acctCfg.color} />
                    <Badge label={creditCfg.label} color={creditCfg.color} bg={creditCfg.bg} />
                    <div style={{ textAlign:'right', minWidth:90 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:B.textPrimary }}>{fmtFull(c.total_revenue||0)}</div>
                      <div style={{ fontSize:10, color:B.textMuted }}>{c.total_jobs||0} jobs</div>
                    </div>
                    {c.overdue_balance > 0 ? (
                      <div style={{ textAlign:'right', minWidth:80 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:B.red }}>{fmtFull(c.overdue_balance)}</div>
                        <div style={{ fontSize:10, color:B.red }}>{c.days_overdue||0}d overdue</div>
                      </div>
                    ) : (
                      <div style={{ minWidth:80 }} />
                    )}
                    <div style={{ minWidth:40, textAlign:'right' }}>
                      <RiskBar score={c.risk_score||0} />
                    </div>
                  </>
                )}
                <span style={{ fontSize:12, color:B.textMuted }}>{isExpanded?'▲':'▼'}</span>
              </button>

              {isExpanded && <CustomerDetail customer={c} onClose={()=>setExpandedId(null)} />}
            </div>
          )
        })}
        {customers.length === 0 && <div style={{ ...cardBorder, textAlign:'center', padding:'40px', color:B.textMuted }}>No accounts found</div>}
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={()=>setShowAdd(false)}
          onSave={async form => {
            await createCustomer.mutateAsync({ ...form, churn_risk:'low', total_jobs:0, total_revenue:0, account_status:'active', credit_status:'unrated', risk_score:0 })
          }}
        />
      )}
    </div>
  )
}
