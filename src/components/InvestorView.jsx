import React, { useMemo } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fontHead, fontBody, fmt, fmtFull } from '../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from './UIComponents';
import * as D from '../data/financials';
import { useAvailableMonths, useFinancials, useBalanceSheet } from '../hooks/useMonthData';
import { useAuth } from '../context/AuthContext';

const FALLBACK_MONTHS = [
  {key:'2025-07',label:'Jul 2025'},{key:'2025-08',label:'Aug 2025'},{key:'2025-09',label:'Sep 2025'},
  {key:'2025-10',label:'Oct 2025'},{key:'2025-11',label:'Nov 2025'},{key:'2025-12',label:'Dec 2025'},
  {key:'2026-01',label:'Jan 2026'},{key:'2026-02',label:'Feb 2026'},
];

export default function InvestorView() {
  const { signOut, user } = useAuth();
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

  const monthCount = availableMonths.length;
  const monthSlice = D.months.slice(0, monthCount);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  const ytdRev = sum(D.totalRevenue.slice(0, monthCount));
  const ytdNP = sum(D.netProfit.slice(0, monthCount));
  const ytdGP = sum(D.grossProfit.slice(0, monthCount));
  const ytdGMPct = ytdRev > 0 ? Math.round(ytdGP / ytdRev * 1000) / 10 : 0;
  const ytdNPPct = ytdRev > 0 ? Math.round(ytdNP / ytdRev * 1000) / 10 : 0;

  const monthlyData = monthSlice.map((m, i) => ({
    name: m,
    revenue: D.totalRevenue[i],
    netProfit: D.netProfit[i],
  }));

  const currentMonth = availableMonths[availableMonths.length - 1]?.label || 'Feb 2026';

  return (
    <div style={{ background: B.bg, minHeight: '100vh', color: B.textPrimary, fontFamily: fontBody }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: `3px solid ${B.yellow}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/logo.jpg" alt="SkipSync" style={{ height: 38, borderRadius: 4 }} onError={e => { e.target.style.display = 'none'; }} />
          <div>
            <div style={{ fontFamily: fontHead, fontSize: 18, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: B.yellow }}>SkipSync</div>
            <div style={{ fontSize: 11, color: '#888' }}>Investor View — Read Only</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, color: '#888' }}>{user?.email}</span>
          <button onClick={signOut} style={{ background: 'none', border: `1px solid #555`, color: B.yellow, padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontFamily: fontHead, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <SectionHeader
          title="FY2026 Business Performance Summary"
          subtitle={`Jul 2025 — ${currentMonth} | ${monthCount} months YTD | Binned-IT Pty Ltd (SkipSync), Seaford VIC`}
        />

        {/* Read-only notice */}
        <div style={{ background: `${B.yellow}15`, border: `1px solid ${B.yellow}40`, borderRadius: 8, padding: '10px 16px', marginBottom: 24, fontSize: 12, color: B.textSecondary }}>
          This is a read-only investor dashboard. Data is for the period Jul 2025 — {currentMonth}.
        </div>

        {/* KPI headline */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 24 }}>
          <KPITile label="YTD Revenue" value={fmtFull(ytdRev)} sub={`${monthCount} months`} status="yellow" large />
          <KPITile label="YTD Net Profit" value={fmtFull(ytdNP)} sub={`${ytdNPPct}% margin`} status={ytdNP > 0 ? 'green' : 'red'} large />
          <KPITile label="Gross Margin YTD" value={`${ytdGMPct}%`} sub="Target: >60%" status={ytdGMPct >= 60 ? 'green' : 'red'} large />
          <KPITile label="Annualised Revenue" value={fmtFull(ytdRev / monthCount * 12)} sub="Run-rate projection" status="amber" large />
        </div>

        {/* Revenue trend */}
        <ChartCard title="Monthly Revenue & Net Profit Trend">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 500 }}>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 12 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.yellow} name="Revenue" radius={[3, 3, 0, 0]} />
                  <Line dataKey="netProfit" stroke={B.green} strokeWidth={2} name="Net Profit" dot={{ fill: B.green, r: 4 }} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        {/* Balance Sheet Summary */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: fontHead, fontSize: 14, fontWeight: 700, color: B.textPrimary, textTransform: 'uppercase', marginBottom: 14, letterSpacing: '0.04em' }}>Balance Sheet Summary (as at {currentMonth})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: fontHead, fontSize: 12, color: B.green, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Assets</div>
              {[
                ['Total Assets', fmtFull(D.balanceSheet.totalAssets)],
                ['Fixed Assets', fmtFull(D.balanceSheet.fixedAssets.total)],
                ['Accounts Receivable', fmtFull(D.arTotal)],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${B.cardBorder}`, fontSize: 13 }}>
                  <span style={{ color: B.textSecondary }}>{l}</span>
                  <span style={{ fontWeight: 700, color: B.textPrimary }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontFamily: fontHead, fontSize: 12, color: B.red, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Liabilities & Equity</div>
              {[
                ['Total Liabilities', fmtFull(D.balanceSheet.totalLiabilities)],
                ['Total Loans', fmtFull(D.balanceSheet.loans.total)],
                ['Net Equity', fmtFull(D.balanceSheet.equity.total)],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${B.cardBorder}`, fontSize: 13 }}>
                  <span style={{ color: B.textSecondary }}>{l}</span>
                  <span style={{ fontWeight: 700, color: i === 2 && D.balanceSheet.equity.total < 0 ? B.red : B.textPrimary }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${B.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: B.textMuted }}>SkipSync · Binned-IT Pty Ltd — Confidential Investor Report</div>
          <div style={{ fontSize: 11, color: B.textMuted }}>Data as at {currentMonth} | Generated {new Date().toLocaleDateString('en-AU')}</div>
        </div>
      </div>
    </div>
  );
}
