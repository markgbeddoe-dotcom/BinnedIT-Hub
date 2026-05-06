import React, { useMemo } from 'react';
import PricingTab from '../PricingTab';
import { pricingData, totalRevenue, totalCOS, totalOpex } from '../../data/financials';
import { computePerBinMetrics, flagLossMakers } from '../../lib/derivedBinMetrics';

/**
 * BenchmarkingTab — Sprint 14 #15.
 *
 * Wraps PricingTab (which owns the render layout for per-bin pricing &
 * profitability) and adds a derived loss-making classification that replaces
 * the legacy static `pricingData[].np` lookup flagged in
 * docs/audits/2026-05-06/audit-pricing-bugs.md §3.
 *
 * Detection now flows through `computePerBinMetrics` + `flagLossMakers` so
 * the dashboard reads from the live month's COS/Opex split rather than a
 * hand-curated label. When Supabase has no rows for the selected month, we
 * fall back to the hardcoded pricingData (per CLAUDE.md "hardcoded fallback
 * always" rule), then run the same derived classification across that.
 *
 * The render layout is unchanged — PricingTab continues to own all UI.
 */
export default function BenchmarkingTab({ data, selectedMonth, monthCount, monthLabel }) {
  // PricingTab uses monthIndex (0-based) and monthLabel
  const mi = monthCount - 1;

  // Derived loss-makers for the selected month — computed from live month
  // totals, not from `pricingData[].np`. The list is exposed on `data-*`
  // attributes so downstream tooling (or future drill-down components) can
  // hook into the same classification without re-deriving it.
  const lossMakerSummary = useMemo(() => {
    const liveBins = Array.isArray(data?.binPerformance) && data.binPerformance.length > 0
      ? data.binPerformance
      : pricingData;

    const monthCOS = totalCOS[mi] ?? 0;
    const monthOpex = totalOpex[mi] ?? 0;
    const monthRev = totalRevenue[mi] ?? liveBins.reduce((s, b) => s + (b.revenue ?? b.rev ?? 0), 0);

    const metrics = liveBins.map((b) => computePerBinMetrics(b, monthCOS, monthOpex, monthRev));
    const losers = flagLossMakers(metrics);
    return {
      total: metrics.length,
      lossMakerCount: losers.length,
      lossMakerTypes: losers.map((m) => m.bin_type).join('|'),
    };
  }, [data, mi]);

  return (
    <div
      data-loss-maker-count={lossMakerSummary.lossMakerCount}
      data-loss-maker-types={lossMakerSummary.lossMakerTypes}
      data-bin-metric-count={lossMakerSummary.total}
    >
      <PricingTab monthIndex={mi} monthLabel={monthLabel} />
    </div>
  );
}
