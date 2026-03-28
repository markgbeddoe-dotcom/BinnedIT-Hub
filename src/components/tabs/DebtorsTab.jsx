import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useDebtors } from '../../hooks/useMonthData';

export default function DebtorsTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const { data: debtorRows, isLoading } = useDebtors(reportMonth);

  // Build AR data from Supabase or fallback to D.*
  let arChartData, topDebtorsData, arTotal, arOverdue, arCurrent, arOlder;
  if (debtorRows && debtorRows.length > 0) {
    // Aggregate from Supabase debtor rows
    arCurrent = debtorRows.reduce((a, r) => a + (r.current_amount || 0), 0);
    const ar30 = debtorRows.reduce((a, r) => a + (r.overdue_30 || 0), 0);
    const ar60 = debtorRows.reduce((a, r) => a + (r.overdue_60 || 0), 0);
    const ar90 = debtorRows.reduce((a, r) => a + (r.overdue_90plus || 0), 0);
    const arOlderBucket = debtorRows.reduce((a, r) => a + (r.older_bucket || 0), 0);
    arTotal = debtorRows.reduce((a, r) => a + (r.total_outstanding || 0), 0);
    arOverdue = ar30 + ar60 + ar90 + arOlderBucket;
    arOlder = arOlderBucket;
    arChartData = [
      { name: 'Current', value: arCurrent },
      { name: '< 1 Month', value: ar30 },
      { name: '1 Month', value: ar60 },
      { name: '2 Months', value: ar90 },
      { name: 'Older', value: arOlderBucket },
    ];
    topDebtorsData = debtorRows.slice(0, 10).map(r => ({
      name: r.debtor_name,
      total: r.total_outstanding || 0,
      current: r.current_amount || 0,
      under1m: r.overdue_30 || 0,
      m1: r.overdue_60 || 0,
      m2: r.overdue_90plus || 0,
      m3: 0,
      older: r.older_bucket || 0,
    }));
  } else {
    // Fallback to D.*
    arChartData = Object.entries(D.arData).map(([k, v]) => ({ name: k, value: v }));
    topDebtorsData = D.topDebtors;
    arTotal = D.arTotal;
    arOverdue = D.arOverdue;
    arCurrent = D.arData.Current;
    arOlder = D.arData.Older;
  }

  const arColors = [B.green, B.yellow, B.amber, B.orange, B.red, '#991B1B'];

  return (
    <div>
      <SectionHeader title="Debtors & AR Aging" subtitle={`Who owes money and how overdue — as at ${monthLabel}`} />
      {isLoading && (
        <div style={{ padding: '8px 0', fontSize: 12, color: B.textMuted, marginBottom: 8 }}>Loading debtor data...</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="Total AR" value={fmtFull(arTotal)} status="yellow" />
        <KPITile label="Current" value={fmtFull(arCurrent)} sub={arTotal > 0 ? `${(arCurrent / arTotal * 100).toFixed(0)}%` : ''} status="green" />
        <KPITile label="Overdue" value={fmtFull(arOverdue)} sub={arTotal > 0 ? `${(arOverdue / arTotal * 100).toFixed(0)}%` : ''} status="red" />
        <KPITile label="Older (90+ days)" value={fmtFull(arOlder)} status="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
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
              <ResponsiveContainer width="100%" height={Math.max(250, topDebtorsData.length * 35)}>
                <BarChart data={topDebtorsData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
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
