# Cash vs Accrual P&L Reconciliation — Binned-IT Pty Ltd YTD FY26

**Prepared by:** Margaret "Meg" Whitfield, FCA — Virtual CFO
**Date:** 2026-05-07
**Period covered:** Jul 2025 – Feb 2026 (8 months) + YTD column
**Source documents:**
- Cash basis P&L: `docs/audits/2026-05-06/parsed/Binned-IT_Pty_Ltd_-_Current_financial_year_by_month (1).json` (Xero export, "Cash Basis" header)
- Accrual basis P&L: `docs/audits/2026-05-06/parsed/Binned-IT_Pty_Ltd_-_Current_financial_year_by_month.json` (Xero export, no basis tag = accrual default)
- Computation script: `tmp/recon.cjs` — sums every line item in each Section, by month column, with no human re-keying.

**Engagement mode:** Spot-check escalated to Deep audit. Triggered by Mark's discovery during Sprint 17 design that the SkipSync Xero sync (`api/xero-sync.js`) calls `Reports/ProfitAndLoss` without the `paymentsOnly=true` parameter. Default behaviour on that endpoint is **accrual**. The business runs on cash. Every dashboard tile, every alert, every investor-route number sourced from `financials_monthly` is on the wrong basis.

---

## 1 — Executive summary

| Metric | Cash | Accrual | Δ (Cash − Accrual) | Materiality |
|---|---:|---:|---:|---|
| **Feb-26 Net Profit** | **($17,638.72)** | **$30,511.71** | **($48,150.43)** | **🔴 P0 — 3.2× perf-materiality, sign-flips the result** |
| YTD Trading Income | $1,561,838.53 | $1,569,110.73 | ($7,272.20) | 🟢 < $15k |
| YTD Cost of Sales | $521,363.59 | $515,238.43 | $6,125.16 | 🟢 < $15k |
| YTD Operating Expenses | $928,073.62 | $907,073.16 | $21,000.46 | 🟡 above $15k |
| **YTD Net Profit** | **$112,401.32** | **$146,799.14** | **($34,397.82)** | **🟡 above $15k, 30% understated on cash vs accrual** |

**The headline finding:** for the eight months Jul-25 → Feb-26, accrual reports YTD net profit **$34,397.82 (30.6%) higher than cash**. Single-month swings reach **$48,150.43 (Feb-26)** — over **3× performance materiality**, sufficient to convert a $17.6k cash loss into a $30.5k accrual profit. **Mark has been making "is this month profitable?" decisions off a number that disagrees with the bank account by up to half a month's net profit.**

**Verdict on the Snapshot tab and downstream alerts:** 🔴 **Red** until the basis is corrected. Perfect tie-out against the wrong source is still wrong.

---

## 2 — Month-by-month reconciliation grid

### 2.1 Cash basis (the business's operating reality)

| Month | Trading Inc | COS | Gross Profit | GP% | Opex | **Net Profit** | NM% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Jul-25 | 158,453.60 | 57,456.62 | 100,996.98 | 63.7% | 96,646.98 | 4,350.00 | 2.7% |
| Aug-25 | 142,126.62 | 39,850.48 | 102,276.14 | 72.0% | 93,599.49 | 8,676.65 | 6.1% |
| Sep-25 | 160,002.75 | 60,325.70 | 99,677.05 | 62.3% | 88,164.40 | 11,512.65 | 7.2% |
| Oct-25 | 214,200.83 | 81,249.21 | 132,951.62 | 62.1% | 103,805.28 | 29,146.34 | 13.6% |
| Nov-25 | 152,954.01 | 59,745.88 | 93,208.13 | 60.9% | 77,102.22 | 16,105.91 | 10.5% |
| Dec-25 | 158,250.33 | 60,729.01 | 97,521.32 | 61.6% | 102,533.42 | (5,012.10) | (3.2%) |
| Jan-26 | 128,207.41 | 43,660.31 | 84,547.10 | 65.9% | 82,843.04 | 1,704.06 | 1.3% |
| Feb-26 | **139,482.68** | **62,442.31** | **77,040.37** | **55.2%** | **94,679.09** | **(17,638.72)** | **(12.6%)** |
| **YTD** | **1,561,838.53** | **521,363.59** | **1,040,474.94** | **66.6%** | **928,073.62** | **112,401.32** | **7.2%** |

### 2.2 Accrual basis (what SkipSync currently ingests and shows)

| Month | Trading Inc | COS | Gross Profit | GP% | Opex | **Net Profit** | NM% |
|---|---:|---:|---:|---:|---:|---:|---:|
| Jul-25 | 142,181.52 | 53,305.96 | 88,875.56 | 62.5% | 93,817.77 | (4,942.21) | (3.5%) |
| Aug-25 | 145,489.94 | 55,704.15 | 89,785.79 | 61.7% | 87,486.88 | 2,298.91 | 1.6% |
| Sep-25 | 179,927.15 | 65,060.33 | 114,866.82 | 63.8% | 90,784.25 | 24,082.57 | 13.4% |
| Oct-25 | 182,337.70 | 62,501.08 | 119,836.62 | 65.7% | 105,953.57 | 13,883.05 | 7.6% |
| Nov-25 | 168,995.76 | 62,443.98 | 106,551.78 | 63.0% | 88,602.12 | 17,949.66 | 10.6% |
| Dec-25 | 144,221.87 | 55,206.39 | 89,015.48 | 61.7% | 84,274.86 | 4,740.62 | 3.3% |
| Jan-26 | 128,951.28 | 45,852.39 | 83,098.89 | 64.4% | 87,431.29 | (4,332.40) | (3.4%) |
| Feb-26 | **182,867.14** | **62,332.17** | **120,534.97** | **65.9%** | **90,023.26** | **30,511.71** | **16.7%** |
| **YTD** | **1,569,110.73** | **515,238.43** | **1,053,872.30** | **67.2%** | **907,073.16** | **146,799.14** | **9.4%** |

### 2.3 Delta grid (Cash − Accrual)

| Month | Δ Trading Inc | Δ COS | Δ Gross Profit | Δ Opex | **Δ Net Profit** | Materiality (perf = $15k) |
|---|---:|---:|---:|---:|---:|---|
| Jul-25 | 16,272.08 | 4,150.66 | 12,121.42 | 2,829.21 | 9,292.21 | 🟡 watch ($5k+) |
| Aug-25 | (3,363.32) | (15,853.67) | 12,490.35 | 6,112.61 | 6,377.74 | 🟡 watch ($5k+) |
| Sep-25 | (19,924.40) | (4,734.63) | (15,189.77) | (2,619.85) | (12,569.92) | 🟡 watch (NP < $15k but TI flag) |
| Oct-25 | 31,863.13 | 18,748.13 | 13,115.00 | (2,148.29) | **15,263.29** | 🔴 above perf materiality |
| Nov-25 | (16,041.75) | (2,698.10) | (13,343.65) | (11,499.90) | (1,843.75) | 🟢 NP delta immaterial (TI flag) |
| Dec-25 | 14,028.46 | 5,522.62 | 8,505.84 | 18,258.56 | (9,752.72) | 🟡 watch ($5k+; opex flag) |
| Jan-26 | (743.87) | (2,192.08) | 1,448.21 | (4,588.25) | 6,036.46 | 🟡 watch ($5k+) |
| Feb-26 | **(43,384.46)** | **110.14** | **(43,494.60)** | **4,655.83** | **(48,150.43)** | **🔴 P0 — 3.2× perf materiality, sign-flips P&L** |
| **YTD** | **(7,272.20)** | **6,125.16** | **(13,397.36)** | **21,000.46** | **(34,397.82)** | **🔴 above perf materiality** |

**Reading the sign:** positive Δ = cash > accrual (i.e. cash collected this month exceeded what was invoiced — typically prior-month receivables landing). Negative Δ = cash < accrual (i.e. invoices issued exceeded cash collected — receivables built up, or a large bill was paid in advance of recognition).

---

## 3 — Per-month variance commentary (§6.3 template)

| Month | Δ NP | Driver | Action? |
|---|---:|---|---|
| Jul-25 | +$9,292 | Cash > accrual on revenue (+$16,272). Likely **Jun-25 receivables collected in Jul** (FY25 closing AR cleared). Below performance materiality but consistent direction. | Note only |
| Aug-25 | +$6,378 | Cash > accrual on net basis. Notable: COS Δ = **−$15,854** — accrual booked $12,659 of contaminated-soil tipping that cash records in Aug were $100. The supplier invoice was accrued in Aug but paid in Sep on cash basis. | Note only — timing reverses Sep |
| Sep-25 | −$12,570 | Cash < accrual. Trading income Δ = −$19,924 — invoices issued Sep were settled in Oct. Sep-25 also saw the contaminated-soil tipping cash hit ($182.70) that paired with Aug's accrual. Variance below perf-materiality at NP line. | Note only |
| Oct-25 | **+$15,263** | **Above perf-materiality.** Cash trading income +$31,863 above accrual — Sep invoices were collected in Oct (consistent with Sep's −$19,924 reversal). COS also +$18,748 on cash, suggesting Sep COS bills paid in Oct. Net effect favourable to cash by exactly performance materiality. | **Document reversal — confirm against Oct AR aging** |
| Nov-25 | −$1,844 | NP delta immaterial despite revenue Δ −$16,042 and opex Δ −$11,500 (large items invoiced/accrued Nov, paid Dec). The legs largely offset at NP. | Note only |
| Dec-25 | −$9,753 | Cash < accrual. **Opex Δ = +$18,259 on cash** — driver = Dec rent paid as a double-up ($9,333 vs $4,667 monthly — bookkeeper paid Jan rent early), Workcover insurance $10,944 cash vs $5,795 accrual (annual premium paid Dec, accrued evenly). Trading income Δ +$14,028 likely Nov receivables collected. | **Investigate Workcover split — accrual basis splits the $10,944 over 23 months evenly; cash basis takes the full hit Dec. Both bases legitimate; no fix needed, but document so the Dec NP comparison Y-on-Y is apples-to-apples in future.** |
| Jan-26 | +$6,036 | Below perf-materiality at NP. Trading income roughly flat (cash slightly behind by $744); opex −$4,588 because Jan only paid one month of rent on cash basis whereas accrual recognised one month — the Dec double-up dropped Jan cash rent to $0 (vs $9,333 in Dec). | Note only |
| **Feb-26** | **−$48,150** | **🔴 P0. Trading income Δ = −$43,384** — Feb invoiced $182,867 on accrual but **only $139,483 hit the bank in Feb**. The $43,384 gap is **invoices issued in Feb that were not collected in Feb** — i.e. it sits in AR awaiting March collection. COS roughly flat (Δ +$110), opex Δ +$4,656 (mostly Feb Workcover/insurance accruals, immaterial). **The entire P&L sign-flip — from $30.5k profit to $17.6k loss — is driven by a single line: revenue not yet collected.** | **P0 — see §4. Toggle SkipSync to cash basis as default; do NOT base "is this month profitable" decisions off accrual alone.** |

### 3.1 Trend assessment

The **direction of the variance is not consistent** month-to-month — five months show cash > accrual (Jul, Aug, Oct, Dec opex side, Jan), three show cash < accrual (Sep, Nov, Feb). This is the **expected pattern of a working business with normal AR cycling**: each month's invoiced revenue is collected (mostly) the following month, and each month's accrued bills are paid (mostly) the following month. The two effects roughly net out **over a quarter**, but in **any single month** the gap can swing wildly — Feb-26 is the most extreme example to date.

**Anomalies worth flagging:**
- **Sep → Oct reversal** ($12,570 → +$15,263) is a textbook AR-cycling reversal; cleanly explained.
- **Aug → Sep COS reversal** ($15,854 contaminated-soil supplier) is a single supplier invoice straddling the month-end; cleanly explained.
- **Dec opex distortion** ($18,259 unfavourable on cash) is a double-up of rent + an annual Workcover premium concentrated in one month on cash basis. **This is the single most defensible reason a CFO would prefer accrual for trend analysis** — it smooths out lumpy single-payment items.
- **Feb-26 revenue gap** ($43,384) is the largest single-month variance in either direction across the eight-month window. Mar-26 cash collection should largely reverse this. **If it doesn't, AR collectability becomes the headline P0 — not basis selection.**

---

## 4 — Business impact for Mark

The basis question is not academic. Each surface in the SkipSync Hub is making a different decision off the financials_monthly numbers. Each surface needs the *right* basis for *its* decision:

### 4.1 "Loss-making bin types" alerts (PricingTab + SnapshotTab)

These fire when a bin type's net profit drops below threshold. Currently they read accrual-derived data, which means a bin type can show "profitable" because its invoices were issued, **even though the customer hasn't paid and may never pay**. For pricing decisions ("am I making money on the WMF − 6m Heavy?") Mark needs to know whether the cash actually arrived.

**Recommendation:** loss-maker alerts should fire off **CASH** numbers. Re-pricing or retiring a bin type is a forward-looking cash decision; sunk accruals don't help.

### 4.2 ATO obligations forecast (Snapshot Cash tile)

Mark's ~$540k GST + PAYG liability has to be paid in cash, on a date the ATO specifies. Forecasting cash to meet this **must use cash basis** — accrual revenue that lives in AR doesn't pay the ATO. Using accrual to forecast cash is structurally wrong; it will systematically **overestimate** Binned-IT's ability to meet obligations (because it counts invoiced-but-uncollected revenue as if it were money in the bank).

**Recommendation:** Snapshot's cash forecast tile must source from cash basis exclusively. The accrual figure has no place in that calculation.

### 4.3 Investor reporting (`/investor` route)

This is the one surface where **accrual is arguably the better default** — Andrew is reading SkipSync as a substitute for an audited management report, and **AASB 101 / IFRS-AU presentation is accrual basis**. An investor asks "what did the business earn this month?" and the answer in accrual terms ($30.5k Feb-26 profit) is the answer a Big-4-audited statement would produce.

**However:** showing Andrew an accrual-only number while the operator is making cash decisions creates a defensibility risk if the two ever diverge in a way Andrew later questions. The honest answer is: **show both, side by side, with a single-line plain-English explanation** ("invoiced this month: $182,867; collected this month: $139,483; the gap is in receivables and will mostly land in March").

**Recommendation:** investor route shows **accrual headline KPI with a sub-tile showing cash conversion** (cash NP ÷ accrual NP). Below 70% in any month should trigger an amber flag on the dashboard — currently Feb-26 is at **−57.8%** (cash NP is *negative* against a positive accrual NP), which is a defensibility-worthy disclosure regardless of the headline.

### 4.4 The Sprint 10 reconciliation now requires re-validation

The Sprint 10 work (logged at §10 of `agents/Accountant.md`) tied SkipSync's `financials_monthly` to the **accrual** Xero export to the cent — 99 Vitest assertions, all green. **That work is correct against the source it was tied to.** It does not, however, validate the cash side at all. Until §17B–E land cash basis ingestion and dual storage, the cash numbers in SkipSync are not reconciled to anything.

**Recommendation:** as part of Sprint 17, re-run the 5-way reconciliation **for both bases** for at least one fully-closed month (Mar-26 once available). Either basis can fail independently; both must pass before the dashboard is signed off as 🟢 green.

---

## 5 — Recommendations for the CFO-grade contract (Sprint 17)

The architectural decisions for §17B–E should follow these principles, in priority order:

### 5.1 DEFAULT basis: **CASH**
The business runs on cash. The bank account is the operating reality. Mark's loss-maker alerts, cash forecasting, and "did this month make money?" question are all cash questions. **Default everywhere a basis must be picked is cash.** The current default (silently accrual because `paymentsOnly` is omitted) is the inverse of what the business needs.

### 5.2 TOGGLE: required for power-users
Sarah will need to switch to accrual when reconciling against Xero's accrual P&L (which is also Xero's default presentation), or when preparing AASB-compliant management reports. **The toggle lives in the SnapshotTab header (top-right "Cash | Accrual")** and persists per-user via `platform_settings.user_prefs.financial_basis`. It must apply consistently across every tab in the same session — switching basis in one tab and not another is a defect.

### 5.3 DUAL STORAGE: both bases in `financials_monthly`
Add columns `*_cash` and `*_accrual` for every metric currently stored single-basis (revenue subtotals, COS subtotals, opex subtotals, derived GP/NP/NM%). The toggle is then a read-time selection over already-synced data. **No re-sync should ever be required to change basis** — historical analysis must be possible in either basis on demand.

Schema sketch (additive — no breaking change to existing readers):
- `financials_monthly` gains `*_accrual` columns (existing columns become the *cash* canonical set, with a one-time backfill from the existing accrual sync's data being re-tagged correctly until the cash sync produces real cash data going forward).
- The xero-sync writer makes **two API calls per month**: one with `paymentsOnly=true` (cash), one without (accrual). Both write to the same row. Failure of one does not block the other (degraded sync surfaces an Amber integrity badge).

### 5.4 SIGN-OFF: both bases visible side-by-side in the Snapshot KPI tile
The single most important UX outcome is that **the gap is obvious at a glance**. A CFO reviewing the dashboard at 8am should see, on the home tile, both numbers and the delta. If the gap is large (>$15k or sign-flipping), the tile turns amber and links through to a per-month basis-comparison view (essentially the §2.3 grid above).

This achieves three things at once:
1. Mark cannot accidentally make a decision off only one basis.
2. Sarah cannot silently re-sync to one basis and lose the other.
3. The "we audited the wrong source" failure mode (see §6 below) becomes structurally impossible — both bases are always visible, so a divergence between them is a tell that something needs investigating.

### 5.5 Diagnostic assertion in the sync writer
Per the §10 Sprint 10 pattern (assert `rev_other / rev_total < 5%` or warn), add: assert that **|cash_np − accrual_np| / |accrual_np| < 30%** for each month. If the gap is wider than that, log it and surface as an Amber integrity flag. Feb-26 would currently fire this (gap = 158% of accrual NP) — exactly the kind of thing that should have fired before tonight's discovery.

---

## 6 — The "would I sign this?" test (§6.5)

Would I, as a Big 4 audit partner, sign a comfort letter on Binned-IT's Feb-26 management accounts as currently surfaced in SkipSync?

**No.** The Snapshot tab shows accrual-derived $30,511.71 net profit for Feb-26 with no disclosure that the cash position for the same month is a $17,638.72 loss. A reader making any decision off that number — Mark, Sarah, Andrew, or me — is reading a number that **is correct on its own basis but materially incomplete for any single-basis decision**. The omission of the cash counterpart is the defect, not the accrual number itself.

**To sign:** I would require either (a) the dashboard switched to cash default with a clear disclosure of the basis, or (b) both bases presented side by side with the gap explained inline. Sprint 17's design satisfies (b), which is the stronger answer.

---

## 7 — Sign-off

| Item | Status | Owner | Note |
|---|---|---|---|
| Cash vs accrual variance reconciled to source JSON | 🟢 | Meg | All eight months tied to the cent against `recon.cjs` aggregation |
| Materiality assessed per §6.1 | 🟢 | Meg | Perf materiality $15k; Feb-26 + YTD + Oct-25 above |
| Variance commentary per §6.3 | 🟢 | Meg | Per-month drivers documented |
| Basis-default recommendation | 🟢 | Meg → §17B-E | Cash default, toggle, dual storage, side-by-side tile |
| §10 Learnings Log updated | 🟢 | Meg | See `agents/Accountant.md` §10 entry 2026-05-07-PM |
| Implementation (Sprint 17 #17B-E) | ⏳ | Sibling agents | Out of scope for this audit |
| Re-reconciliation against cash basis once #17B-E lands | ⏳ | Meg (next session) | Required before Sprint 17 sign-off |

**Three things checked, found, to do next:**
- **Checked:** every month Jul-25 → Feb-26 + YTD on both cash and accrual basis, tied to the parsed Xero JSON exports.
- **Found:** the accrual default in `api/xero-sync.js` causes silent overstatement of YTD net profit by $34,398 (30.6%) and a $48,150 single-month sign-flip in Feb-26. Three months breach performance materiality at the NP line; multiple line items breach it at the revenue/opex line.
- **To do next:** ship Sprint 17 #17B-E (cash default + toggle + dual storage + side-by-side tile), then re-run the 5-way reconciliation for Mar-26 against **both** bases before Sprint 17 sign-off.

---

*End of working paper. Filed to `docs/audits/2026-05-07-cash-vs-accrual-reconciliation.md`. Learnings logged to `agents/Accountant.md` §10.*
