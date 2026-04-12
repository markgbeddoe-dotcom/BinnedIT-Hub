import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { B, fontHead, fontBody } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { SectionHeader } from './UIComponents';
import { getAlertThresholds, upsertThreshold, getProfiles, updateProfileRole, getBinTypes, upsertBinType, inviteUser } from '../api/settings';
import { getXeroStatus, syncXeroMonth, syncXeroAllHistory, getXeroSyncLog } from '../api/xero';
import { useAuth } from '../context/AuthContext';

const iStyle = {
  background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
  padding: '6px 10px', fontSize: 13, color: B.textPrimary, outline: 'none',
  fontFamily: fontBody,
};

// ─── White-Label Widget section ───────────────────────────────────────────────
const EMBED_TENANTS = [
  { slug: 'binned-it', label: 'Binned-IT Pty Ltd (default)' },
];

function WhiteLabelWidget() {
  const [copied, setCopied] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState('binned-it');

  const embedUrl = `https://binnedit-hub.vercel.app/embed/${selectedSlug}`;
  const embedCode = `<iframe\n  src="${embedUrl}"\n  width="100%"\n  height="700"\n  frameborder="0"\n  style="border:none;border-radius:12px;"\n  title="Book a Skip Bin"\n></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const ta = document.createElement('textarea');
      ta.value = embedCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24 }}>
      <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 4 }}>
        White-Label Booking Widget
      </div>
      <p style={{ fontSize: 13, color: B.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        Embed the booking form on any third-party website using this iframe snippet. The widget uses your tenant branding and saves bookings to your Supabase database.
      </p>

      {/* Tenant selector */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, color: B.textSecondary, fontWeight: 600, marginBottom: 6 }}>Tenant Slug</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={selectedSlug}
            onChange={e => setSelectedSlug(e.target.value)}
            style={{ ...iStyle, minWidth: 240 }}
          >
            {EMBED_TENANTS.map(t => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
          <a
            href={embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: B.blue, textDecoration: 'none', fontWeight: 600 }}
          >
            Preview widget ↗
          </a>
        </div>
      </div>

      {/* Embed code */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, color: B.textSecondary, fontWeight: 600, marginBottom: 6 }}>Embed Code</label>
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: '#1A1A2E', color: '#E2E8F0', borderRadius: 8,
            padding: '16px 20px', fontSize: 12, lineHeight: 1.7,
            overflowX: 'auto', margin: 0,
            fontFamily: '"Courier New", Courier, monospace',
            border: `1px solid ${B.cardBorder}`,
          }}>
            {embedCode}
          </pre>
        </div>
      </div>

      <button
        onClick={handleCopy}
        style={{
          background: copied ? B.green : B.yellow,
          border: 'none', borderRadius: 6,
          padding: '8px 20px',
          fontFamily: fontHead, fontSize: 12, fontWeight: 700,
          color: copied ? '#fff' : B.black,
          textTransform: 'uppercase', cursor: 'pointer',
          transition: 'background 0.2s, color 0.2s',
        }}
      >
        {copied ? '✓ Copied!' : 'Copy Embed Code'}
      </button>

      {/* Usage instructions */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${B.cardBorder}` }}>
        <div style={{ fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: B.textSecondary, textTransform: 'uppercase', marginBottom: 10 }}>How to Use</div>
        {[
          'Paste the embed code into any HTML page where you want the booking form to appear.',
          'The widget reads branding (logo, colours, bin sizes) from the tenant config in your Supabase database.',
          'Bookings submitted through the widget are saved to your bookings table with the tenant_id set.',
          'To add a new white-label tenant, insert a row into the tenants and tenant_bin_sizes tables.',
        ].map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 12, color: B.textMuted, lineHeight: 1.5 }}>
            <span style={{ color: B.yellow, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOwner, isManager } = useAuth();

  const { data: thresholds = [], isLoading: thresholdsLoading } = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: getAlertThresholds,
  });
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    enabled: isOwner,
  });
  const { data: binTypes = [], isLoading: binTypesLoading } = useQuery({
    queryKey: ['bin-types'],
    queryFn: getBinTypes,
    enabled: isOwner || isManager,
  });

  const upsertThresholdMut = useMutation({
    mutationFn: upsertThreshold,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-thresholds'] }),
  });
  const updateRoleMut = useMutation({
    mutationFn: ({ userId, role }) => updateProfileRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });
  const upsertBinTypeMut = useMutation({
    mutationFn: upsertBinType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bin-types'] }),
  });

  const [editingThreshold, setEditingThreshold] = useState(null);
  const [newBinType, setNewBinType] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('bookkeeper');
  const [inviteState, setInviteState] = useState(null); // null | 'sending' | 'success' | 'error'
  const [inviteMsg, setInviteMsg] = useState('');
  const [xeroStatus, setXeroStatus] = useState(null);
  const [xeroConnectedToast, setXeroConnectedToast] = useState(false);
  const [xeroSyncing, setXeroSyncing] = useState(false);
  const [xeroSyncMonth, setXeroSyncMonth] = useState('2026-02');
  const [xeroSyncResult, setXeroSyncResult] = useState(null);
  const [xeroSyncLog, setXeroSyncLog] = useState([]);
  const [xeroHistoryFrom, setXeroHistoryFrom] = useState('2025-07');
  const [xeroHistoryTo, setXeroHistoryTo] = useState('2026-02');
  const [xeroHistorySyncing, setXeroHistorySyncing] = useState(false);
  const [xeroHistoryResult, setXeroHistoryResult] = useState(null);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteState('sending');
    setInviteMsg('');
    try {
      await inviteUser(inviteEmail.trim(), inviteRole);
      setInviteState('success');
      setInviteMsg(`Invite sent to ${inviteEmail.trim()} as ${inviteRole}.`);
      setInviteEmail('');
      qc.invalidateQueries({ queryKey: ['profiles'] });
    } catch (err) {
      setInviteState('error');
      setInviteMsg(err.message);
    }
  };
  const handleXeroSync = async () => {
    setXeroSyncing(true);
    setXeroSyncResult(null);
    try {
      const result = await syncXeroMonth(xeroSyncMonth);
      setXeroSyncResult({ ok: true, summary: result.summary });
      getXeroSyncLog().then(setXeroSyncLog).catch(() => {});
    } catch (e) {
      setXeroSyncResult({ ok: false, error: e.message });
    }
    setXeroSyncing(false);
  };

  const handleXeroHistorySync = async () => {
    setXeroHistorySyncing(true);
    setXeroHistoryResult(null);
    try {
      const result = await syncXeroAllHistory(xeroHistoryFrom, xeroHistoryTo);
      setXeroHistoryResult({ ok: true, data: result });
      getXeroSyncLog().then(setXeroSyncLog).catch(() => {});
    } catch (e) {
      setXeroHistoryResult({ ok: false, error: e.message });
    }
    setXeroHistorySyncing(false);
  };

  const [pushStatus, setPushStatus] = useState('checking'); // 'checking'|'unsupported'|'denied'|'subscribed'|'unsubscribed'
  const [pushMsg, setPushMsg] = useState('');

  useEffect(() => {
    getXeroStatus().then(setXeroStatus).catch(() => setXeroStatus({ connected: false }));
    getXeroSyncLog().then(setXeroSyncLog).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('xero_connected') === '1') {
      setXeroConnectedToast(true);
      // Clean up the query param without triggering a navigation
      window.history.replaceState({}, '', location.pathname);
      setTimeout(() => setXeroConnectedToast(false), 6000);
    }
  }, [location.search]);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setPushStatus(sub ? 'subscribed' : 'unsubscribed');
      });
    });
    if (Notification.permission === 'denied') setPushStatus('denied');
  }, []);

  const subscribePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushStatus('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      const VAPID_PUBLIC_KEY = 'BPWT94BxZrM4pGHsPbMwcNp7Ng8kFS93dh7V4Ran8MYRyv79saSsG8H8nk-W5l-reSzMmSpYmrq-yGOtO-vIXwo';
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
      setPushStatus('subscribed');
      setPushMsg('Push notifications enabled. You will receive alerts for critical business events.');
      console.log('Push subscription:', JSON.stringify(sub));
    } catch (e) {
      setPushMsg(`Failed to enable: ${e.message}`);
    }
  };

  const unsubscribePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      setPushStatus('unsubscribed');
      setPushMsg('Push notifications disabled.');
    } catch (e) {
      setPushMsg(`Failed to disable: ${e.message}`);
    }
  };

  const { isMobile } = useBreakpoint();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: isMobile ? '20px 12px' : '40px 24px' }}>
      <SectionHeader title="Settings" subtitle="Alert thresholds, users, bin types, and company info" />

      {xeroConnectedToast && (
        <div style={{
          marginBottom: 20, padding: '14px 18px', borderRadius: 8,
          background: `${B.green}18`, border: `1px solid ${B.green}50`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✓</span>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.green }}>Xero Connected Successfully</div>
            <div style={{ fontSize: 12, color: B.textSecondary, marginTop: 2 }}>Your Xero organisation is now linked. Use the sync controls below to import your financial data.</div>
          </div>
        </div>
      )}

      {/* ── Sub-page navigation ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { id: 'team', icon: '👥', title: 'Team & Staff', desc: 'Manage roles, profiles, and staff certifications', path: '/settings/team', color: B.blue },
          { id: 'audit', icon: '📋', title: 'Audit Log', desc: 'Immutable record of all system changes', path: '/settings/audit', color: B.purple },
        ].map(card => (
          <button
            key={card.id}
            onClick={() => navigate(card.path)}
            style={{
              background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10,
              padding: '18px 20px', cursor: 'pointer', textAlign: 'left',
              borderLeft: `4px solid ${card.color}`, display: 'flex', flexDirection: 'column', gap: 4,
            }}
            onMouseOver={e => { e.currentTarget.style.background = B.cardBgHover }}
            onMouseOut={e => { e.currentTarget.style.background = B.cardBg }}
          >
            <div style={{ fontSize: 22 }}>{card.icon}</div>
            <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>{card.title}</div>
            <div style={{ fontSize: 11, color: B.textMuted }}>{card.desc}</div>
          </button>
        ))}
      </div>

      {/* Alert Thresholds */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>Alert Thresholds</div>
        {thresholdsLoading ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>Loading...</div>
        ) : thresholds.length === 0 ? (
          <div style={{ color: B.textMuted, fontSize: 13 }}>No thresholds configured. Apply migration 003 to add defaults.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                {['Category', 'Metric', 'Warning', 'Critical', 'Unit', ''].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontFamily: fontHead, fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {thresholds.map(t => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                  <td style={{ padding: '8px 10px', color: B.textSecondary }}>{t.category}</td>
                  <td style={{ padding: '8px 10px', color: B.textPrimary, fontWeight: 600 }}>{t.metric_key}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {editingThreshold === t.id ? (
                      <input defaultValue={t.warning_value} id={`warn-${t.id}`} style={{ ...iStyle, width: 80 }} />
                    ) : (
                      <span style={{ color: B.amber }}>{t.warning_value ?? '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {editingThreshold === t.id ? (
                      <input defaultValue={t.critical_value} id={`crit-${t.id}`} style={{ ...iStyle, width: 80 }} />
                    ) : (
                      <span style={{ color: B.red }}>{t.critical_value ?? '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', color: B.textMuted }}>{t.unit || ''}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {isOwner && (
                      editingThreshold === t.id ? (
                        <button onClick={() => {
                          const warn = parseFloat(document.getElementById(`warn-${t.id}`).value);
                          const crit = parseFloat(document.getElementById(`crit-${t.id}`).value);
                          upsertThresholdMut.mutate({ ...t, warning_value: warn, critical_value: crit });
                          setEditingThreshold(null);
                        }} style={{ background: B.green, border: 'none', borderRadius: 4, color: '#fff', padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}>
                          Save
                        </button>
                      ) : (
                        <button onClick={() => setEditingThreshold(t.id)} style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 4, color: B.textSecondary, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontFamily: fontHead }}>
                          Edit
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* User Management */}
      {isOwner && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>User Management</div>
          {profilesLoading ? (
            <div style={{ color: B.textMuted, fontSize: 13 }}>Loading...</div>
          ) : profiles.length === 0 ? (
            <div style={{ color: B.textMuted, fontSize: 13 }}>No users found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profiles.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: B.bg, borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: B.textPrimary }}>{p.full_name || p.id.slice(0, 8) + '...'}</div>
                  </div>
                  <select value={p.role} onChange={e => updateRoleMut.mutate({ userId: p.id, role: e.target.value })} style={{ ...iStyle, padding: '4px 8px' }}>
                    {['owner', 'manager', 'bookkeeper', 'viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          {/* Invite new user */}
          <div style={{ marginTop: 20, borderTop: `1px solid ${B.cardBorder}`, paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: B.textSecondary, fontFamily: fontHead, textTransform: 'uppercase', marginBottom: 10 }}>Invite New User</div>
            <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 4 }}>Email address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setInviteState(null); }}
                  placeholder="sarah@binnedit.com.au"
                  required
                  style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label style={{ display: 'block', fontSize: 11, color: B.textMuted, marginBottom: 4 }}>Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{ ...iStyle, width: '100%' }}
                >
                  <option value="bookkeeper">Bookkeeper</option>
                  <option value="manager">Fleet Manager</option>
                  <option value="viewer">Investor / Viewer</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteState === 'sending'}
                style={{
                  background: inviteState === 'sending' ? B.cardBorder : B.yellow,
                  border: 'none', borderRadius: 6, color: inviteState === 'sending' ? B.textMuted : '#000',
                  padding: '8px 20px', cursor: inviteState === 'sending' ? 'not-allowed' : 'pointer',
                  fontFamily: fontHead, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {inviteState === 'sending' ? 'Sending…' : 'Send Invite'}
              </button>
            </form>
            {inviteMsg && (
              <div style={{
                marginTop: 8, fontSize: 12, padding: '8px 12px', borderRadius: 6,
                background: inviteState === 'success' ? `${B.green}18` : `${B.red}18`,
                color: inviteState === 'success' ? B.green : B.red,
                border: `1px solid ${inviteState === 'success' ? B.green : B.red}40`,
              }}>
                {inviteState === 'success' ? '✓ ' : '✗ '}{inviteMsg}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: B.textMuted }}>
              The user will receive a magic link email to set their password and access the dashboard.
            </div>
          </div>
        </div>
      )}

      {/* Bin Types */}
      {(isOwner || isManager) && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>Bin Types</div>
          {binTypesLoading ? (
            <div style={{ color: B.textMuted, fontSize: 13 }}>Loading...</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {binTypes.map(bt => (
                  <div key={bt.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: B.bg, borderRadius: 6 }}>
                    <div style={{ flex: 1, fontSize: 13, color: B.textPrimary }}>{bt.name}</div>
                    <div style={{ fontSize: 11, color: B.textMuted }}>{bt.size_cubic_metres ? `${bt.size_cubic_metres}m³` : ''}</div>
                    <div style={{ fontSize: 11, color: bt.is_active ? B.green : B.red }}>{bt.is_active ? 'Active' : 'Inactive'}</div>
                    <button onClick={() => upsertBinTypeMut.mutate({ ...bt, is_active: !bt.is_active })} style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 4, color: B.textSecondary, padding: '3px 8px', cursor: 'pointer', fontSize: 10, fontFamily: fontHead }}>
                      {bt.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newBinType} onChange={e => setNewBinType(e.target.value)} placeholder="New bin type name" style={{ ...iStyle, flex: 1 }} />
                <button onClick={() => { if (!newBinType.trim()) return; upsertBinTypeMut.mutate({ name: newBinType.trim(), is_active: true }); setNewBinType(''); }} style={{ background: B.green, border: 'none', borderRadius: 6, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}>
                  Add
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Push Notifications */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 12 }}>Push Notifications</div>
        {pushStatus === 'unsupported' && (
          <div style={{ fontSize: 13, color: B.textMuted }}>Push notifications are not supported in this browser.</div>
        )}
        {pushStatus === 'denied' && (
          <div style={{ fontSize: 13, color: B.red }}>Notifications blocked by browser. Enable in browser settings to use this feature.</div>
        )}
        {pushStatus === 'checking' && (
          <div style={{ fontSize: 13, color: B.textMuted }}>Checking notification status...</div>
        )}
        {(pushStatus === 'subscribed' || pushStatus === 'unsubscribed') && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 10, background: pushStatus === 'subscribed' ? `${B.green}20` : `${B.cardBorder}40`, color: pushStatus === 'subscribed' ? B.green : B.textMuted, padding: '3px 10px', borderRadius: 20, fontFamily: fontHead, textTransform: 'uppercase', fontWeight: 700 }}>
                {pushStatus === 'subscribed' ? 'Enabled' : 'Disabled'}
              </div>
              <span style={{ fontSize: 12, color: B.textSecondary }}>
                {pushStatus === 'subscribed' ? 'You will receive alerts for critical events.' : 'Enable to receive browser alerts for critical business events.'}
              </span>
            </div>
            <button
              onClick={pushStatus === 'subscribed' ? unsubscribePush : subscribePush}
              style={{ background: pushStatus === 'subscribed' ? 'none' : B.yellow, border: `1px solid ${pushStatus === 'subscribed' ? B.cardBorder : B.yellow}`, color: pushStatus === 'subscribed' ? B.textSecondary : '#000', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}
            >
              {pushStatus === 'subscribed' ? 'Disable Notifications' : 'Enable Notifications'}
            </button>
          </div>
        )}
        {pushMsg && (
          <div style={{ marginTop: 10, fontSize: 12, color: pushStatus === 'subscribed' ? B.green : B.textMuted }}>{pushMsg}</div>
        )}
      </div>

      {/* ── Xero Integration ── */}
      {isOwner && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 4 }}>Xero Integration</div>
          <div style={{ fontSize: 13, color: B.textSecondary, marginBottom: 16 }}>Connect Xero to automatically sync your P&L, Balance Sheet, and AR data each month.</div>

          {/* Connection status */}
          <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>
                  {xeroStatus?.connected ? `Connected — ${xeroStatus.tenantName || 'Xero'}` : 'Not Connected'}
                </div>
                <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>
                  {xeroStatus?.connected ? `Last token refresh: ${xeroStatus.updatedAt ? new Date(xeroStatus.updatedAt).toLocaleDateString('en-AU') : 'Unknown'}` : 'Click Connect to link your Xero organisation'}
                </div>
              </div>
              <a
                href="/api/xero-auth"
                style={{ background: xeroStatus?.connected ? B.bg : B.yellow, color: xeroStatus?.connected ? B.textSecondary : '#fff', border: `1px solid ${xeroStatus?.connected ? B.cardBorder : B.yellow}`, padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontFamily: fontHead, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', display: 'inline-block' }}
              >
                {xeroStatus?.connected ? 'Reconnect' : 'Connect Xero'}
              </a>
            </div>
          </div>

          {/* Sync controls */}
          {xeroStatus?.connected && (
            <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 12 }}>Sync Month from Xero</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={xeroSyncMonth}
                  onChange={e => setXeroSyncMonth(e.target.value)}
                  style={{ background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: B.textPrimary, fontFamily: fontBody }}
                >
                  {['2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={handleXeroSync}
                  disabled={xeroSyncing}
                  style={{ background: B.green, border: 'none', borderRadius: 6, padding: '8px 20px', cursor: xeroSyncing ? 'wait' : 'pointer', fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}
                >
                  {xeroSyncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
              {xeroSyncResult && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 6, background: xeroSyncResult.ok ? `${B.green}15` : `${B.red}15`, border: `1px solid ${xeroSyncResult.ok ? B.green : B.red}40` }}>
                  {xeroSyncResult.ok ? (
                    <div style={{ fontSize: 12, color: B.green }}>
                      ✓ Synced {xeroSyncMonth} — Revenue: ${Math.round(xeroSyncResult.summary?.revenue || 0).toLocaleString('en-AU')} | Net Profit: ${Math.round(xeroSyncResult.summary?.netProfit || 0).toLocaleString('en-AU')} | GM: {(xeroSyncResult.summary?.grossMargin || 0).toFixed(1)}%
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: B.red }}>✗ {xeroSyncResult.error}</div>
                  )}
                </div>
              )}

              {/* Bulk historical sync */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${B.cardBorder}` }}>
                <div style={{ fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: B.textSecondary, textTransform: 'uppercase', marginBottom: 10 }}>Sync All History</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>From</label>
                    <select
                      value={xeroHistoryFrom}
                      onChange={e => setXeroHistoryFrom(e.target.value)}
                      style={{ background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: B.textPrimary, fontFamily: fontBody }}
                    >
                      {['2024-07','2024-08','2024-09','2024-10','2024-11','2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>To</label>
                    <select
                      value={xeroHistoryTo}
                      onChange={e => setXeroHistoryTo(e.target.value)}
                      style={{ background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '6px 10px', fontSize: 12, color: B.textPrimary, fontFamily: fontBody }}
                    >
                      {['2024-07','2024-08','2024-09','2024-10','2024-11','2024-12','2025-01','2025-02','2025-03','2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleXeroHistorySync}
                    disabled={xeroHistorySyncing}
                    style={{ background: xeroHistorySyncing ? B.cardBorder : B.blue, border: 'none', borderRadius: 6, padding: '8px 18px', cursor: xeroHistorySyncing ? 'wait' : 'pointer', fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: xeroHistorySyncing ? B.textMuted : '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
                  >
                    {xeroHistorySyncing ? 'Syncing...' : 'Sync All History'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: B.textMuted, marginTop: 6 }}>
                  Syncs each month sequentially with a 500 ms delay to respect Xero rate limits.
                </div>
                {xeroHistoryResult && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 6, background: xeroHistoryResult.ok ? `${B.blue}12` : `${B.red}15`, border: `1px solid ${xeroHistoryResult.ok ? B.blue : B.red}40` }}>
                    {xeroHistoryResult.ok ? (
                      <div style={{ fontSize: 12, color: B.blue }}>
                        ✓ Bulk sync complete — {xeroHistoryResult.data?.succeeded}/{xeroHistoryResult.data?.synced} months succeeded
                        {xeroHistoryResult.data?.failed > 0 && (
                          <span style={{ color: B.amber }}> ({xeroHistoryResult.data.failed} failed — check sync log below)</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: B.red }}>✗ {xeroHistoryResult.error}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync log */}
          {xeroSyncLog.length > 0 && (
            <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: 20 }}>
              <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 10 }}>Sync History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {xeroSyncLog.slice(0, 5).map((log, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: log.status === 'success' ? B.green : B.red, fontWeight: 700 }}>{log.status === 'success' ? '✓' : '✗'}</span>
                    <span style={{ color: B.textPrimary }}>{log.sync_month?.slice(0, 7)}</span>
                    <span style={{ color: B.textMuted }}>{new Date(log.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span style={{ color: B.textMuted, flex: 1 }}>{log.message || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* White-Label Booking Widget */}
      {isOwner && <WhiteLabelWidget />}

      {/* Company Info */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24 }}>
        <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 16 }}>Company Info</div>
        {[
          ['Company Name', 'Binned-IT Pty Ltd'],
          ['ABN', '(stored in Supabase — contact owner)'],
          ['Location', 'Seaford, Melbourne VIC'],
          ['Financial Year', 'July – June'],
          ['Platform Version', '2.2.0'],
        ].map(([l, v], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
            <span style={{ fontSize: 12, color: B.textSecondary }}>{l}</span>
            <span style={{ fontSize: 12, color: B.textPrimary, fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
