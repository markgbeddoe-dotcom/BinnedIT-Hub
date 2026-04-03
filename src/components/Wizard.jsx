import React, { useState, useRef, useCallback } from 'react';
import { B, fontHead, fmtFull } from '../theme';
import { wizardSteps } from '../data/wizardSteps';
import { parseCashSummary, parseBalanceSheet, parseGenericExcel, validateFile } from '../data/fileParser';

// ===== SHARED STYLES (outside component to avoid recreation) =====
const inputStyle = {
  background:B.bg, border:`1px solid ${B.cardBorder}`, borderRadius:6, padding:'8px 12px',
  fontSize:13, color:B.textPrimary, width:'100%', outline:'none', fontFamily:'"DM Sans",system-ui,sans-serif'
};
const monoStyle = { ...inputStyle, fontFamily:'monospace', fontSize:11 };

// ===== STABLE SUB-COMPONENTS (defined outside to prevent remount) =====
function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ fontSize: 12, color: B.textSecondary, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function ToggleGroup({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            style={{ background: active ? B.yellow : B.cardBg, border: `1px solid ${active ? B.yellow : B.cardBorder}`,
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 400,
              color: active ? B.black : B.textSecondary, cursor: 'pointer', transition: 'all 0.15s' }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function MultiToggle({ values, onChange, options }) {
  const toggle = (v) => {
    const next = values.includes(v) ? values.filter(x => x !== v) : [...values, v];
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = values.includes(o.v);
        return (
          <button key={o.v} type="button" onClick={() => toggle(o.v)}
            style={{ background: active ? B.yellow : B.cardBg, border: `1px solid ${active ? B.yellow : B.cardBorder}`,
              borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 400,
              color: active ? B.black : B.textSecondary, cursor: 'pointer' }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

function SectionBox({ title, color, children }) {
  return (
    <div style={{ background: B.cardBg, borderRadius: 8, padding: 16, borderLeft: `3px solid ${color}`, border: `1px solid ${B.cardBorder}` }}>
      <div style={{ fontFamily: fontHead, fontSize: 13, color: color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function MiniKPI({ label, value, color }) {
  return (
    <div style={{ background: B.bg, borderRadius: 8, padding: 14, textAlign: 'center', border: `1px solid ${B.cardBorder}` }}>
      <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: fontHead, fontSize: 20, color, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ===== MAIN WIZARD =====
export default function Wizard({ onComplete, onHome, selectedMonth }) {
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState({});
  const [parsed, setParsed] = useState({});
  const [parsing, setParsing] = useState(false);
  const [bankBalance, setBankBalance] = useState('');
  const [bankDate, setBankDate] = useState('');
  const fileInputRef = useRef(null);

  // Quality state
  const [qUnreconciledCount, setQUnreconciledCount] = useState('');
  const [qUnreconciledValue, setQUnreconciledValue] = useState('');
  const [qBankRecStatus, setQBankRecStatus] = useState('');
  const [qPlStatus, setQPlStatus] = useState('');
  const [qMissingInvoices, setQMissingInvoices] = useState('');

  // Compliance state — individual pieces to avoid wholesale reset
  const [cWhsIncidents, setCWhsIncidents] = useState('no');
  const [cWhsDetails, setCWhsDetails] = useState('');
  const [cNearMiss, setCNearMiss] = useState('no');
  const [cNearMissDetails, setCNearMissDetails] = useState('');
  const [cWhsRegister, setCWhsRegister] = useState('not_started');
  const [cLastToolbox, setCLastToolbox] = useState('');
  const [cTrainingRows, setCTrainingRows] = useState([{name:'NA',type:'NA',date:'NA',evidence:'NA'}]);
  const [cCertExpiring, setCCertExpiring] = useState('');
  const [cCertExpired, setCCertExpired] = useState('no');
  const [cNewStaff, setCNewStaff] = useState('');
  const [cTrainingRegister, setCTrainingRegister] = useState('not_started');
  const [cAsbJobs, setCAsbJobs] = useState('');
  const [cAsbDocs, setCAsbDocs] = useState('not_tracked');
  const [cAsbClearance, setCAsbClearance] = useState('na');
  const [cAsbComplaints, setCAsbComplaints] = useState('no');
  const [cAsbComplaintDetails, setCAsbComplaintDetails] = useState('');
  const [cVehiclesOffRoad, setCVehiclesOffRoad] = useState('no');
  const [cVehiclesOffRoadReason, setCVehiclesOffRoadReason] = useState('');
  const [cVehicleRegos, setCVehicleRegos] = useState('');
  const [cFleetInspections, setCFleetInspections] = useState('no');
  const [cEpaStatus, setCEpaStatus] = useState('current');
  const [cEpaRenewal, setCEpaRenewal] = useState('');
  const [cInsurance, setCInsurance] = useState('');

  // ESG / Waste Diversion state
  const [esgLandfill, setEsgLandfill] = useState('');
  const [esgRecycled, setEsgRecycled] = useState('');
  const [esgDiverted, setEsgDiverted] = useState('');

  // Market state — individual pieces
  const [mOutlook, setMOutlook] = useState('normal');
  const [mKeyWins, setMKeyWins] = useState('');
  const [mKeyRisks, setMKeyRisks] = useState('');
  const [mReferralSources, setMReferralSources] = useState([]);
  const [mCustomersAtRisk, setMCustomersAtRisk] = useState('');
  const [mPaymentsExpected, setMPaymentsExpected] = useState('');
  const [mBillsDue, setMBillsDue] = useState('');
  const [mAtoStatus, setMAtoStatus] = useState('on_track');
  const [mEquipmentPlanned, setMEquipmentPlanned] = useState('no');
  const [mEquipmentDetails, setMEquipmentDetails] = useState('');

  const ws = wizardSteps[step];
  const pc = { A: B.yellow, B: B.amber, C: B.green };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setParsing(true);
    try {
      let result;
      if (ws.num === 2) { result = await parseCashSummary(file); result.validation = validateFile(result, 'cashSummary'); }
      else if (ws.num === 4) { result = await parseBalanceSheet(file); result.validation = validateFile(result, 'balanceSheet'); }
      else { result = await parseGenericExcel(file); result.validation = { valid: true, errors: [], warnings: [] }; }
      setParsed(prev => ({ ...prev, [ws.num]: result }));
      setFiles(prev => ({ ...prev, [ws.num]: { name: file.name, size: file.size, loaded: true } }));
      // Auto-populate from parsed data (inside try so result is in scope)
      if (ws.num === 2 && result.cashBalance) setBankBalance(String(result.cashBalance));
      // Auto-populate asbestos count from Bin Type Usage (step 5) or Jobs by TipSite (step 6)
      if ((ws.num === 5 || ws.num === 6) && result.rows) {
        const asbCount = result.rows.filter(r => {
          const vals = Object.values(r).map(v => String(v).toLowerCase());
          return vals.some(v => v.includes('asb') || v.includes('asbestos'));
        }).length;
        if (asbCount > 0) setCAsbJobs(String(asbCount));
      }
    } catch (err) { alert('Error reading file: ' + err.message); }
    setParsing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isLoaded = files[ws.num]?.loaded;
  const parsedData = parsed[ws.num];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 24 }}>
        {wizardSteps.map((_, i) => (
          <div key={i} onClick={() => setStep(i)} style={{ flex: 1, height: 6, borderRadius: 3, cursor: 'pointer',
            background: i < step ? B.green : i === step ? pc[wizardSteps[i].part] : B.cardBorder }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Part {ws.part}: {ws.part === 'A' ? 'File Uploads' : ws.part === 'B' ? 'Data Quality & Context' : 'Output'}</span>
        <span style={{ fontSize: 11, color: B.textMuted }}>Step {ws.num} of {wizardSteps.length}</span>
      </div>
      {selectedMonth && <div style={{ marginBottom: 12, padding: '6px 14px', background: B.yellow + '18', border: '1px solid ' + B.yellow + '40', borderRadius: 6, fontSize: 12, color: B.yellow, fontFamily: fontHead, fontWeight: 600 }}>Loading data for: {selectedMonth}</div>}

      {/* Step Card */}
      <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 14, padding: '32px 28px', borderLeft: `4px solid ${pc[ws.part]}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 40 }}>{ws.icon}</div>
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 22, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase' }}>{ws.title}</div>
            <div style={{ fontSize: 12, color: pc[ws.part], fontWeight: 600 }}>Source: {ws.source}</div>
          </div>
        </div>
        <div style={{ background: B.bg, borderRadius: 8, padding: '16px 20px', marginBottom: 20, borderLeft: `3px solid ${pc[ws.part]}` }}>
          <div style={{ fontSize: 11, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Instructions</div>
          <div style={{ fontSize: 13, color: B.textSecondary, whiteSpace: 'pre-line', lineHeight: 1.7 }}>{ws.instructions}</div>
        </div>

        {/* UPLOAD STEPS */}
        {(ws.type === 'upload') && (
          <div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
            <div onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isLoaded ? B.green : B.cardBorder}`, borderRadius: 12, padding: '40px 20px',
                textAlign: 'center', cursor: 'pointer', background: isLoaded ? `${B.green}08` : B.bg }}>
              {parsing ? <><div style={{ fontSize: 24 }}>⏳</div><div style={{ fontFamily: fontHead, color: B.amber, fontSize: 14, marginTop: 8 }}>READING FILE...</div></>
                : isLoaded ? <>
                  <div style={{ fontSize: 32 }}>✅</div>
                  <div style={{ fontFamily: fontHead, color: B.green, fontSize: 14, marginTop: 8, textTransform: 'uppercase' }}>File Loaded</div>
                  <div style={{ fontSize: 12, color: B.textMuted, marginTop: 4 }}>{files[ws.num].name} — {(files[ws.num].size / 1024).toFixed(0)} KB</div>
                </> : <>
                  <div style={{ fontSize: 32 }}>📂</div>
                  <div style={{ fontFamily: fontHead, color: B.yellow, fontSize: 14, marginTop: 8, textTransform: 'uppercase' }}>Drop your Excel file here</div>
                  <div style={{ fontSize: 12, color: B.textMuted, marginTop: 4 }}>or click to browse</div>
                </>}
            </div>
            {parsedData?.validation?.warnings?.map((w, i) => <div key={i} style={{ fontSize: 11, color: B.amber, marginTop: 6 }}>⚠️ {w}</div>)}
            {parsedData && ws.num === 2 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <MiniKPI label="Total Income" value={fmtFull(parsedData.totalIncome)} color={B.green} />
                <MiniKPI label="Total Expenses" value={fmtFull(parsedData.totalExpenses)} color={B.red} />
                <MiniKPI label="Cash Balance" value={fmtFull(parsedData.cashBalance)} color={B.yellow} />
              </div>
            )}
            {parsedData && ws.num === 4 && (
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                <MiniKPI label="Total Assets" value={fmtFull(parsedData.totalAssets)} color={B.green} />
                <MiniKPI label="Total Liabilities" value={fmtFull(Math.abs(parsedData.totalLiabilities))} color={B.red} />
                <MiniKPI label="Net Equity" value={fmtFull(parsedData.netEquity)} color={parsedData.netEquity < 0 ? B.red : B.green} />
              </div>
            )}
            {parsedData && ![2, 4].includes(ws.num) && parsedData.rowCount !== undefined && (
              <div style={{ marginTop: 12, fontSize: 12, color: B.textSecondary, textAlign: 'center' }}>{parsedData.rowCount} rows loaded</div>
            )}
          </div>
        )}

        {/* BANK STEP */}
        {ws.type === 'bank' && (
          <div>
            <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
            <div onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isLoaded ? B.green : B.cardBorder}`, borderRadius: 12, padding: '30px 20px', textAlign: 'center', cursor: 'pointer', background: isLoaded ? `${B.green}08` : B.bg, marginBottom: 16 }}>
              {isLoaded ? <><div style={{ fontSize: 32 }}>✅</div><div style={{ fontFamily: fontHead, color: B.green, fontSize: 14 }}>File Loaded</div></>
                : <><div style={{ fontSize: 32 }}>🏛️</div><div style={{ fontFamily: fontHead, color: B.yellow, fontSize: 14, marginTop: 8 }}>Upload Westpac Statement</div></>}
            </div>
            <div style={{ background: B.bg, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 12, color: B.textSecondary, marginBottom: 8, fontWeight: 600 }}>Or enter closing balance manually:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: B.textMuted, display: 'block', marginBottom: 4 }}>Closing Balance ($)</label>
                  <input type="text" inputMode="decimal" value={bankBalance} onChange={e => setBankBalance(e.target.value)} placeholder="e.g. 99334.01" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: B.textMuted, display: 'block', marginBottom: 4 }}>Statement Date</label>
                  <input type="date" value={bankDate} onChange={e => setBankDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QUALITY STEP */}
        {ws.type === 'quality' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Unreconciled items in Xero">
              <input type="text" inputMode="numeric" value={qUnreconciledCount} onChange={e => setQUnreconciledCount(e.target.value)} placeholder="e.g. 12" style={inputStyle} />
            </FormField>
            <FormField label="Estimated $ value of unreconciled items">
              <input type="text" inputMode="decimal" value={qUnreconciledValue} onChange={e => setQUnreconciledValue(e.target.value)} placeholder="e.g. 5000" style={inputStyle} />
            </FormField>
            <FormField label="Bank reconciliation up to date?">
              <ToggleGroup value={qBankRecStatus} onChange={setQBankRecStatus}
                options={[{ v: 'yes', l: 'Yes' }, { v: 'behind_days', l: 'Behind a few days' }, { v: 'behind_week', l: 'Behind a week+' }, { v: 'not_sure', l: 'Not sure' }]} />
            </FormField>
            <FormField label="Is this P&L the final version?">
              <ToggleGroup value={qPlStatus} onChange={setQPlStatus}
                options={[{ v: 'final', l: 'Final' }, { v: 'draft', l: 'Draft — invoices still to post' }]} />
            </FormField>
            <FormField label="Known missing invoices (one per line)">
              <textarea value={qMissingInvoices} onChange={e => setQMissingInvoices(e.target.value)}
                placeholder="e.g. Cleanaway invoice ~$3,000 for Feb tip fees" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </FormField>
          </div>
        )}

        {/* COMPLIANCE STEP */}
        {ws.type === 'compliance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionBox title="WHS" color={B.red}>
              <FormField label="Any WHS incidents this month?">
                <ToggleGroup value={cWhsIncidents} onChange={setCWhsIncidents} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              {cWhsIncidents === 'yes' && <FormField label="Incident details">
                <textarea value={cWhsDetails} onChange={e => setCWhsDetails(e.target.value)} placeholder="Date, description, severity, action taken" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>}
              <FormField label="Near-miss incidents?">
                <ToggleGroup value={cNearMiss} onChange={setCNearMiss} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              {cNearMiss === 'yes' && <FormField label="Near-miss details">
                <textarea value={cNearMissDetails} onChange={e => setCNearMissDetails(e.target.value)} placeholder="Date, what happened, who was involved, corrective action" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>}
              <FormField label="WHS incident register maintained?">
                <ToggleGroup value={cWhsRegister} onChange={setCWhsRegister} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, { v: 'not_started', l: 'Not started' }]} />
              </FormField>
              <FormField label="Last toolbox talk date">
                <input type="date" value={cLastToolbox} onChange={e => setCLastToolbox(e.target.value)} style={inputStyle} />
              </FormField>
            </SectionBox>

            <SectionBox title="Training & Certifications" color={B.amber}>
              <FormField label="Training completed this month">
                {cTrainingRows.map((row, ri) => (
                  <div key={ri} style={{display:'grid',gridTemplateColumns:'1fr 1fr 0.8fr 0.6fr auto',gap:6,marginBottom:6}}>
                    <input type="text" value={row.name} onChange={e => {const r=[...cTrainingRows];r[ri]={...r[ri],name:e.target.value};setCTrainingRows(r);}} placeholder="Staff name" style={inputStyle} />
                    <input type="text" value={row.type} onChange={e => {const r=[...cTrainingRows];r[ri]={...r[ri],type:e.target.value};setCTrainingRows(r);}} placeholder="Training type" style={inputStyle} />
                    <input type="text" value={row.date} onChange={e => {const r=[...cTrainingRows];r[ri]={...r[ri],date:e.target.value};setCTrainingRows(r);}} placeholder="Date" style={inputStyle} />
                    <input type="text" value={row.evidence} onChange={e => {const r=[...cTrainingRows];r[ri]={...r[ri],evidence:e.target.value};setCTrainingRows(r);}} placeholder="Y/N" style={inputStyle} />
                    {cTrainingRows.length > 1 && <button type="button" onClick={() => setCTrainingRows(cTrainingRows.filter((_,i)=>i!==ri))} style={{background:'none',border:'none',color:B.red,cursor:'pointer',fontSize:16,padding:'4px 8px'}}>×</button>}
                  </div>
                ))}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 0.8fr 0.6fr auto',gap:6,marginBottom:4}}>
                  <span style={{fontSize:9,color:B.textMuted}}>Staff Name</span>
                  <span style={{fontSize:9,color:B.textMuted}}>Training Type</span>
                  <span style={{fontSize:9,color:B.textMuted}}>Date</span>
                  <span style={{fontSize:9,color:B.textMuted}}>Evidence</span>
                  <span></span>
                </div>
                <button type="button" onClick={() => setCTrainingRows([...cTrainingRows,{name:'',type:'',date:'',evidence:''}])} style={{background:B.bg,border:'1px solid '+B.cardBorder,borderRadius:6,padding:'4px 12px',fontSize:11,color:B.textSecondary,cursor:'pointer'}}>+ Add row</button>
              </FormField>
              <FormField label="Certifications expiring within 90 days">
                <textarea value={cCertExpiring} onChange={e => setCCertExpiring(e.target.value)} placeholder={"Staff name | Cert type | Expiry date\ne.g. Sam | HR Licence | 15/05/2026"} rows={2} style={monoStyle} />
              </FormField>
              <FormField label="Any EXPIRED certifications?">
                <ToggleGroup value={cCertExpired} onChange={setCCertExpired} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              <FormField label="New staff this month">
                <textarea value={cNewStaff} onChange={e => setCNewStaff(e.target.value)} placeholder="Name | Role | Start date | Induction done Y/N" rows={2} style={monoStyle} />
              </FormField>
              <FormField label="Training register status">
                <ToggleGroup value={cTrainingRegister} onChange={setCTrainingRegister}
                  options={[{ v: 'yes', l: 'Current' }, { v: 'partial', l: 'Partially' }, { v: 'no', l: 'No' }, { v: 'not_started', l: 'Does not exist' }]} />
              </FormField>
            </SectionBox>

            <SectionBox title="Asbestos Compliance" color={B.orange}>
              <FormField label="Asbestos jobs completed this month">
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <input type="text" inputMode="numeric" value={cAsbJobs} onChange={e => setCAsbJobs(e.target.value)} style={{ ...inputStyle, width: 120 }} />
                  {parsed[3] && <span style={{fontSize:11,color:B.green,fontWeight:600}}>Auto-populated from job data</span>}
                </div>
              </FormField>
              <FormField label="Documentation complete for all jobs?">
                <ToggleGroup value={cAsbDocs} onChange={setCAsbDocs}
                  options={[{ v: 'yes', l: 'Yes — all complete' }, { v: 'gaps', l: 'Some gaps' }, { v: 'not_tracked', l: 'Not tracked' }]} />
              </FormField>
              <FormField label="Clearance certificates obtained?">
                <ToggleGroup value={cAsbClearance} onChange={setCAsbClearance} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }, { v: 'na', l: 'N/A' }]} />
              </FormField>
              <FormField label="Any asbestos complaints or EPA contact?">
                <ToggleGroup value={cAsbComplaints} onChange={setCAsbComplaints} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              {cAsbComplaints === 'yes' && <FormField label="Complaint / EPA contact details">
                <textarea value={cAsbComplaintDetails} onChange={e => setCAsbComplaintDetails(e.target.value)} placeholder="Date, nature of complaint, EPA reference number if applicable, actions taken" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>}
            </SectionBox>

            <SectionBox title="ESG — Waste Diversion" color={B.teal}>
              <FormField label="Tonnes to landfill this month">
                <input type="text" inputMode="decimal" value={esgLandfill} onChange={e => setEsgLandfill(e.target.value)} placeholder="e.g. 12.5" style={{ ...inputStyle, width: 160 }} />
              </FormField>
              <FormField label="Tonnes recycled / diverted from landfill">
                <input type="text" inputMode="decimal" value={esgRecycled} onChange={e => setEsgRecycled(e.target.value)} placeholder="e.g. 8.2" style={{ ...inputStyle, width: 160 }} />
              </FormField>
              <FormField label="Total tonnes diverted (incl. reuse, repurpose)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="text" inputMode="decimal" value={esgDiverted} onChange={e => setEsgDiverted(e.target.value)} placeholder="e.g. 9.0" style={{ ...inputStyle, width: 160 }} />
                  {esgRecycled && !esgDiverted && (
                    <span style={{ fontSize: 11, color: B.teal, fontWeight: 600 }}>Tip: can equal recycled if no other diversion</span>
                  )}
                </div>
              </FormField>
              {(esgLandfill || esgDiverted) && (() => {
                const lf = parseFloat(esgLandfill) || 0;
                const dv = parseFloat(esgDiverted) || parseFloat(esgRecycled) || 0;
                const total = lf + dv;
                const rate = total > 0 ? Math.round(dv / total * 1000) / 10 : 0;
                return (
                  <div style={{ background: B.bg, borderRadius: 8, padding: 12, display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>Diversion Rate</div>
                      <div style={{ fontFamily: fontHead, fontSize: 22, color: rate >= 50 ? B.green : B.amber, fontWeight: 700 }}>{rate}%</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>Total Waste</div>
                      <div style={{ fontFamily: fontHead, fontSize: 22, color: B.textPrimary, fontWeight: 700 }}>{total.toFixed(1)}t</div>
                    </div>
                  </div>
                );
              })()}
            </SectionBox>

            <SectionBox title="Vehicles, Insurance & EPA" color={B.blue}>
              <FormField label="Vehicle registrations due in 90 days">
                <textarea value={cVehicleRegos} onChange={e => setCVehicleRegos(e.target.value)} placeholder={"Vehicle/Rego | Due date\ne.g. Hino 500 XYZ123 | 15/04/2026"} rows={2} style={monoStyle} />
              </FormField>
              <FormField label="Vehicles currently off-road?">
                <ToggleGroup value={cVehiclesOffRoad} onChange={setCVehiclesOffRoad} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              {cVehiclesOffRoad === 'yes' && <FormField label="Which vehicles and why?">
                <textarea value={cVehiclesOffRoadReason} onChange={e => setCVehiclesOffRoadReason(e.target.value)} placeholder="Vehicle / rego, reason off-road, expected return date" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>}
              <FormField label="Fleet inspections completed?">
                <ToggleGroup value={cFleetInspections} onChange={setCFleetInspections} options={[{ v: 'yes', l: 'Yes' }, { v: 'partial', l: 'Partial' }, { v: 'no', l: 'No' }]} />
              </FormField>
              <FormField label="EPA licence status">
                <ToggleGroup value={cEpaStatus} onChange={setCEpaStatus}
                  options={[{ v: 'current', l: 'Current' }, { v: 'renewal_pending', l: 'Renewal pending' }, { v: 'expired', l: 'Expired' }, { v: 'na', l: 'N/A' }]} />
              </FormField>
              {(cEpaStatus === 'current' || cEpaStatus === 'renewal_pending') && (
                <FormField label="EPA licence renewal date">
                  <input type="date" value={cEpaRenewal} onChange={e => setCEpaRenewal(e.target.value)} style={inputStyle} />
                </FormField>
              )}
              <FormField label="Insurance renewal dates">
                <textarea value={cInsurance} onChange={e => setCInsurance(e.target.value)} placeholder={"Policy type | Provider | Expiry date | Premium\ne.g. Public Liability | QBE | 30/06/2026 | $4,200"} rows={3} style={monoStyle} />
              </FormField>
            </SectionBox>
          </div>
        )}

        {/* MARKET STEP */}
        {ws.type === 'market' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionBox title="Business Context" color={B.yellow}>
              <FormField label="Business outlook this month">
                <ToggleGroup value={mOutlook} onChange={setMOutlook}
                  options={[{ v: 'strong', l: 'Strong' }, { v: 'normal', l: 'Normal' }, { v: 'challenging', l: 'Challenging' }, { v: 'uncertain', l: 'Uncertain' }]} />
              </FormField>
              <FormField label="Key wins">
                <textarea value={mKeyWins} onChange={e => setMKeyWins(e.target.value)} placeholder="e.g. Won Scotty's Suburban as a regular account" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>
              <FormField label="Key risks">
                <textarea value={mKeyRisks} onChange={e => setMKeyRisks(e.target.value)} placeholder="e.g. Hearing competitor opened in Dandenong" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </FormField>
            </SectionBox>

            <SectionBox title="Customer Intel" color={B.green}>
              <FormField label="Customers at risk of leaving">
                <textarea value={mCustomersAtRisk} onChange={e => setMCustomersAtRisk(e.target.value)} placeholder={"Customer name | Reason | Last job date\ne.g. ABC Builders | Price complaints | Jan 2026"} rows={2} style={monoStyle} />
              </FormField>
              <FormField label="New customer referral sources this month">
                <MultiToggle values={mReferralSources} onChange={setMReferralSources}
                  options={[{ v: 'google', l: 'Google' }, { v: 'word_of_mouth', l: 'Word of Mouth' }, { v: 'returning', l: 'Returning' }, { v: 'signage', l: 'Signage' }, { v: 'social', l: 'Social Media' }, { v: 'builder_ref', l: 'Builder Referral' }]} />
              </FormField>
            </SectionBox>

            <SectionBox title="Cash Flow Context" color={B.blue}>
              <FormField label="Large payments expected next 30 days">
                <textarea value={mPaymentsExpected} onChange={e => setMPaymentsExpected(e.target.value)} placeholder={"Customer | Amount | Expected date\ne.g. Remeed Solutions | $20,000 | 15/03/2026"} rows={2} style={monoStyle} />
              </FormField>
              <FormField label="Large bills due next 30 days">
                <textarea value={mBillsDue} onChange={e => setMBillsDue(e.target.value)} placeholder={"Supplier | Amount | Due date\ne.g. Cleanaway | $12,000 | 20/03/2026"} rows={2} style={monoStyle} />
              </FormField>
              <FormField label="ATO payment plan status">
                <ToggleGroup value={mAtoStatus} onChange={setMAtoStatus}
                  options={[{ v: 'on_track', l: 'On Track' }, { v: 'behind', l: 'Behind' }, { v: 'under_review', l: 'Under Review' }, { v: 'no_plan', l: 'No Plan' }, { v: 'na', l: 'N/A' }]} />
              </FormField>
              <FormField label="Equipment purchase planned?">
                <ToggleGroup value={mEquipmentPlanned} onChange={setMEquipmentPlanned} options={[{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }]} />
              </FormField>
              {mEquipmentPlanned === 'yes' && <FormField label="Equipment details">
                <input value={mEquipmentDetails} onChange={e => setMEquipmentDetails(e.target.value)} placeholder="Item, estimated cost, timeframe" style={inputStyle} />
              </FormField>}
            </SectionBox>
          </div>
        )}

        {/* REVIEW */}
        {ws.type === 'review' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
              <MiniKPI label="Files Loaded" value={`${Object.keys(files).filter(k => files[k].loaded).length} / 7`} color={B.green} />
              <MiniKPI label="Cash Balance" value={bankBalance ? `$${Number(bankBalance).toLocaleString()}` : (parsed[2]?.cashBalance ? `$${Number(parsed[2].cashBalance).toLocaleString()}` : '—')} color={B.green} />
              <MiniKPI label="Data Quality" value={qUnreconciledCount ? (Number(qUnreconciledCount) < 5 ? 'HIGH' : 'MEDIUM') : 'Not entered'} color={B.amber} />
            </div>
            <div style={{ background: B.bg, borderRadius: 8, padding: 14, marginBottom: 16 }}>
              {wizardSteps.filter(s => s.type === 'upload' || s.type === 'bank').map(s => (
                <div key={s.num} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${B.cardBorder}` }}>
                  <span style={{ fontSize: 12, color: B.textSecondary }}>{s.title}</span>
                  <span style={{ fontSize: 12, color: files[s.num]?.loaded ? B.green : B.red, fontWeight: 600 }}>{files[s.num]?.loaded ? '✓ Loaded' : '✗ Missing'}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onComplete({ files, parsed, selectedMonth, bankBalance, quality: { unreconciledCount: qUnreconciledCount, unreconciledValue: qUnreconciledValue, bankRecStatus: qBankRecStatus, plStatus: qPlStatus, missingInvoices: qMissingInvoices }, compliance: { whsIncidents: cWhsIncidents, whsDetails: cWhsDetails, nearMiss: cNearMiss, nearMissDetails: cNearMissDetails, whsRegister: cWhsRegister, lastToolbox: cLastToolbox, trainingRows: cTrainingRows, certExpiring: cCertExpiring, certExpired: cCertExpired, newStaff: cNewStaff, trainingRegister: cTrainingRegister, asbJobs: cAsbJobs, asbDocs: cAsbDocs, asbClearance: cAsbClearance, asbComplaints: cAsbComplaints, asbComplaintDetails: cAsbComplaintDetails, vehiclesOffRoad: cVehiclesOffRoad, vehiclesOffRoadReason: cVehiclesOffRoadReason, vehicleRegos: cVehicleRegos, fleetInspections: cFleetInspections, epaStatus: cEpaStatus, epaRenewal: cEpaRenewal, insurance: cInsurance }, market: { outlook: mOutlook, keyWins: mKeyWins, keyRisks: mKeyRisks, referralSources: mReferralSources, customersAtRisk: mCustomersAtRisk, paymentsExpected: mPaymentsExpected, billsDue: mBillsDue }, esg: { landfill: esgLandfill, recycled: esgRecycled, diverted: esgDiverted } })}
              style={{ width: '100%', background: B.green, color: B.white, border: 'none', padding: 14, borderRadius: 8, fontFamily: fontHead, fontSize: 16, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>
              ✓ Generate Dashboard
            </button>
          </div>
        )}

        {/* REPORT */}
        {ws.type === 'report' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" style={{ background: B.yellow, color: B.black, border: 'none', padding: '12px 24px', borderRadius: 8, fontFamily: fontHead, fontSize: 14, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>📧 Email Report</button>
              <button type="button" style={{ background: B.cardBg, border: `2px solid ${B.yellow}`, color: B.textPrimary, padding: '12px 24px', borderRadius: 8, fontFamily: fontHead, fontSize: 14, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>🖨️ Print / Save PDF</button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button type="button" onClick={() => step > 0 ? setStep(step - 1) : onHome()}
          style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, color: B.textSecondary, padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: fontHead, fontSize: 13 }}>
          ← {step === 0 ? 'Home' : 'Back'}</button>
        {step < wizardSteps.length - 1 ?
          <button type="button" onClick={() => setStep(step + 1)}
            style={{ background: pc[ws.part], color: B.black, border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: fontHead, fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>Next Step →</button>
          : <button type="button" onClick={() => onComplete({ files, parsed, selectedMonth, bankBalance, quality: { unreconciledCount: qUnreconciledCount, unreconciledValue: qUnreconciledValue, bankRecStatus: qBankRecStatus, plStatus: qPlStatus, missingInvoices: qMissingInvoices }, compliance: { whsIncidents: cWhsIncidents, whsDetails: cWhsDetails, nearMiss: cNearMiss, nearMissDetails: cNearMissDetails, whsRegister: cWhsRegister, lastToolbox: cLastToolbox, trainingRows: cTrainingRows, certExpiring: cCertExpiring, certExpired: cCertExpired, newStaff: cNewStaff, trainingRegister: cTrainingRegister, asbJobs: cAsbJobs, asbDocs: cAsbDocs, asbClearance: cAsbClearance, asbComplaints: cAsbComplaints, asbComplaintDetails: cAsbComplaintDetails, vehiclesOffRoad: cVehiclesOffRoad, vehiclesOffRoadReason: cVehiclesOffRoadReason, vehicleRegos: cVehicleRegos, fleetInspections: cFleetInspections, epaStatus: cEpaStatus, epaRenewal: cEpaRenewal, insurance: cInsurance }, market: { outlook: mOutlook, keyWins: mKeyWins, keyRisks: mKeyRisks, referralSources: mReferralSources, customersAtRisk: mCustomersAtRisk, paymentsExpected: mPaymentsExpected, billsDue: mBillsDue }, esg: { landfill: esgLandfill, recycled: esgRecycled, diverted: esgDiverted } })}
            style={{ background: B.green, color: B.white, border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontFamily: fontHead, fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>✓ View Dashboard</button>
        }
      </div>
    </div>
  );
}
