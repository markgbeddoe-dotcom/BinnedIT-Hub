import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { B, fontHead, fontBody } from '../theme'
import { SectionHeader } from './UIComponents'
import {
  getTeamMembers, updateTeamMember,
  getStaffCertificates, upsertStaffCertificate, deleteStaffCertificate,
  getTeamRecentActivity,
} from '../api/team'
import { useAuth } from '../context/AuthContext'
import { useBreakpoint } from '../hooks/useBreakpoint'

const ROLES = ['owner', 'manager', 'bookkeeper', 'driver', 'fleet_manager', 'viewer']

const CERT_TYPES = [
  { value: 'asbestos_supervisor', label: 'Asbestos Supervisor' },
  { value: 'asbestos_worker',     label: 'Asbestos Worker' },
  { value: 'whs',                 label: 'WHS / Safety' },
  { value: 'drivers_licence',     label: "Driver's Licence" },
  { value: 'heavy_vehicle',       label: 'Heavy Vehicle (HC)' },
  { value: 'first_aid',           label: 'First Aid' },
  { value: 'other',               label: 'Other' },
]

const ROLE_COLORS = {
  owner:        B.yellow,
  manager:      B.blue,
  bookkeeper:   B.green,
  driver:       B.orange,
  fleet_manager:B.cyan,
  viewer:       B.textMuted,
}

function certStatus(expiryDate) {
  if (!expiryDate) return { label: 'No expiry', color: B.textMuted }
  const days = Math.ceil((new Date(expiryDate) - new Date()) / 86400000)
  if (days < 0)   return { label: 'EXPIRED',        color: B.red }
  if (days <= 30) return { label: `${days}d — urgent`, color: B.red }
  if (days <= 90) return { label: `${days}d left`,   color: B.amber }
  return { label: 'Current', color: B.green }
}

const BLANK_CERT = { staff_name: '', cert_name: '', cert_type: 'other', issuer: '', cert_number: '', expiry_date: '' }

export default function TeamPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isOwner, isManager } = useAuth()
  const { isMobile } = useBreakpoint()
  const canEdit = isOwner || isManager

  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm]           = useState({})
  const [selectedUser, setSelectedUser]   = useState(null)
  const [showAddCert, setShowAddCert]     = useState(false)
  const [certForm, setCertForm]           = useState(BLANK_CERT)

  const iStyle = {
    background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 12, color: B.textPrimary,
    outline: 'none', fontFamily: fontBody,
  }

  // ── Queries ────────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: getTeamMembers,
    retry: false,
  })
  const { data: certs = [], isLoading: certsLoading } = useQuery({
    queryKey: ['staff-certs'],
    queryFn: getStaffCertificates,
    retry: false,
  })
  const { data: activity = [] } = useQuery({
    queryKey: ['team-activity', selectedUser],
    queryFn: () => getTeamRecentActivity(selectedUser),
    enabled: !!selectedUser,
    retry: false,
  })

  // ── Mutations ──────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, updates }) => updateTeamMember(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      setEditingMember(null)
      setEditForm({})
    },
  })
  const addCertMut = useMutation({
    mutationFn: upsertStaffCertificate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-certs'] })
      setShowAddCert(false)
      setCertForm(BLANK_CERT)
    },
  })
  const removeCertMut = useMutation({
    mutationFn: deleteStaffCertificate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-certs'] }),
  })

  // ── Helpers ────────────────────────────────────────────────
  const startEdit = (m) => {
    setEditingMember(m.id)
    setEditForm({ full_name: m.full_name || '', phone: m.phone || '', role: m.role })
  }
  const saveEdit = (id) => {
    updateMut.mutate({ id, updates: editForm })
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '20px 12px' : '40px 24px' }}>
      {/* Back */}
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

      <SectionHeader title="Team & Staff" subtitle="Manage team members, roles, and compliance certifications" />

      {/* ── Team Members ── */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>
          Team Members {!membersLoading && `(${members.length})`}
        </div>

        {membersLoading ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>Loading…</div>
        ) : members.length === 0 ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>No team members found. Invite users via Settings → User Management.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {members.map(m => (
              <div key={m.id}>
                {/* Member row */}
                <div
                  onClick={() => setSelectedUser(selectedUser === m.id ? null : m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px',
                    background: selectedUser === m.id ? `${B.yellow}12` : B.bg,
                    borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${selectedUser === m.id ? B.yellow : 'transparent'}`,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: ROLE_COLORS[m.role] || B.textMuted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: '#000' }}>
                      {(m.full_name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Name / edit form */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingMember === m.id ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <input
                          value={editForm.full_name}
                          onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                          placeholder="Full name"
                          style={{ ...iStyle, flex: '1 1 140px' }}
                        />
                        <input
                          value={editForm.phone}
                          onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="Phone"
                          style={{ ...iStyle, flex: '1 1 120px' }}
                        />
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: B.textPrimary }}>
                          {m.full_name || '(No name)'}
                        </div>
                        <div style={{ fontSize: 11, color: B.textMuted }}>
                          {m.phone || m.id.slice(0, 8) + '…'}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Role badge / selector */}
                  {editingMember === m.id ? (
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      style={{ ...iStyle, padding: '4px 8px' }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: `${ROLE_COLORS[m.role] || B.textMuted}22`,
                      color: ROLE_COLORS[m.role] || B.textMuted,
                      fontFamily: fontHead, textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>
                      {m.role || 'viewer'}
                    </span>
                  )}

                  {/* Edit / save / cancel */}
                  {canEdit && (
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                      {editingMember === m.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(m.id)}
                            style={{ background: B.green, border: 'none', borderRadius: 4, color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingMember(null); setEditForm({}) }}
                            style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 4, color: B.textSecondary, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(m)}
                          style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 4, color: B.textSecondary, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Activity panel */}
                {selectedUser === m.id && (
                  <div style={{
                    marginLeft: isMobile ? 0 : 46, marginTop: 4,
                    padding: '10px 14px', background: B.bg, borderRadius: 8,
                  }}>
                    <div style={{ fontSize: 10, fontFamily: fontHead, color: B.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
                      Recent Activity
                    </div>
                    {activity.length === 0 ? (
                      <div style={{ fontSize: 12, color: B.textMuted, fontStyle: 'italic' }}>No recorded activity yet.</div>
                    ) : (
                      activity.map((a, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 10, alignItems: 'center',
                          padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22`, fontSize: 12,
                        }}>
                          <span style={{ color: a.action === 'INSERT' ? B.green : a.action === 'DELETE' ? B.red : B.amber, fontFamily: fontHead, fontWeight: 700, fontSize: 10, width: 50 }}>
                            {a.action}
                          </span>
                          <span style={{ color: B.textSecondary }}>{a.table_name}</span>
                          <span style={{ color: B.textMuted, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            {new Date(a.created_at).toLocaleString('en-AU', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Staff Certificates ── */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>
            Certifications & Licences
          </div>
          {canEdit && (
            <button
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

        {/* Add cert form */}
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
                  <label style={{ display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 3 }}>{f.label}</label>
                  <input
                    value={certForm[f.key]}
                    onChange={e => setCertForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 3 }}>Type</label>
                <select value={certForm.cert_type} onChange={e => setCertForm(p => ({ ...p, cert_type: e.target.value }))} style={{ ...iStyle, width: '100%' }}>
                  {CERT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 3 }}>Expiry Date</label>
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
                onClick={() => {
                  if (!certForm.staff_name.trim() || !certForm.cert_name.trim()) return
                  addCertMut.mutate(certForm)
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
                    <th key={i} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>{h}</th>
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
                    const { label, color } = certStatus(c.expiry_date)
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: B.textPrimary }}>{c.staff_name}</td>
                        <td style={{ padding: '8px 12px', color: B.textSecondary }}>{c.cert_name}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, fontSize: 11 }}>
                          {CERT_TYPES.find(t => t.value === c.cert_type)?.label || c.cert_type}
                        </td>
                        <td style={{ padding: '8px 12px', color: B.textMuted }}>{c.issuer || '—'}</td>
                        <td style={{ padding: '8px 12px', color: B.textMuted, whiteSpace: 'nowrap' }}>
                          {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-AU') : '—'}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: `${color}20`, color, fontFamily: fontHead,
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
    </div>
  )
}
