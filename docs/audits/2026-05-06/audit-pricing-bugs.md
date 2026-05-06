# SkipSync Pricing Audit

**Auditor:** Subagent (Explore lens), 2026-05-06
**Severity:** P0 — pricing data drives live business decisions; multiple unresolved inconsistencies make the data unreliable

## Executive summary

Mark, the pricing system has multiple unresolved inconsistencies that compound. The same "average price" metric is calculated differently across tabs, bin type names don't match between hardcoded fallback and Supabase schema, and there's no unified contract for what "price" means. For a business using this for live pricing decisions on bin types, this is a data integrity issue.

**Critical findings:**
1. **Pricing formula divergence** — PricingTab calculates avg rate as `Math.round(revenue / jobs)`; FleetTab pulls `avg_price` directly from Supabase. Different denominator/rounding logic.
2. **Bin type name fragmentation** — three parallel naming conventions ("WMF - 6m", "6m General Waste", "6m³ GW") with manual mapping prone to breakage.
3. **Loss-making bin detection is hardcoded** — flags a static `np` field, not a derived metric from live cost allocation.
4. **Competitor join is fragile** — name-string lookups with no normalization.
5. **Money rounding is ad-hoc** — `Math.round`, `.toFixed`, and unrounded floats mixed throughout.

## Inconsistencies

### 1. Divergent pricing formulas

**PricingTab.jsx:73-77** — `avgRate = Math.round(revenue / jobs)` (whole dollars)
**FleetTab.jsx:10-18** — `avgRate = r.avg_price` (numeric(10,2) from Supabase, fractional cents possible)

Same metric label, different calculation. Side-by-side these will diverge.

### 2. Bin type naming fragmentation

| Source | Example names | Used in |
|---|---|---|
| `binTypesData` (financials.js:52-63) | "WMF - 6m", "ASB - 8m", "6M CONT SOIL" | FleetTab fallback |
| `pricingData` (financials.js:75-94) | "6m General Waste", "8m Asbestos", "8m Soil" | PricingTab + cost allocator |
| Competitor service list (CompetitorPage.jsx:7-13) | "4m³ GW", "6m³ Asbestos" | competitor rate matrix |
| Supabase `bin_type_performance.bin_type` | (no constraint) | Live data source |

**Critical mapping in PricingTab.jsx:8-15:**
```js
const binNameMap = {
  'WMF - 4m': '4m General Waste',
  'WMF - 6m': '6m General Waste',
  'ASB - 6m': '6m Asbestos',
  '6M CONT SOIL': '8m Soil',
  // ...15 entries, manually maintained
};
```

Risk: a single Bin-Manager rename ("ASB-6M" → "ASB - 6m" off by one space) silently drops a bin from profitability analysis.

### 3. Loss-making bin detection — hardcoded

**PricingTab.jsx:160-177:**
```js
if (d.feb.np < 0) {
  const shortfall = pj.totalCost - pj.revenue;
  let text = d.type + ': Losing ' + fmtFull(Math.abs(pj.profit)) + '/job this month...';
}
```

`d.feb.np` comes from `pricingData` static data (financials.js:76, e.g. `np: 3.8` for "6m General Waste"). Pre-calculated at data load, never recomputed from live cost allocation.

The cost allocator (`costAllocator.js:173`) computes `profitPct = (profit / scaledRev) * 100` — a different number. The two don't reconcile. Alerts trigger off the static `np`, not the computed one.

**Consequence:** A bin type with `np: -2.6` in static data but +1.2% via the allocator gets flagged but isn't actually losing money. Or vice versa — a bin losing money in live data goes unflagged because static `np` is positive.

### 4. Competitor rate join is fragile

**CompetitorPage.jsx:7-19** lists default services like `'4m³ GW'`, `'6m³ Asbestos'`. Match logic at line 152: `c.rates[service]` direct property lookup.

If a competitor enters their rate as `"4m General Waste"` or `"4 GW"` or any case variant, the lookup fails silently — no rate, no comparison, no alert.

`competitor_rates` table has no CHECK constraint on `bin_type` — Supabase accepts any string.

### 5. Rounding inconsistency

| Location | Formula | Rounding |
|---|---|---|
| PricingTab.jsx:18 | `Math.round(v / 1.1)` | Whole dollars |
| PricingTab.jsx:74 | `Math.round(estIncome / estJobs)` | Whole dollars |
| PricingTab.jsx:111 | `Math.round(avgMonthRev / avgMonthJobs)` | Whole dollars |
| PricingTab.jsx:155 | `Number((...).toFixed(0))` | String → int |
| PricingTab.jsx:198 | `.toFixed(1)` | String, 1 decimal |
| costAllocator.js:173 | None | Floating point |

## Calculation traces

### Average price per bin type (Feb 2026)

- **PricingTab:** `pricingData[i].rev / pricingData[i].jobs`, rounded to whole dollars → `865`
- **FleetTab Supabase:** `bin_type_performance.avg_price` → `865.00` or `865.50` (fractional)
- **CompetitorPage:** hardcoded `binnedItRates['6m³ GW'] = 865` (no calculation)

If PricingTab shows "$865" and FleetTab shows "$863", users will (rightly) question correctness.

### Net profit % per bin type

Three different NP% values can exist simultaneously:
- `pricingData.np` = 3.8% (hardcoded YTD, irrelevant after month selection)
- `ytdAllocated[i].alloc.profitPct` = e.g. 3.23% (allocator)
- `d.feb.np` = e.g. 2.95% (fresh per-month computation)

The alert that fires off `d.feb.np < 0` is using the third — but the dashboard often displays the first.

### Loss-making bin detection

1. Alert triggers off `d.feb.np < 0` (pricing static data + per-month overlay)
2. `curProfit = cur.income - curTotalCost` where `curTotalCost = curDirectCost + curOverhead`
3. `curDirectCost = curCOS * curRevShare` (cost allocator scaling)

If allocator scaling is wrong (e.g. scales to 110% of actual COS), `curProfit` is artificially low → false positive alert. Conversely, if allocator over-distributes COS to "Other" bin types, real loss-makers escape detection.

## Recommended unified contract

### 1. Standardize bin type names — "Xm [Category]"
- Adopt `'4m General Waste'`, `'6m Asbestos'`, etc. as canonical
- Add CHECK constraint to `bin_type_performance.bin_type` and `competitor_rates.bin_type`
- Reject inserts that don't match the enum

### 2. Unify price calculation
- Define: `avg_price = revenue / deliveries` (ex GST), rounded to nearest cent at calc time
- Document this in `bin_type_performance` schema comment
- PricingTab and FleetTab use the same helper (e.g. `roundMoney()`)

### 3. Per-bin cost detail in schema
```sql
ALTER TABLE bin_type_performance ADD COLUMN
  tipping_per_job NUMERIC(10,2) DEFAULT 0,
  fuel_per_job NUMERIC(10,2) DEFAULT 0,
  wages_direct_per_job NUMERIC(10,2) DEFAULT 0,
  wages_overhead_per_job NUMERIC(10,2) DEFAULT 0,
  rent_per_job NUMERIC(10,2) DEFAULT 0,
  advertising_per_job NUMERIC(10,2) DEFAULT 0,
  other_opex_per_job NUMERIC(10,2) DEFAULT 0,
  total_cost_per_job NUMERIC(10,2) DEFAULT 0,
  profit_per_job NUMERIC(10,2) DEFAULT 0;
```

This gives drill-down for "why is this bin losing money?"

### 4. Document fallback data with effective dates
```js
export const fallbackDataMetadata = {
  source: 'Bin Manager + Xero P&L, Feb 2026',
  effective_from: '2026-02-01',
  effective_to: '2026-03-01',
};
```

### 5. Standard rounding helpers
```js
export const roundMoney = (v) => Math.round(v * 100) / 100;
export const roundPercent = (v) => Math.round(v * 10) / 10;
```

Rule: round money to nearest cent at calc time, format display with `.toFixed()`.

### 6. Competitor rate normalization
```js
export function normalizeCompetitorBinType(name) {
  const cleaned = name.toLowerCase().replace(/[m³³]/g, '').trim();
  const map = {
    '4 gw': '4m General Waste',
    '6 asb': '6m Asbestos',
    '6 soil': '6m Soil',
    // ...
  };
  return map[cleaned] || null;
}
```

Apply on insert, case-insensitive lookup, reject unmappable.

## Risk-priority fix list

| Risk | Impact | Location | Effort |
|---|---|---|---|
| Pricing formula divergence | HIGH | PricingTab:74, FleetTab:15 | 1 h |
| Bin type name fragmentation | HIGH | PricingTab:8-15 + schema | 2 h |
| Loss-making detection on static `np` | HIGH | PricingTab:160 | 4 h |
| Competitor join case-sensitive | MEDIUM | CompetitorPage:152 | 2 h |
| Rounding inconsistency | MEDIUM | throughout | 2 h |
| Hardcoded fallback not versioned | LOW | financials.js | 1 h |

**Conclusion:** Schema constraints (1 h) + formula documentation (2 h) + migration of loss detection to allocator output (4 h) is achievable in a half-day push. Recommend doing this before the next pricing review.
