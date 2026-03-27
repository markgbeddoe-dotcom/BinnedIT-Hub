import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Area } from 'recharts';
import { B, fontHead, fontBody, catColors, fmt, fmtFull, fmtPct } from './theme';
import { KPITile, SectionHeader, ChartCard, AlertItem, CustomTooltip } from './components/UIComponents';
import { saveMonthData, getMonthData, listMonths } from './data/dataStore';
import * as D from './data/financials';
import { defaultWorkPlan } from './data/workplan';
import { generateAlerts } from './data/analysisEngine';
import Wizard from './components/Wizard';
import PricingTab from './components/PricingTab';
import CompetitorPage from './components/CompetitorPage';

const VERSION = '2.0.1';
const BUILD_DATE = '1 March 2026';

const tiles = [
  { id:"dashboard", icon:"📊", title:"View Dashboard", desc:"Current month's data with analysis", sub:"Select month to view", color:B.yellow },
  { id:"generate", icon:"🔧", title:"Generate New", desc:"12-step guided wizard", sub:"Upload files + manual input", color:B.green },
  { id:"update", icon:"📥", title:"Update Existing", desc:"Add latest month's data", sub:"Quick update wizard", color:B.amber },
  { id:"compare", icon:"📈", title:"Compare Months", desc:"Side-by-side comparison", sub:"Any two months", color:B.orange },
  { id:"settings", icon:"⚙️", title:"Settings", desc:"Alert rules, competitors, branding", sub:"Configure thresholds", color:B.textSecondary },
];

const dashTabs = [
  {id:"snapshot",label:"SNAPSHOT"},{id:"revenue",label:"REVENUE"},{id:"margins",label:"MARGINS"},
  {id:"benchmarking",label:"BENCHMARKING"},{id:"competitors",label:"COMPETITORS"},{id:"bdm",label:"BDM"},
  {id:"fleet",label:"FLEET"},{id:"debtors",label:"DEBTORS"},{id:"cashflow",label:"CASH FLOW"},
  {id:"risk",label:"RISK / EPA"},{id:"workplan",label:"WORK PLAN"},
];

const menuItems = [
  {id:'home',icon:'🏠',label:'Home'},{id:'dashboard',icon:'📊',label:'Dashboard'},{id:'history',icon:'📅',label:'Monthly History'},
  {id:'reports',icon:'📄',label:'Reports'},{id:'settings',icon:'⚙️',label:'Settings'},{id:'about',icon:'ℹ️',label:'About'},
];

const availableMonths = [
  {key:'2025-07',label:'Jul 2025'},{key:'2025-08',label:'Aug 2025'},{key:'2025-09',label:'Sep 2025'},
  {key:'2025-10',label:'Oct 2025'},{key:'2025-11',label:'Nov 2025'},{key:'2025-12',label:'Dec 2025'},
  {key:'2026-01',label:'Jan 2026'},{key:'2026-02',label:'Feb 2026'},
];

export default function App() {
  const [screen, setScreen] = useState("home");
  const [dashTab, setDashTab] = useState("snapshot");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const [wizardData, setWizardData] = useState(null);

  // Month index and label available to all components
  const mi = availableMonths.findIndex(m => m.key === selectedMonth);
  const monthCount = mi + 1;
  const selLabel = availableMonths[mi]?.label || 'Feb 2026';

  // Handle wizard completion — save all data to monthly store
  const handleWizardComplete = (data) => {
    const monthKey = data.selectedMonth || selectedMonth;
    // Save to dataStore
    const monthRecord = {
      monthKey,
      status: 'complete',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parsed: data.parsed || {},
      files: data.files || {},
      bankBalance: data.bankBalance,
      quality: data.quality || {},
      compliance: data.compliance || {},
      market: data.market || {},
    };
    saveMonthData(monthKey, monthRecord);
    setWizardData(data);
    setSelectedMonth(monthKey);
    setScreen('dashboard');
    setDashTab('snapshot');
  };
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState([{role:'assistant',text:'Hi Mark! Ask me anything about your dashboard, reports, or business.'}]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const [wpDone, setWpDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem('binnedit_wp_done') || '{}'); } catch { return {}; }
  });

  const alerts = useMemo(() => generateAlerts(), []);
  const goHome = () => { setScreen("home"); setDashTab("snapshot"); setMenuOpen(false); };
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [chatMsgs]);

  const toggleDone = (id) => {
    setWpDone(prev => {
      const next = { ...prev, [id]: prev[id] ? null : { by: 'Mark', at: new Date().toISOString() } };
      localStorage.setItem('binnedit_wp_done', JSON.stringify(next));
      return next;
    });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMsgs(prev => [...prev, {role:'user', text: userMsg}]);
    setChatLoading(true);
    try {
      const ytdRevChat = D.totalRevenue.slice(0,monthCount).reduce((a,b)=>a+b,0);
      const ytdNPChat = D.netProfit.slice(0,monthCount).reduce((a,b)=>a+b,0);
      const ytdGPChat = D.grossProfit.slice(0,monthCount).reduce((a,b)=>a+b,0);
      const sysPrompt = `You are the Binned-IT Dashboard Hub assistant for Mark. Skip bin hire in Seaford Melbourne. FY Jul-Jun.
Viewing: ${selLabel}. YTD (${monthCount} months) Revenue $${Math.round(ytdRevChat).toLocaleString()}, Net Profit $${Math.round(ytdNPChat).toLocaleString()} (${ytdRevChat>0?Math.round(ytdNPChat/ytdRevChat*1000)/10:0}%), GM ${ytdRevChat>0?Math.round(ytdGPChat/ytdRevChat*1000)/10:0}%.
AR: $${Math.round(D.arTotal).toLocaleString()} total, $${Math.round(D.arOverdue).toLocaleString()} overdue.
Bank: $${D.cashBalance[mi].toLocaleString()}.
Keep answers concise, actionable, reference actual numbers.`;
      const history = chatMsgs.slice(1).map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.text}));
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:800, system: sysPrompt,
          messages: [...history, {role:'user', content: userMsg}] })
      });
      const data = await response.json();
      const reply = data.content?.map(c=>c.text||'').join('') || 'Sorry, could not process that.';
      setChatMsgs(prev => [...prev, {role:'assistant', text: reply}]);
    } catch(e) { setChatMsgs(prev => [...prev, {role:'assistant', text:'Connection issue. Please try again.'}]); }
    setChatLoading(false);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  // ===== HEADER =====
  const Header = () => (
    <div style={{background:'#000',borderBottom:`3px solid ${B.yellow}`,
      padding:'12px 24px',display:'flex',alignItems:'center',gap:14,position:'sticky',top:0,zIndex:100}}>
      <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:'none',border:'none',color:'#fff',fontSize:22,cursor:'pointer',padding:'2px 6px',lineHeight:1}}>☰</button>
      <img src="/logo.jpg" alt="Binned-IT" style={{height:38,borderRadius:4}} />
      <div style={{flex:1}}>
        <div style={{fontFamily:fontHead,fontSize:16,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'#fff'}}>Dashboard Hub</div>
        <div style={{fontSize:11,color:'#888'}}>Management Intelligence Platform &middot; v{VERSION}</div>
      </div>
      {screen==='dashboard' && <div style={{background:'#222',borderRadius:6,padding:'4px 8px',display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,color:'#888'}}>Viewing: </span>
        <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setWizardData(null);}} style={{background:'#333',color:B.yellow,border:'1px solid #555',borderRadius:4,padding:'2px 6px',fontSize:12,fontFamily:fontHead,fontWeight:600,cursor:'pointer'}}>
          {availableMonths.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>}
      {screen !== "home" && (
        <button onClick={goHome} style={{background:'none',border:'1px solid #555',color:B.yellow,
          padding:'6px 16px',borderRadius:6,cursor:'pointer',fontFamily:fontHead,fontSize:12,letterSpacing:'0.06em',textTransform:'uppercase'}}>Home</button>
      )}
    </div>
  );

  // ===== HOME =====
  const Home = () => (
    <div style={{maxWidth:900,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{textAlign:'center',marginBottom:40}}>
        <h1 style={{fontFamily:fontHead,fontSize:28,fontWeight:700,color:B.textPrimary,margin:0,letterSpacing:'0.04em'}}>Welcome back, Mark</h1>
        <p style={{color:B.textMuted,fontSize:14,marginTop:8}}>Data: Jul 2025 – {selLabel} ({monthCount} month{monthCount>1?'s':''}) &nbsp;|&nbsp; Last updated: {selLabel}</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
        {tiles.map(t => (
          <button key={t.id} onClick={() => {
            if (t.id==='dashboard') { setScreen('dashboard'); setDashTab('snapshot'); }
            else if (t.id==='generate'||t.id==='update') { setScreen('month-select'); }
            else setScreen(t.id);
          }} style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:14,padding:'28px 24px',
            cursor:'pointer',textAlign:'left',borderLeft:`4px solid ${t.color}`,display:'flex',flexDirection:'column',gap:6,transition:'all 0.2s'}}
            onMouseOver={e=>{e.currentTarget.style.background=B.cardBgHover;e.currentTarget.style.borderColor=t.color}}
            onMouseOut={e=>{e.currentTarget.style.background=B.cardBg;e.currentTarget.style.borderColor=B.cardBorder}}>
            <div style={{fontSize:32}}>{t.icon}</div>
            <div style={{fontFamily:fontHead,fontSize:18,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',letterSpacing:'0.04em'}}>{t.title}</div>
            <div style={{fontSize:13,color:B.textSecondary}}>{t.desc}</div>
            <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>{t.sub}</div>
          </button>
        ))}
      </div>
      {/* Quick Alerts */}
      <div style={{marginTop:32,background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:12,padding:'20px 24px'}}>
        <div style={{fontFamily:fontHead,fontSize:14,color:B.yellow,fontWeight:700,textTransform:'uppercase',marginBottom:12}}>Quick Alerts</div>
        {(alerts.snapshot||[]).concat((alerts.margins||[]).slice(0,2)).slice(0,5).map((a,i) => (
          <AlertItem key={i} severity={a.sev==='positive'?'positive':a.sev==='critical'?'critical':'warning'} text={a.text} />
        ))}
      </div>
    </div>
  );

  // ===== DASHBOARD =====
  const Dashboard = () => {
    // Use parent-level mi, monthCount, selLabel
    const monthSlice = D.months.slice(0, monthCount);

    // Slice all arrays to selected month range
    const slicedRev = D.totalRevenue.slice(0, monthCount);
    const slicedCOS = D.totalCOS.slice(0, monthCount);
    const slicedOpex = D.totalOpex.slice(0, monthCount);
    const slicedGP = D.grossProfit.slice(0, monthCount);
    const slicedNP = D.netProfit.slice(0, monthCount);
    const slicedGM = D.gmPct.slice(0, monthCount);

    // Compute YTD totals for the selected period
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const ytdRev = sum(slicedRev);
    const ytdCOS = sum(slicedCOS);
    const ytdOpex = sum(slicedOpex);
    const ytdGP = sum(slicedGP);
    const ytdNPTotal = sum(slicedNP);
    const ytdGMPct = ytdRev > 0 ? Math.round(ytdGP / ytdRev * 1000) / 10 : 0;
    const ytdNPPct = ytdRev > 0 ? Math.round(ytdNPTotal / ytdRev * 1000) / 10 : 0;

    // Current month values (last in the slice)
    const curRev = slicedRev[mi] || 0;
    const prevRev = mi > 0 ? slicedRev[mi - 1] : 0;
    const curTrend = prevRev > 0 ? Math.round((curRev / prevRev - 1) * 100) : 0;

    // Chart data sliced to selected months
    const monthlyData = monthSlice.map((m, i) => ({ name: m, revenue: D.totalRevenue[i], cos: D.totalCOS[i], gp: D.grossProfit[i], opex: D.totalOpex[i], np: D.netProfit[i], gm: D.gmPct[i] }));
    const revCatData = monthSlice.map((m, i) => ({ name: m, GW: D.revByCategory.generalWaste[i], Asb: D.revByCategory.asbestos[i], Soil: D.revByCategory.soil[i], Green: D.revByCategory.greenWaste[i], Other: D.revByCategory.other[i] }));
    const costData = monthSlice.map((m, i) => ({ name: m, Fuel: D.fuelCosts[i], Wages: D.wages[i], Tolls: D.tolls[i], Repairs: D.repairs[i], Rent: D.rent[i], Advertising: D.advertising[i] }));
    const cashData = monthSlice.map((m, i) => ({ name: m, Income: D.cashIncome[i], Expenses: D.cashExpenses[i], Net: D.cashNetMovement[i], Balance: D.cashBalance[i] }));
    const arChartData = Object.entries(D.arData).map(([k, v]) => ({ name: k, value: v }));
    const arColors = [B.green, B.yellow, B.amber, B.orange, B.red, '#991B1B'];

    const tabAlerts = alerts[dashTab==='benchmarking'?'pricing':dashTab] || [];

    return (
      <div style={{maxWidth:1100,margin:'0 auto',padding:'20px 24px'}}>
        {/* Tab Bar */}
        <div style={{display:'flex',gap:2,overflowX:'auto',marginBottom:20,paddingBottom:2}}>
          {dashTabs.map(t=>(
            <button key={t.id} onClick={()=>setDashTab(t.id)} style={{
              background:dashTab===t.id?B.yellow:'transparent',color:dashTab===t.id?'#0A0A0A':B.textMuted,
              border:'none',padding:'8px 14px',borderRadius:'8px 8px 0 0',cursor:'pointer',
              fontFamily:fontHead,fontSize:11,fontWeight:dashTab===t.id?700:500,letterSpacing:'0.06em',
              whiteSpace:'nowrap',transition:'all 0.15s',borderBottom:dashTab===t.id?`2px solid ${B.yellow}`:'2px solid transparent'
            }}>{t.label}</button>
          ))}
        </div>

        {/* WORK PLAN TAB */}
        {dashTab==='workplan' && <WorkPlanTab />}

        {/* SNAPSHOT TAB */}
        {dashTab==='snapshot' && (<div>
          <SectionHeader title="Commercial Performance Snapshot" subtitle={`FY2026 YTD — Jul 2025 to ${selLabel} (${monthCount} month${monthCount>1?'s':''} accrual)`} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <KPITile label="YTD Revenue" value={fmtFull(ytdRev)} sub={`${monthCount} months`} status="yellow" large />
            <KPITile label="YTD Net Profit" value={fmtFull(ytdNPTotal)} sub={`${ytdNPPct}% margin`} status={ytdNPTotal>0?"green":"red"} large />
            <KPITile label="Gross Margin YTD" value={`${ytdGMPct}%`} sub="Target: >60%" status={ytdGMPct>=60?"green":"red"} large />
            <KPITile label={`${selLabel} Revenue`} value={fmtFull(curRev)} trend={curTrend} status="green" large />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <ChartCard title="Monthly Revenue vs Net Profit">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={(v)=>fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.yellow} name="Revenue" radius={[3,3,0,0]} />
                  <Line dataKey="np" stroke={B.green} strokeWidth={2} name="Net Profit" dot={{fill:B.green,r:3}} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Gross Margin % Trend">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} domain={[50,100]} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<CustomTooltip formatter={(v)=>`${v}%`} />} />
                  <Line dataKey="gm" stroke={B.amber} strokeWidth={2} name="GM%" dot={{fill:B.amber,r:4}} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          {/* Balance Sheet Summary */}
          <div style={{marginBottom:12,marginTop:4}}>
            <h3 style={{fontSize:16,fontWeight:700,color:B.textPrimary,margin:0,fontFamily:fontHead,textTransform:'uppercase'}}>Balance Sheet Highlights</h3>
            <p style={{fontSize:12,color:B.textSecondary,margin:'2px 0 0'}}>Key positions from latest Xero balance sheet</p>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
            <KPITile label="Total Assets" value={fmtFull(D.balanceSheet.totalAssets)} status="green" />
            <KPITile label="Total Liabilities" value={fmtFull(D.balanceSheet.totalLiabilities)} status="red" />
            <KPITile label="Net Equity" value={fmtFull(D.balanceSheet.equity.total)} status={D.balanceSheet.equity.total<0?"red":"green"} />
            <KPITile label="Bank Balance (Xero)" value={fmtFull(D.balanceSheet.bankBalance)} status="amber" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
            <KPITile label="GST Liability" value={fmtFull(D.balanceSheet.gst)} status="red" />
            <KPITile label="PAYG Withholding" value={fmtFull(D.balanceSheet.paygWithholding)} status="red" />
            <KPITile label="ATO Clearing" value={fmtFull(D.balanceSheet.atoClearing)} sub="Credit balance" status="green" />
            <KPITile label="Director Loans" value={fmtFull(D.balanceSheet.directorLoans.total)} status="amber" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            <KPITile label="Total Loans Outstanding" value={fmtFull(D.balanceSheet.loans.total)} status="red" />
            <KPITile label="Fixed Assets" value={fmtFull(D.balanceSheet.fixedAssets.total)} sub="Trucks, bins, equipment" status="green" />
            <KPITile label="Current Year Earnings" value={fmtFull(D.balanceSheet.equity.currentYearEarnings)} status={D.balanceSheet.equity.currentYearEarnings>0?"green":"red"} />
          </div>
        </div>)}

        {/* REVENUE TAB */}
        {dashTab==='revenue' && (<div>
          <SectionHeader title="Revenue Analysis" subtitle={`Revenue by category and trend — YTD to ${selLabel}`} />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <ChartCard title="Revenue by Category (Monthly)">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revCatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="GW" stackId="a" fill={B.yellow} name="General Waste" />
                  <Bar dataKey="Asb" stackId="a" fill={B.orange} name="Asbestos" />
                  <Bar dataKey="Soil" stackId="a" fill="#8B6914" name="Soil" />
                  <Bar dataKey="Green" stackId="a" fill={B.green} name="Green Waste" />
                  <Bar dataKey="Other" stackId="a" fill={B.purple} name="Other" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Revenue Mix YTD">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={[
                    {name:'General Waste',value:D.revByCategory.generalWaste.reduce((a,b)=>a+b,0)},
                    {name:'Asbestos',value:D.revByCategory.asbestos.reduce((a,b)=>a+b,0)},
                    {name:'Soil',value:D.revByCategory.soil.reduce((a,b)=>a+b,0)},
                    {name:'Green Waste',value:D.revByCategory.greenWaste.reduce((a,b)=>a+b,0)},
                    {name:'Other',value:D.revByCategory.other.reduce((a,b)=>a+b,0)},
                  ]} cx="50%" cy="50%" outerRadius={100} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {[B.yellow,B.orange,'#8B6914',B.green,B.purple].map((c,i)=><Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={v=>fmtFull(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>)}

        {/* MARGINS TAB */}
        {dashTab==='margins' && (<div>
          <SectionHeader title="Margin & Cost Analysis" subtitle={`COS, operating expenses, and cost drivers — YTD to ${selLabel}`} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <KPITile label={`${selLabel} COS`} value={fmtFull(slicedCOS[mi])} sub={mi===7?"! Likely incomplete":""} status={mi===7?"red":"yellow"} />
            <KPITile label="Avg Monthly COS" value={fmtFull(sum(slicedCOS)/monthCount)} status="yellow" />
            <KPITile label={`${selLabel} Opex`} value={fmtFull(slicedOpex[mi])} trend={mi>0?Math.round((slicedOpex[mi]/slicedOpex[mi-1]-1)*100):0} status="green" />
            <KPITile label={`${selLabel} Fuel`} value={fmtFull(D.fuelCosts[mi])} sub={mi===7?"! Appears unposted":""} status={mi===7?"red":"yellow"} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <ChartCard title="Monthly COS vs Operating Expenses">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="cos" fill={B.red} name="COS" radius={[3,3,0,0]} />
                  <Bar dataKey="opex" fill={B.amber} name="Opex" radius={[3,3,0,0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Cost Drivers (Monthly)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Line dataKey="Wages" stroke={B.yellow} strokeWidth={2} />
                  <Line dataKey="Fuel" stroke={B.red} strokeWidth={2} />
                  <Line dataKey="Repairs" stroke={B.orange} strokeWidth={2} />
                  <Line dataKey="Rent" stroke={B.blue} strokeWidth={2} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>)}


        {/* BENCHMARKING TAB */}
        {dashTab==='benchmarking' && <PricingTab monthIndex={mi} monthLabel={selLabel} />}

        {/* COMPETITORS TAB */}
        {dashTab==='competitors' && <CompetitorPage onBack={()=>setDashTab('snapshot')} />}

        {/* BDM TAB */}
        {dashTab==='bdm' && (<div>
          <SectionHeader title="Business Development" subtitle="New customers, dormant accounts, pipeline" />
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            <KPITile label={`New Customers (${selLabel})`} value={D.newCustomersFeb.length} status="green" />
            <KPITile label="Dormant (90+ days)" value={D.dormantCustomers.length} status="red" />
            <KPITile label="Net Movement" value={`${D.newCustomersFeb.length - D.dormantCustomers.length}`} status="red" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ChartCard title={`New Customers — ${selLabel} (${D.newCustomersFeb.length})`}>
              <ResponsiveContainer width="100%" height={Math.max(180, D.newCustomersFeb.length * 40)}>
                <BarChart data={[...D.newCustomersFeb].sort((a,b)=>b.revenue-a.revenue)} layout="vertical" margin={{left:10,right:20,top:5,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>'$'+Math.round(v/1000)+'k'} />
                  <YAxis type="category" dataKey="name" tick={{fill:B.textSecondary,fontSize:10}} width={120} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.green} name="Revenue" radius={[0,4,4,0]} barSize={20}>
                    {D.newCustomersFeb.map((c,i)=><Cell key={i} fill={c.type==='Commercial'?B.green:c.type==='Builder'?B.blue:c.type==='Industrial'?B.cyan:B.amber} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:12,marginTop:8,flexWrap:'wrap',justifyContent:'center'}}>
                {[{l:'Commercial',c:B.green},{l:'Builder',c:B.blue},{l:'Industrial',c:B.cyan},{l:'Domestic',c:B.amber}].map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:t.c}} />
                    <span style={{fontSize:9,color:B.textMuted}}>{t.l}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
            <ChartCard title={`Dormant Accounts (${D.dormantCustomers.length})`}>
              <ResponsiveContainer width="100%" height={Math.max(180, Math.min(D.dormantCustomers.length, 10) * 40)}>
                <BarChart data={[...D.dormantCustomers].sort((a,b)=>b.totalYTD-a.totalYTD).slice(0,10)} layout="vertical" margin={{left:10,right:20,top:5,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>'$'+Math.round(v/1000)+'k'} />
                  <YAxis type="category" dataKey="name" tick={{fill:B.textSecondary,fontSize:10}} width={120} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="totalYTD" fill={B.red} name="YTD Revenue (Lost)" radius={[0,4,4,0]} barSize={20} opacity={0.7}>
                    {D.dormantCustomers.map((c,i)=><Cell key={i} fill={c.aging==='Older'?B.red:B.orange} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:12,marginTop:8,justifyContent:'center'}}>
                {[{l:'90+ days',c:B.orange},{l:'6+ months',c:B.red}].map((t,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:8,height:8,borderRadius:2,background:t.c}} />
                    <span style={{fontSize:9,color:B.textMuted}}>{t.l}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </div>)}

        {/* FLEET TAB */}
        {dashTab==='fleet' && (<div>
          <SectionHeader title="Fleet & Utilisation" subtitle={`Bin type performance — ${selLabel}`} />
          <ChartCard title={`Top Earning Bin Types (${selLabel})`}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={D.binTypesData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis type="number" tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{fill:B.textSecondary,fontSize:11}} width={100} />
                <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                <Bar dataKey="income" fill={B.yellow} name="Income" radius={[0,3,3,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>)}

        {/* DEBTORS TAB */}
        {dashTab==='debtors' && (<div>
          <SectionHeader title="Debtors & AR Aging" subtitle={`Who owes money and how overdue — as at ${selLabel}`} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <KPITile label="Total AR" value={fmtFull(D.arTotal)} status="yellow" />
            <KPITile label="Current" value={fmtFull(D.arData.Current)} sub={`${(D.arData.Current/D.arTotal*100).toFixed(0)}%`} status="green" />
            <KPITile label="Overdue" value={fmtFull(D.arOverdue)} sub={`${(D.arOverdue/D.arTotal*100).toFixed(0)}%`} status="red" />
            <KPITile label="Older (90+ days)" value={fmtFull(D.arData.Older)} status="red" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <ChartCard title="AR Aging Breakdown">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={arChartData} cx="50%" cy="50%" outerRadius={90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {arColors.map((c,i)=><Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={v=>fmtFull(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Top 10 Debtors (by aging)">
              <ResponsiveContainer width="100%" height={Math.max(250, D.topDebtors.length * 35)}>
                <BarChart data={D.topDebtors} layout="vertical" margin={{left:10,right:20,top:5,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>'$'+Math.round(v/1000)+'k'} />
                  <YAxis type="category" dataKey="name" tick={{fill:B.textSecondary,fontSize:9}} width={110} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Legend wrapperStyle={{fontSize:10}} />
                  <Bar dataKey="current" stackId="a" fill={B.green} name="Current" barSize={18} />
                  <Bar dataKey="under1m" stackId="a" fill={B.amber} name="<30 days" />
                  <Bar dataKey="m1" stackId="a" fill={B.orange} name="30-60" />
                  <Bar dataKey="m2" stackId="a" fill="#E07050" name="60-90" />
                  <Bar dataKey="m3" stackId="a" fill={B.red} name="90+" />
                  <Bar dataKey="older" stackId="a" fill="#8B3040" name="120+" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>)}

        {/* CASH FLOW TAB */}
        {dashTab==='cashflow' && (<div>
          <SectionHeader title="Cash Flow & Projections" subtitle={`Cash basis performance — YTD to ${selLabel}`} />
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <KPITile label="True Cash (Westpac)" value="$99,334" status="green" large />
            <KPITile label="YTD Cash Net" value={fmtFull(D.cashNetMovement.slice(0,monthCount).reduce((a,b)=>a+b,0))} status="green" />
            <KPITile label="Monthly Loan Payments" value={fmtFull(D.monthlyLoanRepayments)} status="amber" />
            <KPITile label="Annual Debt Service" value={fmtFull(D.annualDebtService)} status="amber" />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            <ChartCard title="Cash In vs Cash Out (Monthly)">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={cashData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="Income" fill={B.green} name="Cash In" radius={[3,3,0,0]} />
                  <Bar dataKey="Expenses" fill={B.red} name="Cash Out" radius={[3,3,0,0]} />
                  <Line dataKey="Balance" stroke={B.yellow} strokeWidth={2} name="Running Balance" dot={{fill:B.yellow,r:3}} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="6-Month Cash Projection">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  {name:'Mar',projected:108000},{name:'Apr',projected:115000},{name:'May',projected:105000},
                  {name:'Jun',projected:95000},{name:'Jul',projected:82000},{name:'Aug',projected:71000}
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{fill:B.textMuted,fontSize:11}} />
                  <YAxis tick={{fill:B.textMuted,fontSize:10}} tickFormatter={v=>fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v=>fmtFull(v)} />} />
                  <Bar dataKey="projected" name="Projected Balance" radius={[3,3,0,0]}>
                    {[B.green,B.green,B.green,B.green,B.amber,B.amber].map((c,i)=><Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>)}

        {/* RISK TAB */}
        {dashTab==='risk' && (()=>{
          // Load compliance data from wizard or dataStore
          const stored = getMonthData(selectedMonth);
          const comp = wizardData?.compliance || stored?.compliance || {};
          const qual = wizardData?.quality || stored?.quality || {};
          const mkt = wizardData?.market || stored?.market || {};
          const monthLabel = availableMonths.find(m=>m.key===selectedMonth)?.label || selectedMonth;
          return (<div>
          <SectionHeader title="Risk, EPA & Compliance" subtitle={`Regulated waste, WHS, training and business risk — ${monthLabel}`} />

          {/* Top 3 category cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {[{t:'ASBESTOS',c:B.amber,items:[
                ['YTD Revenue',fmtFull(D.revByCategory.asbestos.reduce((a,b)=>a+b,0))],
                ['Jobs This Month', comp.asbJobs || 'Not entered', comp.asbJobs ? B.textPrimary : B.red],
                ['Documentation', comp.asbDocs==='yes'?'All complete':comp.asbDocs==='gaps'?'Some gaps':'Not tracked', comp.asbDocs==='yes'?B.green:B.red],
                ['Clearance Certs', comp.asbClearance==='yes'?'Obtained':comp.asbClearance==='no'?'Missing':'N/A', comp.asbClearance==='yes'?B.green:comp.asbClearance==='no'?B.red:B.textMuted],
                ['Complaints/EPA', comp.asbComplaints==='yes'?'YES — SEE DETAILS':comp.asbComplaints==='no'?'None':'Not recorded', comp.asbComplaints==='yes'?B.red:B.green],
              ]},
              {t:'CONTAMINATED SOIL',c:B.orange,items:[
                ['YTD Revenue',fmtFull(D.revByCategory.soil.reduce((a,b)=>a+b,0))],
                ['Tip Receipts','NEEDS VERIFICATION',B.amber],
              ]},
              {t:'WHS & SAFETY',c:B.red,items:[
                ['Incidents', comp.whsIncidents==='yes'?'YES — SEE DETAILS':comp.whsIncidents==='no'?'None reported':'Not recorded', comp.whsIncidents==='yes'?B.red:B.green],
                ['Near Misses', comp.nearMiss==='yes'?'YES — SEE DETAILS':comp.nearMiss==='no'?'None reported':'Not recorded', comp.nearMiss==='yes'?B.amber:B.green],
                ['WHS Register', comp.whsRegister==='yes'?'Current':comp.whsRegister==='partial'?'Partial':comp.whsRegister==='not_started'?'Does not exist':'Not current', comp.whsRegister==='yes'?B.green:B.red],
                ['Last Toolbox', comp.lastToolbox || 'Not recorded', comp.lastToolbox?B.textPrimary:B.red],
              ]},
            ].map(card=>(
              <div key={card.t} style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:'18px 20px'}}>
                <div style={{fontSize:14,fontWeight:800,color:card.c,marginBottom:14,fontFamily:fontHead}}>{card.t}</div>
                {card.items.map(([l,v,col],i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${B.cardBorder}`}}>
                    <span style={{fontSize:12,color:B.textSecondary}}>{l}</span>
                    <span style={{fontSize:12,fontWeight:700,color:col||B.textPrimary}}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Compliance detail sections */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
            {/* Training & Certifications */}
            <ChartCard title="Training & Certifications">
              <div style={{fontSize:12,color:B.textSecondary,marginBottom:8}}>
                <strong>Register Status:</strong> <span style={{color:comp.trainingRegister==='yes'?B.green:B.red}}>{comp.trainingRegister==='yes'?'Current':comp.trainingRegister==='partial'?'Partially complete':comp.trainingRegister==='not_started'?'Does not exist':'Not current'}</span>
              </div>
              {comp.trainingRows && comp.trainingRows.length > 0 && comp.trainingRows[0].name !== 'NA' ? (
                <div>
                  <div style={{fontSize:11,color:B.textMuted,marginBottom:4}}>Completed this month:</div>
                  {comp.trainingRows.map((r,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1fr 0.7fr 0.5fr',gap:4,padding:'3px 0',borderBottom:`1px solid ${B.cardBorder}22`,fontSize:11}}>
                      <span style={{color:B.textPrimary}}>{r.name}</span>
                      <span style={{color:B.textSecondary}}>{r.type}</span>
                      <span style={{color:B.textMuted}}>{r.date}</span>
                      <span style={{color:r.evidence==='Y'||r.evidence==='y'?B.green:B.red}}>{r.evidence}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{fontSize:11,color:B.textMuted,fontStyle:'italic'}}>No training recorded this month</div>}
              {comp.certExpiring && <div style={{marginTop:8,fontSize:11,color:B.amber}}>Expiring soon: {comp.certExpiring}</div>}
              {comp.certExpired==='yes' && <div style={{marginTop:4,fontSize:11,color:B.red,fontWeight:600}}>⚠ EXPIRED certifications exist</div>}
              {comp.newStaff && <div style={{marginTop:8,fontSize:11,color:B.textSecondary}}>New staff: {comp.newStaff}</div>}
            </ChartCard>

            {/* Licensing & EPA */}
            <ChartCard title="Licensing, EPA & Insurance">
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${B.cardBorder}22`}}>
                  <span style={{fontSize:12,color:B.textSecondary}}>EPA Licence</span>
                  <span style={{fontSize:12,fontWeight:600,color:comp.epaStatus==='current'?B.green:comp.epaStatus==='expired'?B.red:B.amber}}>{comp.epaStatus==='current'?'Current':comp.epaStatus==='expired'?'EXPIRED':comp.epaStatus==='renewal_due'?'Renewal due':'Not recorded'}</span>
                </div>
                {comp.epaRenewal && <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${B.cardBorder}22`}}>
                  <span style={{fontSize:12,color:B.textSecondary}}>EPA Renewal Date</span>
                  <span style={{fontSize:12,color:B.textPrimary}}>{comp.epaRenewal}</span>
                </div>}
                <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${B.cardBorder}22`}}>
                  <span style={{fontSize:12,color:B.textSecondary}}>Insurance</span>
                  <span style={{fontSize:12,color:comp.insurance?B.textPrimary:B.red}}>{comp.insurance || 'Not recorded'}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${B.cardBorder}22`}}>
                  <span style={{fontSize:12,color:B.textSecondary}}>Fleet Inspections</span>
                  <span style={{fontSize:12,fontWeight:600,color:comp.fleetInspections==='yes'?B.green:B.red}}>{comp.fleetInspections==='yes'?'Current':'Overdue / Not done'}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${B.cardBorder}22`}}>
                  <span style={{fontSize:12,color:B.textSecondary}}>Vehicles Off-Road</span>
                  <span style={{fontSize:12,color:comp.vehiclesOffRoad==='yes'?B.red:B.green}}>{comp.vehiclesOffRoad==='yes'?'Yes':'None'}</span>
                </div>
                {comp.vehiclesOffRoad==='yes' && comp.vehiclesOffRoadReason && <div style={{fontSize:11,color:B.red,padding:'4px 0'}}>{comp.vehiclesOffRoadReason}</div>}
              </div>
            </ChartCard>
          </div>

          {/* Incident details if any */}
          {(comp.whsIncidents==='yes' || comp.nearMiss==='yes' || comp.asbComplaints==='yes') && (
            <ChartCard title="Incident & Complaint Details">
              {comp.whsIncidents==='yes' && comp.whsDetails && <div style={{marginBottom:8}}><div style={{fontSize:11,color:B.red,fontWeight:600}}>WHS Incident:</div><div style={{fontSize:12,color:B.textSecondary}}>{comp.whsDetails}</div></div>}
              {comp.nearMiss==='yes' && comp.nearMissDetails && <div style={{marginBottom:8}}><div style={{fontSize:11,color:B.amber,fontWeight:600}}>Near Miss:</div><div style={{fontSize:12,color:B.textSecondary}}>{comp.nearMissDetails}</div></div>}
              {comp.asbComplaints==='yes' && comp.asbComplaintDetails && <div><div style={{fontSize:11,color:B.red,fontWeight:600}}>Asbestos Complaint / EPA Contact:</div><div style={{fontSize:12,color:B.textSecondary}}>{comp.asbComplaintDetails}</div></div>}
            </ChartCard>
          )}

          {/* Data Quality Notes */}
          {(qual.bankRecStatus || qual.plStatus || qual.missingInvoices) && (
            <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:'16px 20px',marginTop:12}}>
              <div style={{fontFamily:fontHead,fontSize:12,color:B.textMuted,fontWeight:700,textTransform:'uppercase',marginBottom:8}}>Data Quality Notes</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,fontSize:12}}>
                {qual.bankRecStatus && <div><span style={{color:B.textMuted}}>Bank Rec: </span><span style={{color:qual.bankRecStatus==='reconciled'?B.green:B.red}}>{qual.bankRecStatus}</span></div>}
                {qual.plStatus && <div><span style={{color:B.textMuted}}>P&L Status: </span><span>{qual.plStatus}</span></div>}
                {qual.unreconciledCount && <div><span style={{color:B.textMuted}}>Unreconciled: </span><span style={{color:B.red}}>{qual.unreconciledCount} items ({qual.unreconciledValue})</span></div>}
              </div>
            </div>
          )}
        </div>);
        })()}

        {/* ALERTS PANEL (all tabs except workplan) */}
        {dashTab!=='workplan' && tabAlerts.length > 0 && (
          <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:'16px 20px',marginTop:20}}>
            <div style={{fontFamily:fontHead,fontSize:13,color:B.yellow,fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Recommended Actions</div>
            {tabAlerts.map((a,i) => <AlertItem key={i} severity={a.sev==='critical'?'critical':a.sev==='warning'?'warning':a.sev==='info'?'info':'positive'} text={a.text} />)}
          </div>
        )}
      </div>
    );
  };

  // ===== WORK PLAN TAB =====
  const WorkPlanTab = () => (
    <div>
      <SectionHeader title="Work Plan" subtitle="Prioritised by: Growth first → Cash → Compliance → Data → Systems → Strategy" />
      {[{title:"THIS WEEK",color:B.red,items:defaultWorkPlan.thisWeek},
        {title:"THIS MONTH",color:B.amber,items:defaultWorkPlan.thisMonth},
        {title:"THIS QUARTER",color:B.textMuted,items:defaultWorkPlan.thisQuarter},
      ].map((section,si)=>(
        <div key={si} style={{marginBottom:20}}>
          <div style={{fontFamily:fontHead,fontSize:13,color:section.color,fontWeight:700,textTransform:'uppercase',marginBottom:10,letterSpacing:'0.06em'}}>
            {section.title} ({section.items.filter(it=>!wpDone[it.id]).length} open, {section.items.filter(it=>wpDone[it.id]).length} done)
          </div>
          {section.items.map(item => {
            const done = wpDone[item.id];
            return (
              <div key={item.id} style={{background:done?`${B.green}08`:B.cardBg,border:`1px solid ${done?`${B.green}33`:B.cardBorder}`,borderRadius:10,padding:'14px 16px',marginBottom:8,borderLeft:`4px solid ${done?B.green:section.color}`,opacity:done?0.6:1,transition:'all 0.2s'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontFamily:fontHead,fontSize:16,color:section.color,fontWeight:700}}>#{item.id}</span>
                      <span style={{fontSize:13,color:done?B.textMuted:B.textPrimary,fontWeight:600,textDecoration:done?'line-through':'none'}}>{item.action}</span>
                    </div>
                    <div style={{fontSize:11,color:B.textMuted,marginTop:4}}>{item.why}</div>
                    <div style={{display:'flex',gap:12,marginTop:6}}>
                      <span style={{fontSize:10,color:B.yellow,background:`${B.yellow}15`,padding:'2px 8px',borderRadius:4}}>{item.owner}</span>
                      <span style={{fontSize:10,color:B.textMuted}}>{item.effort}</span>
                      <span style={{fontSize:10,color:B.textMuted}}>Area: {item.area}</span>
                      {done && <span style={{fontSize:10,color:B.green}}>[OK] Done by {done.by}  -  {new Date(done.at).toLocaleDateString('en-AU')}</span>}
                    </div>
                  </div>
                  <button onClick={()=>toggleDone(item.id)}
                    style={{background:done?B.green:'none',border:`2px solid ${done?B.green:B.cardBorder}`,borderRadius:6,width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:done?'#0A0A0A':B.textMuted,fontSize:14,fontWeight:700}}>
                    {done?'[OK]':''}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );


  // ===== SIDE MENU =====
  const SideMenu = () => (<>
    {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:200}} />}
    <div style={{position:'fixed',top:0,left:menuOpen?0:-280,width:280,height:'100vh',background:B.cardBg,zIndex:201,transition:'left 0.25s ease',boxShadow:menuOpen?'4px 0 20px rgba(0,0,0,0.15)':'none',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#000',padding:'20px',borderBottom:`3px solid ${B.yellow}`}}>
        <div style={{fontFamily:fontHead,fontSize:18,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Binned-IT</div>
        <div style={{fontSize:11,color:'#888',marginTop:2}}>Dashboard Hub v{VERSION}</div>
      </div>
      <div style={{flex:1,padding:'12px 0',overflowY:'auto'}}>
        {menuItems.map(item => (
          <button key={item.id} onClick={()=>{
            if(item.id==='home')goHome(); else if(item.id==='dashboard'){setScreen('dashboard');setDashTab('snapshot');setMenuOpen(false);}
            else {setScreen(item.id);setMenuOpen(false);}
          }} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:'none',border:'none',cursor:'pointer',fontSize:14,color:B.textPrimary,textAlign:'left'}}
            onMouseOver={e=>e.currentTarget.style.background=B.bg} onMouseOut={e=>e.currentTarget.style.background='none'}>
            <span style={{fontSize:18}}>{item.icon}</span><span style={{fontFamily:fontHead,fontWeight:500}}>{item.label}</span>
          </button>
        ))}
      </div>
      <div style={{padding:'16px 20px',borderTop:`1px solid ${B.cardBorder}`,fontSize:10,color:B.textMuted}}>v{VERSION} - Published {BUILD_DATE}</div>
    </div>
  </>);

  // ===== CHATBOT =====
  const ChatBot = () => (<>
    <button onClick={()=>setChatOpen(!chatOpen)} style={{position:'fixed',bottom:24,right:24,width:56,height:56,borderRadius:'50%',background:B.yellow,border:'none',cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,zIndex:150,color:'#fff'}}>{chatOpen?'✕':'💬'}</button>
    {chatOpen && (
      <div style={{position:'fixed',bottom:90,right:24,width:380,maxWidth:'calc(100vw - 48px)',height:480,maxHeight:'60vh',background:B.cardBg,borderRadius:14,boxShadow:'0 8px 32px rgba(0,0,0,0.2)',display:'flex',flexDirection:'column',zIndex:150,overflow:'hidden',border:`1px solid ${B.cardBorder}`}}>
        <div style={{background:'#000',padding:'14px 16px',borderBottom:`2px solid ${B.yellow}`}}>
          <div style={{fontFamily:fontHead,fontSize:14,fontWeight:700,color:'#fff',textTransform:'uppercase'}}>Binned-IT Assistant</div>
          <div style={{fontSize:10,color:'#888'}}>Powered by Claude</div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:8}}>
          {chatMsgs.map((m,i)=>(<div key={i} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'85%',background:m.role==='user'?B.yellow:B.bg,color:m.role==='user'?'#fff':B.textPrimary,borderRadius:12,padding:'10px 14px',fontSize:13,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{m.text}</div>))}
          {chatLoading && <div style={{alignSelf:'flex-start',background:B.bg,borderRadius:12,padding:'10px 14px',fontSize:13,color:B.textMuted}}>Thinking...</div>}
          <div ref={chatEndRef} />
        </div>
        <div style={{padding:'10px 12px',borderTop:`1px solid ${B.cardBorder}`,display:'flex',gap:8}}>
          <input ref={chatInputRef} value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}}
            placeholder="Ask about your business..." style={{flex:1,background:B.bg,border:`1px solid ${B.cardBorder}`,borderRadius:8,padding:'8px 12px',fontSize:13,color:B.textPrimary,outline:'none',fontFamily:fontBody}} />
          <button onClick={sendChat} disabled={chatLoading} style={{background:B.yellow,border:'none',borderRadius:8,padding:'8px 14px',cursor:chatLoading?'wait':'pointer',fontFamily:fontHead,fontSize:12,fontWeight:700,color:'#fff'}}>Send</button>
        </div>
      </div>
    )}
  </>);

  // ===== HISTORY SCREEN =====
  const HistoryScreen = () => (
    <div style={{maxWidth:700,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:20}}>Monthly History</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {availableMonths.map((m,mi) => {
          const hasData = mi < D.months.length;
          return (<button key={m.key} onClick={()=>{setSelectedMonth(m.key);setScreen('dashboard');setDashTab('snapshot');}}
            style={{background:B.cardBg,border:`2px solid ${hasData?B.green:B.cardBorder}`,borderRadius:10,padding:'16px 12px',cursor:'pointer',textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{fontFamily:fontHead,fontSize:14,fontWeight:700,color:B.textPrimary}}>{m.label}</div>
            <div style={{fontSize:10,color:hasData?B.green:B.textMuted,marginTop:4,fontWeight:600}}>{hasData?'Complete':'No data'}</div>
            {hasData && <div style={{fontSize:11,color:B.textSecondary,marginTop:4}}>{fmtFull(D.totalRevenue[mi])} rev</div>}
          </button>);
        })}
      </div>
    </div>
  );

  // ===== REPORTS SCREEN =====
  const ReportsScreen = () => (
    <div style={{maxWidth:700,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:20}}>Reports</div>
      {[{title:'Monthly Management Report',desc:'Full month summary with P&L, KPIs, and recommendations',icon:'📊'},
        {title:'Profitability by Bin Type',desc:'Detailed cost allocation and margin analysis',icon:'🗑️'},
        {title:'Training Register',desc:'Staff training records, certifications, and expiry tracking',icon:'📋'},
        {title:'Incident Register',desc:'WHS incidents, near-misses, and corrective actions',icon:'⚠️'},
        {title:'Cash Flow Forecast',desc:'6-month rolling projection based on trends',icon:'💰'},
        {title:'Balance Sheet Analysis',desc:'Asset, liability, and equity movements',icon:'🏦'},
      ].map((r,i)=>(<div key={i} style={{background:B.cardBg,borderRadius:10,padding:'16px 20px',marginBottom:10,display:'flex',alignItems:'center',gap:14,border:`1px solid ${B.cardBorder}`,opacity:0.7}}>
        <span style={{fontSize:24}}>{r.icon}</span>
        <div style={{flex:1}}><div style={{fontFamily:fontHead,fontSize:14,fontWeight:600,color:B.textPrimary}}>{r.title}</div><div style={{fontSize:12,color:B.textMuted,marginTop:2}}>{r.desc}</div></div>
        <span style={{fontSize:10,color:B.textMuted,fontFamily:fontHead,textTransform:'uppercase'}}>Coming Soon</span>
      </div>))}
    </div>
  );

  // ===== SETTINGS SCREEN =====
  const SettingsScreen = () => (
    <div style={{maxWidth:600,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:20}}>Settings</div>
      {[{title:'Financial Year',desc:'Currently Jul 2025 – Jun 2026',icon:'📅'},
        {title:'Alert Thresholds',desc:'Customise when warnings trigger',icon:'⚠️'},
        {title:'Data Sources',desc:'Xero, Bin Manager, Westpac connections',icon:'🔗'},
        {title:'User Preferences',desc:'Display, notifications, defaults',icon:'👤'},
        {title:'Export & Backup',desc:'Download data or create backup',icon:'💾'},
      ].map((s,i)=>(<div key={i} style={{background:B.cardBg,borderRadius:10,padding:'16px 20px',marginBottom:10,display:'flex',alignItems:'center',gap:14,border:`1px solid ${B.cardBorder}`}}>
        <span style={{fontSize:24}}>{s.icon}</span>
        <div><div style={{fontFamily:fontHead,fontSize:14,fontWeight:600,color:B.textPrimary}}>{s.title}</div><div style={{fontSize:12,color:B.textMuted,marginTop:2}}>{s.desc}</div></div>
      </div>))}
    </div>
  );

  // ===== ABOUT SCREEN =====
  const AboutScreen = () => (
    <div style={{maxWidth:600,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{background:B.cardBg,borderRadius:14,padding:32,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',textAlign:'center'}}>
        <div style={{fontFamily:fontHead,fontSize:24,fontWeight:700,color:B.textPrimary,textTransform:'uppercase'}}>Binned-IT Dashboard Hub</div>
        <div style={{fontSize:14,color:B.textSecondary,marginTop:8}}>Management Intelligence Platform</div>
        <div style={{marginTop:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,textAlign:'left'}}>
          {[{l:'Version',v:VERSION},{l:'Published',v:BUILD_DATE},{l:'Data Range',v:'Jul 2025 - Feb 2026'},{l:'Months Loaded',v:'8'},{l:'Platform',v:'React + Vite'},{l:'AI Assistant',v:'Claude (Anthropic)'}].map((r,i)=>(
            <div key={i} style={{padding:'8px 12px',background:B.bg,borderRadius:6}}>
              <div style={{fontSize:10,color:B.textMuted,textTransform:'uppercase'}}>{r.l}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textPrimary,marginTop:2}}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{background:B.bg,minHeight:'100vh',color:B.textPrimary,fontFamily:fontBody}}>
      <Header />
      <SideMenu />
      {screen==='home' && <Home />}
      {screen==='month-select' && (
        <div style={{maxWidth:600,margin:'0 auto',padding:'40px 24px'}}>
          <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:8}}>Select Month</div>
          <p style={{fontSize:13,color:B.textSecondary,marginBottom:24}}>Which month are you loading data for?</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
            {availableMonths.map(m => {
              const isCurrent = m.key === selectedMonth;
              return (
                <button key={m.key} onClick={()=>{setSelectedMonth(m.key);setScreen('wizard');}}
                  style={{background:isCurrent?B.yellow:B.cardBg,color:isCurrent?'#000':B.textPrimary,border:'1px solid '+(isCurrent?B.yellow:B.cardBorder),
                  borderRadius:10,padding:'16px 12px',cursor:'pointer',fontFamily:fontHead,fontSize:14,fontWeight:600,textAlign:'center',transition:'all 0.15s'}}
                  onMouseOver={e=>{if(!isCurrent){e.currentTarget.style.background=B.bg;e.currentTarget.style.borderColor=B.yellow}}}
                  onMouseOut={e=>{if(!isCurrent){e.currentTarget.style.background=B.cardBg;e.currentTarget.style.borderColor=B.cardBorder}}}>
                  {m.label}
                </button>
              );
            })}
          </div>
          <button onClick={goHome} style={{marginTop:24,background:'none',border:'1px solid '+B.cardBorder,borderRadius:8,padding:'10px 20px',cursor:'pointer',fontSize:13,color:B.textSecondary,fontFamily:fontHead}}>← Back to Home</button>
        </div>
      )}
      {screen==='wizard' && <Wizard onComplete={handleWizardComplete} onHome={goHome} selectedMonth={selectedMonth} />}
      {screen==='dashboard' && <Dashboard />}
      {screen==='history' && <HistoryScreen />}
      {screen==='reports' && <ReportsScreen />}
      {screen==='settings' && <SettingsScreen />}
      {screen==='about' && <AboutScreen />}
      <ChatBot />
    </div>
  );
}
