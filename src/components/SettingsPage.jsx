import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { B, fontHead, fontBody } from '../theme';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { SectionHeader } from './UIComponents';
import { getAlertThresholds, upsertThreshold, getProfiles, updateProfileRole, getBinTypes, upsertBinType, inviteUser } from '../api/settings';
import { getXeroStatus, syncXeroMonth, syncXeroAllHistory, getXeroSyncLog } from '../api/xero';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const iStyle = {
  background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
  padding: '6px 10px', fontSize: 13, color: B.textPrimary, outline: 'none',
  fontFamily: fontBody,
};

// ─── Company Identity editor (Sprint 11 #11 follow-up) ───────────────────────
// Lets the owner save real ABN/ACN/BSB/etc into platform_settings under
// company.* keys. The legal-letter templates and the CollectionsPage Send-gate
// read these via useCompanyConfig(). When values are saved, hasPlaceholders
// flips to false and Sarah can dispatch letters.

const COMPANY_FIELDS = [
  { key: 'company.name',    label: 'Company name',         placeholder: 'Binned-IT Pty Ltd' },
  { key: 'company.abn',     label: 'ABN',                  placeholder: '11 222 333 444' },
  { key: 'company.acn',     label: 'ACN',                  placeholder: '123 456 789' },
  { key: 'company.address', label: 'Registered address',   placeholder: '12 Industrial Way, Seaford VIC 3198' },
  { key: 'company.phone',   label: 'Accounts phone',       placeholder: '03 9123 4567' },
  { key: 'company.email',   label: 'Accounts email',       placeholder: 'accounts@example.com.au' },
  { key: 'company.bsb',     label: 'BSB',                  placeholder: '063-000' },
  { key: 'company.account_number',         label: 'Bank account number',     placeholder: '1234 5678' },
  { key: 'company.penalty_interest_rate',  label: 'Penalty interest rate %', placeholder: '10' },
];

// Sprint 18 #L2 — letterhead logo upload
// Bucket name and constraints — kept here as constants so the SQL migration
// and the React UI stay in lockstep. If you change the bucket name you must
// also update supabase/migrations/021_company_assets_storage.sql.
const LOGO_BUCKET = 'company-assets';
const LOGO_MAX_BYTES = 2 * 1024 * 1024;        // 2 MB
const LOGO_ACCEPT_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
const LOGO_ACCEPT_EXT = ['png', 'jpg', 'jpeg', 'svg'];

function CompanyIdentityEditor() {
  const qc = useQueryClient();
  const { user, isOwner } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['platform-settings-company'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', [...COMPANY_FIELDS.map(f => f.key), 'company.logo_url']);
      if (error) throw error;
      return data || [];
    },
  });

  const initial = useMemo(() => {
    const map = Object.fromEntries(rows.map(r => [r.key, r.value || '']));
    return Object.fromEntries(COMPANY_FIELDS.map(f => [f.key, map[f.key] || '']));
  }, [rows]);

  // Logo URL lives in the same platform_settings table but isn't part of the
  // text-input grid — it has its own picker. We pull it out separately so the
  // dirty/save logic for the text fields stays clean.
  const initialLogoUrl = useMemo(() => {
    const row = rows.find(r => r.key === 'company.logo_url');
    return row?.value || '';
  }, [rows]);

  const [form, setForm] = useState(initial);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoStatus, setLogoStatus] = useState(null); // null | 'uploaded' | 'removed'

  // Reset local form whenever the loaded rows change (e.g. on first fetch).
  useEffect(() => { setForm(initial); }, [initial]);
  useEffect(() => { setLogoUrl(initialLogoUrl); }, [initialLogoUrl]);

  const dirty = COMPANY_FIELDS.some(f => (form[f.key] || '') !== (initial[f.key] || ''));

  const handleSave = async () => {
    setSaveError(null);
    const upserts = COMPANY_FIELDS
      .filter(f => (form[f.key] || '').trim() !== (initial[f.key] || '').trim())
      .map(f => ({
        key: f.key,
        value: (form[f.key] || '').trim(),
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }));
    if (upserts.length === 0) return;
    const { error } = await supabase.from('platform_settings').upsert(upserts, { onConflict: 'key' });
    if (error) { setSaveError(error.message); return; }
    setSavedAt(new Date().toISOString());
    qc.invalidateQueries({ queryKey: ['platform-settings-company'] });
    qc.invalidateQueries({ queryKey: ['company-config'] }); // useCompanyConfig hook key
  };

  // ── Logo upload (Sprint 18 #L2) ──────────────────────────────────────────
  // Uploads to Supabase Storage bucket `company-assets`. The bucket SHOULD be
  // pre-created via migration 021; if for any reason it doesn't exist (e.g.
  // tenant skipped the migration), we attempt to create it on the fly — but
  // only if the caller is the owner, since `storage.buckets` writes are
  // gated by RLS in our migrations. The resulting public URL is then saved
  // into `platform_settings.company.logo_url` via the existing upsert path.
  const handleLogoPick = async (file) => {
    setLogoError(null);
    setLogoStatus(null);
    if (!file) return;

    if (!LOGO_ACCEPT_MIME.includes(file.type)) {
      setLogoError(`Unsupported file type "${file.type || 'unknown'}" — please upload PNG, JPG or SVG.`);
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setLogoError(`File is ${mb} MB — max allowed is 2 MB.`);
      return;
    }

    setLogoUploading(true);
    try {
      // Tenant-scoped path — even single-tenant deployments benefit from this
      // because it leaves room for the white-label tenants to keep their own
      // letterhead under their own folder. We use the user id as a stable
      // tenant proxy until proper tenants land in storage RLS.
      const tenantId = user?.id || 'default';
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const safeExt = LOGO_ACCEPT_EXT.includes(ext) ? ext : 'png';
      const path = `${tenantId}/logo.${safeExt}`;

      // Try the upload first — if the bucket is missing we'll get a clear
      // error and can attempt to create it. We treat the bucket-missing case
      // as a one-time bootstrap rather than failing.
      let { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });

      if (upErr && /bucket.*not\s*found/i.test(upErr.message || '')) {
        if (!isOwner) {
          throw new Error('Storage bucket "company-assets" is missing. Ask the owner to apply migration 021 or contact support.');
        }
        // Bootstrap the bucket. createBucket throws if the caller lacks
        // permission — which is fine, the user sees a clear error.
        const { error: createErr } = await supabase.storage.createBucket(LOGO_BUCKET, {
          public: true,
          fileSizeLimit: LOGO_MAX_BYTES,
        });
        if (createErr) throw createErr;
        // Retry the upload after creating the bucket.
        const retry = await supabase.storage
          .from(LOGO_BUCKET)
          .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
        upErr = retry.error;
      }
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Upload succeeded but no public URL was returned. Check storage bucket privacy.');

      // Cache-bust so a re-upload of the same path is reflected immediately.
      const url = `${publicUrl}?t=${Date.now()}`;

      const { error: psErr } = await supabase.from('platform_settings').upsert({
        key: 'company.logo_url',
        value: url,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      if (psErr) throw psErr;

      setLogoUrl(url);
      setLogoStatus('uploaded');
      qc.invalidateQueries({ queryKey: ['platform-settings-company'] });
      qc.invalidateQueries({ queryKey: ['company-config'] });
    } catch (e) {
      setLogoError(e?.message || 'Upload failed — please try again.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoRemove = async () => {
    setLogoError(null);
    setLogoStatus(null);
    try {
      const { error } = await supabase.from('platform_settings').delete().eq('key', 'company.logo_url');
      if (error) throw error;
      setLogoUrl('');
      setLogoStatus('removed');
      qc.invalidateQueries({ queryKey: ['platform-settings-company'] });
      qc.invalidateQueries({ queryKey: ['company-config'] });
    } catch (e) {
      setLogoError(e?.message || 'Remove failed.');
    }
  };

  const PLACEHOLDER_ABN = '57 123 456 789';
  const placeholderActive =
    !form['company.abn'] || form['company.abn'].trim() === '' || form['company.abn'].trim() === PLACEHOLDER_ABN ||
    !form['company.bsb'] || form['company.bsb'].trim() === '' || form['company.bsb'].trim() === '063-000' ||
    !form['company.account_number'] || form['company.account_number'].trim() === '' || form['company.account_number'].trim() === '1234 5678';

  return (
    <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>🏢</span>
        <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>Company Identity</div>
      </div>
      <p style={{ fontSize: 13, color: B.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Used by every legal letter the platform generates (account contracts, director guarantees,
        collections demands, security-over-assets notices). <strong>Until you set real values here,
        the Send button on the Collections page is disabled</strong> because letters with placeholder
        ABN/BSB are legally defective.
      </p>

      {placeholderActive && (
        <div style={{ background: '#FFF4E6', border: `1px solid ${B.amber}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#7A4F00' }}>
          ⚠ At least one of ABN / BSB / account number is missing or still a placeholder.
          Letters cannot be dispatched until all three are configured with real values.
        </div>
      )}

      {/* ── Letterhead logo (Sprint 18 #L2) ────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap',
        background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 10,
        padding: '14px 16px', marginBottom: 16,
      }}>
        <div style={{
          width: 140, height: 80, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fff',
          border: logoUrl ? `1px solid ${B.cardBorder}` : `2px dashed ${B.textMuted}`,
          borderRadius: 8, overflow: 'hidden',
        }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company logo"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ fontSize: 10, color: B.textMuted, textAlign: 'center', padding: 8, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              No logo<br />uploaded
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Letterhead Logo
          </div>
          <div style={{ fontSize: 12, color: B.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
            Appears at the top of every collections letter. PNG, JPG or SVG, max 2&nbsp;MB.
            Stored in Supabase Storage (<code>{LOGO_BUCKET}</code>) and served via a public URL.
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{
              background: logoUploading ? B.cardBorder : B.yellow,
              color: logoUploading ? B.textMuted : B.black,
              border: 'none', borderRadius: 6, padding: '8px 16px',
              fontFamily: fontHead, fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', cursor: logoUploading ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {logoUploading ? 'Uploading…' : (logoUrl ? 'Replace logo' : 'Upload logo')}
              <input
                type="file"
                accept={LOGO_ACCEPT_MIME.join(',')}
                style={{ display: 'none' }}
                disabled={logoUploading}
                onChange={e => {
                  const f = e.target.files?.[0];
                  // Reset the value so the same file can be re-picked after an error.
                  e.target.value = '';
                  handleLogoPick(f);
                }}
              />
            </label>
            {logoUrl && (
              <button
                type="button"
                disabled={logoUploading}
                onClick={handleLogoRemove}
                style={{
                  background: 'none', border: `1px solid ${B.red}60`,
                  color: B.red, borderRadius: 6, padding: '8px 14px',
                  fontFamily: fontHead, fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', cursor: 'pointer',
                }}
              >
                Remove
              </button>
            )}
          </div>

          {logoError && (
            <div style={{ marginTop: 8, fontSize: 12, color: B.red }}>
              ✗ {logoError}
            </div>
          )}
          {logoStatus === 'uploaded' && !logoError && (
            <div style={{ marginTop: 8, fontSize: 12, color: B.green, fontWeight: 600 }}>
              ✓ Logo uploaded — it now appears on all generated letters.
            </div>
          )}
          {logoStatus === 'removed' && !logoError && (
            <div style={{ marginTop: 8, fontSize: 12, color: B.textMuted }}>
              Logo removed. Letters will display the “Insert your logo here” placeholder until a new one is uploaded.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {COMPANY_FIELDS.map(f => (
          <div key={f.key} style={{ gridColumn: f.key === 'company.address' ? '1 / -1' : 'auto' }}>
            <label style={{ display: 'block', fontSize: 11, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              {f.label}
            </label>
            <input
              type="text"
              value={form[f.key] || ''}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              disabled={isLoading}
              style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button
          onClick={handleSave}
          disabled={!dirty || isLoading}
          style={{
            background: dirty ? B.yellow : B.cardBgHover,
            color: dirty ? B.black : B.textMuted,
            border: 'none', borderRadius: 6, padding: '8px 20px',
            fontFamily: fontHead, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', cursor: dirty ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          Save Company Identity
        </button>
        {savedAt && !dirty && <span style={{ fontSize: 12, color: B.green }}>✓ Saved</span>}
        {saveError && <span style={{ fontSize: 12, color: B.red }}>{saveError}</span>}
      </div>
    </div>
  );
}

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

// ─── Settings tab navigation ────────────────────────────────────────────────
// Sections are grouped by activity. Deep-linkable via ?tab=<id> so other pages
// can link straight to a tab (e.g. /settings?tab=users).
const SETTINGS_TABS = [
  { id: 'alerts',       label: 'Alerts' },
  { id: 'users',        label: 'Users & Roles' },
  { id: 'bins',         label: 'Pricing & Bins' },
  { id: 'branding',     label: 'Bookings & Branding' },
  { id: 'integrations', label: 'Integrations' },
];

// All seven roles permitted by the profiles.role CHECK constraint
// (supabase/migrations/022_roles_expansion.sql). Must stay in sync with
// VALID_ROLES in api/invite.js.
const ALL_ROLES = ['owner', 'manager', 'fleet_manager', 'bookkeeper', 'driver', 'viewer', 'investor'];

const ROLE_OPTIONS = [
  { value: 'owner',         label: 'Owner' },
  { value: 'manager',       label: 'Manager' },
  { value: 'fleet_manager', label: 'Fleet Manager' },
  { value: 'bookkeeper',    label: 'Bookkeeper' },
  { value: 'driver',        label: 'Driver' },
  { value: 'viewer',        label: 'Viewer' },
  { value: 'investor',      label: 'Investor' },
];

// Read-only summary of what each role can do. Derived from the role booleans
// in src/context/AuthContext.jsx and the route gates in src/App.jsx.
const ROLE_MATRIX = [
  { role: 'owner',         access: 'Everything — all pages, settings, user invites, audit log, Xero & AI configuration.' },
  { role: 'manager',       access: 'Manager-level: operations, dispatch, Rules Engine, waste-audit approvals, fleet & team edits.' },
  { role: 'fleet_manager', access: 'Same manager-level access: operations, dispatch, rules, waste audits, fleet.' },
  { role: 'bookkeeper',    access: 'Financials: invoices, collections, Xero sync; waste audits read-only.' },
  { role: 'driver',        access: 'Driver app (/driver) only — pre-start checklist, job queue, photos, hazard reports.' },
  { role: 'viewer',        access: 'Read-only — redirected to the investor dashboard, locked to cash accounting basis.' },
  { role: 'investor',      access: 'Same as viewer — locked to the read-only /investor view on the cash basis.' },
];

const NAV_CARDS = {
  team:  { id: 'team',  icon: '👥', title: 'Team & Staff', desc: 'Manage roles, profiles, and staff certifications', path: '/settings/team', color: B.blue },
  audit: { id: 'audit', icon: '📋', title: 'Audit Log', desc: 'Immutable record of all system changes', path: '/settings/audit', color: B.purple },
};

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

  // Claude AI settings
  const [claudeKey, setClaudeKey] = useState('');
  const [claudeKeyShow, setClaudeKeyShow] = useState(false);
  const [claudeKeySaving, setClaudeKeySaving] = useState(false);
  const [claudeKeyDeleting, setClaudeKeyDeleting] = useState(false);
  const [claudeKeyStatus, setClaudeKeyStatus] = useState(null); // null | 'saved' | 'error' | 'testing' | 'ok' | 'fail'
  const [claudeKeyStored, setClaudeKeyStored] = useState(undefined); // undefined=loading, null=none, string=masked key
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
    // Load stored Claude API key (masked)
    if (isOwner) {
      import('../lib/supabase').then(({ supabase }) => {
        supabase.from('platform_settings').select('value').eq('key', 'anthropic_api_key').maybeSingle()
          .then(({ data, error }) => {
            if (error) { setClaudeKeyStored(null); return; }
            setClaudeKeyStored(data?.value ? 'sk-ant-…' + data.value.slice(-6) : null)
          }).catch(() => setClaudeKeyStored(null))
      })
    }
  }, [isOwner]);

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
      const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!VAPID_PUBLIC_KEY) {
        setPushMsg('Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY in the environment.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushStatus('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
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

  // ── Tab state — driven by the URL so tabs are deep-linkable (?tab=users).
  // Changing tab replaces (not pushes) the history entry.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = SETTINGS_TABS.some(t => t.id === tabParam) ? tabParam : 'alerts';
  const setActiveTab = (id) => setSearchParams({ tab: id }, { replace: true });

  const renderNavCard = (card) => (
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
  );

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

      {/* ── Sub-page navigation (cross-cutting — lives above the tab bar) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}>
        {renderNavCard(NAV_CARDS.audit)}
      </div>

      {/* ── Tab bar (same visual pattern as FleetManagementPage) ── */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: `2px solid ${B.cardBorder}`, overflowX: 'auto' }}>
        {SETTINGS_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            background: 'transparent', border: 'none', padding: '8px 18px', cursor: 'pointer',
            fontFamily: fontHead, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
            color: activeTab === t.id ? B.textPrimary : B.textMuted,
            borderBottom: activeTab === t.id ? `3px solid ${B.yellow}` : '3px solid transparent',
            marginBottom: -2, transition: 'all 0.15s', textTransform: 'uppercase',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Alert Thresholds (Alerts tab) */}
      {activeTab === 'alerts' && (
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
      )}

      {/* User Management (Users & Roles tab) */}
      {activeTab === 'users' && isOwner && (
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
                    {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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

      {/* Role permissions matrix + Team quick-link (Users & Roles tab) */}
      {activeTab === 'users' && (
        <>
          <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
            <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 4 }}>What Each Role Can Do</div>
            <p style={{ fontSize: 12, color: B.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
              Read-only reference. Assign roles with the dropdowns above, or manage profiles on the Team page.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 440 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                    {['Role', 'Access'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontFamily: fontHead, fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROLE_MATRIX.map(r => (
                    <tr key={r.role} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                      <td style={{ padding: '8px 10px', fontFamily: fontHead, fontSize: 11, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{r.role}</td>
                      <td style={{ padding: '8px 10px', color: B.textSecondary, lineHeight: 1.5 }}>{r.access}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
            {renderNavCard(NAV_CARDS.team)}
          </div>
        </>
      )}

      {/* Bin Types (Pricing & Bins tab) */}
      {activeTab === 'bins' && (isOwner || isManager) && (
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

      {/* Push Notifications (Alerts tab) */}
      {activeTab === 'alerts' && (
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
      )}

      {/* ── Xero Integration (Integrations tab) ── */}
      {activeTab === 'integrations' && isOwner && (
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

      {/* Company Identity (Bookings & Branding tab — legal-letter ABN/BSB/etc — Sprint 11 #11 follow-up) */}
      {activeTab === 'branding' && isOwner && <CompanyIdentityEditor />}

      {/* White-Label Booking Widget (Bookings & Branding tab) */}
      {activeTab === 'branding' && isOwner && <div style={{ marginBottom: 20 }}><WhiteLabelWidget /></div>}

      {/* Claude AI Configuration (Integrations tab) */}
      {activeTab === 'integrations' && isOwner && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>Claude AI Configuration</div>
          </div>
          <p style={{ fontSize: 13, color: B.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
            The API key used for the AI Chat assistant. When a key is saved here it overrides the environment variable — useful for rotating keys without a redeploy.
          </p>

          {/* Current key status */}
          <div style={{ background: B.bg, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: B.textSecondary }}>
            <span style={{ color: B.textMuted }}>Stored key: </span>
            {claudeKeyStored === undefined && <span style={{ color: B.textMuted, fontStyle: 'italic' }}>Loading…</span>}
            {claudeKeyStored === null && <span style={{ color: B.textMuted, fontStyle: 'italic' }}>None — using environment variable</span>}
            {claudeKeyStored && <span style={{ fontFamily: 'monospace', fontWeight: 600, color: B.green }}>{claudeKeyStored}</span>}
          </div>

          {/* New key input */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Update API Key
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type={claudeKeyShow ? 'text' : 'password'}
                value={claudeKey}
                onChange={e => setClaudeKey(e.target.value)}
                placeholder="sk-ant-api03-…"
                style={{ ...iStyle, flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              />
              <button onClick={() => setClaudeKeyShow(s => !s)}
                style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 11, color: B.textSecondary, fontFamily: fontBody }}>
                {claudeKeyShow ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              disabled={claudeKeySaving || !claudeKey.startsWith('sk-ant-')}
              onClick={async () => {
                setClaudeKeySaving(true)
                setClaudeKeyStatus(null)
                try {
                  const { supabase } = await import('../lib/supabase')
                  const { error } = await supabase.from('platform_settings').upsert(
                    { key: 'anthropic_api_key', value: claudeKey.trim(), updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                  )
                  if (error) throw error
                  setClaudeKeyStored('sk-ant-…' + claudeKey.trim().slice(-6))
                  setClaudeKey('')
                  setClaudeKeyStatus('saved')
                } catch (e) {
                  setClaudeKeyStatus('error')
                  console.error('Claude key save error:', e)
                } finally {
                  setClaudeKeySaving(false)
                }
              }}
              style={{ background: B.yellow, border: 'none', borderRadius: 7, padding: '8px 18px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12, fontWeight: 700, color: B.black, opacity: claudeKeySaving || !claudeKey.startsWith('sk-ant-') ? 0.5 : 1 }}>
              {claudeKeySaving ? 'Saving…' : 'Save Key'}
            </button>

            <button
              onClick={async () => {
                setClaudeKeyStatus('testing')
                try {
                  const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with just the word PONG.' }] }),
                  })
                  if (res.status === 404) { setClaudeKeyStatus('local'); return; }
                  setClaudeKeyStatus(res.ok ? 'ok' : 'fail')
                } catch { setClaudeKeyStatus('fail') }
              }}
              style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 7, padding: '8px 16px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12, color: B.textSecondary }}>
              {claudeKeyStatus === 'testing' ? 'Testing…' : 'Test Connection'}
            </button>

            {claudeKeyStored && (
              <button
                disabled={claudeKeyDeleting}
                onClick={async () => {
                  if (!window.confirm('Remove stored key? The system will fall back to the environment variable.')) return;
                  setClaudeKeyDeleting(true)
                  try {
                    const { supabase } = await import('../lib/supabase')
                    const { error } = await supabase.from('platform_settings').delete().eq('key', 'anthropic_api_key')
                    if (error) throw error
                    setClaudeKeyStored(null)
                    setClaudeKeyStatus(null)
                  } catch (e) {
                    console.error('Claude key delete error:', e)
                  } finally {
                    setClaudeKeyDeleting(false)
                  }
                }}
                style={{ background: 'none', border: `1px solid ${B.red}60`, borderRadius: 7, padding: '8px 14px', cursor: 'pointer', fontFamily: fontHead, fontSize: 11, color: B.red, opacity: claudeKeyDeleting ? 0.5 : 1 }}>
                {claudeKeyDeleting ? 'Removing…' : 'Remove Key'}
              </button>
            )}

            {claudeKeyStatus === 'saved' && <span style={{ fontSize: 12, color: B.green, fontWeight: 600 }}>✓ Key saved</span>}
            {claudeKeyStatus === 'error' && <span style={{ fontSize: 12, color: B.red }}>✗ Save failed — check browser console</span>}
            {claudeKeyStatus === 'ok' && <span style={{ fontSize: 12, color: B.green, fontWeight: 600 }}>✓ Connection OK</span>}
            {claudeKeyStatus === 'fail' && <span style={{ fontSize: 12, color: B.red }}>✗ Connection failed — check key</span>}
            {claudeKeyStatus === 'local' && <span style={{ fontSize: 12, color: B.amber }}>⚠ Run <code>vercel dev</code> to test locally — works fine on the live app</span>}
          </div>

          <p style={{ fontSize: 11, color: B.textMuted, marginTop: 14, lineHeight: 1.5 }}>
            Key is stored in Supabase and readable only by users with the owner role. The Vercel environment variable acts as a fallback when no key is stored here.
          </p>
        </div>
      )}

      {/* Company Info (Bookings & Branding tab) */}
      {activeTab === 'branding' && (
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
      )}
    </div>
  );
}
