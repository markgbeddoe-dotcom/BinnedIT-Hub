import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function DebtorsTab({ data, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const arChartData = Object.entries(D.arData).map(([k, v]) => ({ name: k, value: v }));
  const arColors = [B.green, B.yellow, B.amber, B.orange, B.red, '#991B1B'];

  return (
    <div>
      <SectionHeader title="Debtors & AR Aging" subtitle={`Who owes money and how overdue — as at ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total AR" value={fmtFull(D.arTotal)} status="yellow" />
        <KPITile label="Current" value={fmtFull(D.arData.Current)} sub={`${(D.arData.Current / D.arTotal * 100).toFixed(0)}%`} status="green" />
        <KPITile label="Overdue" value={fmtFull(D.arOverdue)} sub={`${(D.arOverdue / D.arTotal * 100).toFixed(0)}%`} status="red" />
        <KPITile label="Older (90+ days)" value={fmtFull(D.arData.Older)} status="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ChartCard title="AR Aging Breakdown">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 300 }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={arChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {arColors.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtFull(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Top 10 Debtors (by aging)">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={Math.max(250, D.topDebtors.length * 35)}>
                <BarChart data={D.topDebtors} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fill: B.textSecondary, fontSize: 9 }} width={110} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="current" stackId="a" fill={B.green} name="Current" barSize={18} />
                  <Bar dataKey="under1m" stackId="a" fill={B.amber} name="<30 days" />
                  <Bar dataKey="m1" stackId="a" fill={B.orange} name="30-60" />
                  <Bar dataKey="m2" stackId="a" fill="#E07050" name="60-90" />
                  <Bar dataKey="m3" stackId="a" fill={B.red} name="90+" />
                  <Bar dataKey="older" stackId="a" fill="#8B3040" name="120+" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
