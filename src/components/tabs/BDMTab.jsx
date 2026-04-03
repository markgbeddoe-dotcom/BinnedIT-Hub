import React from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { B, fmtFull, fontHead } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';
import { useAcquisitions, useChurnSignals } from '../../hooks/useMonthData';
import { useBreakpoint } from '../../hooks/useBreakpoint';

export default function BDMTab({ reportId, reportMonth, selectedMonth, monthCount, monthLabel }) {
  const { isMobile } = useBreakpoint();
  const { data: acquisitionRows, isLoading } = useAcquisitions(reportMonth);
  const { data: churnSignals = [] } = useChurnSignals(reportMonth);

  // Use Supabase data if available, else fallback to D.*
  const useSupabase = acquisitionRows && acquisitionRows.length > 0;
  const newCustomers = useSupabase
    ? acquisitionRows.map(r => ({
        name: r.customer_name,
        firstJob: r.first_job_date || '',
        jobs: r.jobs_in_month || 0,
        revenue: r.revenue_in_month || 0,
        type: r.customer_type || 'Commercial',
      }))
    : D.newCustomersFeb;

  return (
    <div>
      <SectionHeader title="Business Development" subtitle="New customers, dormant accounts, pipeline" />
      {isLoading && (
        <div style={{ padding: '8px 0', fontSize: 12, color: B.textMuted, marginBottom: 8 }}>Loading acquisition data...</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label={`New Customers (${monthLabel})`} value={newCustomers.length} status="green" />
        <KPITile label="Dormant (90+ days)" value={D.dormantCustomers.length} status="red" />
        <KPITile label="Net Movement" value={`${newCustomers.length - D.dormantCustomers.length}`} status="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <ChartCard title={`New Customers — ${monthLabel} (${newCustomers.length})`}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={Math.max(180, newCustomers.length * 40)}>
                <BarChart
                  data={[...newCustomers].sort((a, b) => b.revenue - a.revenue)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fill: B.textSecondary, fontSize: 10 }} width={120} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.green} name="Revenue" radius={[0, 4, 4, 0]} barSize={20}>
                    {newCustomers.map((c, i) => (
                      <Cell key={i} fill={c.type === 'Commercial' ? B.green : c.type === 'Builder' ? B.blue : c.type === 'Industrial' ? B.cyan : B.amber} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[{ l: 'Commercial', c: B.green }, { l: 'Builder', c: B.blue }, { l: 'Industrial', c: B.cyan }, { l: 'Domestic', c: B.amber }].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: t.c }} />
                <span style={{ fontSize: 9, color: B.textMuted }}>{t.l}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title={`Dormant Accounts (${D.dormantCustomers.length})`}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={Math.max(180, Math.min(D.dormantCustomers.length, 10) * 40)}>
                <BarChart
                  data={[...D.dormantCustomers].sort((a, b) => b.totalYTD - a.totalYTD).slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fill: B.textSecondary, fontSize: 10 }} width={120} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="totalYTD" fill={B.red} name="YTD Revenue (Lost)" radius={[0, 4, 4, 0]} barSize={20} opacity={0.7}>
                    {D.dormantCustomers.map((c, i) => (
                      <Cell key={i} fill={c.aging === 'Older' ? B.red : B.orange} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center' }}>
            {[{ l: '90+ days', c: B.orange }, { l: '6+ months', c: B.red }].map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: t.c }} />
                <span style={{ fontSize: 9, color: B.textMuted }}>{t.l}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Churn Risk Alerts */}
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: B.textPrimary, margin: 0, fontFamily: fontHead, textTransform: 'uppercase' }}>
            Customer Churn Risk
          </h3>
          <p style={{ fontSize: 12, color: B.textSecondary, margin: '2px 0 0' }}>
            Customers with &gt;40% drop in activity vs 3-month average — requires follow-up
          </p>
        </div>
        {churnSignals.length === 0 ? (
          <div style={{ background: B.cardBg, border: `1px solid ${B.cardBorder}`, borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 13, color: B.textMuted }}>
              No churn signals detected.
              {' '}
              <span style={{ fontSize: 11 }}>
                (Requires at least 3 months of customer order data in Supabase to analyse.)
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 10 }}>
            {churnSignals.slice(0, 8).map((s, i) => (
              <div key={i} style={{
                background: B.cardBg, border: `1px solid ${B.red}40`, borderLeft: `3px solid ${B.red}`,
                borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: B.textPrimary }}>{s.customer_name}</div>
                  <div style={{ fontSize: 11, color: B.textMuted, marginTop: 2 }}>
                    Avg: {fmtFull(s.avg_revenue)} → Now: {fmtFull(s.current_revenue)}
                  </div>
                </div>
                <div style={{
                  background: s.drop_pct >= 80 ? `${B.red}20` : `${B.orange}20`,
                  color: s.drop_pct >= 80 ? B.red : B.orange,
                  borderRadius: 6, padding: '4px 10px', fontFamily: fontHead, fontSize: 13, fontWeight: 700,
                }}>
                  ↓{s.drop_pct}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
