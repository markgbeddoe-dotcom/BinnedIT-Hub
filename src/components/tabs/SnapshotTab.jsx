import React from 'react';
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fontHead, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useFinancials, useBalanceSheet, useYTDFinancials } from '../../hooks/useMonthData';

export default function SnapshotTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const mi = monthCount - 1;
  const monthSlice = D.months.slice(0, monthCount);

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

  return (
    <div>
      <SectionHeader
        title="Commercial Performance Snapshot"
        subtitle={`FY2026 YTD — Jul 2025 to ${monthLabel} (${monthCount} month${monthCount > 1 ? 's' : ''} accrual)`}
      />
      {finLoading && (
        <div style={{ padding: '8px 0', fontSize: 12, color: B.textMuted, marginBottom: 8 }}>Loading live data...</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="YTD Revenue" value={fmtFull(ytdRev)} sub={`${monthCount} months`} status="yellow" large />
        <KPITile label="YTD Net Profit" value={fmtFull(ytdNPTotal)} sub={`${ytdNPPct}% margin`} status={ytdNPTotal > 0 ? 'green' : 'red'} large />
        <KPITile label="Gross Margin YTD" value={`${ytdGMPct}%`} sub="Target: >60%" status={ytdGMPct >= 60 ? 'green' : 'red'} large />
        <KPITile label={`${monthLabel} Revenue`} value={fmtFull(curRev)} trend={curTrend} status="green" large />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Monthly Revenue vs Net Profit">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={250}>
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
              <ResponsiveContainer width="100%" height={250}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <KPITile label="Total Loans Outstanding" value={fmtFull(bsTotalLoans)} status="red" />
        <KPITile label="Fixed Assets" value={fmtFull(bsFixedAssets)} sub="Trucks, bins, equipment" status="green" />
        <KPITile label="Current Year Earnings" value={fmtFull(bsCurrentYearEarnings)} status={bsCurrentYearEarnings > 0 ? 'green' : 'red'} />
      </div>
    </div>
  );
}
