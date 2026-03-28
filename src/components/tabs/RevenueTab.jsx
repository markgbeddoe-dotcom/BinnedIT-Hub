import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';

export default function RevenueTab({ data, selectedMonth, monthCount, monthLabel }) {
  const monthSlice = D.months.slice(0, monthCount);

  const revCatData = monthSlice.map((m, i) => ({
    name: m,
    GW: D.revByCategory.generalWaste[i],
    Asb: D.revByCategory.asbestos[i],
    Soil: D.revByCategory.soil[i],
    Green: D.revByCategory.greenWaste[i],
    Other: D.revByCategory.other[i],
  }));

  const pieMixData = [
    { name: 'General Waste', value: D.revByCategory.generalWaste.slice(0, monthCount).reduce((a, b) => a + b, 0) },
    { name: 'Asbestos', value: D.revByCategory.asbestos.slice(0, monthCount).reduce((a, b) => a + b, 0) },
    { name: 'Soil', value: D.revByCategory.soil.slice(0, monthCount).reduce((a, b) => a + b, 0) },
    { name: 'Green Waste', value: D.revByCategory.greenWaste.slice(0, monthCount).reduce((a, b) => a + b, 0) },
    { name: 'Other', value: D.revByCategory.other.slice(0, monthCount).reduce((a, b) => a + b, 0) },
  ];

  const pieColors = [B.yellow, B.orange, '#8B6914', B.green, B.purple];

  return (
    <div>
      <SectionHeader title="Revenue Analysis" subtitle={`Revenue by category and trend — YTD to ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Revenue by Category (Monthly)">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revCatData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="name" tick={{ fill: B.textMuted, fontSize: 11 }} />
                  <YAxis tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="GW" stackId="a" fill={B.yellow} name="General Waste" />
                  <Bar dataKey="Asb" stackId="a" fill={B.orange} name="Asbestos" />
                  <Bar dataKey="Soil" stackId="a" fill="#8B6914" name="Soil" />
                  <Bar dataKey="Green" stackId="a" fill={B.green} name="Green Waste" />
                  <Bar dataKey="Other" stackId="a" fill={B.purple} name="Other" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Revenue Mix YTD">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieMixData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieColors.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtFull(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
