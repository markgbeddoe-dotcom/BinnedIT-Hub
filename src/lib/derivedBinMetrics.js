/**
 * @file derivedBinMetrics.js
 * Per-bin cost detail + derived loss-making detection (Sprint 14 #15).
 *
 * The legacy "loss-making bin types" alert in PricingTab read `pricingData[].np`
 * straight from the hand-curated YTD summary in `src/data/financials.js`. This
 * module computes the same classification from LIVE month data — proportional
 * COS + Opex split by revenue share, then per-job rollups — so the dashboard
 * can drill into "why is this bin losing money?" instead of trusting a static
 * label baked into the source.
 *
 * Companion DB columns are added by `supabase/migrations/018_per_bin_cost_detail.sql`.
 *
 * The COS / Opex sub-category ratios mirror those in `src/data/costAllocator.js`
 * so per-job line items reconcile to the same shape PricingTab already renders.
 */

// COS sub-category split (skip bin business: tipping is the dominant direct cost)
const COS_RATIOS = {
  tipping: 0.70,
  fuel: 0.10,
  wagesDirect: 0.12,
  tolls: 0.05,
  repairs: 0.03,
};

// Opex sub-category split — mid-range fallbacks aligned with cost allocator P&L pulls.
// Caller may pass `opexRatios` to override (e.g. derived from financials_monthly).
const DEFAULT_OPEX_RATIOS = {
  wagesOverhead: 0.55,
  rent: 0.05,
  advertising: 0.03,
  fuel: 0.09,
  other: 0.28,
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Compute per-job cost detail + derived net margin for a single bin row.
 *
 * @param {object} rawBin            One row from bin_type_performance (or a
 *                                    pricingData entry shaped { revenue/rev,
 *                                    deliveries/jobs, bin_type/type }).
 * @param {number} monthCOS          Month's total Cost of Sales from financials_monthly.
 * @param {number} monthOpex         Month's total Operating Expenses.
 * @param {number} totalRevenue      Month's total revenue (denominator for
 *                                    proportional split).
 * @param {object} [opts]
 * @param {object} [opts.opexRatios] Override the default opex sub-category ratios.
 * @returns {object} per-job metrics matching the new DB columns + bin_type, deliveries,
 *                   revenue, revenue_per_job, total_cost_per_job, profit_per_job,
 *                   net_margin_pct_derived.
 */
export function computePerBinMetrics(rawBin, monthCOS, monthOpex, totalRevenue, opts = {}) {
  const opexRatios = { ...DEFAULT_OPEX_RATIOS, ...(opts.opexRatios || {}) };

  const binType = rawBin?.bin_type ?? rawBin?.type ?? '';
  const revenue = num(rawBin?.revenue ?? rawBin?.rev);
  const deliveries = num(rawBin?.deliveries ?? rawBin?.jobs);

  const total = num(totalRevenue);
  const revShare = total > 0 ? revenue / total : 0;

  // Proportional allocation: every bin gets COS/Opex in proportion to revenue share.
  const allocCOS = num(monthCOS) * revShare;
  const allocOpex = num(monthOpex) * revShare;
  const totalCost = allocCOS + allocOpex;
  const profit = revenue - totalCost;

  // Per-job rollups
  const revenuePerJob = deliveries > 0 ? revenue / deliveries : 0;
  const totalCostPerJob = deliveries > 0 ? totalCost / deliveries : 0;
  const profitPerJob = deliveries > 0 ? profit / deliveries : 0;
  const netMarginPctDerived = revenue > 0 ? (profit / revenue) * 100 : 0;

  // COS per-job line items
  const tippingPerJob = deliveries > 0 ? (allocCOS * COS_RATIOS.tipping) / deliveries : 0;
  const fuelCOSPerJob = deliveries > 0 ? (allocCOS * COS_RATIOS.fuel) / deliveries : 0;
  const wagesDirectPerJob = deliveries > 0 ? (allocCOS * COS_RATIOS.wagesDirect) / deliveries : 0;

  // Opex per-job line items — combine COS-fuel and Opex-fuel into a single fuel_per_job
  // figure (matches what PricingTab renders + matches the new fuel_per_job column).
  const fuelOpexPerJob = deliveries > 0 ? (allocOpex * opexRatios.fuel) / deliveries : 0;
  const fuelPerJob = fuelCOSPerJob + fuelOpexPerJob;

  const wagesOverheadPerJob = deliveries > 0 ? (allocOpex * opexRatios.wagesOverhead) / deliveries : 0;
  const rentPerJob = deliveries > 0 ? (allocOpex * opexRatios.rent) / deliveries : 0;
  const advertisingPerJob = deliveries > 0 ? (allocOpex * opexRatios.advertising) / deliveries : 0;
  const otherOpexPerJob = deliveries > 0 ? (allocOpex * opexRatios.other) / deliveries : 0;

  return {
    bin_type: binType,
    deliveries,
    revenue,
    revenue_per_job: revenuePerJob,
    tipping_per_job: tippingPerJob,
    fuel_per_job: fuelPerJob,
    wages_direct_per_job: wagesDirectPerJob,
    wages_overhead_per_job: wagesOverheadPerJob,
    rent_per_job: rentPerJob,
    advertising_per_job: advertisingPerJob,
    other_opex_per_job: otherOpexPerJob,
    total_cost_per_job: totalCostPerJob,
    profit_per_job: profitPerJob,
    net_margin_pct_derived: netMarginPctDerived,
    // convenience fields for downstream sorting / risk ranking
    alloc_cos: allocCOS,
    alloc_opex: allocOpex,
    profit_total: profit,
  };
}

/**
 * Filter to the loss-making subset.
 *
 * A bin is flagged when EITHER its profit_per_job is negative OR its derived
 * net margin sits below the materiality threshold (default 0% — i.e. true
 * losses only). Pass e.g. 5 to also flag "marginal" bins below 5% net.
 *
 * @param {object[]} metrics            Array of metrics from computePerBinMetrics.
 * @param {number} [materialityPct=0]   Net-margin floor below which a bin is flagged.
 * @returns {object[]} the loss-making subset (preserves input order).
 */
export function flagLossMakers(metrics, materialityPct = 0) {
  if (!Array.isArray(metrics)) return [];
  return metrics.filter((m) => {
    if (!m || m.deliveries <= 0) return false;
    return m.profit_per_job < 0 || m.net_margin_pct_derived < materialityPct;
  });
}

/**
 * Rank bins by total monthly bleed: |profit_per_job| × deliveries.
 *
 * A bin losing $50/job × 100 deliveries ($5k bleed) outranks a bin losing
 * $200/job × 5 deliveries ($1k bleed) because the dollar impact is greater.
 * Ties break on per-job loss size (deeper unit loss ranks higher).
 *
 * @param {object[]} metrics  Array of metrics from computePerBinMetrics.
 * @returns {object[]} sorted DESC by total bleed; profitable bins land at the bottom.
 */
export function riskRanking(metrics) {
  if (!Array.isArray(metrics)) return [];
  const scored = metrics.map((m) => {
    const lossPerJob = Math.max(0, -num(m?.profit_per_job));
    const deliveries = num(m?.deliveries);
    return { metric: m, bleed: lossPerJob * deliveries, lossPerJob };
  });
  scored.sort((a, b) => {
    if (b.bleed !== a.bleed) return b.bleed - a.bleed;
    return b.lossPerJob - a.lossPerJob;
  });
  return scored.map((s) => s.metric);
}
