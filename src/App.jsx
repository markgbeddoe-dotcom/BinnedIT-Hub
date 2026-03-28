import React, { useState, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { B, fontHead, fontBody, fmt, fmtFull } from './theme';
import { AlertItem } from './components/UIComponents';
import { saveMonthData, getMonthData, listMonths } from './data/dataStore';
import * as D from './data/financials';
import { defaultWorkPlan } from './data/workplan';
import { generateAlerts } from './data/analysisEngine';
import Wizard from './components/Wizard';

// Tab components
import SnapshotTab from './components/tabs/SnapshotTab';
import RevenueTab from './components/tabs/RevenueTab';
import MarginsTab from './components/tabs/MarginsTab';
import BenchmarkingTab from './components/tabs/BenchmarkingTab';
import CompetitorsTab from './components/tabs/CompetitorsTab';
import BDMTab from './components/tabs/BDMTab';
import FleetTab from './components/tabs/FleetTab';
import FleetAssetsTab from './components/tabs/FleetAssetsTab';
import DebtorsTab from './components/tabs/DebtorsTab';
import CashFlowTab from './components/tabs/CashFlowTab';
import RiskEPATab from './components/tabs/RiskEPATab';
import WorkPlanTab from './components/tabs/WorkPlanTab';
import ChatPanel from './components/ChatPanel';
import MobileNav from './components/MobileNav';
import { OfflineBanner } from './components/OfflineBanner';
import SettingsPage from './components/SettingsPage';
import { PrintStyles } from './components/PDFExport';
import PDFExport from './components/PDFExport';
import InvestorView from './components/InvestorView';

// React Query hooks
import { useAvailableMonths } from './hooks/useMonthData';
import { useBreakpoint } from './hooks/useBreakpoint';

const VERSION = '2.2.0';
const BUILD_DATE = '27 March 2026';

const FALLBACK_MONTHS = [
  {key:'2025-07',label:'Jul 2025'},{key:'2025-08',label:'Aug 2025'},{key:'2025-09',label:'Sep 2025'},
  {key:'2025-10',label:'Oct 2025'},{key:'2025-11',label:'Nov 2025'},{key:'2025-12',label:'Dec 2025'},
  {key:'2026-01',label:'Jan 2026'},{key:'2026-02',label:'Feb 2026'},
];

const tiles = [
  { id:"dashboard", icon:"📊", title:"View Dashboard", desc:"Current month's data with analysis", sub:"Select month to view", color:B.yellow },
  { id:"generate", icon:"🔧", title:"Generate New", desc:"12-step guided wizard", sub:"Upload files + manual input", color:B.green },
  { id:"update", icon:"📥", title:"Update Existing", desc:"Add latest month's data", sub:"Quick update wizard", color:B.amber },
  { id:"fleet-assets", icon:"🚛", title:"Fleet Assets", desc:"Trucks, bins, maintenance records", sub:"Jake's operations module", color:B.orange },
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
  {id:'fleet-assets',icon:'🚛',label:'Fleet Assets'},{id:'reports',icon:'📄',label:'Reports'},{id:'settings',icon:'⚙️',label:'Settings'},{id:'about',icon:'ℹ️',label:'About'},
];

// Main app wrapper that handles state and routing
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [dashTab, setDashTab] = useState("snapshot");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const [wizardData, setWizardData] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [wpDone, setWpDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem('binnedit_wp_done') || '{}'); } catch { return {}; }
  });

  const { isMobile } = useBreakpoint();

  // React Query: available months from Supabase with fallback
  const { data: supabaseMonths } = useAvailableMonths();
  const availableMonths = useMemo(() => {
    if (supabaseMonths && supabaseMonths.length > 0) {
      return supabaseMonths.map(r => {
        const d = new Date(r.report_month);
        const label = d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
        const key = r.report_month.slice(0, 7);
        return { key, label };
      }).reverse();
    }
    return FALLBACK_MONTHS;
  }, [supabaseMonths]);

  const mi = availableMonths.findIndex(m => m.key === selectedMonth);
  const monthCount = mi >= 0 ? mi + 1 : FALLBACK_MONTHS.findIndex(m => m.key === selectedMonth) + 1 || 8;
  const selLabel = availableMonths.find(m => m.key === selectedMonth)?.label || FALLBACK_MONTHS.find(m => m.key === selectedMonth)?.label || 'Feb 2026';

  const alerts = useMemo(() => generateAlerts(monthCount), [monthCount]);

  const currentScreen = location.pathname === '/' || location.pathname === '/home' ? 'home'
    : location.pathname.startsWith('/dashboard') ? 'dashboard'
    : location.pathname === '/wizard' || location.pathname === '/month-select' ? 'wizard'
    : location.pathname === '/fleet-assets' ? 'fleet-assets'
    : location.pathname === '/settings' ? 'settings'
    : location.pathname === '/history' ? 'history'
    : location.pathname === '/reports' ? 'reports'
    : location.pathname === '/about' ? 'about'
    : 'home';

  const goHome = () => { navigate('/home'); setMenuOpen(false); };

  const handleWizardComplete = (data) => {
    const monthKey = data.selectedMonth || selectedMonth;
    const monthRecord = {
      monthKey, status: 'complete', createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), parsed: data.parsed || {},
      files: data.files || {}, bankBalance: data.bankBalance,
      quality: data.quality || {}, compliance: data.compliance || {}, market: data.market || {},
    };
    saveMonthData(monthKey, monthRecord);
    setWizardData(data);
    setSelectedMonth(monthKey);
    navigate('/dashboard');
    setDashTab('snapshot');
  };

  const toggleDone = (id) => {
    setWpDone(prev => {
      const next = { ...prev, [id]: prev[id] ? null : { by: 'Mark', at: new Date().toISOString() } };
      localStorage.setItem('binnedit_wp_done', JSON.stringify(next));
      return next;
    });
  };

  // ===== HEADER =====
  const Header = () => (
    <div style={{background:'#000',borderBottom:`3px solid ${B.yellow}`,
      padding:'12px 24px',display:'flex',alignItems:'center',gap:14,position:'sticky',top:0,zIndex:100}} className="no-print">
      <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:'none',border:'none',color:'#fff',fontSize:22,cursor:'pointer',padding:'2px 6px',lineHeight:1}}>☰</button>
      <img src="/logo.jpg" alt="Binned-IT" style={{height:38,borderRadius:4}} onError={e=>{e.target.style.display='none'}} />
      <div style={{flex:1}}>
        <div style={{fontFamily:fontHead,fontSize:16,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'#fff'}}>Dashboard Hub</div>
        <div style={{fontSize:11,color:'#888'}}>Management Intelligence Platform &middot; v{VERSION}</div>
      </div>
      {currentScreen==='dashboard' && !isMobile && (
        <div style={{background:'#222',borderRadius:6,padding:'4px 8px',display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:11,color:'#888'}}>Viewing: </span>
          <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setWizardData(null);}} style={{background:'#333',color:B.yellow,border:'1px solid #555',borderRadius:4,padding:'2px 6px',fontSize:12,fontFamily:fontHead,fontWeight:600,cursor:'pointer'}}>
            {availableMonths.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
      )}
      {currentScreen==='dashboard' && (
        <PDFExport monthLabel={selLabel} />
      )}
      {currentScreen !== 'home' && (
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
            if (t.id==='dashboard') { navigate('/dashboard'); setDashTab('snapshot'); }
            else if (t.id==='generate'||t.id==='update') { navigate('/month-select'); }
            else if (t.id==='fleet-assets') { navigate('/fleet-assets'); }
            else navigate(`/${t.id}`);
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
    const tabAlerts = alerts[dashTab === 'benchmarking' ? 'pricing' : dashTab] || [];
    const tabProps = { selectedMonth, monthCount, monthLabel: selLabel };

    return (
      <div style={{maxWidth:1100,margin:'0 auto',padding:'20px 24px'}}>
        {/* Month selector on mobile — full-width above content */}
        {isMobile && (
          <div style={{marginBottom:12}} className="no-print">
            <select value={selectedMonth} onChange={e=>{setSelectedMonth(e.target.value);setWizardData(null);}} style={{width:'100%',background:'#333',color:B.yellow,border:`1px solid ${B.cardBorder}`,borderRadius:6,padding:'8px 12px',fontSize:13,fontFamily:fontHead,fontWeight:600,cursor:'pointer'}}>
              {availableMonths.map(m=><option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        )}

        {/* Print header — only visible during printing */}
        <div className="print-header" style={{display:'none'}}>
          <div style={{fontFamily:fontHead,fontSize:20,fontWeight:700}}>Binned-IT Dashboard Hub — {dashTabs.find(t=>t.id===dashTab)?.label || 'REPORT'}</div>
          <div style={{fontSize:13,color:'#555'}}>Period: Jul 2025 – {selLabel} | Generated: {new Date().toLocaleDateString('en-AU')}</div>
        </div>

        {/* Tab Bar — hidden on mobile (use MobileNav instead) */}
        <div style={{display:isMobile?'none':'flex',gap:2,overflowX:'auto',marginBottom:20,paddingBottom:2}} className="no-print">
          {dashTabs.map(t=>(
            <button key={t.id} onClick={()=>setDashTab(t.id)} style={{
              background:dashTab===t.id?B.yellow:'transparent',color:dashTab===t.id?'#0A0A0A':B.textMuted,
              border:'none',padding:'8px 14px',borderRadius:'8px 8px 0 0',cursor:'pointer',
              fontFamily:fontHead,fontSize:11,fontWeight:dashTab===t.id?700:500,letterSpacing:'0.06em',
              whiteSpace:'nowrap',transition:'all 0.15s',borderBottom:dashTab===t.id?`2px solid ${B.yellow}`:'2px solid transparent'
            }}>{t.label}</button>
          ))}
        </div>

        {dashTab === 'snapshot'      && <SnapshotTab      {...tabProps} />}
        {dashTab === 'revenue'       && <RevenueTab       {...tabProps} />}
        {dashTab === 'margins'       && <MarginsTab       {...tabProps} />}
        {dashTab === 'benchmarking'  && <BenchmarkingTab  {...tabProps} />}
        {dashTab === 'competitors'   && <CompetitorsTab   {...tabProps} onBack={()=>setDashTab('snapshot')} />}
        {dashTab === 'bdm'           && <BDMTab           {...tabProps} />}
        {dashTab === 'fleet'         && <FleetTab         {...tabProps} />}
        {dashTab === 'debtors'       && <DebtorsTab       {...tabProps} />}
        {dashTab === 'cashflow'      && <CashFlowTab      {...tabProps} />}
        {dashTab === 'risk'          && <RiskEPATab       {...tabProps} wizardData={wizardData} />}
        {dashTab === 'workplan'      && <WorkPlanTab      wpDone={wpDone} toggleDone={toggleDone} />}

        {/* Alerts panel */}
        {dashTab !== 'workplan' && tabAlerts.length > 0 && (
          <div style={{background:B.cardBg,border:`1px solid ${B.cardBorder}`,borderRadius:10,padding:'16px 20px',marginTop:20}} className="no-print">
            <div style={{fontFamily:fontHead,fontSize:13,color:B.yellow,fontWeight:700,textTransform:'uppercase',marginBottom:10}}>Recommended Actions</div>
            {tabAlerts.map((a,i) => <AlertItem key={i} severity={a.sev==='critical'?'critical':a.sev==='warning'?'warning':a.sev==='info'?'info':'positive'} text={a.text} />)}
          </div>
        )}
      </div>
    );
  };

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
            if(item.id==='home') goHome();
            else if(item.id==='dashboard'){navigate('/dashboard');setDashTab('snapshot');setMenuOpen(false);}
            else {navigate(`/${item.id}`);setMenuOpen(false);}
          }} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:'none',border:'none',cursor:'pointer',fontSize:14,color:B.textPrimary,textAlign:'left'}}
            onMouseOver={e=>e.currentTarget.style.background=B.bg} onMouseOut={e=>e.currentTarget.style.background='none'}>
            <span style={{fontSize:18}}>{item.icon}</span><span style={{fontFamily:fontHead,fontWeight:500}}>{item.label}</span>
          </button>
        ))}
        {/* Investor View link */}
        <button onClick={()=>{navigate('/investor');setMenuOpen(false);}} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'12px 20px',background:'none',border:'none',cursor:'pointer',fontSize:14,color:B.textPrimary,textAlign:'left'}}
          onMouseOver={e=>e.currentTarget.style.background=B.bg} onMouseOut={e=>e.currentTarget.style.background='none'}>
          <span style={{fontSize:18}}>📈</span><span style={{fontFamily:fontHead,fontWeight:500}}>Investor View</span>
        </button>
      </div>
      <div style={{padding:'16px 20px',borderTop:`1px solid ${B.cardBorder}`,fontSize:10,color:B.textMuted}}>v{VERSION} - Published {BUILD_DATE}</div>
    </div>
  </>);

  // ===== HISTORY SCREEN =====
  const HistoryScreen = () => (
    <div style={{maxWidth:700,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:20}}>Monthly History</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {availableMonths.map((m,mIdx) => {
          const hasData = mIdx < D.months.length;
          return (<button key={m.key} onClick={()=>{setSelectedMonth(m.key);navigate('/dashboard');setDashTab('snapshot');}}
            style={{background:B.cardBg,border:`2px solid ${hasData?B.green:B.cardBorder}`,borderRadius:10,padding:'16px 12px',cursor:'pointer',textAlign:'center',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
            <div style={{fontFamily:fontHead,fontSize:14,fontWeight:700,color:B.textPrimary}}>{m.label}</div>
            <div style={{fontSize:10,color:hasData?B.green:B.textMuted,marginTop:4,fontWeight:600}}>{hasData?'Complete':'No data'}</div>
            {hasData && <div style={{fontSize:11,color:B.textSecondary,marginTop:4}}>{fmtFull(D.totalRevenue[mIdx])} rev</div>}
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

  // ===== ABOUT SCREEN =====
  const AboutScreen = () => (
    <div style={{maxWidth:600,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{background:B.cardBg,borderRadius:14,padding:32,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',textAlign:'center'}}>
        <div style={{fontFamily:fontHead,fontSize:24,fontWeight:700,color:B.textPrimary,textTransform:'uppercase'}}>Binned-IT Dashboard Hub</div>
        <div style={{fontSize:14,color:B.textSecondary,marginTop:8}}>Management Intelligence Platform</div>
        <div style={{marginTop:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,textAlign:'left'}}>
          {[{l:'Version',v:VERSION},{l:'Published',v:BUILD_DATE},{l:'Data Range',v:'Jul 2025 - Feb 2026'},{l:'Months Loaded',v:'8'},{l:'Platform',v:'React + Vite + Supabase'},{l:'AI Assistant',v:'Claude (Anthropic)'}].map((r,i)=>(
            <div key={i} style={{padding:'8px 12px',background:B.bg,borderRadius:6}}>
              <div style={{fontSize:10,color:B.textMuted,textTransform:'uppercase'}}>{r.l}</div>
              <div style={{fontSize:13,fontWeight:600,color:B.textPrimary,marginTop:2}}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ===== MONTH SELECT =====
  const MonthSelect = () => (
    <div style={{maxWidth:600,margin:'0 auto',padding:'40px 24px'}}>
      <div style={{fontFamily:fontHead,fontSize:22,fontWeight:700,color:B.textPrimary,textTransform:'uppercase',marginBottom:8}}>Select Month</div>
      <p style={{fontSize:13,color:B.textSecondary,marginBottom:24}}>Which month are you loading data for?</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {availableMonths.map(m => {
          const isCurrent = m.key === selectedMonth;
          return (
            <button key={m.key} onClick={()=>{setSelectedMonth(m.key);navigate('/wizard');}}
              style={{background:isCurrent?B.yellow:B.cardBg,color:isCurrent?'#000':B.textPrimary,border:'1px solid '+(isCurrent?B.yellow:B.cardBorder),
              borderRadius:10,padding:'16px 12px',cursor:'pointer',fontFamily:fontHead,fontSize:14,fontWeight:600,textAlign:'center',transition:'all 0.15s'}}
              onMouseOver={e=>{if(!isCurrent){e.currentTarget.style.background=B.bg;e.currentTarget.style.borderColor=B.yellow}}}
              onMouseOut={e=>{if(!isCurrent){e.currentTarget.style.background=B.cardBg;e.currentTarget.style.borderColor=B.cardBorder}}}>
              {m.label}
            </button>
          );
        })}
      </div>
      <button onClick={goHome} style={{marginTop:24,background:'none',border:'1px solid '+B.cardBorder,borderRadius:8,padding:'10px 20px',cursor:'pointer',fontSize:13,color:B.textSecondary,fontFamily:fontHead}}>Back to Home</button>
    </div>
  );

  const alerts_count = useMemo(() => {
    return (alerts.snapshot||[]).filter(a=>a.sev==='critical').length;
  }, [alerts]);

  return (
    <div style={{background:B.bg,minHeight:'100vh',color:B.textPrimary,fontFamily:fontBody,paddingBottom:isMobile?72:0}}>
      <PrintStyles />
      <OfflineBanner />
      <Header />
      <SideMenu />

      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/:tab" element={<Dashboard />} />
        <Route path="/month-select" element={<MonthSelect />} />
        <Route path="/wizard" element={<Wizard onComplete={handleWizardComplete} onHome={goHome} selectedMonth={selectedMonth} />} />
        <Route path="/fleet-assets" element={<FleetAssetsTab />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<AboutScreen />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(!chatOpen)}
        selectedMonth={selectedMonth}
        monthCount={monthCount}
        selLabel={selLabel}
        isMobile={isMobile}
      />
      {isMobile && (
        <MobileNav
          currentScreen={currentScreen}
          currentTab={dashTab}
          alertCount={alerts_count}
          chatOpen={chatOpen}
          onNavigate={(s, t) => {
            if (s === 'home') navigate('/home');
            else navigate(`/${s}`);
            if (t) setDashTab(t);
            setMenuOpen(false);
          }}
          onChatOpen={() => setChatOpen(prev => !prev)}
        />
      )}
    </div>
  );
}
