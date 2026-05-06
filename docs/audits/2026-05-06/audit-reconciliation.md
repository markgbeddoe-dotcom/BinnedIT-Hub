# Xero ↔ SkipSync (Supabase) Reconciliation Audit

**Date:** 2026-05-06
**Auditor:** Claude Code
**Scope:** `api/xero-sync.js` mapping logic vs. four parsed Xero exports (Accrual P&L by month, Cash-basis P&L by month, Balance Sheet at 30 Apr 2026, Aged Receivables Summary at 31 May 2026)
**Target schema:** `supabase/migrations/001_initial_schema.sql` — `financials_monthly`, `balance_sheet_monthly`, `debtors_monthly`

---

## Executive Summary

The current `xero-sync.js` mapping pipeline **silently misclassifies the majority of trading-income revenue and the majority of cost-of-sales** because the keyword-classifier was tuned for a tiny subset of SKU names that does not match the actual Xero chart of accounts. It also has a sign-flipping bug on negative line items that **inflates revenue** when customers receive credits. Three of the four sections it claims to populate are either silently broken or fully disabled. **In its current state the data SkipSync would land in Supabase is not a reliable basis for business decisions.**

### Headline numbers (YTD Jul 2025 – Apr 2026, accrual basis)

| Metric (SkipSync would store) | Value | Comment |
|---|---:|---|
| `rev_total` | **$1,569,450.33** | Xero raw sum is **$1,569,110.73** — SkipSync over-states by **$339.60** due to sign-flip on negative revenue rows |
| `rev_asbestos` | $311,261.62 (19.8%) | Reasonable |
| `rev_soil` | $217,484.98 (13.9%) | Reasonable |
| `rev_green` | $35,728.03 (2.3%) | Reasonable |
| `rev_other` | **$1,004,975.70 (64.0%)** | **CRITICAL** — should be ~$70k; rest is WMF/CON/Transport miscategorised |
| `cos_total` | $515,238.43 | Matches Xero |
| `cos_wages` | **$0.00** | Correct (wages are in OPEX) but column is misleading |
| `cos_fuel` | **$0.00** | **CRITICAL** — bin-coded COS rows never match `fuel/petrol/diesel` |
| `cos_disposal` | $177,346.07 (34.4%) | **Mostly correct, but missing all `W- 4m`, `WMF - 12M (313)`, `ASB - 4m (324)` etc. tipping-by-bin lines** |
| `cos_other` | $337,892.36 (65.6%) | Includes 30 of 36 COS lines that should have been classified |
| `opex_total` | $907,073.16 | Matches Xero |
| `opex_admin` | $568,835.46 | Bundles Wages ($503,941) + Superannuation ($64,894); intent unclear |
| `net_profit` | $147,138.74 | Xero raw is **$146,799.14** — overstated by **$339.60** |

### Severity rollup

- **P0 (critical):** 4 findings — revenue mis-classification, sign-flip on negatives, cash-balance loss, AR sync disabled
- **P1 (high):** 4 findings — COS keyword coverage, cash-vs-liability collision, AR column shift, double-counting of Westpac
- **P2 (medium):** 5 findings
- **P3 (low):** 4 findings

---

## P0 — Critical Findings

### P0-1. Revenue keyword classifier loses **$882k WMF + $32k CON + $90k assorted = ~$1.0M (64% of rev) into `rev_other`**

**Where:** `api/xero-sync.js`, `mapPLToFinancials`, lines **131–147** (the "Binned-IT fallback" branch).

The classifier only checks keywords `asb`/`asbestos`, `soil`/`soi`/`contaminated`/`csoil`, `grw`/`green`. Every other Trading-Income row falls through to `revOther`. The actual Binned-IT chart of accounts contains revenue categories that the classifier has no rule for:

| SKU name (from `Trading Income` section) | YTD revenue | Currently bucketed as | Should be |
|---|---:|---|---|
| WMF - 6m Heavy | $232,403.82 | `rev_other` | `rev_general` (waste mgmt) |
| WMF - 12M | $148,376.62 | `rev_other` | `rev_general` |
| WMF - 4m Heavy | $133,419.10 | `rev_other` | `rev_general` |
| WMF - 8m Heavy | $103,643.64 | `rev_other` | `rev_general` |
| WMF - 10M | $65,868.18 | `rev_other` | `rev_general` |
| WMF - 16m | $49,031.52 | `rev_other` | `rev_general` |
| WMF - 23m | $44,611.83 | `rev_other` | `rev_general` |
| WMF - 12m Light | $44,438.73 | `rev_other` | `rev_general` |
| WMF - 6m Light | $29,160.91 | `rev_other` | `rev_general` |
| WMF - 4m Light | $18,213.64 | `rev_other` | `rev_general` |
| WMF - 8m Light | $13,322.48 | `rev_other` | `rev_general` |
| **WMF subtotal** | **$882,490.47** | | |
| CON - 6m FOR JOBS NOT RECYCLING | $16,500.00 | `rev_other` | (concrete bin) |
| CON - 8m FOR JOBS NOT RECYCLING | $8,718.18 | `rev_other` | |
| CON - 4m FOR JOBS NOT RECYCLING | $7,400.00 | `rev_other` | |
| **CON subtotal** | **$32,618.18** | | |
| Revenue - Transport | $31,223.00 | `rev_other` | new category? |
| General Waste Tonnage | $15,290.93 | `rev_other` | `rev_general` |
| Recycling Income | $8,220.46 | `rev_other` | recycling category? |
| Other fees | $7,576.72 | `rev_other` | |
| Fuel Levy | $7,468.45 | `rev_other` | |
| Revenue - Council Permits | $5,034.02 | `rev_other` | |
| LONG TERM BIN RENTAL 1 MONTH | $4,832.79 | `rev_other` | |
| Machinery Hire | $4,410.00 | `rev_other` | |
| Revenue - Recycling M3 RATE TIPPING $50/M3 | $4,150.88 | `rev_other` | |
| PLASTIC AND TAPE | $1,490.00 | `rev_other` | |

**Business impact:** The dashboard's revenue-mix chart, `rev_general` KPI, and any margin-by-bin-type analysis are unusable. Every WMF SKU — the actual core skip-bin business — is invisible in the existing four buckets.

**Schema mismatch:** The migration defines `rev_general numeric(12,2)` (line 59 of `001_initial_schema.sql`) but `mapPLToFinancials` line 236 hard-codes `rev_general: 0`. The "general / WMF" revenue category exists in the schema but is never written to.

---

### P0-2. Sign-flip on negative revenue line items inflates revenue — **$339.60 overstatement YTD**, varies by month

**Where:** `mapPLToFinancials` line 137 — `const amt = Math.abs(row.amount)` inside the trading-income loop.

Xero returns **negative** trading-income rows when customers receive credits/refunds. Applying `Math.abs()` row-by-row erases the credit. Concrete instances in the parsed data:

| Row | Month | Xero value | SkipSync value | Net P&L impact |
|---|---|---:|---:|---:|
| Revenue - Waste Management Fees (WMF) | Oct 2025 | -$1,500.00 | +$1,500.00 | **+$3,000.00** to net profit |
| WMF - 8m Light | Jan 2026 | -$172.07 | +$172.07 | **+$344.14** to net profit |
| Revenue - Waste Management Fees (WMF) | YTD only column | -$169.80 | +$169.80 | (already covered by Oct) |

Per-month net-profit reconciliation (SkipSync vs. raw Xero):

| Month | Xero raw net | SkipSync net | Δ |
|---|---:|---:|---:|
| Jul 2025 | -$4,942.21 | -$4,942.21 | 0.00 |
| Aug 2025 | $2,298.91 | $2,298.91 | 0.00 |
| Sep 2025 | $24,082.57 | $24,082.57 | 0.00 |
| **Oct 2025** | $13,883.05 | **$16,883.05** | **+$3,000.00** |
| Nov 2025 | $17,949.66 | $17,949.66 | 0.00 |
| Dec 2025 | $4,740.62 | $4,740.62 | 0.00 |
| **Jan 2026** | -$4,332.40 | **-$3,988.26** | **+$344.14** |
| Feb 2026 | $30,511.71 | $30,511.71 | 0.00 |
| Mar 2026 | $17,575.21 | $17,575.21 | 0.00 |
| Apr 2026 | $41,583.41 | $41,583.41 | 0.00 |
| May 2026 | $3,448.61 | $3,448.61 | 0.00 |
| **YTD** | $146,799.14 | **$147,138.74** | **+$339.60** |

The reason Oct is $3,000 wrong (not $1,500): SkipSync's revTotal also includes that line as +$1,500, while raw rev had it at -$1,500, so revenue moves by 2 × $1,500.

**Business impact:** Every month with a customer credit shows the wrong revenue, the wrong margin, and a falsely flattering net profit. Mark may be looking at $30k margins that are really $27k.

**Recommendation:** Sum first, then sign-correct. Or only `Math.abs()` the section total, never the individual rows.

---

### P0-3. Cash balance loses **the entire $77,811.38 operating account** because the bank-account row name does not match `cash`/`bank`/`westpac`

**Where:** `parseBalanceSheet` line 284 — `if (name.includes('cash') || name.includes('bank') || name.includes('westpac')) cash += amount`.

Looking at the Balance Sheet export (`Binned-IT_Pty_Ltd_-_Balance_Sheet.json`):

```
Bank section:
  "Binned-It Pty Ltd"      77811.38   ← the operating account
  "Total Bank"             0          ← summary row (zero in this CSV export)
```

The row name `Binned-It Pty Ltd` does not contain `cash`, `bank`, or `westpac`, so **the parser drops it**. `cash_balance` would be written as $0 (or a much smaller number — see P0-4 below).

In a real Xero API call, the row would still be the company-named bank account; the API does not embed `bank` in the row name. The classifier needs to look at the **section title** (`Bank`, `Cash and Cash Equivalents`) rather than the row name.

**Business impact:** The entire cash KPI on the dashboard would read $106.36 (just the Westpac Business Cash Reserve liability — see P0-4) or $0. Mark cannot make cash-flow decisions on this.

**Recommendation:** When the parent section title includes `bank` / `cash`, sum **all** child rows into `cash_balance` regardless of their name.

---

### P0-4. AR sync is fully disabled — `debtors_monthly` table receives **zero rows**

**Where:** `syncMonth` lines 466–467:

```js
// AR disabled — debtors_monthly requires per-debtor rows; skipping until reworked
void arData
```

The function fetches AR from Xero (line 444) and parses it (line 452) but throws the result away. Consequently:

- The entire `debtors_monthly` table never gets populated.
- The "Top Debtors" / "Days Sales Outstanding" / "Aged Receivables" tabs in the SkipSync dashboard rely on this table — they see no data.
- The Balance Sheet still has `accounts_receivable = $118,082.03`, but there is no breakdown.

Per the AR export (as at 31 May 2026), there are **80+ debtors** totalling **$112,420.20** with a meaningful overdue distribution:

| Bucket | Amount | % of total |
|---|---:|---:|
| Current | $3,591.19 | 3.2% |
| < 1 Month | $31,017.61 | 27.6% |
| 1 Month | $57,976.09 | 51.6% |
| 2 Months | $4,065.40 | 3.6% |
| 3 Months | -$148.00 | -0.1% |
| Older | $15,917.91 | 14.2% |
| **Total** | **$112,420.20** | |

Top exposures Mark cannot see: ROACH DEMOLITION ($14,197), AAH CONTRACTING ($10,318), REMEED SOLUTIONS ($8,483), DARREN TAYLOR ($4,410), MELBOURNE GRAMMAR SCHOOL ($4,223).

**Note:** the BS shows AR = $118,082 (at 30 Apr) and the AR Summary shows $112,420 (at 31 May). They are at different dates so the gap is reasonable; both are real numbers.

**Business impact:** Bookkeeper Sarah and Mark have no visibility on which customers are overdue, no DSO trend, no aging breakdown — exactly the data needed for collection calls.

**Recommendation:** Re-enable and write a per-debtor loop into `debtors_monthly` (one row per top-N debtors). The current parser already produces `topDebtors`; the writer just needs to iterate.

---

## P1 — High Findings

### P1-1. COS keyword classifier mis-buckets **30 of 36 lines = $337,892.36 (65.6%) into `cos_other`**

**Where:** `mapPLToFinancials` lines 178–181.

Current keywords:
- `cos_wages`: `wage, driver, labour, labor` — matches **0** lines
- `cos_fuel`: `fuel, petrol, diesel` — matches **0** lines
- `cos_disposal`: `tip, disposal, landfill, waste levy, tipping, recycling` — matches 6 lines

Lines that incorrectly fall into `cos_other`:

| Row name | YTD | Type |
|---|---:|---|
| Recycling costs - General Waste | $137,652.75 | (matches `recycling` so OK in disposal — but barely) |
| WMF - 12M (313) | $45,985.36 | tipping cost for that bin — should be disposal |
| W - 6m Heavy (307) | $38,954.72 | tipping cost for that bin — should be disposal |
| W - 4m Heavy (305) | $32,424.20 | tipping cost — should be disposal |
| ASB - 8m (328) | $33,123.35 | asbestos disposal — should be disposal |
| ASB - 4m (324) | $23,260.87 | asbestos disposal — should be disposal |
| ASB - 6m (326) | $22,673.76 | asbestos disposal — should be disposal |
| ASB - 10m (321) | $20,517.90 | asbestos disposal — should be disposal |
| WMF - 16m (314) | $14,331.46 | tipping cost — should be disposal |
| S - 8m (348) | $14,101.49 | soil tipping — should be disposal |
| W- 4m Light (304) | $14,075.04 | tipping cost — should be disposal |
| WMF - 10m (312) | $13,245.33 | tipping cost — should be disposal |
| W - 8m Heavy (309) | $13,211.19 | tipping cost — should be disposal |
| W - 6m Light (306) | $12,831.28 | tipping cost — should be disposal |
| ... 16 more bin-coded rows | | |

Every "ASB - Xm (3xx)", "W - Xm Heavy (3xx)", "WMF - Xm (3xx)", "S - Xm (3xx)" is by definition a **bin-specific tipping/disposal cost** but none match the keyword list because the keywords search for words like `tip` not bin codes.

**Business impact:** "Tipping cost as % of revenue" is a key margin lever for a skip-bin business. Today 30 lines of disposal cost are invisible; the dashboard will show disposal at ~34% of COS when the true number is closer to 95%.

**Recommendation:** Either (a) recognise that for Binned-IT, **all COS lines are disposal-related** (they're per-bin tipping accounts), so set `cos_disposal = cos_total`, or (b) widen the keyword list to include the bin prefixes (`asb -`, `wmf -`, `w -`, `s -`, `gw -`, `c -`).

---

### P1-2. `Westpac Business Cash Reserve` ($106.36) is a **liability**, but the cash-keyword matcher pulls it into `cash_balance`

**Where:** `parseBalanceSheet` line 284 matches `westpac` regardless of which section the row sits in.

In the BS export the line is in **Current Liabilities** (line 224 of the export): `Westpac Business Cash Reserve: 106.36`. The parser does not check section title for this match — only the name. So `cash_balance` would receive +$106.36, AND `total_liabilities` would still receive the $106.36 via the `liabilit` section-title check (line 281). It's effectively double-categorised.

**Business impact:** Small dollar amount today, but if Mark has a real Westpac cash account in future, the bug makes it impossible to tell which one is the asset and which is the liability.

**Recommendation:** Restrict cash matching to the `Bank` / `Cash` section.

---

### P1-3. AR parser, if enabled, would **lose the entire `Older` bucket — $15,917.91 (14.2% of AR)**

**Where:** `parseAgedReceivables` lines 313–322. The code expects `Cells[1..5]` and computes `rowTotal = cur + d30 + d60 + d90 + old`.

The export shows **6 ageing buckets** (Current, < 1 Month, 1 Month, 2 Months, 3 Months, Older) plus a Total column = 8 cells per row including the contact name. The Xero AgedReceivablesByContact API also returns 6 ageing buckets in modern reports.

What the parser would do, if `Cells[1..5]` correspond to the first 5 buckets only:

- `current` = "Current" ($3,591.19) ✓
- `days30` = "< 1 Month" ($31,017.61)
- `days60` = "1 Month" ($57,976.09)
- `days90` = "2 Months" ($4,065.40)
- `older` = "3 Months" (-$148.00)
- **"Older" ($15,917.91) → DROPPED**

The naming inside SkipSync also shifts: `days30` actually contains < 1 Month (which is 0–30 days overdue), `days60` contains 1 Month (30–60 days), etc. The semantics line up roughly, but the **Older** bucket — the most concerning collections risk, with debts like ALL ROUND LANDWORX, BRENT MCLEOD, BRONWYN KILPATRICK, KDK BUILDING, SALVAGE CONSTRUCTIONS — vanishes silently.

**Recommendation:** Either accept 6 buckets (`Cells[1..6]`) and add `older_2`/rename buckets, or add the cells beyond 5 into `older` so nothing is dropped.

---

### P1-4. `total_assets`, `total_liabilities` use Math.abs of the section *summary* row — but **the export's summary rows are 0**

**Where:** `parseBalanceSheet` lines 280–281.

In this particular CSV-derived export, every `Total *` summary row is zero (Total Bank=0, Total Current Assets=0, Total Fixed Assets=0, Total Assets=0, Total Liabilities=0, Total Equity=0). The Xero API itself would return the real summary values, so this is not a runtime bug per se — but **the audit cannot verify that the parser sums correctly**. If for any reason a real summary row came back as 0 (e.g., a malformed report period), `total_assets` and `total_liabilities` would be 0 with no fallback to summing the Row entries.

**Recommendation:** Mirror the existing `sectionTotal` logic: `summary if non-zero, else sum of row values`.

---

## P2 — Medium Findings

### P2-1. `opex_admin` silently bundles Wages + Superannuation

**Where:** `mapPLToFinancials` line 207 — keyword `super` matches `Superannuation`.

YTD: Wages and Salaries $503,941.23 + Superannuation $64,894.23 = **$568,835.46** stored as `opex_admin`. Reasonable as a "total payroll cost" but the schema has only one column so there is no way to disaggregate.

The keyword `payroll` does not match any current row (the row is named "Wages and Salaries"). `salary` does match. So the actual matchers firing here are `wage` (Wages and Salaries) and `super` (Superannuation).

Note: `Wages Payable - Payroll` is on the **Balance Sheet**, not the P&L, so the `payroll` keyword is harmless here.

**Recommendation:** Document the intent, or split into `opex_wages` + `opex_super` columns.

---

### P2-2. `Tolls and Parking` ($33,430.51 YTD) falls into `opex_other` — schema has a `cos_tolls` column that is never populated

**Where:** Schema line 70 — `cos_tolls numeric(12,2)`. The mapping function never references this column, and `Tolls and Parking` is in OPEX in the actual P&L, not COS.

**Recommendation:** Decide where Tolls belong (truck operating cost = COS in trucking businesses); if COS, move via Xero account remap and add a `cos_tolls` keyword. If OPEX, drop the unused schema column.

---

### P2-3. Schema columns `cos_repairs`, `other_current_assets`, `fixed_assets`, `accounts_payable`, `loan_current`, `loan_noncurrent`, `total_loans` are **never populated**

The schema reserves columns for these (lines 70, 95, 96, 98, 101–103) but `parseBalanceSheet` only writes `cash_balance, accounts_receivable, total_assets, total_liabilities, net_equity, gst_liability, payg_liability` (lines 295–301).

The BS export has the data:

| Column | Available value(s) in export |
|---|---|
| `accounts_payable` | "Accounts Payable" $9,828.71 |
| `loan_noncurrent` | Sum of all "Loan -" rows = $325,402.04 |
| `fixed_assets` | "Bin - 12m" + "Bin - 23m" + ... + Machinery + MV + Office Equip = $516,812.73 |
| `other_current_assets` | "1100l wheelie bins" + "Bond - 3 Cumberland" + "Loan to All About Enterprises" = $26,576.96 |

**Business impact:** The Balance Sheet tab on the dashboard shows partial data only; debt-to-equity ratios cannot be computed.

---

### P2-4. GST keyword captures **GST Adjustment + Rounding-related** rows indiscriminately

`name.includes('gst')` (line 286) matches both "GST" ($231,075.23) and "GST Adjustment" ($61.16). Likely correct intent, but worth confirming. The `Math.abs()` masks any sign issues — if the adjustment were negative it would still add as positive.

---

### P2-5. The Cash Basis P&L file is **substantially different** from the Accrual P&L file — SkipSync requests **only the default (Accrual)**

The two parsed files (`Current_financial_year_by_month.json` vs `... (1).json`) differ on:

- **First file** has no "Cash Basis" header row → it is the **Accrual** report
- **Second file** has `"Cash Basis"` as row 4 → it is the **Cash basis** version
- Per-row monthly values differ materially (e.g. ASB -1.1 in Aug = $1,050 accrual vs $550 cash; WMF totals shift by thousands)

`fetchProfitAndLoss` (line 24) does not pass `paymentsOnly=true` so Xero defaults to **accrual** — fine, but no test coverage for the difference, and any future toggle could silently change reported numbers.

---

## P3 — Low Findings

### P3-1. `parseAmount` strips `$` and `,` but does not handle parenthesised negatives `(1,234.56)`

Line 60 — Xero exports often use `(1234.56)` to denote negative amounts in some report formats. Currently this would parse as `NaN → 0` (line 61).

### P3-2. Variable `cos_other = Math.max(0, cosTotal - …)` masks classification bugs

Line 181. If keyword sums ever exceed the section total (e.g. due to overlapping keywords), `cos_other` clamps to zero rather than going negative, hiding the issue. Recommend asserting and logging when this clamp fires.

### P3-3. `monthly_reports` row for the period gets a generated UUID then is referenced as FK — but the period's existing row is `DELETE`'d first

Lines 361–395. There is a small race-condition window where a parallel reader of `financials_monthly` (or worse, a foreign key cascade) sees an empty / inconsistent state. Low risk for a single-tenant, single-user system.

### P3-4. Net-margin calc rounds to 1 decimal but margin-pct field is `numeric(6,2)`

Line 248: `Math.round(grossMarginPct * 10) / 10`. Schema has 2 decimals; data goes in at 1-decimal precision. Cosmetic.

---

## Numerical worked example — February 2026

This is what SkipSync would write to `financials_monthly` for `report_month = '2026-02-01'`, vs. what Xero says.

### Trading Income (Feb 2026 column from Accrual P&L export)

ASB-bucketed rows (sum = $29,048.18) ✓:
- ASB -1.1 = 2,054.55
- ASB - 4m = 4,200.00
- ASB - 6m = 7,563.63
- ASB - 8m = 10,400.00
- ASB - Bigm = 4,000.00
- Asbestos Waste Tonnage = 480.00
- Revenue - Asbestos (ASB) = 350.00

SOIL-bucketed rows (sum = $47,451.70) — **most of this is "Contaminated Soil Tonnage" $34,791.70**, an outlier that should make Feb stand out:
- CONTAMINATED SOIL REVENUE = 3,600.00
- Contaminated Soil Tonnage = 34,791.70
- Revenue - Soil (SOI) = 4,210.00
- SOI - 4m = 1,500.00
- SOI - 6m = 1,200.00
- SOI - 8m = 2,150.00

GREEN-bucketed rows (sum = $4,450.00) ✓:
- GRW - 10m = 700.00
- GRW - 16m = 800.00
- GRW - 4m = 950.00
- GRW - 8m = 2,000.00

OTHER (rev_other) — 22 rows totaling **$101,917.26** — should mostly be `rev_general`:
- All 11 WMF rows + 3 CON rows + 8 misc

`rev_total = 29,048.18 + 47,451.70 + 4,450.00 + 101,917.26 = $182,867.14` ✓ (matches Xero exactly because no negative-row sign-flip in Feb)

### Cost of Sales (Feb 2026)

`cos_total = $62,332.17` (sum of section)

By keyword:
- `cos_wages` = $0 (no wage/driver/labour rows in COS)
- `cos_fuel` = $0 (no fuel rows in COS)
- `cos_disposal` = $21,456.31 — captures: Cost of Goods Sold? No — only:
  - Recycling costs - General Waste $15,113.60
  - Recycling costs - Green Waste $1,561.04
  - Recycling Costs - Soil Tipping $4,020.00
  - Recycling Costs - Timber $272.98
  - Tipping by Bin - Asbestos $338.69
  - Tipping by Bin - Soil $150.00
- `cos_other` = $40,875.86 — **includes** $4,014.49 ASB - 4m, $10,908.16 ASB - 8m, $4,300.27 W - 6m Heavy, $4,578.86 WMF - 12M (313), $3,741.37 WMF - 16m (314), etc. — **all of which are tipping costs**

True disposal cost in Feb is approximately `cos_disposal + the bin-coded rows = ~$60k`, not $21k.

### Operating Expenses (Feb 2026)

`opex_total = $90,023.26` ✓

- `opex_admin` (wages+super+salary keywords) = Wages $46,737.59 + Super $5,761.14 = **$52,498.73**
- `opex_rent` = Rent $4,666.67 ✓
- `opex_advertising` = Advertising $3,465.60 ✓
- `opex_insurance` = MV - Insurances $175.49 (but no Building & Contents in Feb) ✓
- `opex_other` = $90,023.26 − 52,498.73 − 4,666.67 − 3,465.60 − 175.49 = **$29,216.77** (everything else, including $3,272.76 Tolls, $9,740.48 Diesel, $3,814.44 MV repairs, $1,191.18 Loose Tools, $1,059.98 Telephone, etc.)

### Net Profit reconciliation (Feb 2026)

| | Xero raw | SkipSync |
|---|---:|---:|
| Revenue | 182,867.14 | 182,867.14 |
| − COS | (62,332.17) | (62,332.17) |
| = Gross Profit | 120,534.97 | 120,534.97 |
| − OPEX | (90,023.26) | (90,023.26) |
| **= Net Profit** | **30,511.71** | **30,511.71** |

**For Feb 2026 specifically the net-profit number reconciles to the cent** (no negative revenue line in Feb). The damage is in the **mix**: Mark sees `rev_other = $101,917 (56% of Feb revenue)` instead of $0–$10k, and `cos_other = $40,876 (66% of Feb COS)` instead of ~$5k.

### Balance Sheet 30 Apr 2026 reconciliation

| Field SkipSync would write | Value from this export | Xero true value | Discrepancy |
|---|---:|---:|---|
| `cash_balance` | $106.36 (Westpac line in liabilities) | $77,811.38 (Binned-It Pty Ltd bank account) | **−$77,705.02** |
| `accounts_receivable` | $118,082.03 | $118,082.03 | ✓ |
| `total_assets` | $0 (summary row is 0 in this export) | unknown — see P1-4 | depends |
| `gst_liability` | $231,136.39 (GST + GST Adjustment) | $231,136.39 | ✓ |
| `payg_liability` | $507,103.00 | $507,103.00 | ✓ |
| `total_liabilities` | $0 (summary row is 0) | unknown | depends |
| `net_equity` | $0 (summary row is 0) | $164,461.36 (1000 + 20110.83 + 143350.53) | **−$164,461.36** |
| `accounts_payable` | (not written — schema column unused) | $9,828.71 | data lost |
| `loan_noncurrent` | (not written) | ~$325,402 | data lost |

---

## Recommendations (ordered by impact)

1. **Add WMF / general-waste classification rule (P0-1).** Immediate one-line fix:
   ```js
   else if (n.startsWith('wmf') || n.includes('waste management') || n.includes('general waste')) {
     revGeneral += amt;  // or revOther, but at least split out
   }
   ```
   And populate `rev_general` in the return object. Optionally also bucket `con` / concrete and `rev - transport` / `recycling income` into named columns.

2. **Stop sign-flipping individual revenue rows (P0-2).** Drop the `Math.abs(row.amount)` on line 137. Sum the raw numbers, then `Math.abs()` only on the final aggregate if needed. Better: don't `Math.abs` revenue at all — credits are real and should reduce the bucket.

3. **Re-enable AR sync, fix the column shift (P0-4 + P1-3).** Iterate `topDebtors`, write one row per debtor into `debtors_monthly`. Before writing, widen the parser to handle 6 ageing buckets and never drop the `Older` column.

4. **Cash balance from section title, not row name (P0-3).** Walk rows under any section whose title contains `bank` or `cash and cash equivalents`; sum them all into `cash_balance`. Stop matching by row name — the company's own bank account is named after the company.

5. **Widen COS disposal keyword OR set `cos_disposal = cos_total` for Binned-IT (P1-1).** All COS lines for this business are by design tipping/disposal costs. The simplest correct mapping is: `cos_disposal = cos_total - cos_wages - cos_fuel`.

6. **Populate the unused balance-sheet columns (P2-3):** `accounts_payable`, `fixed_assets`, `other_current_assets`, `loan_noncurrent`. The data is in every export.

7. **Add a sanity-check assertion in the writer:** `assert |skipsync_net_profit − xero_net_profit| < 0.01`. Fail loudly when the numbers don't reconcile, rather than silently storing wrong totals.

8. **Split `opex_admin` into `opex_wages` + `opex_super` (P2-1)** so payroll cost can be analysed separately from the (currently nonexistent) "admin overhead" line.

9. **Document/test cash-basis vs accrual (P2-5).** The Cash Basis P&L produces materially different numbers; the API call should be explicit about which one we're requesting.

10. **Add unit tests using these four parsed files as fixtures.** Every finding above should become a regression test.
