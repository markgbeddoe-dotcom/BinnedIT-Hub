import React, { useState } from 'react'
import { B, fontHead, fontBody, fmtFull } from '../theme'
import { useInvoices, useInvoiceSummary, useUpdateInvoiceStatus } from '../hooks/useInvoices'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'


// ── Helpers ───────────────────────────────────────────────────────────────────

function daysOverdue(dueDateStr) {
  if (!dueDateStr) return 0
  const due = new Date(dueDateStr)
  const now = new Date()
  due.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((now - due) / 86400000))
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(val) {
  const n = parseFloat(val || 0)
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_CONFIG = {
  draft:     { label: 'Draft',    bg: '#3D3D4F', color: '#D0D0E0' },
  sent:      { label: 'Sent',     bg: '#1A4A8A', color: '#90C4FF' },
  paid:      { label: 'Paid',     bg: '#1A4A2A', color: '#6DD98B' },
  overdue:   { label: 'Overdue',  bg: '#5A1A1A', color: '#FF9090' },
  cancelled: { label: 'Cancelled',bg: '#3D3D3D', color: '#909090' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontFamily: fontHead, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 4, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

// ── Summary KPI cards ─────────────────────────────────────────────────────────

function SummaryCards({ summary, isMobile }) {
  const cards = [
    { label: 'Outstanding',  value: fmtMoney(summary?.totalOutstanding), color: B.amber, icon: '⏳' },
    { label: 'Overdue',      value: summary?.overdue || 0,               color: B.red,   icon: '🔴', suffix: ' invoices' },
    { label: 'Paid (total)', value: fmtMoney(summary?.totalPaid),        color: B.green, icon: '✓' },
    { label: 'Drafts',       value: summary?.draft || 0,                 color: B.textMuted, icon: '📄', suffix: ' invoices' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
      {cards.map(c => (
        <div key={c.label} style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderLeft: `4px solid ${c.color}`, borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>{c.icon}</div>
          <div style={{ fontFamily: fontHead, fontSize: isMobile ? 18 : 22, fontWeight: 700, color: B.textPrimary }}>
            {c.value}{c.suffix || ''}
          </div>
          <div style={{ fontSize: 11, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Invoice detail panel ──────────────────────────────────────────────────────

function InvoiceDetail({ invoice, onClose, onStatusChange, canEdit }) {
  const overdueDays = daysOverdue(invoice.due_date)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: B.cardBg, borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 20, fontWeight: 700, color: B.textPrimary }}>{invoice.invoice_number}</div>
            <div style={{ fontSize: 13, color: B.textMuted, marginTop: 2 }}>{invoice.customer_name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: B.textMuted, padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <StatusBadge status={invoice.status} />
          {overdueDays > 0 && invoice.status !== 'paid' && (
            <span style={{ fontSize: 12, color: B.red, fontWeight: 700 }}>{overdueDays} days overdue</span>
          )}
          {invoice.xero_invoice_id && (
            <span style={{ fontSize: 11, color: B.cyan, background: 'rgba(26,188,156,0.12)', padding: '3px 8px', borderRadius: 4, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {invoice.xero_sync_status === 'synced' ? 'Xero ✓' : 'Xero pending'}
            </span>
          )}
        </div>

        {/* Amounts */}
        <div style={{ background: B.bg, borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: B.textSecondary, marginBottom: 8 }}>
            <span>Amount (ex-GST)</span><span>{fmtMoney(invoice.amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: B.textSecondary, marginBottom: 8 }}>
            <span>GST (10%)</span><span>{fmtMoney(invoice.gst)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: B.textPrimary, borderTop: `1px solid ${B.cardBorder}`, paddingTop: 8 }}>
            <span>Total (inc-GST)</span><span>{fmtMoney(invoice.total)}</span>
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Created', value: fmtDate(invoice.created_at) },
            { label: 'Due Date', value: fmtDate(invoice.due_date) },
            { label: 'Sent', value: fmtDate(invoice.sent_at) },
            { label: 'Paid', value: fmtDate(invoice.paid_at) },
          ].map(row => (
            <div key={row.label} style={{ background: B.bg, borderRadius: 6, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: B.textPrimary, marginTop: 2 }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Reminder status */}
        <div style={{ background: B.bg, borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Payment Reminders</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: '7-day', sent: invoice.reminder_7_sent },
              { label: '14-day', sent: invoice.reminder_14_sent },
              { label: '30-day', sent: invoice.reminder_30_sent },
            ].map(r => (
              <span key={r.label} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', background: r.sent ? 'rgba(39,174,96,0.15)' : 'rgba(107,114,128,0.15)', color: r.sent ? B.green : B.textMuted }}>
                {r.label} {r.sent ? '✓' : '—'}
              </span>
            ))}
          </div>
        </div>

        {/* Customer */}
        {invoice.customer_email && (
          <div style={{ fontSize: 13, color: B.textSecondary, marginBottom: 16 }}>
            <span style={{ color: B.textMuted }}>Email: </span>
            <a href={`mailto:${invoice.customer_email}`} style={{ color: B.blue, textDecoration: 'none' }}>{invoice.customer_email}</a>
          </div>
        )}

        {/* Actions */}
        {canEdit && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {invoice.status === 'draft' && (
              <button
                onClick={() => { onStatusChange(invoice.id, 'sent'); onClose() }}
                style={{ flex: 1, background: B.blue, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontFamily: fontHead, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Mark as Sent
              </button>
            )}
            <button
              onClick={() => { onStatusChange(invoice.id, 'paid'); onClose() }}
              style={{ flex: 1, background: B.green, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontFamily: fontHead, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Mark as Paid
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Invoice row ───────────────────────────────────────────────────────────────

function InvoiceRow({ invoice, onClick, isMobile }) {
  const overdueDays = daysOverdue(invoice.due_date)

  if (isMobile) {
    return (
      <div onClick={onClick} style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderLeft: `3px solid ${STATUS_CONFIG[invoice.status]?.color || B.cardBorder}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, marginBottom: 2 }}>{invoice.invoice_number}</div>
          <div style={{ fontSize: 12, color: B.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice.customer_name}</div>
          {overdueDays > 0 && invoice.status !== 'paid' && (
            <div style={{ fontSize: 11, color: B.red, marginTop: 3 }}>{overdueDays}d overdue</div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, marginBottom: 4 }}>{fmtMoney(invoice.total)}</div>
          <StatusBadge status={invoice.status} />
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 90px 90px 100px', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${B.cardBorder}`, cursor: 'pointer', transition: 'background 0.15s' }}
      onMouseOver={e => e.currentTarget.style.background = B.cardBgHover}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
      <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.textPrimary }}>{invoice.invoice_number}</div>
      <div style={{ fontSize: 13, color: B.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{invoice.customer_name}</div>
      <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 600, color: B.textPrimary }}>{fmtMoney(invoice.total)}</div>
      <div style={{ fontSize: 12, color: B.textMuted }}>{fmtDate(invoice.due_date)}</div>
      <div>
        {overdueDays > 0 && invoice.status !== 'paid' && invoice.status !== 'cancelled'
          ? <span style={{ fontSize: 11, color: B.red, fontWeight: 700 }}>{overdueDays}d</span>
          : <span style={{ fontSize: 11, color: B.textMuted }}>—</span>}
      </div>
      <StatusBadge status={invoice.status} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'draft',    label: 'Draft' },
  { value: 'sent',     label: 'Sent' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'paid',     label: 'Paid' },
]

export default function InvoicesPage() {
  const { isMobile } = useBreakpoint()
  const { isOwner, isBookkeeper } = useAuth()
  const canEdit = isOwner || isBookkeeper

  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  const { data: invoices = [], isLoading } = useInvoices(statusFilter)
  const { data: summary } = useInvoiceSummary()
  const { mutate: updateStatus } = useUpdateInvoiceStatus()

  async function handleXeroSync() {
    setSyncLoading(true)
    setSyncMsg(null)
    try {
      const session = await supabase.auth.getSession()
      const token   = session?.data?.session?.access_token
      const res     = await fetch('/api/xero-payment-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setSyncMsg(`Synced ${data.synced} invoices — ${data.paid} marked paid`)
      } else {
        setSyncMsg(`Sync error: ${data.error}`)
      }
    } catch (err) {
      setSyncMsg(`Sync failed: ${err.message}`)
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 12px' : '24px 24px', fontFamily: fontBody }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: fontHead, fontSize: isMobile ? 22 : 26, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Invoices
          </h1>
          <p style={{ fontSize: 13, color: B.textMuted, margin: '4px 0 0' }}>
            Auto-generated from completed jobs · Payment tracking &amp; chasing
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {syncMsg && <span style={{ fontSize: 12, color: syncMsg.includes('error') || syncMsg.includes('failed') ? B.red : B.green }}>{syncMsg}</span>}
            <button
              onClick={handleXeroSync}
              disabled={syncLoading}
              style={{ background: 'none', border: `1px solid ${B.cyan}`, color: B.cyan, borderRadius: 7, padding: '8px 14px', cursor: syncLoading ? 'not-allowed' : 'pointer', fontFamily: fontHead, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: syncLoading ? 0.6 : 1 }}>
              {syncLoading ? 'Syncing…' : 'Sync Xero'}
            </button>
          </div>
        )}
      </div>

      {/* Summary KPIs */}
      {summary && <SummaryCards summary={summary} isMobile={isMobile} />}

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            style={{
              background: statusFilter === f.value ? B.yellow : B.cardBg,
              color:      statusFilter === f.value ? B.black   : B.textMuted,
              border:     `1px solid ${statusFilter === f.value ? B.yellow : B.cardBorder}`,
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
              fontFamily: fontHead, fontWeight: 700, fontSize: 11,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}>
            {f.label}
            {f.value !== 'all' && summary?.[f.value] > 0 && (
              <span style={{ marginLeft: 6, background: statusFilter === f.value ? 'rgba(0,0,0,0.15)' : B.bg, borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
                {summary[f.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px 90px 90px 100px', gap: 12, padding: '10px 16px', borderBottom: `2px solid ${B.cardBorder}`, background: B.bg }}>
            {['Invoice #', 'Customer', 'Amount', 'Due', 'Overdue', 'Status'].map(h => (
              <div key={h} style={{ fontSize: 10, fontFamily: fontHead, fontWeight: 700, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
            ))}
          </div>
        )}

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: B.textMuted, fontSize: 13 }}>Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
            <div style={{ fontFamily: fontHead, fontSize: 16, color: B.textMuted, textTransform: 'uppercase' }}>
              {statusFilter === 'all' ? 'No invoices yet' : `No ${statusFilter} invoices`}
            </div>
            <div style={{ fontSize: 13, color: B.textMuted, marginTop: 6 }}>
              Invoices are auto-generated when jobs are marked as completed in the Dispatch board.
            </div>
          </div>
        ) : (
          <div style={{ padding: isMobile ? '8px' : 0 }}>
            {invoices.map(inv => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onClick={() => setSelectedInvoice(inv)}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: B.textMuted }}>
        Showing {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
        {statusFilter !== 'all' ? ` with status: ${statusFilter}` : ''}.
        Automated payment chasing runs daily at 7pm AEST.
      </div>

      {/* Detail modal */}
      {selectedInvoice && (
        <InvoiceDetail
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onStatusChange={(id, status) => updateStatus({ id, status })}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
