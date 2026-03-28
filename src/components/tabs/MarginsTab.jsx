import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function MarginsTab({ data, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const mi = monthCount - 1;
  const monthSlice = D.months.slice(0, monthCount);
  const slicedCOS = D.totalCOS.slice(0, monthCount);
  const slicedOpex = D.totalOpex.slice(0, monthCount);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  const monthlyData = monthSlice.map((m, i) => ({
    name: m,
    cos: D.totalCOS[i],
    opex: D.totalOpex[i],
    np: D.netProfit[i],
    gm: D.gmPct[i],
  }));

  const costData = monthSlice.map((m, i) => ({
    name: m,
    Wages: D.wages[i],
    Fuel: D.fuelCosts[i],
    Repairs: D.repairs[i],
    Rent: D.rent[i],
  }));

  return (
    <div>
      <SectionHeader title="Margin & Cost Analysis" subtitle={`COS, operating expenses, and cost drivers — YTD to ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label={`${monthLabel} COS`} value={fmtFull(slicedCOS[mi])} sub={mi === 7 ? '! Likely incomplete' : ''} status={mi === 7 ? 'red' : 'yellow'} />
        <KPITile label="Avg Monthly COS" value={fmtFull(sum(slicedCOS) / monthCount)} status="yellow" />
        <KPITile label={`${monthLabel} Opex`} value={fmtFull(slicedOpex[mi])} trend={mi > 0 ? Math.round((slicedOpex[mi] / slicedOpex[mi - 1] - 1) * 100) : 0} status="green" />
        <KPITile label={`${monthLabel} Fuel`} value={fmtFull(D.fuelCosts[mi])} sub={mi === 7 ? '! Appears unposted' : ''} status={mi === 7 ? 'red' : 'yellow'} />
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
