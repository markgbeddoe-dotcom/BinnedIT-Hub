import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { B, fontHead, fontBody } from '../theme'
import {
  getStaffCertificates, upsertStaffCertificate, deleteStaffCertificate,
  getInsurancePolicies, upsertInsurancePolicy,
} from '../api/team'
import { useAuth } from '../context/AuthContext'
import { useBreakpoint } from '../hooks/useBreakpoint'

// ─────────────────────────────────────────────────────────────────────────────
// CompliancePanel — GAP-048 (UAT 2026-06-10)
//
// Staff certificates + insurance policies CRUD against the migration-010
// tables (staff_certificates, insurance_policies) via src/api/team.js,
// with 30/7-day expiry warnings surfaced in a combined banner.
// Mounted inside TeamPage (/settings/team).
//
// RLS note: SELECT is open to all authenticated users; INSERT/UPDATE require
// role in ('owner','manager') at the DB level — the UI mirrors that with
// canEdit, but note fleet_manager passes the UI isManager check while the DB
// policy rejects writes (current_user_role() IN ('owner','manager') only).
// ─────────────────────────────────────────────────────────────────────────────

const CERT_TYPES = [
  { value: 'asbestos_supervisor', label: 'Asbestos Supervisor' },
  { value: 'asbestos_worker',     label: 'Asbestos Worker' },
  { value: 'whs',                 label: 'WHS / Safety' },
  { value: 'drivers_licence',     label: "Driver's Licence" },
  { value: 'heavy_vehicle',       label: 'Heavy Vehicle (HC)' },
  { value: 'first_aid',           label: 'First Aid' },
  { value: 'other',               label: 'Other' },
]

const POLICY_TYPES = [
  { value: 'public_liability', label: 'Public Liability' },
  { value: 'workers_comp',     label: 'Workers Compensation' },
  { value: 'vehicle',          label: 'Vehicle / Fleet' },
  { value: 'property',         label: 'Property' },
  { value: 'other',            label: 'Other' },
]

const BLANK_CERT = { staff_name: '', cert_name: '', cert_type: 'other', issuer: '', cert_number: '', expiry_date: '' }
const BLANK_POLICY = { provider: '', policy_type: 'public_liability', policy_number: '', insured_amount: '', annual_premium: '', start_date: '', expiry_date: '', notes: '' }

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

// Expiry status — 30/7-day thresholds per GAP-048
export function expiryStatus(expiryDate) {
  const days = daysUntil(expiryDate)
  if (days === null) return { label: 'No expiry', color: B.textMuted, level: 'none', days }
  if (days < 0)   return { label: 'EXPIRED',            color: B.red,   level: 'expired', days }
  if (days <= 7)  return { label: `${days}d — URGENT`,  color: B.red,   level: 'urgent',  days }
  if (days <= 30) return { label: `${days}d left`,      color: B.amber, level: 'warning', days }
  return { label: 'Current', color: B.green, level: 'ok', days }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '—'
  return `$${Number(v).toLocaleString('en-AU')}`
}

export default function CompliancePanel() {
  const qc = useQueryClient()
  const { isOwner, isManager } = useAuth()
  const { isMobile } = useBreakpoint()
  const canEdit = isOwner || isManager

  const [showAddCert, setShowAddCert] = useState(false)
  const [certForm, setCertForm] = useState(BLANK_CERT)
  const [showAddPolicy, setShowAddPolicy] = useState(false)
  const [policyForm, setPolicyForm] = useState(BLANK_POLICY)
  const [editingPolicyId, setEditingPolicyId] = useState(null)
  const [mutError, setMutError] = useState(null)

  const iStyle = {
    background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 12, color: B.textPrimary,
    outline: 'none', fontFamily: fontBody,
  }
  const cardStyle = { background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: isMobile ? 16 : 24, marginBottom: 20 }
  const headStyle = { fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }

  // ── Queries (graceful fallback — never blank-crash if tables missing) ──
  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ['staff-certs'],
    queryFn: () => getStaffCertificates().catch(() => []),
    retry: false,
  })
  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: () => getInsurancePolicies().catch(() => []),
    retry: false,
  })

  // ── Mutations ──────────────────────────────────────────────
  const addCertMut = useMutation({
    mutationFn: upsertStaffCertificate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-certs'] })
      setShowAddCert(false)
      setCertForm(BLANK_CERT)
      setMutError(null)
    },
    onError: (e) => setMutError(e?.message || 'Save failed'),
  })
  const removeCertMut = useMutation({
    mutationFn: deleteStaffCertificate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-certs'] }),
    onError: (e) => setMutError(e?.message || 'Remove failed'),
  })
  const savePolicyMut = useMutation({
    mutationFn: upsertInsurancePolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-policies'] })
      setShowAddPolicy(false)
      setPolicyForm(BLANK_POLICY)
      setEditingPolicyId(null)
      setMutError(null)
    },
    onError: (e) => setMutError(e?.message || 'Save failed'),
  })
  const removePolicyMut = useMutation({
    // No dedicated delete API — soft-delete via is_active=false (same pattern as certs)
    mutationFn: (id) => upsertInsurancePolicy({ id, is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance-policies'] }),
    onError: (e) => setMutError(e?.message || 'Remove failed'),
  })

  // ── Expiry warnings (30/7 days + expired) across both tables ──
  const warnings = useMemo(() => {
    const certWarnings = certs
      .map(c => ({ kind: 'Certificate', name: `${c.staff_name} — ${c.cert_name}`, status: expiryStatus(c.expiry_date) }))
    const policyWarnings = policies
      .map(p => ({ kind: 'Insurance', name: `${p.provider} ${POLICY_TYPES.find(t => t.value === p.policy_type)?.label || p.policy_type}`, status: expiryStatus(p.expiry_date) }))
    return [...certWarnings, ...policyWarnings]
      .filter(w => ['expired', 'urgent', 'warning'].includes(w.status.level))
      .sort((a, b) => (a.status.days ?? 0) - (b.status.days ?? 0))
  }, [certs, policies])

  const savePolicy = () => {
    if (!policyForm.provider.trim() || !policyForm.expiry_date) return
    const payload = {
      ...(editingPolicyId ? { id: editingPolicyId } : {}),
      provider: policyForm.provider.trim(),
      policy_type: policyForm.policy_type,
      policy_number: policyForm.policy_number.trim() || null,
      insured_amount: policyForm.insured_amount !== '' ? parseFloat(policyForm.insured_amount) : null,
      annual_premium: policyForm.annual_premium !== '' ? parseFloat(policyForm.annual_premium) : null,
      start_date: policyForm.start_date || null,
      expiry_date: policyForm.expiry_date,
      notes: policyForm.notes.trim() || null,
    }
    savePolicyMut.mutate(payload)
  }

  const startEditPolicy = (p) => {
    setEditingPolicyId(p.id)
    setShowAddPolicy(true)
    setPolicyForm({
      provider: p.provider || '',
      policy_type: p.policy_type || 'other',
      policy_number: p.policy_number || '',
      insured_amount: p.insured_amount ?? '',
      annual_premium: p.annual_premium ?? '',
      start_date: p.start_date || '',
      expiry_date: p.expiry_date || '',
      notes: p.notes || '',
    })
  }

  const thStyle = { padding: '7px 12px', textAlign: 'left', fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }
  const labelStyle = { display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 3 }

  return (
    <div data-testid="compliance-panel">
      {/* ── Expiry warnings banner (30/7-day thresholds) ── */}
      {warnings.length > 0 && (
        <div
          data-testid="compliance-expiry-banner"
          style={{
            background: warnings.some(w => w.status.level !== 'warning') ? `${B.red}10` : `${B.amber}12`,
            border: `1px solid ${warnings.some(w => w.status.level !== 'warning') ? B.red : B.amber}40`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          }}
        >
          <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 6 }}>
            ⚠ Compliance expiry warnings ({warnings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4, fontFamily: fontHead,
                  background: `${w.status.color}20`, color: w.status.color, textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  {w.status.label}
                </span>
                <span style={{ color: B.textMuted, fontSize: 10, fontFamily: fontHead, textTransform: 'uppercase' }}>{w.kind}</span>
                <span style={{ color: B.textPrimary }}>{w.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mutError && (
        <div style={{ background: `${B.red}12`, border: `1px solid ${B.red}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: B.red }}>
          ✗ {mutError}
        </div>
      )}

      {/* ── Staff Certificates ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={headStyle}>Certifications &amp; Licences</div>
          {canEdit && (
            <button
              data-testid="add-cert-button"
              onClick={() => { setShowAddCert(prev => !prev); setCertForm(BLANK_CERT) }}
              style={{
                background: B.yellow, border: 'none', borderRadius: 6,
                color: '#000', padding: '6px 14px', cursor: 'pointer',
                fontFamily: fontHead, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}
            >
              + Add Certificate
            </button>
          )}
        </div>

        {showAddCert && (
          <div style={{ background: B.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: fontHead, fontSize: 11, color: B.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
              New Certificate / Licence
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Staff Name', key: 'staff_name', placeholder: 'e.g. Mark Beddoe' },
                { label: 'Certificate Name', key: 'cert_name', placeholder: 'e.g. Asbestos Supervisor' },
                { label: 'Cert Number', key: 'cert_number', placeholder: 'e.g. ASB-001' },
                { label: 'Issuer', key: 'issuer', placeholder: 'e.g. SafeWork VIC' },
              ].map(f => (
                <div key={f.key}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    value={certForm[f.key]}
                    onChange={e => setCertForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Type</label>
                <select value={certForm.cert_type} onChange={e => setCertForm(p => ({ ...p, cert_type: e.target.value }))} style={{ ...iStyle, width: '100%' }}>
                  {CERT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Expiry Date</label>
                <input
                  type="date"
                  value={certForm.expiry_date}
                  onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))}
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                data-testid="save-cert-button"
                onClick={() => {
                  if (!certForm.staff_name.trim() || !certForm.cert_name.trim()) return
                  addCertMut.mutate({ ...certForm, expiry_date: certForm.expiry_date || null })
                }}
                disabled={addCertMut.isPending}
                style={{ background: B.green, border: 'none', borderRadius: 6, color: '#fff', padding: '8px 20px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}
              >
                {addCertMut.isPending ? 'Saving…' : 'Save Certificate'}
              </button>
              <button
                onClick={() => setShowAddCert(false)}
                style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6, color: B.textSecondary, padding: '8px 14px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {certsLoading ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                  {['Staff Member', 'Certificate', 'Type', 'Issuer', 'Expiry', 'Status', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {certs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: B.textMuted, fontSize: 12 }}>
                      No certificates recorded. Click "Add Certificate" to get started.
                    </td>
                  </tr>
                ) : (
                  certs.map(c => {
                    const { label, color } = expiryStatus(c.expiry_date)
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: B.textPrimary }}>{c.staff_name}</td>
                        <td style={{ padding: '8px 12px', color: B.textSecondary }}>{c.cert_name}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, fontSize: 11 }}>
                          {CERT_TYPES.find(t => t.value === c.cert_type)?.label || c.cert_type}
                        </td>
                        <td style={{ padding: '8px 12px', color: B.textMuted }}>{c.issuer || '—'}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, whiteSpace: 'nowrap' }}>{fmtDate(c.expiry_date)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: `${color}20`, color, fontFamily: fontHead, whiteSpace: 'nowrap',
                          }}>
                            {label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {canEdit && (
                            <button
                              onClick={() => removeCertMut.mutate(c.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.red, fontSize: 11, fontFamily: fontHead, padding: 0 }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Insurance Policies ── */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={headStyle}>Insurance Policies</div>
          {canEdit && (
            <button
              data-testid="add-policy-button"
              onClick={() => {
                setShowAddPolicy(prev => !prev)
                setPolicyForm(BLANK_POLICY)
                setEditingPolicyId(null)
              }}
              style={{
                background: B.yellow, border: 'none', borderRadius: 6,
                color: '#000', padding: '6px 14px', cursor: 'pointer',
                fontFamily: fontHead, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}
            >
              + Add Policy
            </button>
          )}
        </div>

        {showAddPolicy && (
          <div style={{ background: B.bg, borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <div style={{ fontFamily: fontHead, fontSize: 11, color: B.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>
              {editingPolicyId ? 'Edit Insurance Policy' : 'New Insurance Policy'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
              <div>
                <label style={labelStyle}>Provider *</label>
                <input
                  data-testid="policy-provider-input"
                  value={policyForm.provider}
                  onChange={e => setPolicyForm(p => ({ ...p, provider: e.target.value }))}
                  placeholder="e.g. QBE Australia"
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Policy Type</label>
                <select value={policyForm.policy_type} onChange={e => setPolicyForm(p => ({ ...p, policy_type: e.target.value }))} style={{ ...iStyle, width: '100%' }}>
                  {POLICY_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Policy Number</label>
                <input
                  value={policyForm.policy_number}
                  onChange={e => setPolicyForm(p => ({ ...p, policy_number: e.target.value }))}
                  placeholder="e.g. QBE-2024-8872"
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Insured Amount ($)</label>
                <input
                  type="number"
                  value={policyForm.insured_amount}
                  onChange={e => setPolicyForm(p => ({ ...p, insured_amount: e.target.value }))}
                  placeholder="e.g. 20000000"
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Annual Premium ($)</label>
                <input
                  type="number"
                  value={policyForm.annual_premium}
                  onChange={e => setPolicyForm(p => ({ ...p, annual_premium: e.target.value }))}
                  placeholder="e.g. 12000"
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Start Date</label>
                <input
                  type="date"
                  value={policyForm.start_date}
                  onChange={e => setPolicyForm(p => ({ ...p, start_date: e.target.value }))}
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Expiry Date *</label>
                <input
                  data-testid="policy-expiry-input"
                  type="date"
                  value={policyForm.expiry_date}
                  onChange={e => setPolicyForm(p => ({ ...p, expiry_date: e.target.value }))}
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                <label style={labelStyle}>Notes</label>
                <input
                  value={policyForm.notes}
                  onChange={e => setPolicyForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Public & Product Liability $20M"
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                data-testid="save-policy-button"
                onClick={savePolicy}
                disabled={savePolicyMut.isPending || !policyForm.provider.trim() || !policyForm.expiry_date}
                style={{
                  background: B.green, border: 'none', borderRadius: 6, color: '#fff',
                  padding: '8px 20px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12,
                  opacity: savePolicyMut.isPending || !policyForm.provider.trim() || !policyForm.expiry_date ? 0.6 : 1,
                }}
              >
                {savePolicyMut.isPending ? 'Saving…' : (editingPolicyId ? 'Update Policy' : 'Save Policy')}
              </button>
              <button
                onClick={() => { setShowAddPolicy(false); setEditingPolicyId(null) }}
                style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6, color: B.textSecondary, padding: '8px 14px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {policiesLoading ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table data-testid="insurance-policies-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                  {['Provider', 'Type', 'Policy #', 'Insured', 'Premium', 'Expiry', 'Status', ''].map((h, i) => (
                    <th key={i} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: B.textMuted, fontSize: 12 }}>
                      No insurance policies recorded. Click "Add Policy" to get started.
                    </td>
                  </tr>
                ) : (
                  policies.map(p => {
                    const { label, color } = expiryStatus(p.expiry_date)
                    return (
                      <tr key={p.id} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: B.textPrimary }}>{p.provider}</td>
                        <td style={{ padding: '8px 12px', color: B.textSecondary, fontSize: 11 }}>
                          {POLICY_TYPES.find(t => t.value === p.policy_type)?.label || p.policy_type}
                        </td>
                        <td style={{ padding: '8px 12px', color: B.textMuted }}>{p.policy_number || '—'}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, whiteSpace: 'nowrap' }}>{fmtMoney(p.insured_amount)}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, whiteSpace: 'nowrap' }}>{fmtMoney(p.annual_premium)}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, whiteSpace: 'nowrap' }}>{fmtDate(p.expiry_date)}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: `${color}20`, color, fontFamily: fontHead, whiteSpace: 'nowrap',
                          }}>
                            {label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => startEditPolicy(p)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.blue, fontSize: 11, fontFamily: fontHead, padding: 0, marginRight: 10 }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => removePolicyMut.mutate(p.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.red, fontSize: 11, fontFamily: fontHead, padding: 0 }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
