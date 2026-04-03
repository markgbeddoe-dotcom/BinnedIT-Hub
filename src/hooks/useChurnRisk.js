/**
 * useChurnRisk — detects customers with >40% drop in order frequency.
 *
 * Queries customer_acquisitions for the past 6 months, splits into:
 *   - "prior" period: months 3–6 ago (avg jobs/month)
 *   - "recent" period: months 1–2 (avg jobs/month)
 * Flags customers where recent avg is ≥40% lower than prior avg.
 *
 * Falls back to D.churnRiskCustomers hardcoded data when Supabase returns empty.
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import * as D from '../data/financials'

async function fetchChurnRisk() {
  // Build last 6 month-start dates
  const months = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().split('T')[0]);
  }
  const oldest = months[months.length - 1];

  const { data, error } = await supabase
    .from('customer_acquisitions')
    .select('customer_name, customer_type, jobs_in_month, revenue_in_month, report_month')
    .gte('report_month', oldest)
    .order('report_month', { ascending: true });

  if (error || !data || data.length === 0) return null;

  // Group by customer
  const byCustomer = {};
  for (const row of data) {
    if (!byCustomer[row.customer_name]) {
      byCustomer[row.customer_name] = { type: row.customer_type, revenue: 0, months: {} };
    }
    byCustomer[row.customer_name].months[row.report_month] = row.jobs_in_month || 0;
    byCustomer[row.customer_name].revenue += row.revenue_in_month || 0;
  }

  // recent = months[0..1] (1–2 months ago), prior = months[2..5] (3–6 months ago)
  const recentMonths = months.slice(0, 2);
  const priorMonths  = months.slice(2, 6);

  const atRisk = [];
  for (const [name, info] of Object.entries(byCustomer)) {
    const recentJobs = recentMonths.reduce((s, m) => s + (info.months[m] || 0), 0);
    const priorJobs  = priorMonths.reduce((s, m) => s + (info.months[m] || 0), 0);

    const avgRecent = recentJobs / recentMonths.length;
    const avgPrior  = priorJobs  / priorMonths.length;

    if (avgPrior < 0.5) continue; // ignore customers with nearly no prior history
    const drop = ((avgPrior - avgRecent) / avgPrior) * 100;
    if (drop >= 40) {
      const lastMonth = Object.keys(info.months).filter(m => info.months[m] > 0).sort().pop();
      const lastJobDate = lastMonth
        ? new Date(lastMonth).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
        : 'Unknown';
      atRisk.push({
        name,
        type: info.type || 'Commercial',
        avgPrior: Math.round(avgPrior * 10) / 10,
        avgRecent: Math.round(avgRecent * 10) / 10,
        drop: Math.round(drop),
        revenue: Math.round(info.revenue),
        lastJob: lastJobDate,
      });
    }
  }

  return atRisk.sort((a, b) => b.drop - a.drop);
}

export function useChurnRisk() {
  return useQuery({
    queryKey: ['churnRisk'],
    queryFn: async () => {
      const result = await fetchChurnRisk();
      return result && result.length > 0 ? result : D.churnRiskCustomers;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
