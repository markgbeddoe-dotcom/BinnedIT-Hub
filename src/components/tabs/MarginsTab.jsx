import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useFinancials, useYTDFinancials } from '../../hooks/useMonthData';

export default function MarginsTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const mi = monthCount - 1;
  const monthSlice = D.months.slice(0, monthCount);

  const { data: financials } = useFinancials(reportMonth);
  const { data: ytdRows } = useYTDFinancials(reportMonth);

  const sum = arr => arr.reduce((a, b) => a + b, 0);

  // Build chart data — prefer Supabase YTD rows
  let monthlyData, costData;
  if (ytdRows && ytdRows.length > 0) {
    monthlyData = ytdRows.map(r => {
      const d = new Date(r.report_month);
      const name = d.toLocaleDateString('en-AU', { month: 'short' });
      return {
        name,
        cos: r.cos_total || 0,
        opex: r.opex_total || 0,
        np: r.net_profit || 0,
        gm: r.gross_margin_pct || 0,
      };
    });
    costData = ytdRows.map(r => {
      const d = new Date(r.report_month);
      const name = d.toLocaleDateString('en-AU', { month: 'short' });
      return {
        name,
        Wages: r.cos_wages || 0,
        Fuel: r.cos_fuel || 0,
        Repairs: r.cos_repairs || 0,
        Rent: r.opex_rent || 0,
      };
    });
  } else {
    monthlyData = monthSlice.map((m, i) => ({
      name: m,
      cos: D.totalCOS[i],
      opex: D.totalOpex[i],
      np: D.netProfit[i],
      gm: D.gmPct[i],
    }));
    costData = monthSlice.map((m, i) => ({
      name: m,
      Wages: D.wages[i],
      Fuel: D.fuelCosts[i],
      Repairs: D.repairs[i],
      Rent: D.rent[i],
    }));
  }

  // KPI values — prefer live data, fallback to D.*
  const curCOS = financials?.cos_total ?? D.totalCOS[mi];
  const curOpex = financials?.opex_total ?? D.totalOpex[mi];
  const curFuel = financials?.cos_fuel ?? D.fuelCosts[mi];
  const prevOpex = mi > 0
    ? (ytdRows && ytdRows.length >= 2 ? (ytdRows[ytdRows.length - 2]?.opex_total || D.totalOpex[mi - 1]) : D.totalOpex[mi - 1])
    : 0;

  const avgCOS = ytdRows && ytdRows.length > 0
    ? ytdRows.reduce((a, r) => a + (r.cos_total || 0), 0) / ytdRows.length
    : sum(D.totalCOS.slice(0, monthCount)) / monthCount;

  const opexTrend = prevOpex > 0 ? Math.round((curOpex / prevOpex - 1) * 100) : 0;

  return (
    <div>
      <SectionHeader title="Margin & Cost Analysis" subtitle={`COS, operating expenses, and cost drivers — YTD to ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label={`${monthLabel} COS`} value={fmtFull(curCOS)} sub={mi === 7 ? '! Likely incomplete' : ''} status={mi === 7 ? 'red' : 'yellow'} />
        <KPITile label="Avg Monthly COS" value={fmtFull(avgCOS)} status="yellow" />
        <KPITile label={`${monthLabel} Opex`} value={fmtFull(curOpex)} trend={opexTrend} status="green" />
        <KPITile label={`${monthLabel} Fuel`} value={fmtFull(curFuel)} sub={mi === 7 ? '! Appears unposted' : ''} status={mi === 7 ? 'red' : 'yellow'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Monthly COS vs Operating Expenses">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="cos" fill={B.red} name="COS" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opex" fill={B.amber} name="Opex" radius={[3, 3, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Cost Drivers (Monthly)">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={costData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Line dataKey="Wages" stroke={B.yellow} strokeWidth={2} />
                  <Line dataKey="Fuel" stroke={B.red} strokeWidth={2} />
                  <Line dataKey="Repairs" stroke={B.orange} strokeWidth={2} />
                  <Line dataKey="Rent" stroke={B.blue} strokeWidth={2} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
