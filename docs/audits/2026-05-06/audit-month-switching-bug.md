# SkipSync Month-Switching Bug Audit

**Auditor:** Subagent (Explore lens), 2026-05-06
**Severity overall:** P0 (multiple user-visible failures, decisions could be made on stale data)

## Reproducible failures (most user-visible)

1. **SnapshotTab KPIs freeze on first selected month**
   - `SnapshotTab.jsx:121-122` reads `D.cashBalance[mi]` and `D.arOverdue` without checking `reportMonth`
   - Cash and AR figures don't move when the user switches months

2. **MarginsTab displays wrong COS/Fuel costs**
   - Hooks correctly keyed on `reportMonth`, but lines 64-82 fall back to `D.*` indices when Supabase is empty — not always month-keyed

3. **FleetTab always shows "Feb 2026 hardcoded data"**
   - `FleetTab.jsx:23-27` falls back to `D.binTypesData` regardless of selected month — the array is single-shape, not per-month
   - User sees identical bin revenue/deliveries for ANY month when Supabase is unavailable

4. **DebtorsTab AR aging frozen at Feb**
   - `DebtorsTab.jsx:44-49` falls back to `D.arData` / `D.topDebtors` (single Feb objects)
   - Switching months shows the same overdue amounts and same top debtors

5. **PricingTab `useMemo` never recalculates** — **THE SMOKING GUN**
   - `PricingTab.jsx:45`: `const { allocated: ytdAllocated } = useMemo(() => allocateCosts(pricingData), [])`
   - **Missing `monthIndex` dependency** — `allocateCosts` runs once at mount, never recomputes when month changes
   - Job profitability always shows Feb cost structure for all months

## Tab-by-tab audit

| Tab | Critical hooks | Issue | Status |
|---|---|---|---|
| Snapshot | useFinancials, useYTDFinancials, useBalanceSheet | Cash/AR hardcoded line 121-122 | ✗ STALE |
| Revenue | useYTDFinancials | Slices correctly with monthCount | ✓ OK |
| Margins | useFinancials, useYTDFinancials | All metrics keyed on reportMonth | ✓ OK |
| Benchmarking (Pricing) | None (internal useMemo) | useMemo line 45 missing monthIndex dep | ✗ BROKEN |
| Competitors | None | Delegates to CompetitorPage | ? UNKNOWN |
| BDM | useAcquisitions, useChurnRisk | useChurnRisk has NO month parameter | ✗ STALE |
| Fleet | useBinPerformance | D.binTypesData always Feb; no per-month fallback | ✗ STALE |
| FleetAssets | useFleet | Separate page — separate audit | ? UNKNOWN |
| Debtors | useDebtors | D.arData, D.topDebtors always Feb | ✗ STALE |
| CashFlow | useFinancials, useYTDFinancials | Sliced correctly with monthCount | ✓ OK |
| Risk/EPA | useCompliance | Compliance keyed on reportMonth | ✓ OK |
| WorkPlan | useWorkPlanItems | Not month-dependent by design | ✓ OK |

## Specific code evidence

### PricingTab.jsx line 45 — THE SMOKING GUN
```jsx
// WRONG: no monthIndex dep means allocateCosts only runs once at component mount
const { allocated: ytdAllocated, costs: ytdCosts, reconCheck } = useMemo(
  () => allocateCosts(pricingData), []   // ← empty deps
);

// Line 48 depends on ytdAllocated, but ytdAllocated never changes
const typeData = useMemo(() => {
  // ... uses ytdAllocated to derive per-month data
}, [ytdAllocated, monthIndex]);
```

### FleetTab.jsx lines 21-27 — always falls back to Feb
```jsx
const reportMonth = selectedMonth ? `${selectedMonth}-01` : null;
const { data: binPerfData, isLoading, isError } = useBinPerformance(reportMonth);

const useSupabase = binPerfData && binPerfData.length > 0;
const chartData = useSupabase ? transformBinPerf(binPerfData) : D.binTypesData;
// ↑ When no Supabase data, ALWAYS shows D.binTypesData which is Feb 2026
```

### BDMTab.jsx line 13 — churn risk ignores month
```jsx
const { data: churnRisk = D.churnRiskCustomers } = useChurnRisk();
// ↑ Takes NO parameters; should be useChurnRisk(reportMonth)
```

### DebtorsTab.jsx lines 44-49 — static fallback
```jsx
} else {
  arChartData = Object.entries(D.arData).map(([k, v]) => ({ name: k, value: v }));
  topDebtorsData = D.topDebtors;
  arTotal = D.arTotal;
  arOverdue = D.arOverdue;
  arCurrent = D.arData.Current;
  arOlder = D.arData.Older;
}
```

## Why this matters

User selects Jul 2025 (monthCount = 1) →
hooks correctly request `useFinancials('2025-07-01')` →
Supabase returns empty (no data seeded) →
fallback path: `D.totalRevenue[0]` is Jul ✓ (this works)
**but** `D.binTypesData[0]` doesn't exist — `D.binTypesData` is a single array, not nested by month →
code returns the Feb-2026 array silently for every month.

The user sees Feb bin data for Jul without any error indicator.

## Files to fix (priority order)

1. **`src/components/PricingTab.jsx`** — Line 45: add `[monthIndex]` to useMemo deps
2. **`src/data/financials.js`** — Add per-month arrays:
   - `binTypesDataByMonth` (8 months)
   - `dormantCustomersByMonth`
   - `newCustomersByMonth`
   - `arDataByMonth`
3. **`src/components/tabs/FleetTab.jsx`** — Line 27: use `D.binTypesDataByMonth[monthCount-1]` in fallback
4. **`src/components/tabs/DebtorsTab.jsx`** — Lines 44-49: per-month arrays in fallback
5. **`src/components/tabs/BDMTab.jsx`** — Line 13: `useChurnRisk(reportMonth)`
6. **`src/hooks/useChurnRisk.js`** — Accept reportMonth parameter
7. **`src/components/tabs/SnapshotTab.jsx`** — Lines 121-122: month-aware cash/AR

## Verification

```bash
npm run dev
# 1. Dashboard → Feb 2026 (note current values)
# 2. Switch to Jul 2025 → revenue/costs/fleet should all change
# 3. Switch to Oct 2025 → debtors aging, new customers should change
# 4. Pricing tab: switch months, check job profitability changes
```

## Severity rationale (P0)

These bugs cause **wrong business decisions**: a user looking at PricingTab thinking they're seeing Jul 2025 cost structure is in fact seeing Feb 2026's. The "loss-making bin types" callout in the PRD is therefore unreliable when shown for any month other than the data's effective month. Fix before next pricing review.
