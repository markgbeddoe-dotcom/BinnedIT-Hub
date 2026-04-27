import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { B, fmt, fmtFull } from '../../theme';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useBinPerformance } from '../../hooks/useMonthData';

// Transform Supabase bin_type_performance rows into chart-compatible format
function transformBinPerf(rows) {
  return rows.map(r => ({
    name: r.bin_type,
    income: r.revenue || 0,
    delivered: r.deliveries || 0,
    avgRate: r.avg_price || 0,
    avgDays: r.avg_hire_days || 0,
    netMarginPct: r.net_margin_pct || 0,
  })).sort((a, b) => b.income - a.income);
}

export default function FleetTab({ data, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const reportMonth = selectedMonth ? `${selectedMonth}-01` : null;
  const { data: binPerfData, isLoading, isError } = useBinPerformance(reportMonth);

  const useSupabase = binPerfData && binPerfData.length > 0;
  const chartData = useSupabase ? transformBinPerf(binPerfData) : D.binTypesData;

  return (
    <div>
      <SectionHeader title="Fleet & Utilisation" subtitle={`Bin type performance — ${monthLabel}`} />

      {isLoading && (
        <div style={{ color: B.textMuted, fontSize: 13, padding: '12px 0', marginBottom: 12 }}>
          Loading bin performance data...
        </div>
      )}

      {isError && (
        <div style={{ background: `${B.amber}15`, border: `1px solid ${B.amber}40`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: B.amber }}>
          Using hardcoded fallback data — Supabase unavailable
        </div>
      )}

      {!useSupabase && !isLoading && (
        <div style={{ background: `${B.yellow}10`, border: `1px solid ${B.yellow}30`, borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 12, color: B.textMuted }}>
          Showing Feb 2026 hardcoded data — no Supabase data for {monthLabel}
        </div>
      )}

      <ChartCard title={`Top Earning Bin Types (${monthLabel})`}>
        <ResponsiveContainer width="99%" height={isMobile ? 220 : 300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" />
            <XAxis type="number" tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => fmt(v)} />
            <YAxis type="category" dataKey="name" tick={{ fill: B.textSecondary, fontSize: 11 }} width={110} />
            <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
            <Bar dataKey="income" fill={B.yellow} name="Income" barSize={16} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Summary table */}
      <div style={{ marginTop: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${B.cardBorder}` }}>
              {['Bin Type', 'Income', 'Deliveries', 'Avg Rate', 'Avg Days', 'Net Margin'].map((h, i) => (
                <th key={i} style={{ padding: '8px 10px', textAlign: i === 0 ? 'left' : 'right', fontFamily: 'DM Mono, monospace', fontSize: 10, color: B.textMuted, textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${B.cardBorder}` }}>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: B.textPrimary }}>{row.name}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: B.yellow }}>{fmtFull(row.income)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: B.textSecondary }}>{row.delivered}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: B.textSecondary }}>{fmtFull(row.avgRate)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: B.textMuted }}>{row.avgDays}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: row.netMarginPct < 0 ? B.red : row.netMarginPct < 10 ? B.amber : B.green }}>
                  {row.netMarginPct !== undefined ? `${row.netMarginPct}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
