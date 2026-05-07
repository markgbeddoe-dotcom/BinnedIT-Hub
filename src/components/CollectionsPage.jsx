import React, { useState, useMemo, useRef } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useCollectionsSummary, useOverdueInvoices, useCreateCollectionsEvent, useEscalateInvoice } from '../hooks/useCollections'
import { generateCollectionsLetter, generateCollectionsLetterHTML, generateSecurityOverAssetsLetter } from '../lib/legalTemplates'
import { useCompanyConfig } from '../hooks/useCompanyConfig'
import { supabase } from '../lib/supabase'

// ── Fallback overdue invoices when Supabase unavailable ───────────────────────
const FALLBACK_OVERDUE = [
  { id:'f1', invoice_number:'INV-0043', customer_name:'Roach Demolition', customer_email:'office@roachdemo.com.au', total:2100, due_date:'2026-04-14', status:'overdue', daysOverdue:10, collectionsLevel:2, collections_level:2, customers:{ id:'f3', name:'Roach Demolition', abn:'34 567 890 123', payment_terms_days:14 } },
  { id:'f2', invoice_number:'INV-0041', customer_name:"Scotty's Suburban", customer_email:'scott@suburbankip.com.au', total:1100, due_date:'2026-04-06', status:'overdue', daysOverdue:18, collectionsLevel:3, collections_level:1, customers:{ id:'f4', name:"Scotty's Suburban", payment_terms_days:7 } },
  { id:'f3', invoice_number:'INV-0038', customer_name:'TREC Plumbing', customer_email:'admin@trecplumbing.com.au', total:2200, due_date:'2026-03-30', status:'overdue', daysOverdue:25, collectionsLevel:4, collections_level:0, customers:{ id:'f6', name:'TREC Plumbing', payment_terms_days:7 } },
]

// ── Level config ──────────────────────────────────────────────────────────────
const LEVEL_CFG = {
  0: { label:'Current',       color:B.green,     bg:`${B.green}15`,  icon:'✓',  days:'0–4d' },
  1: { label:'Notice',        color:B.amber,     bg:`${B.amber}15`,  icon:'⚠',  days:'5–9d' },
  2: { label:'Formal Notice', color:B.orange,    bg:`${B.orange}15`, icon:'⚡',  days:'10–14d' },
  3: { label:'Letter of Demand', color:B.red,    bg:`${B.red}15`,    icon:'⚖',  days:'15–20d' },
  4: { label:'Statutory Demand', color:'#8B0000', bg:'#8B000015',    icon:'🔴', days:'21d+' },
}

const ACTION_LABELS = {
  1: { type:'notice',            label:'Send Overdue Notice',       desc:'Day 5 — Friendly payment reminder' },
  2: { type:'formal_notice',     label:'Send Formal Notice',        desc:'Day 10 — Formal overdue notice with interest warning' },
  3: { type:'letter_of_demand',  label:'Send Letter of Demand',     desc:'Day 15 — Legal letter of demand' },
  4: { type:'statutory_demand',  label:'Statutory Demand Warning',  desc:'Day 21+ — Wind-up threat under Corporations Act' },
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '—'

function LevelBadge({ level }) {
  const cfg = LEVEL_CFG[level] || LEVEL_CFG[0]
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:cfg.bg, color:cfg.color, fontFamily:fontHead, fontSize:10, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap' }}>{cfg.icon} {cfg.label}</span>
}

// ── Letter Preview Modal ──────────────────────────────────────────────────────
// Renders the new HTML letter (Sprint 18 #L1) inside a sandboxed <iframe>.
// We picked iframe srcDoc over dangerouslySetInnerHTML on purpose:
//   • Full style isolation — the letter's inline <style> can't leak into the
//     parent app (and vice-versa), so the Montserrat/Calibri rules don't fight
//     theme.js tokens.
//   • Print fidelity — calling iframe.contentWindow.print() prints ONLY the
//     letter (with its @media print rules), not the surrounding modal chrome,
//     which is the long-standing bug with window.print() on an outer page.
//   • Cleaner Send wire — we still send the raw HTML string to the API so the
//     downstream renderer sees the same thing the bookkeeper saw.
function LetterModal({ invoice, level, customer, onClose, onSend }) {
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [method, setMethod] = useState('email')
  const { company, hasPlaceholders } = useCompanyConfig()
  const iframeRef = useRef(null)

  // The HTML body gets sent (and stored on collections_events.letter_body) so
  // the audit trail keeps a verbatim copy of what was dispatched. We also
  // keep the plain-text version for email clients that prefer it.
  const letterHtml = useMemo(
    () => generateCollectionsLetterHTML(level, invoice, customer, null, company),
    [level, invoice, customer, company]
  )
  const letterText = useMemo(
    () => generateCollectionsLetter(level, invoice, customer, null, company),
    [level, invoice, customer, company]
  )

  const handleSend = async () => {
    setSending(true)
    setSendError(null)
    try {
      // We pass the HTML to onSend — collections-send will pick the right
      // representation. Plain text remains available via letterText for the
      // "manual" path or for email clients that need a fallback.
      await onSend(letterHtml, method, { letterText })
    } catch (err) {
      setSendError(err?.message || 'Send failed — please try again.')
    } finally {
      setSending(false)
    }
  }

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow
    if (!win) {
      // Fallback — printing the whole page is ugly but non-zero.
      window.print()
      return
    }
    try {
      win.focus()
      win.print()
    } catch {
      window.print()
    }
  }

  const levelCfg = LEVEL_CFG[level] || LEVEL_CFG[1]
  const actionLabel = ACTION_LABELS[level]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:860, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'2px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center', background:levelCfg.bg }}>
          <div>
            <div style={{ fontFamily:fontHead, fontSize:15, fontWeight:700, color:levelCfg.color, textTransform:'uppercase' }}>
              Level {level} — {actionLabel?.label}
            </div>
            <div style={{ fontSize:12, color:'#666', marginTop:2 }}>{customer?.name} · {invoice?.invoice_number} · {fmtFull(invoice?.total||0)}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>

        {/* Placeholder warning — letters are legally defective until ABN/BSB configured */}
        {hasPlaceholders && (
          <div style={{ padding:'10px 20px', background:'#FFF4E6', borderBottom:`2px solid ${B.amber}`, color:'#7A4F00', fontSize:12, lineHeight:1.5 }}>
            <strong>⚠ Company config not set.</strong> This letter contains placeholder ABN / ACN / BSB values
            (<code>{company.abn}</code> etc.) and would be legally defective if sent. Configure real values
            in <strong>Settings → Company Identity</strong> before recording any send action.
          </div>
        )}

        {/* Logo missing soft-warning — not blocking, just a UX nudge */}
        {!hasPlaceholders && !company.logo_url && (
          <div style={{ padding:'8px 20px', background:'#F3F4F6', borderBottom:`1px solid ${B.cardBorder}`, color:'#4B5563', fontSize:11.5, lineHeight:1.5 }}>
            ℹ No company logo uploaded — the letter shows an "Insert your logo here" placeholder.
            Upload one in <strong>Settings → Company Identity</strong>.
          </div>
        )}

        {/* Letter preview — iframe srcDoc keeps styles isolated */}
        <div style={{ flex:1, overflow:'hidden', background:'#E5E7EB', padding:'12px' }}>
          <iframe
            ref={iframeRef}
            title="Collections letter preview"
            srcDoc={letterHtml}
            style={{ width:'100%', height:'100%', border:'none', borderRadius:6, background:'#fff', boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}
          />
        </div>

        {/* Actions */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid #ddd', background:'#f5f5f5', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <label style={{ fontSize:11, fontFamily:fontHead, fontWeight:700, color:'#666', textTransform:'uppercase', marginRight:8 }}>Delivery Method:</label>
            <select value={method} onChange={e=>setMethod(e.target.value)} style={{ border:'1px solid #ccc', borderRadius:6, padding:'6px 10px', fontSize:13, fontFamily:fontBody }}>
              <option value="manual">Mark as sent (manual)</option>
              <option value="email">Email</option>
              <option value="post">Registered Post</option>
              <option value="email_post">Email + Registered Post</option>
            </select>
            {method !== 'manual' && (
              <div style={{ fontSize:10, color:B.textSecondary, marginTop:4 }}>
                ✓ Real send is now wired (email via Resend{method === 'post' || method === 'email_post' ? '; registered post is queued for manual dispatch' : ''}).
                Confirm the recipient ({customer?.email || invoice?.customer_email || 'no email on file'}) is correct before clicking send.
              </div>
            )}
            {sendError && (
              <div style={{ fontSize:11, color:B.red, marginTop:6, fontWeight:600 }}>
                ⚠ {sendError}
              </div>
            )}
          </div>
          <button onClick={handlePrint} style={{ background:'#eee', border:'1px solid #ccc', borderRadius:7, padding:'8px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12 }}>🖨 Print</button>
          <button
            onClick={handleSend}
            disabled={sending || hasPlaceholders}
            title={hasPlaceholders ? 'Configure company ABN/BSB in Settings before sending' : ''}
            style={{
              background: hasPlaceholders ? '#999' : levelCfg.color,
              border:'none', borderRadius:7, padding:'8px 18px',
              cursor: hasPlaceholders ? 'not-allowed' : 'pointer',
              fontFamily:fontHead, fontSize:12, fontWeight:700, color:'#fff',
              opacity:sending?0.7:1,
            }}
          >
            {hasPlaceholders
              ? '⚠ Config required'
              : sending
                ? (method === 'manual' ? 'Recording…' : 'Sending…')
                : (method === 'manual' ? `✓ Record — Level ${level}` : `✉ Send — Level ${level}`)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Security Letter Modal ─────────────────────────────────────────────────────
function SecurityLetterModal({ customer, onClose }) {
  const { company } = useCompanyConfig()
  const letter = useMemo(
    () => generateSecurityOverAssetsLetter(customer, customer?.credit_limit, company),
    [customer, company]
  )
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:800, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, width:'100%', maxWidth:760, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ padding:'14px 20px', borderBottom:'2px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:fontHead, fontSize:15, fontWeight:700, textTransform:'uppercase' }}>Security Over Assets — {customer?.name}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'24px 28px', fontFamily:'"Courier New",monospace', fontSize:12, lineHeight:1.8, whiteSpace:'pre-wrap', background:'#fafafa' }}>{letter}</div>
        <div style={{ padding:'14px 20px', borderTop:'1px solid #ddd', display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={()=>window.print()} style={{ background:'#eee', border:'1px solid #ccc', borderRadius:7, padding:'8px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12 }}>🖨 Print</button>
          <button onClick={onClose} style={{ background:B.yellow, border:'none', borderRadius:7, padding:'8px 18px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Invoice Row ───────────────────────────────────────────────────────────────
function InvoiceRow({ invoice, isMobile, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const currentLevel = invoice.collectionsLevel
  const lastLevel = invoice.collections_level || 0
  const customer = invoice.customers || {}
  const levelCfg = LEVEL_CFG[currentLevel] || LEVEL_CFG[1]
  const needsAction = currentLevel > lastLevel
  const isHighValue = parseFloat(invoice.total||0) > 5000

  return (
    <div style={{ border:`1px solid ${needsAction ? levelCfg.color+'60' : B.cardBorder}`, borderRadius:10, overflow:'hidden', marginBottom:8, background: needsAction ? levelCfg.bg : B.cardBg }}>
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={()=>setExpanded(!expanded)}>
        <LevelBadge level={currentLevel} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {customer.name || invoice.customer_name}
          </div>
          <div style={{ fontSize:11, color:B.textMuted }}>{invoice.invoice_number} · Due {fmtDate(invoice.due_date)}</div>
        </div>
        {!isMobile && (
          <>
            <div style={{ textAlign:'right', minWidth:80 }}>
              <div style={{ fontSize:14, fontWeight:700, color:B.textPrimary }}>{fmtFull(invoice.total||0)}</div>
            </div>
            <div style={{ textAlign:'center', minWidth:60 }}>
              <div style={{ fontSize:14, fontWeight:700, color:levelCfg.color }}>{invoice.daysOverdue}d</div>
              <div style={{ fontSize:9, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase' }}>overdue</div>
            </div>
          </>
        )}
        {needsAction && (
          <div style={{ background:levelCfg.color, borderRadius:5, padding:'4px 10px', fontFamily:fontHead, fontSize:10, fontWeight:700, color:'#fff', whiteSpace:'nowrap' }}>
            Action Required
          </div>
        )}
        <span style={{ fontSize:12, color:B.textMuted }}>{expanded?'▲':'▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop:`1px solid ${B.cardBorder}`, padding:'14px 16px', background:B.cardBg }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Invoice',      value: invoice.invoice_number },
              { label:'Amount',       value: fmtFull(invoice.total||0) },
              { label:'Days Overdue', value: `${invoice.daysOverdue} days`, color:levelCfg.color },
              { label:'Due Date',     value: fmtDate(invoice.due_date) },
              { label:'Status',       value: invoice.status },
              { label:'Last Action',  value: lastLevel > 0 ? `Level ${lastLevel} sent` : 'None' },
            ].map(k=>(
              <div key={k.label} style={{ background:B.bg, borderRadius:6, padding:'8px 10px' }}>
                <div style={{ fontSize:9, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                <div style={{ fontSize:13, fontWeight:600, color:k.color||B.textPrimary, marginTop:2 }}>{k.value||'—'}</div>
              </div>
            ))}
          </div>

          {/* Legal background for current level */}
          <div style={{ background:`${levelCfg.bg}`, border:`1px solid ${levelCfg.color}40`, borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
            <div style={{ fontFamily:fontHead, fontSize:11, color:levelCfg.color, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
              {levelCfg.icon} {ACTION_LABELS[currentLevel]?.label || 'Action'}
            </div>
            <div style={{ fontSize:12, color:B.textSecondary }}>{ACTION_LABELS[currentLevel]?.desc}</div>
            {currentLevel === 3 && <div style={{ fontSize:11, color:B.textMuted, marginTop:4 }}>Magistrates' Court of Victoria (up to $100k) · Interest: 10% p.a. · Penalty Interest Rates Act 1983 (Vic)</div>}
            {currentLevel === 4 && <div style={{ fontSize:11, color:B.textMuted, marginTop:4 }}>Corporations Act 2001 s.459E · Company has 21 days to pay or apply to set aside · Non-compliance = presumption of insolvency (s.459C)</div>}
          </div>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {currentLevel > 0 && (
              <button onClick={()=>onAction('letter', invoice, currentLevel, customer)} style={{ background:levelCfg.color, border:'none', borderRadius:7, padding:'9px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:'#fff' }}>
                {levelCfg.icon} Generate Level {currentLevel} Letter
              </button>
            )}
            {lastLevel > 0 && currentLevel > lastLevel && (
              <button onClick={()=>onAction('letter', invoice, lastLevel+1, customer)} style={{ background:B.yellow, border:'none', borderRadius:7, padding:'9px 16px', cursor:'pointer', fontFamily:fontHead, fontSize:12, fontWeight:700, color:B.black }}>
                ↑ Escalate to Level {lastLevel+1}
              </button>
            )}
            {isHighValue && (
              <button onClick={()=>onAction('security', invoice, currentLevel, customer)} style={{ background:'none', border:`1px solid ${B.purple}`, borderRadius:7, padding:'9px 14px', cursor:'pointer', fontFamily:fontHead, fontSize:12, color:B.purple }}>
                🔒 Security Over Assets Letter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CollectionsPage() {
  const { isMobile } = useBreakpoint()
  const { data: summary, isLoading, isError } = useCollectionsSummary()
  const { data: overdueInvoices } = useOverdueInvoices()
  const createEvent = useCreateCollectionsEvent()
  const escalate = useEscalateInvoice()
  const [filterLevel, setFilterLevel] = useState('all')
  const [modal, setModal] = useState(null)

  const invoices = useMemo(() => {
    const raw = (overdueInvoices && overdueInvoices.length > 0 && !isError) ? overdueInvoices : FALLBACK_OVERDUE
    if (filterLevel === 'all') return raw
    return raw.filter(inv => inv.collectionsLevel === parseInt(filterLevel))
  }, [overdueInvoices, filterLevel, isError])

  const stats = useMemo(() => {
    const raw = (overdueInvoices && overdueInvoices.length > 0 && !isError) ? overdueInvoices : FALLBACK_OVERDUE
    return {
      total: raw.length,
      totalAmount: raw.reduce((s,i)=>s+parseFloat(i.total||0),0),
      l1: raw.filter(i=>i.collectionsLevel===1).length,
      l2: raw.filter(i=>i.collectionsLevel===2).length,
      l3: raw.filter(i=>i.collectionsLevel===3).length,
      l4: raw.filter(i=>i.collectionsLevel===4).length,
      l1amt: raw.filter(i=>i.collectionsLevel===1).reduce((s,i)=>s+parseFloat(i.total||0),0),
      l2amt: raw.filter(i=>i.collectionsLevel===2).reduce((s,i)=>s+parseFloat(i.total||0),0),
      l3amt: raw.filter(i=>i.collectionsLevel===3).reduce((s,i)=>s+parseFloat(i.total||0),0),
      l4amt: raw.filter(i=>i.collectionsLevel===4).reduce((s,i)=>s+parseFloat(i.total||0),0),
    }
  }, [overdueInvoices, isError])

  const handleAction = (type, invoice, level, customer) => {
    setModal({ type, invoice, level, customer })
  }

  const handleSendLetter = async (letterHtml, deliveryMethod, opts = {}) => {
    // Sprint 13 #13A: actually send via Resend (and stub postal) when the
    // bookkeeper picks anything other than "manual". Manual still just records
    // the event for accounts where Sarah has already mailed via her own
    // channel. We POST to /api/collections-send BEFORE writing the
    // collections_events row — if the send fails (5xx, no key, etc.) the user
    // sees the error and we DO NOT record a "ghost sent" row.
    //
    // Sprint 18 #L1: the modal now passes the HTML letter as `letterHtml` for
    // the audit trail / preview, plus the plain-text version as opts.letterText
    // for the email body (the current API sends `text` to Resend; switching to
    // multipart HTML email is a future API change and is intentionally out of
    // scope for this commit per the constraints).
    const letterText = opts.letterText || letterHtml
    if (deliveryMethod !== 'manual') {
      const recipientEmail = modal.invoice?.customer_email
        || modal.customer?.email
        || modal.customer?.billing_email
      const recipientName  = modal.customer?.name || modal.invoice?.customer_name

      // Email-based methods need an address; postal-only doesn't.
      if ((deliveryMethod === 'email' || deliveryMethod === 'email_post') && !recipientEmail) {
        throw new Error('No email address on file for this customer — pick "Mark as sent (manual)" or add an email first.')
      }

      const sessionRes = await supabase.auth.getSession()
      const token = sessionRes?.data?.session?.access_token
      if (!token) {
        throw new Error('Your session has expired — please reload the page and sign in again.')
      }

      let res
      try {
        res = await fetch('/api/collections-send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            invoiceId: modal.invoice.id,
            level: modal.level,
            deliveryMethod,
            letterText,
            to: { email: recipientEmail, name: recipientName },
            cc: [],
          }),
        })
      } catch (netErr) {
        throw new Error(`Network error contacting send service: ${netErr?.message || 'unknown'}`)
      }

      let payload = {}
      try { payload = await res.json() } catch { /* non-JSON */ }
      if (!res.ok) {
        throw new Error(payload?.error || `Send failed (HTTP ${res.status})`)
      }
    }

    await createEvent.mutateAsync({
      invoice_id: modal.invoice.id?.startsWith('f') ? null : modal.invoice.id,
      customer_id: modal.customer?.id?.startsWith('f') ? null : modal.customer?.id,
      level: modal.level,
      action_type: ACTION_LABELS[modal.level]?.type || 'notice',
      amount_at_action: parseFloat(modal.invoice.total||0),
      days_overdue_at_action: modal.invoice.daysOverdue,
      // Persist the HTML letter — that's the artefact a regulator/CFO would
      // want to see in an audit. The plain-text rendering is regenerated on
      // demand from the same template if needed.
      letter_body: letterHtml,
      delivery_method: deliveryMethod,
      sent_at: new Date().toISOString(),
    })
    if (!modal.invoice.id?.startsWith('f') && !modal.customer?.id?.startsWith('f')) {
      await escalate.mutateAsync({ invoiceId: modal.invoice.id, level: modal.level })
    }
    setModal(null)
  }

  const cardBorder = { background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'14px 16px' }

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:fontHead, fontSize:24, fontWeight:700, color:B.textPrimary, textTransform:'uppercase', letterSpacing:'0.04em' }}>Collections</div>
        <div style={{ fontSize:13, color:B.textMuted, marginTop:4 }}>Overdue account management — escalating demand letters & legal action</div>
      </div>

      {/* Level Process Banner */}
      <div style={{ background:B.cardBg, border:`1px solid ${B.cardBorder}`, borderRadius:10, padding:'14px 20px', marginBottom:24 }}>
        <div style={{ fontFamily:fontHead, fontSize:11, color:B.textMuted, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Collections Process</div>
        <div style={{ display:'flex', gap:0, flexWrap:'wrap' }}>
          {[
            { level:1, label:'Overdue Notice', days:'Day 5', law:'Good faith reminder' },
            { level:2, label:'Formal Notice', days:'Day 10', law:'+ interest warning (Penalty Interest Rates Act 1983)' },
            { level:3, label:'Letter of Demand', days:'Day 15', law:'+ legal action threat (Magistrates\' Court / County Court VIC)' },
            { level:4, label:'Statutory Demand', days:'Day 21+', law:'+ wind-up threat (Corporations Act 2001 s.459E)' },
          ].map((step, i) => {
            const cfg = LEVEL_CFG[step.level]
            return (
              <React.Fragment key={step.level}>
                <div style={{ flex:1, minWidth:140, textAlign:'center', padding:'8px 12px' }}>
                  <div style={{ background:cfg.bg, border:`1px solid ${cfg.color}`, borderRadius:8, padding:'8px 10px', marginBottom:4 }}>
                    <div style={{ fontFamily:fontHead, fontSize:11, fontWeight:700, color:cfg.color, textTransform:'uppercase' }}>{step.days}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:B.textPrimary, marginTop:2 }}>{step.label}</div>
                    <div style={{ fontSize:10, color:B.textMuted, marginTop:2 }}>{step.law}</div>
                  </div>
                </div>
                {i < 3 && <div style={{ display:'flex', alignItems:'center', color:B.textMuted, fontSize:18, paddingTop:4 }}>→</div>}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap:10, marginBottom:24 }}>
        <div style={{ ...cardBorder, gridColumn: isMobile ? '1/-1' : undefined, borderLeft:`3px solid ${B.red}` }}>
          <div style={{ fontSize:10, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>Total Overdue</div>
          <div style={{ fontSize:22, fontWeight:700, color:B.red, marginTop:4 }}>{fmtFull(stats.totalAmount)}</div>
          <div style={{ fontSize:11, color:B.textMuted }}>{stats.total} invoices</div>
        </div>
        {[
          { level:1, color:B.amber, count:stats.l1, amt:stats.l1amt },
          { level:2, color:B.orange, count:stats.l2, amt:stats.l2amt },
          { level:3, color:B.red, count:stats.l3, amt:stats.l3amt },
          { level:4, color:'#8B0000', count:stats.l4, amt:stats.l4amt },
        ].map(s=>{
          const cfg = LEVEL_CFG[s.level]
          return (
            <div key={s.level} style={{ ...cardBorder, borderLeft:`3px solid ${s.color}`, cursor:'pointer', background: filterLevel===String(s.level)?`${s.color}08`:B.cardBg }}
              onClick={()=>setFilterLevel(filterLevel===String(s.level)?'all':String(s.level))}>
              <div style={{ fontSize:9, color:s.color, fontFamily:fontHead, textTransform:'uppercase', letterSpacing:'0.06em' }}>Level {s.level} — {cfg.days}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.color, marginTop:2 }}>{s.count}</div>
              <div style={{ fontSize:11, color:B.textMuted }}>{fmtFull(s.amt)}</div>
            </div>
          )
        })}
      </div>

      {/* Filter pills */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:B.textMuted, fontFamily:fontHead, textTransform:'uppercase' }}>Filter:</span>
        {['all','1','2','3','4'].map(l=>{
          const cfg = l==='all'?null:LEVEL_CFG[parseInt(l)]
          return (
            <button key={l} onClick={()=>setFilterLevel(l)}
              style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${filterLevel===l?(cfg?.color||B.yellow):B.cardBorder}`, background:filterLevel===l?(cfg?.bg||B.yellow):'transparent', color:filterLevel===l?(cfg?.color||B.black):B.textSecondary, cursor:'pointer', fontFamily:fontHead, fontSize:10, fontWeight:700, textTransform:'uppercase' }}>
              {l==='all'?'All':LEVEL_CFG[parseInt(l)].label}
            </button>
          )
        })}
      </div>

      {/* Invoice list */}
      {isLoading && <div style={{ textAlign:'center', padding:'40px', color:B.textMuted }}>Loading overdue accounts…</div>}
      {invoices.length === 0 && !isLoading && (
        <div style={{ ...cardBorder, textAlign:'center', padding:'48px', color:B.textMuted }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✓</div>
          <div style={{ fontFamily:fontHead, fontSize:16 }}>No overdue accounts{filterLevel!=='all'?` at Level ${filterLevel}`:''}</div>
        </div>
      )}
      {invoices.map(inv => (
        <InvoiceRow key={inv.id} invoice={inv} isMobile={isMobile} onAction={handleAction} />
      ))}

      {/* High-value risk warning */}
      {invoices.some(i=>parseFloat(i.total||0)>5000) && (
        <div style={{ marginTop:20, background:`${B.purple}10`, border:`1px solid ${B.purple}30`, borderRadius:10, padding:'14px 18px', display:'flex', gap:12, alignItems:'flex-start' }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🔒</span>
          <div>
            <div style={{ fontFamily:fontHead, fontSize:13, fontWeight:700, color:B.purple, textTransform:'uppercase' }}>High-Value Accounts — Consider Security</div>
            <div style={{ fontSize:12, color:B.textSecondary, marginTop:4 }}>
              Accounts over $5,000 outstanding should have a PPSR registration and Director's Guarantee.
              Click "Security Over Assets Letter" on individual invoices to generate the formal notice, or visit ppsr.gov.au to register (~$10 per registration, protects your position in insolvency).
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'letter' && (
        <LetterModal
          invoice={modal.invoice}
          level={modal.level}
          customer={modal.customer}
          onClose={()=>setModal(null)}
          onSend={handleSendLetter}
        />
      )}
      {modal?.type === 'security' && (
        <SecurityLetterModal
          customer={modal.customer}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  )
}
