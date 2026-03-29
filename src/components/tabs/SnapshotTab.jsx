import React, { useState } from 'react';
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fontHead, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useFinancials, useBalanceSheet, useYTDFinancials } from '../../hooks/useMonthData';
import AIInsightsPanel from '../AIInsightsPanel';

const FALLBACK_MONTHS = [
  {key:'2025-07',label:'Jul 2025'},{key:'2025-08',label:'Aug 2025'},{key:'2025-09',label:'Sep 2025'},
  {key:'2025-10',label:'Oct 2025'},{key:'2025-11',label:'Nov 2025'},{key:'2025-12',label:'Dec 2025'},
  {key:'2026-01',label:'Jan 2026'},{key:'2026-02',label:'Feb 2026'},
];

export default function SnapshotTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const [compareMode, setCompareMode] = useState(false);
  const [compareMonth, setCompareMonth] = useState('2026-01');

  const mi = monthCount - 1;
  const monthSlice = D.months.slice(0, monthCount);

  // Compare month data
  const compareReportMonth = compareMonth ? `${compareMonth}-01` : null;
  const { data: compareFinancials } = useFinancials(compareMode ? compareReportMonth : null);
  const compareMi = FALLBACK_MONTHS.findIndex(m => m.key === compareMonth);
  const compareMLabel = FALLBACK_MONTHS.find(m => m.key === compareMonth)?.label || compareMonth;

  // Live Supabase data
  const { data: financials, isLoading: finLoading } = useFinancials(reportMonth);
  const { data: balance } = useBalanceSheet(reportMonth);
  const { data: ytdRows } = useYTDFinancials(reportMonth);

  // Build monthly chart data — prefer Supabase YTD rows if available, else D.*
  let monthlyData;
  if (ytdRows && ytdRows.length > 0) {
    monthlyData = ytdRows.map(r => {
      const d = new Date(r.report_month);
      const name = d.toLocaleDateString('en-AU', { month: 'short' });
      return {
        name,
        revenue: r.rev_total || r.revenue_total || 0,
        cos: r.cos_total || 0,
        gp: r.gross_profit || 0,
        opex: r.opex_total || 0,
        np: r.net_profit || 0,
        gm: r.gross_margin_pct || 0,
      };
    });
  } else {
    monthlyData = monthSlice.map((m, i) => ({
      name: m,
      revenue: D.totalRevenue[i],
      cos: D.totalCOS[i],
      gp: D.grossProfit[i],
      opex: D.totalOpex[i],
      np: D.netProfit[i],
      gm: D.gmPct[i],
    }));
  }

  // KPI values — prefer live data with D.* fallback
  const curRev = financials?.rev_total || financials?.revenue_total || D.totalRevenue[mi] || 0;
  const prevRev = mi > 0
    ? (ytdRows && ytdRows.length >= 2 ? (ytdRows[ytdRows.length - 2]?.rev_total || ytdRows[ytdRows.length - 2]?.revenue_total || D.totalRevenue[mi - 1]) : D.totalRevenue[mi - 1])
    : 0;
  const curTrend = prevRev > 0 ? Math.round((curRev / prevRev - 1) * 100) : 0;

  // YTD totals from ytdRows if available, else compute from D.*
  let ytdRev, ytdGP, ytdNPTotal, ytdGMPct, ytdNPPct;
  if (ytdRows && ytdRows.length > 0) {
    ytdRev = ytdRows.reduce((a, r) => a + (r.rev_total || r.revenue_total || 0), 0);
    ytdGP = ytdRows.reduce((a, r) => a + (r.gross_profit || 0), 0);
    ytdNPTotal = ytdRows.reduce((a, r) => a + (r.net_profit || 0), 0);
  } else {
    const slicedRev = D.totalRevenue.slice(0, monthCount);
    const slicedGP = D.grossProfit.slice(0, monthCount);
    const slicedNP = D.netProfit.slice(0, monthCount);
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    ytdRev = sum(slicedRev);
    ytdGP = sum(slicedGP);
    ytdNPTotal = sum(slicedNP);
  }
  ytdGMPct = ytdRev > 0 ? Math.round(ytdGP / ytdRev * 1000) / 10 : 0;
  ytdNPPct = ytdRev > 0 ? Math.round(ytdNPTotal / ytdRev * 1000) / 10 : 0;

  // Balance sheet values — prefer Supabase, fallback to D.*
  const bsTotalAssets = balance?.total_assets ?? D.balanceSheet.totalAssets;
  const bsTotalLiabilities = balance?.total_liabilities ?? D.balanceSheet.totalLiabilities;
  const bsNetEquity = balance?.net_equity ?? D.balanceSheet.equity.total;
  const bsCashBalance = balance?.cash_balance ?? D.balanceSheet.bankBalance;
  const bsGstLiability = balance?.gst_liability ?? D.balanceSheet.gst;
  const bsPaygLiability = balance?.payg_liability ?? D.balanceSheet.paygWithholding;
  const bsAtoClearing = balance?.ato_clearing ?? D.balanceSheet.atoClearing;
  const bsDirectorLoans = balance?.director_loans ?? D.balanceSheet.directorLoans.total;
  const bsTotalLoans = balance?.total_loans ?? D.balanceSheet.loans.total;
  const bsFixedAssets = balance?.fixed_assets ?? D.balanceSheet.fixedAssets.total;
  const bsCurrentYearEarnings = balance?.current_year_earnings ?? D.balanceSheet.equity.currentYearEarnings;

  // Compare month fallback values
  const cRev = compareFinancials?.rev_total || compareFinancials?.revenue_total || (compareMi >= 0 ? D.totalRevenue[compareMi] : 0);
  const cNP = compareFinancials?.net_profit || (compareMi >= 0 ? D.netProfit[compareMi] : 0);
  const cGP = compareFinancials?.gross_profit || (compareMi >= 0 ? D.grossProfit[compareMi] : 0);
  const cGMPct = compareFinancials?.gross_margin_pct || (compareMi >= 0 ? D.gmPct[compareMi] : 0);

  const snapshotContext = [
    `Month: ${monthLabel}`,
    `Revenue: $${Math.round(financials?.rev_total ?? D.totalRevenue[mi] ?? 0).toLocaleString('en-AU')}`,
    `Gross Margin: ${(financials?.gross_margin_pct ?? D.gmPct[mi] ?? 0).toFixed(1)}%`,
    `Net Profit: $${Math.round(financials?.net_profit ?? D.netProfit[mi] ?? 0).toLocaleString('en-AU')}`,
    `YTD Revenue: $${Math.round(ytdRev).toLocaleString('en-AU')}`,
    `YTD Net Profit: $${Math.round(ytdNPTotal).toLocaleString('en-AU')}`,
    `Cash Balance: $${Math.round((D.cashBalance || [])[mi] || 0).toLocaleString('en-AU')}`,
    `AR Total: $${Math.round(D.arTotal || 0).toLocaleString('en-AU')} (overdue: $${Math.round(D.arOverdue || 0).toLocaleString('en-AU')})`,
  ].join('\n');

  return (
    <div>
      <SectionHeader
        title="Commercial Performance Snapshot"
        subtitle={`FY2026 YTD — Jul 2025 to ${monthLabel} (${monthCount} month${monthCount > 1 ? 's' : ''} accrual)`}
      />
      {finLoading && (
        <div style={{ padding: '8px 0', fontSize: 12, color: B.textMuted, marginBottom: 8 }}>Loading live data...</div>
      )}

      {/* Compare toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          onClick={() => setCompareMode(prev => !prev)}
          style={{
            background: compareMode ? B.yellow : 'none',
            border: `1px solid ${compareMode ? B.yellow : B.cardBorder}`,
            color: compareMode ? '#000' : B.textSecondary,
            borderRadius: 6, padding: '5px 14px', cursor: 'pointer',
            fontFamily: fontHead, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          Compare Months
        </button>
        {compareMode && (
          <select
            value={compareMonth}
            onChange={e => setCompareMonth(e.target.value)}
            style={{ background: B.bg, border: `1px solid ${B.cardBorder}`, borderRadius: 6, padding: '5px 10px', fontSize: 12, color: B.textPrimary, outline: 'none' }}
          >
            {FALLBACK_MONTHS.filter(m => m.key !== selectedMonth).map(m => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Month comparison panel */}
      {compareMode && (
        <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontFamily: fontHead, fontSize: 13, fontWeight: 700, color: B.yellow, textTransform: 'uppercase', marginBottom: 12 }}>
            Month Comparison: {monthLabel} vs {compareMLabel}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Revenue', aVal: curRev, bVal: cRev },
              { label: 'Net Profit', aVal: financials?.net_profit ?? D.netProfit[mi] ?? 0, bVal: cNP },
              { label: 'Gross Profit', aVal: financials?.gross_profit ?? D.grossProfit[mi] ?? 0, bVal: cGP },
              { label: 'GM %', aVal: financials?.gross_margin_pct ?? D.gmPct[mi] ?? 0, bVal: cGMPct, isPct: true },
            ].map((item, i) => {
              const diff = item.aVal - item.bVal;
              const pctChange = item.bVal !== 0 ? ((item.aVal / item.bVal) - 1) * 100 : 0;
              return (
                <div key={i} style={{ background: B.bg, borderRadius: 8, padding: '12px 14px', border: `1px solid ${B.cardBorder}` }}>
                  <div style={{ fontSize: 10, color: B.textMuted, textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div>
                      <div style={{ fontSize: 9, color: B.yellow, fontFamily: fontHead, textTransform: 'uppercase' }}>{monthLabel}</div>
                      <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: B.textPrimary }}>
                        {item.isPct ? `${item.aVal.toFixed(1)}%` : fmtFull(item.aVal)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 9, color: B.textMuted, fontFamily: fontHead, textTransform: 'uppercase' }}>{compareMLabel}</div>
                      <div style={{ fontFamily: fontHead, fontSize: 16, fontWeight: 700, color: B.textSecondary }}>
                        {item.isPct ? `${item.bVal.toFixed(1)}%` : fmtFull(item.bVal)}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: diff >= 0 ? B.green : B.red, fontWeight: 700, textAlign: 'right' }}>
                    {diff >= 0 ? '↑' : '↓'} {item.isPct ? `${Math.abs(diff).toFixed(1)}pp` : fmtFull(Math.abs(diff))} ({Math.abs(pctChange).toFixed(1)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="YTD Revenue" value={fmtFull(ytdRev)} sub={`${monthCount} months`} status="yellow" large />
        <KPITile label="YTD Net Profit" value={fmtFull(ytdNPTotal)} sub={`${ytdNPPct}% margin`} status={ytdNPTotal > 0 ? 'green' : 'red'} large />
        <KPITile label="Gross Margin YTD" value={`${ytdGMPct}%`} sub="Target: >60%" status={ytdGMPct >= 60 ? 'green' : 'red'} large />
        <KPITile label={`${monthLabel} Revenue`} value={fmtFull(curRev)} trend={curTrend} status="green" large />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Monthly Revenue vs Net Profit">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.yellow} name="Revenue" radius={[3, 3, 0, 0]} />
                  <Line dataKey="np" stroke={B.green} strokeWidth={2} name="Net Profit" dot={{ fill: B.green, r: 3 }} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Gross Margin % Trend">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} domain={[50, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip formatter={v => `${v}%`} />} />
                  <Line dataKey="gm" stroke={B.amber} strokeWidth={2} name="GM%" dot={{ fill: B.amber, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Balance Sheet Summary */}
      <div style={{ marginBottom: 12, marginTop: 4 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: B.textPrimary, margin: 0, fontFamily: fontHead, textTransform: 'uppercase' }}>Balance Sheet Highlights</h3>
        <p style={{ fontSize: 12, color: B.textSecondary, margin: '2px 0 0' }}>Key positions from latest Xero balance sheet</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <KPITile label="Total Assets" value={fmtFull(bsTotalAssets)} status="green" />
        <KPITile label="Total Liabilities" value={fmtFull(bsTotalLiabilities)} status="red" />
        <KPITile label="Net Equity" value={fmtFull(bsNetEquity)} status={bsNetEquity < 0 ? 'red' : 'green'} />
        <KPITile label="Bank Balance (Xero)" value={fmtFull(bsCashBalance)} status="amber" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
        <KPITile label="GST Liability" value={fmtFull(bsGstLiability)} status="red" />
        <KPITile label="PAYG Withholding" value={fmtFull(bsPaygLiability)} status="red" />
        <KPITile label="ATO Clearing" value={fmtFull(bsAtoClearing)} sub="Credit balance" status="green" />
        <KPITile label="Director Loans" value={fmtFull(bsDirectorLoans)} status="amber" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12 }}>
        <KPITile label="Total Loans Outstanding" value={fmtFull(bsTotalLoans)} status="red" />
        <KPITile label="Fixed Assets" value={fmtFull(bsFixedAssets)} sub="Trucks, bins, equipment" status="green" />
        <KPITile label="Current Year Earnings" value={fmtFull(bsCurrentYearEarnings)} status={bsCurrentYearEarnings > 0 ? 'green' : 'red'} />
      </div>
      <AIInsightsPanel
        tabName="Business Snapshot"
        contextSummary={snapshotContext}
        selectedMonth={reportMonth}
        selLabel={monthLabel}
      />
    </div>
  );
}
