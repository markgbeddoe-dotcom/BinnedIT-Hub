import React from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { B, fmtFull } from '../../theme';
import { KPITile, SectionHeader, ChartCard, CustomTooltip } from '../UIComponents';
import * as D from '../../data/financials';

export default function BDMTab({ data, selectedMonth, monthCount, monthLabel }) {
  return (
    <div>
      <SectionHeader title="Business Development" subtitle="New customers, dormant accounts, pipeline" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <KPITile label={`New Customers (${monthLabel})`} value={D.newCustomersFeb.length} status="green" />
        <KPITile label="Dormant (90+ days)" value={D.dormantCustomers.length} status="red" />
        <KPITile label="Net Movement" value={`${D.newCustomersFeb.length - D.dormantCustomers.length}`} status="red" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ChartCard title={`New Customers — ${monthLabel} (${D.newCustomersFeb.length})`}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 320 }}>
              <ResponsiveContainer width="100%" height={Math.max(180, D.newCustomersFeb.length * 40)}>
                <BarChart
                  data={[...D.newCustomersFeb].sort((a, b) => b.revenue - a.revenue)}
                  layout="vertical"
                  margin={{ left: 10, right: 20, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E0E0E0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: B.textMuted, fontSize: 10 }} tickFormatter={v => '$' + Math.round(v / 1000) + 'k'} />
                  <YAxis type="category" dataKey="name" tick={{ fill: B.textSecondary, fontSize: 10 }} width={120} />
                  <Tooltip content={<CustomTooltip formatter={v => fmtFull(v)} />} />
                  <Bar dataKey="revenue" fill={B.green} name="Revenue" radius={[0, 4, 4, 0]} barSize={20}>
                    {D.newCustomersFeb.map((c, i) => (
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
    </div>
  );
}
