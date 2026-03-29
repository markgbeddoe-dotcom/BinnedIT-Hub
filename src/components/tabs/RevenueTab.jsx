import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useYTDFinancials } from '../../hooks/useMonthData';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import AIInsightsPanel from '../AIInsightsPanel';

export default function RevenueTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const monthSlice = D.months.slice(0, monthCount);

  const { data: ytdRows } = useYTDFinancials(reportMonth);

  // Build category data — if Supabase has it, use it; else fallback to D.*
  let revCatData, pieMixData;
  if (ytdRows && ytdRows.length > 0) {
    revCatData = ytdRows.map(r => {
      const d = new Date(r.report_month);
      const name = d.toLocaleDateString('en-AU', { month: 'short' });
      return {
        name,
        GW: r.rev_general || 0,
        Asb: r.rev_asbestos || 0,
        Soil: r.rev_soil || 0,
        Green: r.rev_green || 0,
        Other: r.rev_other || 0,
      };
    });
    pieMixData = [
      { name: 'General Waste', value: ytdRows.reduce((a, r) => a + (r.rev_general || 0), 0) },
      { name: 'Asbestos', value: ytdRows.reduce((a, r) => a + (r.rev_asbestos || 0), 0) },
      { name: 'Soil', value: ytdRows.reduce((a, r) => a + (r.rev_soil || 0), 0) },
      { name: 'Green Waste', value: ytdRows.reduce((a, r) => a + (r.rev_green || 0), 0) },
      { name: 'Other', value: ytdRows.reduce((a, r) => a + (r.rev_other || 0), 0) },
    ];
  } else {
    revCatData = monthSlice.map((m, i) => ({
      name: m,
      GW: D.revByCategory.generalWaste[i],
      Asb: D.revByCategory.asbestos[i],
      Soil: D.revByCategory.soil[i],
      Green: D.revByCategory.greenWaste[i],
      Other: D.revByCategory.other[i],
    }));
    pieMixData = [
      { name: 'General Waste', value: D.revByCategory.generalWaste.slice(0, monthCount).reduce((a, b) => a + b, 0) },
      { name: 'Asbestos', value: D.revByCategory.asbestos.slice(0, monthCount).reduce((a, b) => a + b, 0) },
      { name: 'Soil', value: D.revByCategory.soil.slice(0, monthCount).reduce((a, b) => a + b, 0) },
      { name: 'Green Waste', value: D.revByCategory.greenWaste.slice(0, monthCount).reduce((a, b) => a + b, 0) },
      { name: 'Other', value: D.revByCategory.other.slice(0, monthCount).reduce((a, b) => a + b, 0) },
    ];
  }

  const pieColors = [B.yellow, B.orange, '#8B6914', B.green, B.purple];

  const mi = (monthCount || 1) - 1;
  const ytdRev = pieMixData.reduce((a, c) => a + c.value, 0);
  const revenueContext = [
    `Period: YTD to ${monthLabel} (${monthCount} month${monthCount > 1 ? 's' : ''})`,
    `YTD Revenue: $${Math.round(ytdRev).toLocaleString('en-AU')}`,
    `This month revenue: $${Math.round(D.totalRevenue[mi] || 0).toLocaleString('en-AU')}`,
    `Revenue by category (YTD): ${pieMixData.map(c => `${c.name}: $${Math.round(c.value).toLocaleString('en-AU')}`).join(', ')}`,
    `Top category: ${pieMixData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A'}`,
    `Gross Margin this month: ${D.gmPct[mi] || 0}%`,
  ].join('\n');

  return (
    <div>
      <SectionHeader title="Revenue Analysis" subtitle={`Revenue by category and trend — YTD to ${monthLabel}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <ChartCard title="Revenue by Category (Monthly)">
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 300 }}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
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
            <div style={{ minWidth: 280 }}>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 280}>
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
      <AIInsightsPanel
        tabName="Revenue Analysis"
        contextSummary={revenueContext}
        selectedMonth={reportMonth}
        selLabel={monthLabel}
      />
    </div>
  );
}
