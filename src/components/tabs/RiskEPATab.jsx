import React from 'react';
import { B, fontHead, fmtFull } from '../../theme';
import { SectionHeader, ChartCard } from '../UIComponents';
import * as D from '../../data/financials';
import { getMonthData } from '../../data/dataStore';
import { useCompliance } from '../../hooks/useMonthData';

export default function RiskEPATab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel, wizardData }) {
  const stored = getMonthData(selectedMonth);
  const { data: liveCompliance } = useCompliance(reportMonth);

  // Prefer Supabase compliance data, then wizard data, then localStorage, then empty
  let comp;
  if (liveCompliance) {
    // Map Supabase columns back to the shape the UI expects
    comp = {
      whsIncidents: liveCompliance.whs_incidents > 0 ? 'yes' : 'no',
      whsDetails: liveCompliance.whs_incident_details || '',
      nearMiss: liveCompliance.whs_near_miss ? 'yes' : 'no',
      nearMissDetails: liveCompliance.whs_near_miss_details || '',
      whsRegister: liveCompliance.whs_register_current ? 'yes' : 'no',
      lastToolbox: liveCompliance.whs_last_toolbox_talk || '',
      trainingRows: [],
      trainingRegister: liveCompliance.whs_training_current ? 'yes' : 'not_started',
      asbJobs: liveCompliance.asbestos_jobs || '',
      asbDocs: liveCompliance.asbestos_docs_complete ? 'yes' : 'not_tracked',
      asbClearance: liveCompliance.asbestos_clearance_certs > 0 ? 'yes' : 'na',
      asbComplaints: liveCompliance.asbestos_complaints > 0 ? 'yes' : 'no',
      asbComplaintDetails: liveCompliance.asbestos_complaint_details || '',
      vehiclesOffRoad: liveCompliance.vehicles_off_road > 0 ? 'yes' : 'no',
      vehiclesOffRoadReason: liveCompliance.vehicles_off_road_reason || '',
      fleetInspections: liveCompliance.fleet_inspections_current ? 'yes' : 'no',
      epaStatus: liveCompliance.epa_renewal_status || (liveCompliance.epa_license_current ? 'current' : 'expired'),
      epaRenewal: liveCompliance.epa_expiry_date || '',
      insurance: '',
    };
  } else {
    comp = wizardData?.compliance || stored?.compliance || {};
  }
  const qual = wizardData?.quality || stored?.quality || {};

  return (
    <div>
      <SectionHeader title="Risk, EPA & Compliance" subtitle={`Regulated waste, WHS, training and business risk — ${monthLabel}`} />

      {/* Top 3 category cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
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

      {/* Compliance detail sections */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
              <span style={{ fontSize: 12, color: B.textSecondary }}>EPA Licence</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: comp.epaStatus === 'current' ? B.green : comp.epaStatus === 'expired' ? B.red : B.amber }}>
                {comp.epaStatus === 'current' ? 'Current' : comp.epaStatus === 'expired' ? 'EXPIRED' : comp.epaStatus === 'renewal_due' || comp.epaStatus === 'renewal_pending' ? 'Renewal due' : 'Not recorded'}
              </span>
            </div>
            {comp.epaRenewal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
                <span style={{ fontSize: 12, color: B.textSecondary }}>EPA Renewal Date</span>
                <span style={{ fontSize: 12, color: B.textPrimary }}>{comp.epaRenewal}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
              <span style={{ fontSize: 12, color: B.textSecondary }}>Insurance</span>
              <span style={{ fontSize: 12, color: comp.insurance ? B.textPrimary : B.red }}>{comp.insurance || 'Not recorded'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
              <span style={{ fontSize: 12, color: B.textSecondary }}>Fleet Inspections</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: comp.fleetInspections === 'yes' ? B.green : B.red }}>
                {comp.fleetInspections === 'yes' ? 'Current' : 'Overdue / Not done'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}22` }}>
              <span style={{ fontSize: 12, color: B.textSecondary }}>Vehicles Off-Road</span>
              <span style={{ fontSize: 12, color: comp.vehiclesOffRoad === 'yes' ? B.red : B.green }}>
                {comp.vehiclesOffRoad === 'yes' ? 'Yes' : 'None'}
              </span>
            </div>
            {comp.vehiclesOffRoad === 'yes' && comp.vehiclesOffRoadReason && (
              <div style={{ fontSize: 11, color: B.red, padding: '4px 0' }}>{comp.vehiclesOffRoadReason}</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* Incident details */}
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

      {/* Data Quality Notes */}
      {(qual.bankRecStatus || qual.plStatus || qual.missingInvoices) && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginTop: 12 }}>
          <div style={{ fontFamily: fontHead, fontSize: 12, color: B.textMuted, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Data Quality Notes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, fontSize: 12 }}>
            {qual.bankRecStatus && <div><span style={{ color: B.textMuted }}>Bank Rec: </span><span style={{ color: qual.bankRecStatus === 'reconciled' ? B.green : B.red }}>{qual.bankRecStatus}</span></div>}
            {qual.plStatus && <div><span style={{ color: B.textMuted }}>P&L Status: </span><span>{qual.plStatus}</span></div>}
            {qual.unreconciledCount && <div><span style={{ color: B.textMuted }}>Unreconciled: </span><span style={{ color: B.red }}>{qual.unreconciledCount} items ({qual.unreconciledValue})</span></div>}
          </div>
        </div>
      )}
    </div>
  );
}
