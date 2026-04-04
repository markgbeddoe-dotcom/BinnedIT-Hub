import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { B, fontHead, fontBody } from '../theme'
import { SectionHeader } from './UIComponents'
import { getAuditLog } from '../api/audit'
import { useBreakpoint } from '../hooks/useBreakpoint'

const TABLES  = ['bookings', 'invoices', 'customers']
const ACTIONS = ['INSERT', 'UPDATE', 'DELETE']
const PAGE_SIZE = 50

const actionColor = (a) =>
  a === 'INSERT' ? B.green : a === 'DELETE' ? B.red : B.amber

function diffSummary(oldVals, newVals, action) {
  if (action === 'DELETE') return <span style={{ fontSize: 11, color: B.red }}>Record deleted</span>
  if (action === 'INSERT' && newVals) {
    const pairs = Object.entries(newVals)
      .filter(([k]) => k !== 'id' && k !== 'created_at' && k !== 'updated_at')
      .slice(0, 2)
    return (
      <span style={{ fontSize: 11, color: B.textMuted }}>
        {pairs.map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 24)}`).join(' · ')}
      </span>
    )
  }
  if (action === 'UPDATE' && oldVals && newVals) {
    const changed = Object.keys(newVals).filter(
      k => k !== 'updated_at' && JSON.stringify(newVals[k]) !== JSON.stringify(oldVals[k])
    ).slice(0, 3)
    if (!changed.length) return <span style={{ fontSize: 11, color: B.textMuted }}>No field changes</span>
    return (
      <div>
        {changed.map(k => (
          <div key={k} style={{ fontSize: 11, color: B.textMuted, marginBottom: 1 }}>
            <span style={{ color: B.textSecondary, fontWeight: 600 }}>{k}:</span>{' '}
            <span style={{ color: B.red }}>{String(oldVals[k] ?? '').slice(0, 18)}</span>
            {' → '}
            <span style={{ color: B.green }}>{String(newVals[k] ?? '').slice(0, 18)}</span>
          </div>
        ))}
      </div>
    )
  }
  return '—'
}

export default function AuditLogPage() {
  const navigate = useNavigate()
  const { isMobile } = useBreakpoint()

  const [filters, setFilters] = useState({ tableName: '', action: '', dateFrom: '', dateTo: '' })
  const [page, setPage] = useState(0)

  const setFilter = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(0) }

  const queryParams = {
    tableName: filters.tableName || undefined,
    action:    filters.action    || undefined,
    dateFrom:  filters.dateFrom  ? `${filters.dateFrom}T00:00:00Z` : undefined,
    dateTo:    filters.dateTo    ? `${filters.dateTo}T23:59:59Z`   : undefined,
    limit:     PAGE_SIZE,
    offset:    page * PAGE_SIZE,
  }

  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ['audit-log', queryParams],
    queryFn: () => getAuditLog(queryParams),
    retry: false,
  })

  const iStyle = {
    background: B.bg,
    border: `1px solid ${B.cardBorder}`,
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    color: B.textPrimary,
    outline: 'none',
    fontFamily: fontBody,
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 12px' : '40px 24px' }}>
      {/* Back nav */}
      <button
        onClick={() => navigate('/settings')}
        style={{
          background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6,
          padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: B.textSecondary,
          fontFamily: fontHead, marginBottom: 12, display: 'inline-block',
        }}
      >
        ← Settings
      </button>

      <SectionHeader
        title="Audit Log"
        subtitle="Immutable record of all changes across bookings, invoices, and customers"
      />

      {/* Filters */}
      <div style={{
        background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10,
        padding: '14px 18px', marginBottom: 20,
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>Table</label>
          <select value={filters.tableName} onChange={e => setFilter('tableName', e.target.value)} style={iStyle}>
            <option value="">All tables</option>
            {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>Action</label>
          <select value={filters.action} onChange={e => setFilter('action', e.target.value)} style={iStyle}>
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>From</label>
          <input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} style={iStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3, fontFamily: fontHead, textTransform: 'uppercase' }}>To</label>
          <input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} style={iStyle} />
        </div>
        <button
          onClick={() => { setFilters({ tableName: '', action: '', dateFrom: '', dateTo: '' }); setPage(0) }}
          style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: B.textSecondary, fontFamily: fontHead }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: B.textMuted, fontSize: 13 }}>Loading audit log…</div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: 'center', color: B.red, fontSize: 13 }}>
            Could not load audit log. Apply migration 010 to enable audit trail.
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: B.textMuted, fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📋</div>
            No audit entries found.{page === 0 && ' Changes to bookings and invoices will be recorded here automatically.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B.cardBorder}`, background: B.bg }}>
                  {['Time', 'Table', 'Action', 'Record', 'Changed By', 'Details'].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 10, color: B.textMuted, fontFamily: fontHead,
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                    <td style={{ padding: '8px 14px', color: B.textMuted, whiteSpace: 'nowrap', fontSize: 11 }}>
                      {new Date(log.created_at).toLocaleString('en-AU', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '8px 14px', color: B.textPrimary, fontWeight: 600 }}>
                      {log.table_name}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        padding: '2px 8px', borderRadius: 4,
                        background: `${actionColor(log.action)}20`,
                        color: actionColor(log.action),
                        fontFamily: fontHead,
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '8px 14px', color: B.textMuted, fontFamily: 'monospace', fontSize: 11 }}>
                      {log.record_id ? `${log.record_id.slice(0, 8)}…` : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', color: B.textMuted, fontSize: 11 }}>
                      {log.changed_by ? `${log.changed_by.slice(0, 8)}…` : '(system)'}
                    </td>
                    <td style={{ padding: '8px 14px', maxWidth: 280 }}>
                      {diffSummary(log.old_values, log.new_values, log.action)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (logs.length === PAGE_SIZE || page > 0) && (
          <div style={{
            padding: '10px 16px', borderTop: `1px solid ${B.cardBorder}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6,
                padding: '5px 14px', cursor: page === 0 ? 'not-allowed' : 'pointer',
                fontSize: 12, color: page === 0 ? B.textMuted : B.textSecondary, fontFamily: fontHead,
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: B.textMuted }}>Page {page + 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={logs.length < PAGE_SIZE}
              style={{
                background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6,
                padding: '5px 14px', cursor: logs.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
                fontSize: 12, color: logs.length < PAGE_SIZE ? B.textMuted : B.textSecondary, fontFamily: fontHead,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: B.textMuted }}>
        Audit log is immutable — entries cannot be edited or deleted. Only owners and managers can view this log.
      </div>
    </div>
  )
}
