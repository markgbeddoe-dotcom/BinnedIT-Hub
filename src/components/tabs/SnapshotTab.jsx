import React from 'react';
import { ComposedChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fontHead, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function SnapshotTab({ data, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const mi = monthCount - 1;
  const monthSlice = D.months.slice(0, monthCount);

  const slicedRev = D.totalRevenue.slice(0, monthCount);
  const slicedCOS = D.totalCOS.slice(0, monthCount);
  const slicedGP = D.grossProfit.slice(0, monthCount);
  const slicedNP = D.netProfit.slice(0, monthCount);

  const sum = arr => arr.reduce((a, b) => a + b, 0);
  const ytdRev = sum(slicedRev);
  const ytdGP = sum(slicedGP);
  const ytdNPTotal = sum(slicedNP);
  const ytdGMPct = ytdRev > 0 ? Math.round(ytdGP / ytdRev * 1000) / 10 : 0;
  const ytdNPPct = ytdRev > 0 ? Math.round(ytdNPTotal / ytdRev * 1000) / 10 : 0;

  const curRev = slicedRev[mi] || 0;
  const prevRev = mi > 0 ? slicedRev[mi - 1] : 0;
  const curTrend = prevRev > 0 ? Math.round((curRev / prevRev - 1) * 100) : 0;

  const monthlyData = monthSlice.map((m, i) => ({
    name: m,
    revenue: D.totalRevenue[i],
    cos: D.totalCOS[i],
    gp: D.grossProfit[i],
    opex: D.totalOpex[i],
    np: D.netProfit[i],
    gm: D.gmPct[i],
  }));

  return (
    <div>
      <SectionHeader
        title="Commercial Performance Snapshot"
        subtitle={`FY2026 YTD — Jul 2025 to ${monthLabel} (${monthCount} month${monthCount > 1 ? 's' : ''} accrual)`}
      />
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
        <KPITile label="Total Assets" value={fmtFull(D.balanceSheet.totalAssets)} status="green" />
        <KPITile label="Total Liabilities" value={fmtFull(D.balanceSheet.totalLiabilities)} status="red" />
        <KPITile label="Net Equity" value={fmtFull(D.balanceSheet.equity.total)} status={D.balanceSheet.equity.total < 0 ? 'red' : 'green'} />
        <KPITile label="Bank Balance (Xero)" value={fmtFull(D.balanceSheet.bankBalance)} status="amber" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
        <KPITile label="GST Liability" value={fmtFull(D.balanceSheet.gst)} status="red" />
        <KPITile label="PAYG Withholding" value={fmtFull(D.balanceSheet.paygWithholding)} status="red" />
        <KPITile label="ATO Clearing" value={fmtFull(D.balanceSheet.atoClearing)} sub="Credit balance" status="green" />
        <KPITile label="Director Loans" value={fmtFull(D.balanceSheet.directorLoans.total)} status="amber" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <KPITile label="Total Loans Outstanding" value={fmtFull(D.balanceSheet.loans.total)} status="red" />
        <KPITile label="Fixed Assets" value={fmtFull(D.balanceSheet.fixedAssets.total)} sub="Trucks, bins, equipment" status="green" />
        <KPITile label="Current Year Earnings" value={fmtFull(D.balanceSheet.equity.currentYearEarnings)} status={D.balanceSheet.equity.currentYearEarnings > 0 ? 'green' : 'red'} />
      </div>
    </div>
  );
}
