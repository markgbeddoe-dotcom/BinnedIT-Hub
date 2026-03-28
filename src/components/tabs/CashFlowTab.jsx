import React from 'react';
import { ComposedChart, BarChart, Bar, Line, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function CashFlowTab({ data, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const monthSlice = D.months.slice(0, monthCount);
  const sum = arr => arr.reduce((a, b) => a + b, 0);

  const cashData = monthSlice.map((m, i) => ({
    name: m,
    Income: D.cashIncome[i],
    Expenses: D.cashExpenses[i],
    Net: D.cashNetMovement[i],
    Balance: D.cashBalance[i],
  }));

  const projectionColors = [B.green, B.green, B.green, B.green, B.amber, B.amber];

  return (
    <div>
      <SectionHeader title="Cash Flow & Projections" subtitle={`Cash basis performance — YTD to ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label="True Cash (Westpac)" value="$99,334" status="green" large />
        <KPITile label="YTD Cash Net" value={fmtFull(D.cashNetMovement.slice(0, monthCount).reduce((a, b) => a + b, 0))} status="green" />
        <KPITile label="Monthly Loan Payments" value={fmtFull(D.monthlyLoanRepayments)} status="amber" />
        <KPITile label="Annual Debt Service" value={fmtFull(D.annualDebtService)} status="amber" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Cash In vs Cash Out (Monthly)">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={cashData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="Income" fill={B.green} name="Cash In" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Expenses" fill={B.red} name="Cash Out" radius={[3, 3, 0, 0]} />
                  <Line dataKey="Balance" stroke={B.yellow} strokeWidth={2} name="Running Balance" dot={{ fill: B.yellow, r: 3 }} />
                  <Legend />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="6-Month Cash Projection">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: 'Mar', projected: 108000 }, { name: 'Apr', projected: 115000 },
                  { name: 'May', projected: 105000 }, { name: 'Jun', projected: 95000 },
                  { name: 'Jul', projected: 82000 }, { name: 'Aug', projected: 71000 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="projected" name="Projected Balance" radius={[3, 3, 0, 0]}>
                    {projectionColors.map((c, i) => <Cell key={i} fill={c} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
