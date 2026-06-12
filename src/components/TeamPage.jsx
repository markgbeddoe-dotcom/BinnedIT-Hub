import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { B, fontHead, fontBody } from '../theme'
import { SectionHeader } from './UIComponents'
import {
  getTeamMembers, updateTeamMember,
  getTeamRecentActivity,
} from '../api/team'
import { inviteUser, removeUser } from '../api/settings'
import { useAuth } from '../context/AuthContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
// GAP-048: certificates + insurance policies CRUD + 30/7-day expiry warnings
// now live in CompliancePanel (also renders the insurance_policies table that
// previously had no UI).
import CompliancePanel from './CompliancePanel'

const ROLES = ['owner', 'manager', 'bookkeeper', 'driver', 'fleet_manager', 'viewer', 'investor']

const ROLE_COLORS = {
  owner:        B.yellow,
  manager:      B.blue,
  bookkeeper:   B.green,
  driver:       B.orange,
  fleet_manager:B.cyan,
  viewer:       B.textMuted,
  investor:     B.purple,
}

export default function TeamPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { isOwner, isManager, user } = useAuth()
  const { isMobile } = useBreakpoint()
  const canEdit = isOwner || isManager
  // Add/remove create or delete accounts — owner-only (matches the invite +
  // remove-user endpoints, which both verify role === 'owner' server-side).
  const canManageMembers = isOwner

  const [editingMember, setEditingMember] = useState(null)
  const [editForm, setEditForm]           = useState({})
  const [selectedUser, setSelectedUser]   = useState(null)
  const [showAdd, setShowAdd]             = useState(false)
  const [addForm, setAddForm]             = useState({ full_name: '', email: '', role: 'driver' })
  const [addMsg, setAddMsg]               = useState(null)

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
  const addMut = useMutation({
    mutationFn: ({ email, role, fullName }) => inviteUser(email, role, fullName),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['team-members'] })
      setAddMsg({ ok: true, text: `Invite sent to ${vars.email} as ${vars.role}.` })
      setAddForm({ full_name: '', email: '', role: 'driver' })
    },
    onError: (e) => setAddMsg({ ok: false, text: e.message || 'Invite failed' }),
  })
  const removeMut = useMutation({
    mutationFn: (id) => removeUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-members'] }),
    onError: (e) => window.alert(e.message || 'Remove failed'),
  })

  // ── Helpers ────────────────────────────────────────────────
  const submitAdd = () => {
    const email = addForm.email.trim()
    if (!email) { setAddMsg({ ok: false, text: 'Email is required' }); return }
    setAddMsg(null)
    addMut.mutate({ email, role: addForm.role, fullName: addForm.full_name.trim() })
  }
  const removeMember = (m) => {
    if (m.id === user?.id) { window.alert("You can't remove your own account."); return }
    if (window.confirm(`Remove ${m.full_name || 'this member'}? This deletes their login and access. This cannot be undone.`)) {
      removeMut.mutate(m.id)
    }
  }
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>
            Team Members {!membersLoading && `(${members.length})`}
          </div>
          {canManageMembers && (
            <button
              onClick={() => { setShowAdd(s => !s); setAddMsg(null) }}
              style={{ background: showAdd ? 'none' : B.yellow, border: `1px solid ${B.yellowDark}`, borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: showAdd ? B.textSecondary : B.black, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.04em' }}
            >
              {showAdd ? 'Cancel' : '+ Add Member'}
            </button>
          )}
        </div>

        {/* Add member (invite) form — owner only */}
        {canManageMembers && showAdd && (
          <div style={{ background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={addForm.full_name}
                onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Full name (optional)"
                style={{ ...iStyle, flex: '1 1 150px', minHeight: 36 }}
              />
              <input
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@binnedit.com.au"
                style={{ ...iStyle, flex: '1 1 200px', minHeight: 36 }}
              />
              <select
                value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                style={{ ...iStyle, minHeight: 36 }}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                onClick={submitAdd}
                disabled={addMut.isPending}
                style={{ background: B.green, border: 'none', borderRadius: 6, color: '#fff', padding: '8px 16px', cursor: addMut.isPending ? 'wait' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: fontHead, textTransform: 'uppercase', minHeight: 36 }}
              >
                {addMut.isPending ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: B.textMuted, marginTop: 8 }}>
              Sends a magic-link invite to set a password. Restricted to company domains (binnedit.com.au / binned-it.com.au).
            </div>
            {addMsg && (
              <div style={{ marginTop: 8, fontSize: 12, color: addMsg.ok ? B.green : B.red }}>
                {addMsg.ok ? '✓ ' : '⚠ '}{addMsg.text}
              </div>
            )}
          </div>
        )}

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
                        <>
                          <button
                            onClick={() => startEdit(m)}
                            style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 4, color: B.textSecondary, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}
                          >
                            Edit
                          </button>
                          {canManageMembers && m.id !== user?.id && (
                            <button
                              onClick={() => removeMember(m)}
                              disabled={removeMut.isPending}
                              title="Remove team member"
                              style={{ background: 'none', border: `1px solid ${B.red}55`, borderRadius: 4, color: B.red, padding: '4px 10px', cursor: removeMut.isPending ? 'wait' : 'pointer', fontSize: 11, fontFamily: fontHead }}
                            >
                              Remove
                            </button>
                          )}
                        </>
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

      {/* ── Compliance: staff certificates + insurance policies (GAP-048) ── */}
      <CompliancePanel />
    </div>
  )
}
