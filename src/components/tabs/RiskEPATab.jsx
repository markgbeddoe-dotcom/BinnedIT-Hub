import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { B, fontHead, fmtFull } from '../../theme';
import { SectionHeader, ChartCard } from '../UIComponents';
import * as D from '../../data/financials';
import { getMonthData } from '../../data/dataStore';
import { useCompliance } from '../../hooks/useMonthData';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { getInsurancePolicies, getStaffCertificates, upsertInsurancePolicy } from '../../api/team';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ───────────────────────────────────────────────────

function expiryStatus(dateStr) {
  if (!dateStr) return { label: 'No date', color: B.textMuted }
  const days = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  if (days < 0)    return { label: 'EXPIRED',         color: B.red }
  if (days <= 30)  return { label: `${days}d — urgent`, color: B.red }
  if (days <= 90)  return { label: `Expiring ${days}d`, color: B.amber }
  return { label: 'Current', color: B.green }
}

const POLICY_TYPE_LABELS = {
  public_liability: 'Public Liability',
  workers_comp:     'Workers Comp',
  vehicle:          'Vehicle / Fleet',
  property:         'Property',
  other:            'Other',
}

const BLANK_POLICY = {
  provider: '', policy_type: 'public_liability', policy_number: '',
  insured_amount: '', annual_premium: '', start_date: '', expiry_date: '', notes: '',
}

// ── Component ─────────────────────────────────────────────────

export default function RiskEPATab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel, wizardData }) {
  const { isMobile } = useBreakpoint();
  const { isOwner, isManager } = useAuth();
  const qc = useQueryClient();
  const stored = getMonthData(selectedMonth);
  const { data: liveCompliance } = useCompliance(reportMonth);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [policyForm, setPolicyForm] = useState(BLANK_POLICY);

  // ── Compliance data (Supabase → wizard → localStorage) ───
  let comp;
  if (liveCompliance) {
    comp = {
      whsIncidents:         liveCompliance.whs_incidents > 0 ? 'yes' : 'no',
      whsDetails:           liveCompliance.whs_incident_details || '',
      nearMiss:             liveCompliance.whs_near_miss ? 'yes' : 'no',
      nearMissDetails:      liveCompliance.whs_near_miss_details || '',
      whsRegister:          liveCompliance.whs_register_current ? 'yes' : 'no',
      lastToolbox:          liveCompliance.whs_last_toolbox_talk || '',
      trainingRows:         [],
      trainingRegister:     liveCompliance.whs_training_current ? 'yes' : 'not_started',
      asbJobs:              liveCompliance.asbestos_jobs || '',
      asbDocs:              liveCompliance.asbestos_docs_complete ? 'yes' : 'not_tracked',
      asbClearance:         liveCompliance.asbestos_clearance_certs > 0 ? 'yes' : 'na',
      asbComplaints:        liveCompliance.asbestos_complaints > 0 ? 'yes' : 'no',
      asbComplaintDetails:  liveCompliance.asbestos_complaint_details || '',
      vehiclesOffRoad:      liveCompliance.vehicles_off_road > 0 ? 'yes' : 'no',
      vehiclesOffRoadReason:liveCompliance.vehicles_off_road_reason || '',
      fleetInspections:     liveCompliance.fleet_inspections_current ? 'yes' : 'no',
      epaStatus:            liveCompliance.epa_renewal_status || (liveCompliance.epa_license_current ? 'current' : 'expired'),
      epaRenewal:           liveCompliance.epa_expiry_date || '',
      insurance:            '',
    };
  } else {
    comp = wizardData?.compliance || stored?.compliance || {};
  }
  const qual = wizardData?.quality || stored?.quality || {};

  // ── Insurance & certs from Supabase ──────────────────────
  const { data: insurancePolicies = [] } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: getInsurancePolicies,
    retry: false,
  });
  const { data: staffCerts = [] } = useQuery({
    queryKey: ['staff-certs'],
    queryFn: getStaffCertificates,
    retry: false,
  });

  const addPolicyMut = useMutation({
    mutationFn: upsertInsurancePolicy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance-policies'] });
      setShowAddPolicy(false);
      setPolicyForm(BLANK_POLICY);
    },
  });

  // ── Upcoming expiries (next 120 days) ────────────────────
  const today = new Date();
  const cutoff = new Date(today.getTime() + 120 * 86400000);

  const upcomingExpiries = [
    ...staffCerts
      .filter(c => c.expiry_date && new Date(c.expiry_date) <= cutoff)
      .map(c => ({ label: `${c.staff_name} — ${c.cert_name}`, date: c.expiry_date, category: 'Certificate' })),
    ...insurancePolicies
      .filter(p => p.expiry_date && new Date(p.expiry_date) <= cutoff)
      .map(p => ({ label: `${p.provider} (${POLICY_TYPE_LABELS[p.policy_type] || p.policy_type})`, date: p.expiry_date, category: 'Insurance' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  const iStyle = {
    background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
    padding: '6px 10px', fontSize: 12, color: B.textPrimary, outline: 'none',
  };

  // Effective cert data: prefer Supabase, fall back to hardcoded
  const effectiveCerts = staffCerts.length > 0 ? staffCerts : [
    { staff_name: 'Mark (Owner)', cert_name: 'Asbestos Supervisor',  expiry_date: '2026-08-15' },
    { staff_name: 'Driver 1',     cert_name: 'Asbestos Worker',       expiry_date: '2026-11-30' },
    { staff_name: 'Driver 2',     cert_name: 'Asbestos Worker',       expiry_date: '2025-12-31' },
    { staff_name: 'All Staff',    cert_name: 'WHS Induction',         expiry_date: '2026-06-30' },
  ];

  return (
    <div>
      {/* Header with print button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        <SectionHeader
          title="Risk, EPA & Compliance"
          subtitle={`Regulated waste, WHS, insurance, and business risk — ${monthLabel}`}
        />
        <button
          onClick={() => window.print()}
          className="no-print"
          style={{
            background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 6,
            padding: '7px 16px', cursor: 'pointer', fontSize: 12, color: B.textSecondary,
            fontFamily: fontHead, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}
        >
          🖨 Print Compliance Report
        </button>
      </div>

      {/* ── Top 3 category cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          {
            t: 'ASBESTOS', c: B.amber, items: [
              ['YTD Revenue', fmtFull(D.revByCategory.asbestos.reduce((a, b) => a + b, 0))],
              ['Jobs This Month', comp.asbJobs || 'Not entered', comp.asbJobs ? B.textPrimary : B.red],
              ['Documentation', comp.asbDocs === 'yes' ? 'All complete' : comp.asbDocs === 'gaps' ? 'Some gaps' : 'Not tracked', comp.asbDocs === 'yes' ? B.green : B.red],
              ['Clearance Certs', comp.asbClearance === 'yes' ? 'Obtained' : comp.asbClearance === 'no' ? 'Missing' : 'N/A', comp.asbClearance === 'yes' ? B.green : comp.asbClearance === 'no' ? B.red : B.textMuted],
              ['Complaints/EPA', comp.asbComplaints === 'yes' ? 'YES — SEE DETAILS' : comp.asbComplaints === 'no' ? 'None' : 'Not recorded', comp.asbComplaints === 'yes' ? B.red : B.green],
            ]
          },
          {
            t: 'CONTAMINATED SOIL', c: B.orange, items: [
              ['YTD Revenue', fmtFull(D.revByCategory.soil.reduce((a, b) => a + b, 0))],
              ['Tip Receipts', 'NEEDS VERIFICATION', B.amber],
            ]
          },
          {
            t: 'WHS & SAFETY', c: B.red, items: [
              ['Incidents', comp.whsIncidents === 'yes' ? 'YES — SEE DETAILS' : comp.whsIncidents === 'no' ? 'None reported' : 'Not recorded', comp.whsIncidents === 'yes' ? B.red : B.green],
              ['Near Misses', comp.nearMiss === 'yes' ? 'YES — SEE DETAILS' : comp.nearMiss === 'no' ? 'None reported' : 'Not recorded', comp.nearMiss === 'yes' ? B.amber : B.green],
              ['WHS Register', comp.whsRegister === 'yes' ? 'Current' : comp.whsRegister === 'partial' ? 'Partial' : comp.whsRegister === 'not_started' ? 'Does not exist' : 'Not current', comp.whsRegister === 'yes' ? B.green : B.red],
              ['Last Toolbox', comp.lastToolbox || 'Not recorded', comp.lastToolbox ? B.textPrimary : B.red],
            ]
          },
        ].map(card => (
          <div key={card.t} style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: card.c, marginBottom: 14, fontFamily: fontHead }}>{card.t}</div>
            {card.items.map(([l, v, col], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${B.cardBorder}` }}>
                <span style={{ fontSize: 12, color: B.textSecondary }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: col || B.textPrimary }}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Compliance detail cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Training & Certifications">
          <div style={{ fontSize: 12, color: B.textSecondary, marginBottom: 8 }}>
            <strong>Register Status:</strong>{' '}
            <span style={{ color: comp.trainingRegister === 'yes' ? B.green : B.red }}>
              {comp.trainingRegister === 'yes' ? 'Current' : comp.trainingRegister === 'partial' ? 'Partially complete' : comp.trainingRegister === 'not_started' ? 'Does not exist' : 'Not current'}
            </span>
          </div>
          {comp.trainingRows && comp.trainingRows.length > 0 && comp.trainingRows[0].name !== 'NA' ? (
            <div>
              <div style={{ fontSize: 11, color: B.textMuted, marginBottom: 4 }}>Completed this month:</div>
              {comp.trainingRows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.7fr 0.5fr', gap: 4, padding: '3px 0', borderBottom: `1px solid ${B.cardBorder}22`, fontSize: 11 }}>
                  <span style={{ color: B.textPrimary }}>{r.name}</span>
                  <span style={{ color: B.textSecondary }}>{r.type}</span>
                  <span style={{ color: B.textMuted }}>{r.date}</span>
                  <span style={{ color: r.evidence === 'Y' || r.evidence === 'y' ? B.green : B.red }}>{r.evidence}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: B.textMuted, fontStyle: 'italic' }}>No training recorded this month</div>
          )}
          {comp.certExpiring && <div style={{ marginTop: 8, fontSize: 11, color: B.amber }}>Expiring soon: {comp.certExpiring}</div>}
          {comp.certExpired === 'yes' && <div style={{ marginTop: 4, fontSize: 11, color: B.red, fontWeight: 600 }}>EXPIRED certifications exist</div>}
          {comp.newStaff && <div style={{ marginTop: 8, fontSize: 11, color: B.textSecondary }}>New staff: {comp.newStaff}</div>}
        </ChartCard>

        <ChartCard title="Licensing, EPA & Insurance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['EPA Licence', comp.epaStatus === 'current' ? 'Current' : comp.epaStatus === 'expired' ? 'EXPIRED' : comp.epaStatus === 'renewal_due' || comp.epaStatus === 'renewal_pending' ? 'Renewal due' : 'Not recorded', comp.epaStatus === 'current' ? B.green : comp.epaStatus === 'expired' ? B.red : B.amber],
              ...(comp.epaRenewal ? [['EPA Renewal Date', comp.epaRenewal, B.textPrimary]] : []),
              ['Fleet Inspections', comp.fleetInspections === 'yes' ? 'Current' : 'Overdue / Not done', comp.fleetInspections === 'yes' ? B.green : B.red],
              ['Vehicles Off-Road', comp.vehiclesOffRoad === 'yes' ? 'Yes' : 'None', comp.vehiclesOffRoad === 'yes' ? B.red : B.green],
            ].map(([l, v, col], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
                <span style={{ fontSize: 12, color: B.textSecondary }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: col || B.textPrimary }}>{v}</span>
              </div>
            ))}
            {comp.vehiclesOffRoad === 'yes' && comp.vehiclesOffRoadReason && (
              <div style={{ fontSize: 11, color: B.red, padding: '4px 0' }}>{comp.vehiclesOffRoadReason}</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── Insurance Policies ── */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>
            Insurance Policies
          </div>
          {(isOwner || isManager) && (
            <button
              onClick={() => { setShowAddPolicy(p => !p); setPolicyForm(BLANK_POLICY) }}
              className="no-print"
              style={{ background: B.yellow, border: 'none', borderRadius: 6, color: '#000', padding: '5px 12px', cursor: 'pointer', fontFamily: fontHead, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}
            >
              + Add Policy
            </button>
          )}
        </div>

        {showAddPolicy && (
          <div style={{ background: B.bg, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
              {[
                { label: 'Provider', key: 'provider', placeholder: 'e.g. QBE Australia' },
                { label: 'Policy Number', key: 'policy_number', placeholder: 'e.g. QBE-2024-8872' },
                { label: 'Notes', key: 'notes', placeholder: 'Coverage description' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>{f.label}</label>
                  <input value={policyForm[f.key]} onChange={e => setPolicyForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>Type</label>
                <select value={policyForm.policy_type} onChange={e => setPolicyForm(p => ({ ...p, policy_type: e.target.value }))} style={{ ...iStyle, width: '100%' }}>
                  {Object.entries(POLICY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>Expiry Date</label>
                <input type="date" value={policyForm.expiry_date} onChange={e => setPolicyForm(p => ({ ...p, expiry_date: e.target.value }))} style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: B.textMuted, marginBottom: 3 }}>Insured Amount ($)</label>
                <input type="number" value={policyForm.insured_amount} onChange={e => setPolicyForm(p => ({ ...p, insured_amount: e.target.value }))} placeholder="e.g. 20000000" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button
                onClick={() => { if (!policyForm.provider.trim() || !policyForm.expiry_date) return; addPolicyMut.mutate(policyForm) }}
                disabled={addPolicyMut.isPending}
                style={{ background: B.green, border: 'none', borderRadius: 6, color: '#fff', padding: '7px 18px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}
              >
                {addPolicyMut.isPending ? 'Saving…' : 'Save Policy'}
              </button>
              <button onClick={() => setShowAddPolicy(false)} style={{ background: 'none', border: `1px solid ${B.cardBorder}`, borderRadius: 6, color: B.textSecondary, padding: '7px 14px', cursor: 'pointer', fontFamily: fontHead, fontSize: 12 }}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                {['Provider', 'Type', 'Policy No.', 'Insured Amount', 'Expiry', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insurancePolicies.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '16px 10px', color: B.textMuted, fontSize: 12, textAlign: 'center' }}>No insurance policies. Apply migration 010 or click + Add Policy.</td></tr>
              ) : (
                insurancePolicies.map((p, i) => {
                  const { label, color } = expiryStatus(p.expiry_date)
                  return (
                    <tr key={p.id || i} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                      <td style={{ padding: '7px 10px', fontWeight: 600, color: B.textPrimary }}>{p.provider}</td>
                      <td style={{ padding: '7px 10px', color: B.textSecondary }}>{POLICY_TYPE_LABELS[p.policy_type] || p.policy_type}</td>
                      <td style={{ padding: '7px 10px', color: B.textMuted, fontSize: 11 }}>{p.policy_number || '—'}</td>
                      <td style={{ padding: '7px 10px', color: B.textSecondary }}>{p.insured_amount ? `$${Number(p.insured_amount).toLocaleString('en-AU')}` : '—'}</td>
                      <td style={{ padding: '7px 10px', color: B.textMuted, whiteSpace: 'nowrap' }}>{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('en-AU') : '—'}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}20`, color, fontFamily: fontHead }}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Upcoming Expiry Calendar (next 120 days) ── */}
      {upcomingExpiries.length > 0 && (
        <div style={{ background: B.cardBg, border: `2px solid ${B.amber}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.amber, textTransform: 'uppercase', marginBottom: 12 }}>
            Upcoming Expiries — Next 120 Days
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingExpiries.map((item, i) => {
              const { label, color } = expiryStatus(item.date)
              const days = Math.ceil((new Date(item.date) - today) / 86400000)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 10px', background: B.bg, borderRadius: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}20`, color, fontFamily: fontHead, whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, color: B.textPrimary }}>{item.label}</span>
                  <span style={{ fontSize: 10, color: B.textMuted, fontFamily: fontHead, whiteSpace: 'nowrap' }}>{item.category}</span>
                  <span style={{ fontSize: 12, color: B.textMuted, whiteSpace: 'nowrap' }}>
                    {new Date(item.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Asbestos Document Completeness ── */}
      {(comp.asbJobs > 0 || comp.asbDocs) && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.amber, textTransform: 'uppercase', marginBottom: 12 }}>
            Asbestos Document Completeness
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Tip Receipts', status: comp.asbDocs === 'yes' ? 'complete' : comp.asbDocs === 'gaps' ? 'partial' : 'missing' },
              { label: 'Clearance Certificates', status: comp.asbClearance === 'yes' ? 'complete' : comp.asbClearance === 'no' ? 'missing' : 'na' },
              { label: 'Disposal Manifests', status: comp.asbDocs === 'yes' ? 'complete' : 'not_tracked' },
            ].map((item, i) => (
              <div key={i} style={{ background: B.bg, borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: B.textSecondary }}>{item.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  background: item.status === 'complete' ? `${B.green}20` : item.status === 'partial' ? `${B.amber}20` : item.status === 'na' ? `${B.textMuted}20` : `${B.red}20`,
                  color: item.status === 'complete' ? B.green : item.status === 'partial' ? B.amber : item.status === 'na' ? B.textMuted : B.red,
                }}>
                  {item.status === 'complete' ? 'Complete' : item.status === 'partial' ? 'Gaps' : item.status === 'na' ? 'N/A' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
          {comp.asbJobs && (
            <div style={{ marginTop: 8, fontSize: 11, color: B.textMuted }}>
              Asbestos jobs this month: <strong style={{ color: B.textPrimary }}>{comp.asbJobs}</strong>
            </div>
          )}
        </div>
      )}

      {/* ── Staff Certification Matrix ── */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>
            Staff Certification Matrix
          </div>
          <a
            href="/settings/team"
            className="no-print"
            style={{ fontSize: 11, color: B.blue, textDecoration: 'none', fontFamily: fontHead }}
          >
            Manage certificates →
          </a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                {['Staff Member', 'Certification', 'Expiry', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveCerts.map((c, i) => {
                const { label, color } = expiryStatus(c.expiry_date)
                return (
                  <tr key={c.id || i} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                    <td style={{ padding: '7px 10px', color: B.textPrimary, fontWeight: 600 }}>{c.staff_name}</td>
                    <td style={{ padding: '7px 10px', color: B.textSecondary }}>{c.cert_name}</td>
                    <td style={{ padding: '7px 10px', color: B.textMuted }}>
                      {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-AU') : '—'}
                    </td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}20`, color, fontFamily: fontHead }}>
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Vehicle Registration Expiry ── */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 12 }}>
          Vehicle Registration Expiry
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 350 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
                {['Vehicle', 'Registration', 'Expiry Date', 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { vehicle: 'Mack Truck (TRK-001)', rego: 'ABC123', expiry: '2026-06-30' },
                { vehicle: 'Isuzu Truck (TRK-002)', rego: 'XYZ456', expiry: '2026-05-15' },
                { vehicle: 'Trailer 1', rego: 'TRL001', expiry: '2026-08-20' },
              ].map((v, i) => {
                const { label, color } = expiryStatus(v.expiry)
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                    <td style={{ padding: '7px 10px', color: B.textPrimary, fontWeight: 600 }}>{v.vehicle}</td>
                    <td style={{ padding: '7px 10px', color: B.textSecondary }}>{v.rego}</td>
                    <td style={{ padding: '7px 10px', color: B.textMuted }}>{new Date(v.expiry).toLocaleDateString('en-AU')}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${color}20`, color, fontFamily: fontHead }}>
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Incident & Complaint Details ── */}
      {(comp.whsIncidents === 'yes' || comp.nearMiss === 'yes' || comp.asbComplaints === 'yes') && (
        <ChartCard title="Incident & Complaint Details">
          {comp.whsIncidents === 'yes' && comp.whsDetails && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>WHS Incident:</div>
              <div style={{ fontSize: 12, color: B.textSecondary }}>{comp.whsDetails}</div>
            </div>
          )}
          {comp.nearMiss === 'yes' && comp.nearMissDetails && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: B.amber, fontWeight: 600 }}>Near Miss:</div>
              <div style={{ fontSize: 12, color: B.textSecondary }}>{comp.nearMissDetails}</div>
            </div>
          )}
          {comp.asbComplaints === 'yes' && comp.asbComplaintDetails && (
            <div>
              <div style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>Asbestos Complaint / EPA Contact:</div>
              <div style={{ fontSize: 12, color: B.textSecondary }}>{comp.asbComplaintDetails}</div>
            </div>
          )}
        </ChartCard>
      )}

      {/* ── Data Quality Notes ── */}
      {(qual.bankRecStatus || qual.plStatus || qual.missingInvoices) && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginTop: 12 }}>
          <div style={{ fontFamily: fontHead, fontSize: 12, color: B.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Data Quality Notes</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, fontSize: 12 }}>
            {qual.bankRecStatus && <div><span style={{ color: B.textMuted }}>Bank Rec: </span><span style={{ color: qual.bankRecStatus === 'reconciled' ? B.green : B.red }}>{qual.bankRecStatus}</span></div>}
            {qual.plStatus && <div><span style={{ color: B.textMuted }}>P&L Status: </span><span>{qual.plStatus}</span></div>}
            {qual.unreconciledCount && <div><span style={{ color: B.textMuted }}>Unreconciled: </span><span style={{ color: B.red }}>{qual.unreconciledCount} items ({qual.unreconciledValue})</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
