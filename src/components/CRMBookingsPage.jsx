import React, { useState, useMemo } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useCustomers } from '../hooks/useCustomers'
import { supabase } from '../lib/supabase'

// ── Service Matrix ────────────────────────────────────────────────────────────
const SERVICE_MATRIX = [
  {
    category: 'General Waste',
    color: B.blue, icon: '🗑️',
    desc: 'Household and commercial general waste — mixed non-hazardous',
    services: [
      { id: 'gw-2', label: '2m³ Mini Skip', capacity: '~10 wheelie bins', price: 195, popular: true },
      { id: 'gw-4', label: '4m³ Small Skip', capacity: '~30 wheelie bins', price: 275 },
      { id: 'gw-6', label: '6m³ Medium Skip', capacity: '~50 wheelie bins', price: 355 },
      { id: 'gw-8', label: '8m³ Large Skip', capacity: '~70 wheelie bins', price: 435 },
      { id: 'gw-10', label: '10m³ XL Skip', capacity: '~90 wheelie bins', price: 515 },
      { id: 'gw-12', label: '12m³ Maxi Skip', capacity: '~110 wheelie bins', price: 595 },
    ],
  },
  {
    category: 'Green Waste',
    color: B.green, icon: '🌿',
    desc: 'Lawn clippings, branches, leaves, garden organics',
    services: [
      { id: 'grn-2', label: '2m³ Mini Green', capacity: '~10 wheelie bins', price: 175 },
      { id: 'grn-4', label: '4m³ Small Green', capacity: '~30 wheelie bins', price: 250 },
      { id: 'grn-6', label: '6m³ Medium Green', capacity: '~50 wheelie bins', price: 325 },
      { id: 'grn-8', label: '8m³ Large Green', capacity: '~70 wheelie bins', price: 395 },
    ],
  },
  {
    category: 'Soil & Rubble',
    color: B.amber, icon: '🪨',
    desc: 'Clean soil, dirt, sand, gravel — no contamination',
    services: [
      { id: 'soil-2', label: '2m³ Mini Soil', capacity: '~2.8 tonne max', price: 295 },
      { id: 'soil-4', label: '4m³ Soil Skip', capacity: '~5 tonne max', price: 450 },
      { id: 'soil-6', label: '6m³ Soil Skip', capacity: '~7.5 tonne max', price: 595 },
    ],
  },
  {
    category: 'Concrete & Bricks',
    color: B.textMuted, icon: '🧱',
    desc: 'Broken concrete, bricks, pavers, masonry',
    services: [
      { id: 'conc-2', label: '2m³ Concrete Skip', capacity: '~3 tonne max', price: 345 },
      { id: 'conc-4', label: '4m³ Concrete Skip', capacity: '~5.5 tonne max', price: 520 },
    ],
  },
  {
    category: 'Mixed C&D',
    color: B.purple, icon: '🏗️',
    desc: 'Mixed construction & demolition — timber, plasterboard, metals',
    services: [
      { id: 'cd-4', label: '4m³ C&D Skip', capacity: '~30 wheelie bins', price: 315 },
      { id: 'cd-6', label: '6m³ C&D Skip', capacity: '~50 wheelie bins', price: 410 },
      { id: 'cd-8', label: '8m³ C&D Skip', capacity: '~70 wheelie bins', price: 495 },
      { id: 'cd-10', label: '10m³ C&D Skip', capacity: '~90 wheelie bins', price: 575 },
    ],
  },
  {
    category: 'Asbestos',
    color: B.red, icon: '⚠️',
    desc: 'Licensed asbestos removal & disposal — pricing on application',
    services: [
      { id: 'asb-2', label: '2m³ Asbestos Bin', capacity: 'Licensed disposal', price: 695, poa: false },
      { id: 'asb-4', label: '4m³ Asbestos Bin', capacity: 'Licensed disposal', price: 995, poa: false },
      { id: 'asb-poa', label: 'Asbestos — POA', capacity: 'Large volumes / bulk', price: 0, poa: true },
    ],
  },
  {
    category: 'Contaminated Soil',
    color: B.red, icon: '☢️',
    desc: 'EPA-licensed contaminated soil disposal — pricing on application',
    services: [
      { id: 'csoil-poa', label: 'Contaminated Soil — POA', capacity: 'EPA licensed facility', price: 0, poa: true },
    ],
  },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' }) : '—'

function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]
}
function minCollection(del) {
  if (!del) return tomorrowStr()
  const d = new Date(del); d.setDate(d.getDate()+2); return d.toISOString().split('T')[0]
}

const FALLBACK_CUSTOMERS = [
  { id:'f1', name:'Remeed Solutions', email:'accounts@remeed.com.au', suburb:'Seaford', payment_terms_days:30, account_type:'account', credit_status:'approved' },
  { id:'f2', name:'Fieldmans Waste', email:'billing@fieldmans.com.au', suburb:'Frankston', payment_terms_days:14, account_type:'account', credit_status:'approved' },
  { id:'f3', name:'Roach Demolition', email:'office@roachdemo.com.au', suburb:'Seaford', payment_terms_days:14, account_type:'account', credit_status:'review' },
  { id:'f4', name:"Scotty's Suburban", email:'scott@suburbankip.com.au', suburb:'Carrum Downs', payment_terms_days:7, account_type:'commercial', credit_status:'unrated' },
  { id:'f5', name:'Melbourne Grammar School', email:'facilities@melgrammar.vic.edu.au', suburb:'South Yarra', payment_terms_days:30, account_type:'account', credit_status:'approved' },
]

const inputStyle = { width:'100%', boxSizing:'border-box', border:`1px solid ${B.cardBorder}`, borderRadius:6, padding:'8px 10px', fontSize:13, fontFamily:fontBody, color:B.textPrimary, background:B.cardBg, outline:'none' }
const labelSt = { fontSize:11, fontFamily:fontHead, fontWeight:600, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' }
const btnPrimary = { background:B.yellow, border:'none', borderRadius:7, padding:'10px 20px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black, letterSpacing:'0.05em', textTransform:'uppercase' }
const btnSecondary = { background:'none', border:`1px solid ${B.cardBorder}`, borderRadius:7, padding:'9px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12, color:B.textSecondary }

const PAYMENT_TERMS_OPTIONS = [
  { value: 0,  label: 'COD — Cash on Delivery' },
  { value: 7,  label: 'NET 7 days' },
  { value: 14, label: 'NET 14 days' },
  { value: 21, label: 'NET 21 days' },
  { value: 30, label: 'NET 30 days' },
]

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'commercial', label: 'Commercial (no account)' },
  { value: 'residential', label: 'Residential' },
  { value: 'account', label: 'Credit Account' },
  { value: 'cod', label: 'COD Only' },
]

// ── New Booking Modal ─────────────────────────────────────────────────────────
function NewBookingModal({ onClose, customers, onCustomerCreated }) {
  const [step, setStep] = useState('customer') // customer → service → details → confirm
  const [newCustomerMode, setNewCustomerMode] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedService, setSelectedService] = useState(null)
  const [form, setForm] = useState({ address:'', suburb:'', postcode:'', delivery_date:tomorrowStr(), collection_date:'', special_instructions:'', notes:'' })
  const [newCust, setNewCust] = useState({ name:'', email:'', phone:'', address:'', suburb:'', postcode:'', abn:'', account_type:'commercial', payment_terms_days:14 })
  const [savingCust, setSavingCust] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const setNC = (k,v) => setNewCust(c=>({...c,[k]:v}))

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0,8)
    const q = customerSearch.toLowerCase()
    return customers.filter(c=>c.name.toLowerCase().includes(q)||c.suburb?.toLowerCase().includes(q)).slice(0,8)
  }, [customers, customerSearch])

  const handleCreateCustomer = async () => {
    if (!newCust.name.trim()) return
    setSavingCust(true)
    try {
      const { data, error } = await supabase.from('customers').insert({
        name: newCust.name.trim(),
        email: newCust.email || null,
        phone: newCust.phone || null,
        address: newCust.address || null,
        suburb: newCust.suburb || null,
        postcode: newCust.postcode || null,
        abn: newCust.abn || null,
        account_type: newCust.account_type,
        payment_terms_days: newCust.payment_terms_days,
        account_status: 'active',
        credit_status: newCust.account_type === 'account' ? 'unrated' : 'approved',
      }).select().single()
      if (error) { alert('Error creating customer: ' + error.message); return }
      if (onCustomerCreated) onCustomerCreated(data)
      setSelectedCustomer(data)
      setNewCustomerMode(false)
      setStep('service')
    } finally { setSavingCust(false) }
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const gst = (selectedService.price * 0.1)
      const booking = {
        customer_id: selectedCustomer.id?.startsWith('f') ? null : selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_email: selectedCustomer.email,
        customer_phone: selectedCustomer.phone || '',
        address: form.address,
        suburb: form.suburb,
        postcode: form.postcode,
        bin_size: selectedService.id,
        waste_type: selectedService.category,
        price: selectedService.poa ? 0 : selectedService.price,
        delivery_date: form.delivery_date,
        collection_date: form.collection_date || null,
        special_instructions: form.special_instructions,
        notes: form.notes,
        status: 'pending',
      }
      const { error } = await supabase.from('bookings').insert(booking)
      if (!error) setDone(true)
      else alert('Error creating booking: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:B.cardBg, borderRadius:14, padding:40, maxWidth:440, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
        <div style={{ fontFamily:fontHead, fontSize:20, fontWeight:700, color:B.green, textTransform:'uppercase', marginBottom:8 }}>Booking Created</div>
        <div style={{ fontSize:13, color:B.textSecondary, marginBottom:24 }}>
          {selectedService.label} for {selectedCustomer.name} — {form.suburb}<br />
          Delivery: {fmtDate(form.delivery_date)}
        </div>
        <button style={btnPrimary} onClick={onClose}>Done</button>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:700, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:B.cardBg, borderRadius:14, width:'100%', maxWidth:640, boxShadow:'0 12px 40px rgba(0,0,0,0.25)', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:`1px solid ${B.cardBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontFamily:fontHead, fontSize:17, fontWeight:700, color:B.textPrimary, textTransform:'uppercase' }}>New Booking</div>
            {selectedCustomer && <div style={{ fontSize:12, color:B.textMuted }}>{selectedCustomer.name}</div>}
            {selectedService && <div style={{ fontSize:12, color:B.blue }}>{selectedService.category} — {selectedService.label}</div>}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:B.textMuted }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:24 }}>

          {/* Step 1: Customer selection or new customer form */}
          {step === 'customer' && !newCustomerMode && (
            <div>
              <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, marginBottom:16, textTransform:'uppercase' }}>1 — Select Customer Account</div>
              <input style={{ ...inputStyle, marginBottom:12 }} placeholder="Search customer name or suburb…" value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} autoFocus />
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {filteredCustomers.map(c => (
                  <button key={c.id} onClick={()=>{ setSelectedCustomer(c); setStep('service') }}
                    style={{ background:B.bg, border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'12px 14px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{c.name}</div>
                      <div style={{ fontSize:11, color:B.textMuted }}>{c.suburb} · NET {c.payment_terms_days||14} · {c.account_type||'commercial'} · {c.credit_status||'—'}</div>
                    </div>
                    <span style={{ color:B.textMuted }}>→</span>
                  </button>
                ))}
              </div>
              {filteredCustomers.length === 0 && (
                <div style={{ textAlign:'center', padding:'20px', color:B.textMuted, fontSize:13 }}>No matching customers found</div>
              )}
              <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${B.cardBorder}` }}>
                <button onClick={()=>setNewCustomerMode(true)}
                  style={{ width:'100%', background:`${B.yellow}15`, border:`1px dashed ${B.yellow}`, borderRadius:8, padding:'12px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.textPrimary, letterSpacing:'0.04em', textTransform:'uppercase' }}>
                  + Create New Customer Account
                </button>
              </div>
            </div>
          )}

          {/* New customer form */}
          {step === 'customer' && newCustomerMode && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <button onClick={()=>setNewCustomerMode(false)} style={{ background:'none', border:'none', color:B.blue, cursor:'pointer', fontSize:13, fontFamily:fontBody, padding:0 }}>← Back to search</button>
              </div>
              <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, marginBottom:16, textTransform:'uppercase' }}>New Customer Account</div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Business / Customer Name *</label>
                  <input style={inputStyle} value={newCust.name} onChange={e=>setNC('name',e.target.value)} placeholder="e.g. ABC Constructions Pty Ltd" autoFocus />
                </div>
                <div>
                  <label style={labelSt}>Email</label>
                  <input style={inputStyle} type="email" value={newCust.email} onChange={e=>setNC('email',e.target.value)} placeholder="accounts@company.com.au" />
                </div>
                <div>
                  <label style={labelSt}>Phone</label>
                  <input style={inputStyle} value={newCust.phone} onChange={e=>setNC('phone',e.target.value)} placeholder="03 XXXX XXXX" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Address</label>
                  <input style={inputStyle} value={newCust.address} onChange={e=>setNC('address',e.target.value)} placeholder="123 Business Street" />
                </div>
                <div>
                  <label style={labelSt}>Suburb</label>
                  <input style={inputStyle} value={newCust.suburb} onChange={e=>setNC('suburb',e.target.value)} placeholder="Seaford" />
                </div>
                <div>
                  <label style={labelSt}>Postcode</label>
                  <input style={inputStyle} value={newCust.postcode} onChange={e=>setNC('postcode',e.target.value)} placeholder="3198" />
                </div>
                <div>
                  <label style={labelSt}>ABN</label>
                  <input style={inputStyle} value={newCust.abn} onChange={e=>setNC('abn',e.target.value)} placeholder="XX XXX XXX XXX" />
                </div>
                <div>
                  <label style={labelSt}>Account Type</label>
                  <select style={inputStyle} value={newCust.account_type} onChange={e=>setNC('account_type',e.target.value)}>
                    {ACCOUNT_TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Payment Terms</label>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    {PAYMENT_TERMS_OPTIONS.map(o=>(
                      <button key={o.value} onClick={()=>setNC('payment_terms_days',o.value)}
                        style={{ padding:'8px 14px', borderRadius:7, border:`1px solid ${newCust.payment_terms_days===o.value?B.yellow:B.cardBorder}`, background:newCust.payment_terms_days===o.value?`${B.yellow}25`:'transparent', color:newCust.payment_terms_days===o.value?B.textPrimary:B.textSecondary, cursor:'pointer', fontFamily:fontHead, fontSize:11, fontWeight:700, textTransform:'uppercase', whiteSpace:'nowrap' }}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop:20, background:`${B.blue}08`, border:`1px solid ${B.blue}30`, borderRadius:8, padding:'10px 14px', fontSize:12, color:B.textSecondary }}>
                Account will be created as <strong>{ACCOUNT_TYPE_OPTIONS.find(o=>o.value===newCust.account_type)?.label}</strong> with <strong>{PAYMENT_TERMS_OPTIONS.find(o=>o.value===newCust.payment_terms_days)?.label}</strong>.
                You can complete credit checks, add directors and T&Cs in the Customers tab.
              </div>

              <button style={{ ...btnPrimary, width:'100%', marginTop:16, opacity:savingCust||!newCust.name.trim()?0.6:1 }}
                disabled={savingCust||!newCust.name.trim()} onClick={handleCreateCustomer}>
                {savingCust ? 'Creating Account…' : 'Create Account & Continue →'}
              </button>
            </div>
          )}

          {/* Step 2: Service selection matrix */}
          {step === 'service' && (
            <div>
              <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, marginBottom:16, textTransform:'uppercase' }}>2 — Select Service</div>
              {SERVICE_MATRIX.map(cat => (
                <div key={cat.category} style={{ marginBottom:20 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>{cat.icon}</span>
                    <div>
                      <div style={{ fontFamily:fontHead, fontSize:12, fontWeight:700, color:cat.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{cat.category}</div>
                      <div style={{ fontSize:11, color:B.textMuted }}>{cat.desc}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
                    {cat.services.map(svc => (
                      <button key={svc.id} onClick={()=>{ setSelectedService({...svc, category:cat.category}); setStep('details') }}
                        style={{ background:B.cardBg, border:`1px solid ${cat.color}40`, borderRadius:8, padding:'10px 12px', cursor:'pointer', textAlign:'left', position:'relative', transition:'all 0.12s' }}>
                        {svc.popular && <div style={{ position:'absolute', top:6, right:6, background:B.yellow, color:B.black, fontFamily:fontHead, fontSize:8, fontWeight:700, padding:'2px 5px', borderRadius:3, textTransform:'uppercase' }}>Popular</div>}
                        <div style={{ fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.textPrimary }}>{svc.label}</div>
                        <div style={{ fontSize:11, color:B.textMuted, marginTop:2 }}>{svc.capacity}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:svc.poa?B.textMuted:cat.color, marginTop:6 }}>
                          {svc.poa ? 'POA' : `$${svc.price} + GST`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Job details */}
          {step === 'details' && (
            <div>
              <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, marginBottom:16, textTransform:'uppercase' }}>3 — Job Details</div>

              {/* Selected service summary */}
              <div style={{ background:B.bg, border:`1px solid ${B.cardBorder}`, borderRadius:8, padding:'12px 14px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary }}>{selectedService?.category} — {selectedService?.label}</div>
                  <div style={{ fontSize:11, color:B.textMuted }}>{selectedService?.capacity}</div>
                </div>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:B.green }}>
                    {selectedService?.poa ? 'POA' : `$${selectedService?.price} + GST`}
                  </div>
                  {!selectedService?.poa && <div style={{ fontSize:11, color:B.textMuted, textAlign:'right' }}>Total: ${((selectedService?.price||0)*1.1).toFixed(0)} inc. GST</div>}
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Delivery Address *</label>
                  <input style={inputStyle} value={form.address} onChange={e=>set('address',e.target.value)} placeholder="123 Main Street" />
                </div>
                <div>
                  <label style={labelSt}>Suburb *</label>
                  <input style={inputStyle} value={form.suburb} onChange={e=>set('suburb',e.target.value)} placeholder="Seaford" />
                </div>
                <div>
                  <label style={labelSt}>Postcode</label>
                  <input style={inputStyle} value={form.postcode} onChange={e=>set('postcode',e.target.value)} placeholder="3198" />
                </div>
                <div>
                  <label style={labelSt}>Delivery Date *</label>
                  <input style={inputStyle} type="date" value={form.delivery_date} min={tomorrowStr()} onChange={e=>set('delivery_date',e.target.value)} />
                </div>
                <div>
                  <label style={labelSt}>Collection Date</label>
                  <input style={inputStyle} type="date" value={form.collection_date} min={minCollection(form.delivery_date)} onChange={e=>set('collection_date',e.target.value)} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Special Instructions</label>
                  <textarea style={{ ...inputStyle, height:60, resize:'vertical' }} value={form.special_instructions} onChange={e=>set('special_instructions',e.target.value)} placeholder="Access notes, gate codes, position requirements…" />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={labelSt}>Internal Notes (not visible to customer)</label>
                  <textarea style={{ ...inputStyle, height:48, resize:'vertical' }} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Dispatch notes, driver instructions…" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${B.cardBorder}`, display:'flex', gap:10, justifyContent:'space-between', alignItems:'center' }}>
          {!newCustomerMode && (
            <button style={btnSecondary} onClick={()=>{
              if (step==='details') setStep('service')
              else if (step==='service') setStep('customer')
              else onClose()
            }}>← Back</button>
          )}
          {step === 'details' && (
            <button style={{ ...btnPrimary, opacity:saving||!form.address||!form.suburb?0.6:1 }}
              disabled={saving||!form.address||!form.suburb}
              onClick={handleSubmit}>
              {saving ? 'Creating…' : 'Create Booking →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────���──────────────────────────────────
export default function CRMBookingsPage() {
  const { isMobile } = useBreakpoint()
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [localCustomers, setLocalCustomers] = useState([])

  const { data: supabaseCustomers, isError } = useCustomers({})
  const customers = useMemo(() => {
    const base = (supabaseCustomers && supabaseCustomers.length > 0 && !isError) ? supabaseCustomers : FALLBACK_CUSTOMERS
    // Prepend any locally created customers (not yet in the fetched list)
    const baseIds = new Set(base.map(c=>c.id))
    const extra = localCustomers.filter(c=>!baseIds.has(c.id))
    return [...extra, ...base]
  }, [supabaseCustomers, isError, localCustomers])

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        let q = supabase.from('bookings').select('*, customers(name)').order('created_at',{ascending:false}).limit(100)
        if (statusFilter !== 'all') q = q.eq('status', statusFilter)
        if (search) q = q.or(`customer_name.ilike.%${search}%,suburb.ilike.%${search}%`)
        const { data } = await q
        setBookings(data || [])
      } catch { setBookings([]) } finally { setLoading(false) }
    }
    load()
  }, [search, statusFilter])

  const STATUS_CFG = {
    pending:    { color:B.amber,   bg:`${B.amber}15`   },
    confirmed:  { color:B.blue,    bg:`${B.blue}15`    },
    scheduled:  { color:B.purple,  bg:`${B.purple}15`  },
    in_progress:{ color:B.cyan,    bg:`${B.cyan}15`    },
    completed:  { color:B.green,   bg:`${B.green}15`   },
    cancelled:  { color:B.textMuted, bg:`${B.textMuted}15` },
  }

  const cardBorder = { background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'12px 16px' }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:fontHead, fontSize:24, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.04em' }}>Bookings</div>
          <div style={{ fontSize:13, color:B.textMuted, marginTop:4 }}>CRM-linked bookings — create from customer account · <a href="/book" target="_blank" style={{ color:B.blue, textDecoration:'none' }}>Customer self-service widget ↗</a></div>
        </div>
        <button onClick={()=>setShowNew(true)} style={btnPrimary}>+ New Booking</button>
      </div>

      {/* Service matrix preview */}
      <div style={{ ...cardBorder, marginBottom:24 }}>
        <div style={{ fontFamily:fontHead, fontSize:11, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Service Matrix — Pricing Guide</div>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:8 }}>
          {SERVICE_MATRIX.slice(0,4).map(cat => (
            <div key={cat.category} style={{ background:B.bg, borderRadius:8, padding:'10px 12px', borderLeft:`3px solid ${cat.color}` }}>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                <span>{cat.icon}</span>
                <span style={{ fontFamily:fontHead, fontSize:11, fontWeight:700, color:cat.color, textTransform:'uppercase' }}>{cat.category}</span>
              </div>
              <div style={{ fontSize:11, color:B.textMuted }}>
                {fmtFull(cat.services[0].price)} – {fmtFull(cat.services[cat.services.length-1].poa?cat.services[cat.services.length-2].price:cat.services[cat.services.length-1].price)}
                {cat.services.some(s=>s.poa) ? ' + POA' : ''} + GST
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input style={{ ...cardBorder, flex:1, minWidth:200, padding:'8px 12px', border:`1px solid ${B.cardBorder}`, borderRadius:8, fontSize:13, fontFamily:fontBody, outline:'none' }}
          placeholder="Search customer or suburb…" value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{ display:'flex', gap:6 }}>
          {['all','pending','confirmed','scheduled','in_progress','completed'].map(s=>{
            const cfg = s==='all'?null:STATUS_CFG[s]
            return (
              <button key={s} onClick={()=>setStatusFilter(s)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${statusFilter===s?(cfg?.color||B.yellow):B.cardBorder}`, background:statusFilter===s?(cfg?.bg||B.yellow):'transparent', color:statusFilter===s?(cfg?.color||B.black):B.textSecondary, cursor:'pointer', fontFamily:fontHead, fontSize:10, fontWeight:700, textTransform:'uppercase' }}>
                {s === 'all' ? 'All' : s.replace('_',' ')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bookings list */}
      {loading && <div style={{ textAlign:'center', padding:'40px', color:B.textMuted }}>Loading…</div>}
      {!loading && bookings.length === 0 && (
        <div style={{ ...cardBorder, textAlign:'center', padding:'48px', color:B.textMuted }}>
          No bookings found · <button style={{ background:'none', border:'none', color:B.blue, cursor:'pointer', fontFamily:fontBody, fontSize:13, textDecoration:'underline' }} onClick={()=>setShowNew(true)}>Create first booking</button>
        </div>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {bookings.map(b => {
          const cfg = STATUS_CFG[b.status] || STATUS_CFG.pending
          return (
            <div key={b.id} style={{ ...cardBorder, display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:fontHead, fontSize:14, fontWeight:700, color:B.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {b.customers?.name || b.customer_name}
                </div>
                <div style={{ fontSize:11, color:B.textMuted }}>{b.bin_size} · {b.waste_type} · {b.suburb}</div>
              </div>
              {!isMobile && <>
                <div style={{ fontSize:12, color:B.textSecondary, minWidth:80 }}>{fmtDate(b.delivery_date)}</div>
                {b.price > 0 && <div style={{ fontSize:13, fontWeight:700, color:B.textPrimary, minWidth:70, textAlign:'right' }}>${b.price} ex GST</div>}
              </>}
              <span style={{ display:'inline-flex', alignItems:'center', background:cfg.bg, color:cfg.color, fontFamily:fontHead, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, textTransform:'uppercase', whiteSpace:'nowrap' }}>
                {b.status.replace('_',' ')}
              </span>
            </div>
          )
        })}
      </div>

      {showNew && <NewBookingModal onClose={()=>setShowNew(false)} customers={customers} onCustomerCreated={c=>setLocalCustomers(prev=>[c,...prev])} />}
    </div>
  )
}
