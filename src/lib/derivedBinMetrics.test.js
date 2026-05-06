import { describe, it, expect } from 'vitest';
import {
  computePerBinMetrics,
  flagLossMakers,
  riskRanking,
} from './derivedBinMetrics';

describe('computePerBinMetrics', () => {
  it('returns sensible per-job numbers for a healthy bin', () => {
    // Bin: revenue 10000 / deliveries 20 / proportional COS 4000 / proportional Opex 3000
    // Revenue share = 1.0 (single bin = 100% of total revenue 10000),
    // so COS/Opex pass through 1:1.
    const bin = { bin_type: '6m General Waste', revenue: 10000, deliveries: 20 };
    const m = computePerBinMetrics(bin, 4000, 3000, 10000);

    expect(m.bin_type).toBe('6m General Waste');
    expect(m.deliveries).toBe(20);
    expect(m.revenue).toBe(10000);
    expect(m.revenue_per_job).toBe(500);
    expect(m.total_cost_per_job).toBe(350);
    expect(m.profit_per_job).toBe(150);
    expect(m.net_margin_pct_derived).toBe(30);
  });

  it('splits COS + Opex proportionally to revenue share', () => {
    // Bin contributes half the total revenue → gets half the COS/Opex.
    const bin = { bin_type: '4m General Waste', revenue: 5000, deliveries: 10 };
    const m = computePerBinMetrics(bin, 4000, 3000, 10000);

    expect(m.alloc_cos).toBe(2000);  // 4000 * 0.5
    expect(m.alloc_opex).toBe(1500); // 3000 * 0.5
    expect(m.total_cost_per_job).toBe(350); // (2000+1500)/10
    expect(m.profit_per_job).toBe(150);     // 500 - 350
  });

  it('returns zeroed per-job values when deliveries is 0', () => {
    const bin = { bin_type: 'Idle', revenue: 0, deliveries: 0 };
    const m = computePerBinMetrics(bin, 4000, 3000, 10000);

    expect(m.revenue_per_job).toBe(0);
    expect(m.total_cost_per_job).toBe(0);
    expect(m.profit_per_job).toBe(0);
    expect(m.net_margin_pct_derived).toBe(0);
  });

  it('accepts legacy pricingData shape (rev/jobs/type)', () => {
    const legacy = { type: '8m Asbestos', rev: 10000, jobs: 20 };
    const m = computePerBinMetrics(legacy, 4000, 3000, 10000);

    expect(m.bin_type).toBe('8m Asbestos');
    expect(m.deliveries).toBe(20);
    expect(m.revenue_per_job).toBe(500);
  });

  it('exposes per-job tipping/fuel/rent breakdown columns', () => {
    const bin = { bin_type: '6m General Waste', revenue: 10000, deliveries: 20 };
    const m = computePerBinMetrics(bin, 4000, 3000, 10000);

    // tipping = 70% of allocated COS / deliveries = 0.70 * 4000 / 20 = 140
    expect(m.tipping_per_job).toBeCloseTo(140, 5);
    // wages_direct = 12% of allocated COS / deliveries
    expect(m.wages_direct_per_job).toBeCloseTo((0.12 * 4000) / 20, 5);
    // rent_per_job > 0 from default opex ratios
    expect(m.rent_per_job).toBeGreaterThan(0);
    expect(m.advertising_per_job).toBeGreaterThan(0);
  });
});

describe('flagLossMakers', () => {
  const sample = [
    // healthy
    { bin_type: 'A', deliveries: 20, profit_per_job: 150, net_margin_pct_derived: 30 },
    // unit loss
    { bin_type: 'B', deliveries: 10, profit_per_job: -50, net_margin_pct_derived: -10 },
    // breakeven (skin-of-teeth)
    { bin_type: 'C', deliveries: 5, profit_per_job: 5, net_margin_pct_derived: 1 },
    // healthy
    { bin_type: 'D', deliveries: 30, profit_per_job: 80, net_margin_pct_derived: 12 },
    // dormant — should be excluded
    { bin_type: 'E', deliveries: 0, profit_per_job: -100, net_margin_pct_derived: -50 },
  ];

  it('returns only the loss-making subset at default 0% threshold', () => {
    const out = flagLossMakers(sample);
    expect(out.map((m) => m.bin_type)).toEqual(['B']);
  });

  it('supports a materiality threshold to also flag marginal bins', () => {
    const out = flagLossMakers(sample, 5);
    expect(out.map((m) => m.bin_type).sort()).toEqual(['B', 'C']);
  });

  it('returns [] for non-array input', () => {
    expect(flagLossMakers(null)).toEqual([]);
    expect(flagLossMakers(undefined)).toEqual([]);
  });
});

describe('riskRanking', () => {
  it('sorts by total bleed: $50/job × 100 deliveries ranks above $200/job × 5 deliveries', () => {
    const a = { bin_type: 'BIG_BLEED', deliveries: 100, profit_per_job: -50 };  // $5,000 bleed
    const b = { bin_type: 'DEEP_LOSS', deliveries: 5, profit_per_job: -200 };   // $1,000 bleed
    const c = { bin_type: 'PROFITABLE', deliveries: 50, profit_per_job: 30 };   // 0 bleed

    const ranked = riskRanking([b, c, a]);
    expect(ranked.map((m) => m.bin_type)).toEqual(['BIG_BLEED', 'DEEP_LOSS', 'PROFITABLE']);
  });

  it('places profitable bins at the bottom', () => {
    const losers = [
      { bin_type: 'L1', deliveries: 10, profit_per_job: -10 },
      { bin_type: 'L2', deliveries: 20, profit_per_job: -5 },
    ];
    const winners = [{ bin_type: 'W1', deliveries: 100, profit_per_job: 50 }];
    const ranked = riskRanking([...winners, ...losers]);
    expect(ranked[ranked.length - 1].bin_type).toBe('W1');
  });

  it('returns [] for non-array input', () => {
    expect(riskRanking(null)).toEqual([]);
  });
});
