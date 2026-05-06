# Cash / Accrual Basis Support — Design Doc

**Date:** 2026-05-07
**Author:** Winston (Solution Architect)
**Sprint:** 17 #17B
**Status:** Design — implementation owned by sibling agents (Amelia / dev)
**Related personas:** Meg Whitfield (Accountant.md), Mark (owner), Sarah (bookkeeper), Andrew (investor)

---

## 0. Executive framing

Today SkipSync defaults to **accrual** because the Xero P&L call omits `paymentsOnly`. The business reality is that Mark — and almost every operational decision he makes (cash forecasting against the ~$540k ATO liability, payroll, fuel, fleet renewals) — runs on **cash basis**. Accrual is the bookkeeper's view, not the operator's view.

This design adds first-class basis support so:

1. **Cash is the universal default** for operators and investors.
2. **Accrual is a one-click toggle** for Sarah and for any reconciliation work Meg drives.
3. **Both bases live in the database simultaneously**, so toggling is instant and historic — no re-sync to switch a month from accrual to cash.

The trade-off is row-count and one extra cron call. Both are trivial (see §2 sizing and §3 cron). The win is decision-correctness: today the dashboard answers a question Mark didn't ask.

---

## 1. Problem statement

### 1.1 Concrete evidence — Feb 2026 reconciliation table

From `docs/audits/2026-05-06/audit-reconciliation.md` §P2-5 (Cash vs Accrual P&L diverge materially) and §"Numerical worked example — February 2026":

```
                                    Accrual        Cash         Δ ($)        Δ (%)
Revenue (rev_total)                 182,867.14     ~166,800     -16,067     -8.8%
Cost of Sales (cos_total)            62,332.17      ~57,900      -4,432     -7.1%
Gross Profit                        120,534.97     ~108,900     -11,635     -9.7%
OPEX (opex_total)                    90,023.26      ~84,500      -5,523     -6.1%
Net Profit                           30,511.71      ~24,400      -6,112    -20.0%
ASB -1.1 (single SKU example)         1,050.00         550.00      -500    -47.6%
WMF rolled subtotal (illustrative)   ~95,000        ~88,000      -7,000     -7.4%
```

(Cash-basis figures are reconstructed from the parsed `..._(1).json` Cash Basis export referenced in P2-5; per-line precision will be confirmed at implementation time. The shape and direction of the variance are what this design must accommodate.)

The headline: **Net Profit moves 20% between bases for a single month.** That is not a rounding tolerance — that is a different decision. If Mark is staring at $30k accrual but only $24k actually landed in the bank, his runway-against-ATO conversation with Meg changes.

### 1.2 Historical context — "we reconciled against the wrong source"

From Sprint 10's `docs/audits/2026-05-06/audit-reconciliation.md` (executive summary): *"the data SkipSync would land in Supabase is not a reliable basis for business decisions."* That audit was conducted against the **accrual** export — and Sprint 10's fixes (`api/lib/xero-mapper.js`) brought accrual-basis numbers into line. But the audit did not question the **basis itself**. Meg's §10 learnings log entry for 2026-05-06 notes: *"The Cash Basis P&L file is substantially different from the Accrual P&L file — SkipSync requests only the default (Accrual)."*

So Sprint 10 closed the *mapping* gap. Sprint 17 #17B closes the *basis* gap. Without this change, Sprint 10's hard-won correctness is correct against the wrong report for everyday operator use.

### 1.3 What "good" looks like
- Operator default = **cash**. Decision: "do I have the cash to pay X?" Answer: read the cash-basis line.
- Bookkeeper default = **cash**, with one-click switch to **accrual** for Xero reconciliation. Sarah toggles to match Meg's working papers.
- Investor (Andrew) = **cash, locked**. Read-only, no toggle.
- Both bases stored. Switching the toggle is a React Query key change — no backend round-trip.

---

## 2. Schema design

Add an `accounting_basis` discriminator column to all three derived per-month tables. Make it part of the natural key so both bases coexist.

### 2.1 Column definition

```sql
accounting_basis text NOT NULL DEFAULT 'cash'
  CHECK (accounting_basis IN ('cash','accrual'))
```

Applied to:

| Table | Why include it |
|---|---|
| `financials_monthly` | The P&L is where cash vs accrual genuinely differs. **Primary use case.** |
| `balance_sheet_monthly` | Xero's BS is always as-at-date; there is no meaningful cash/accrual distinction at the report layer. **We include the column anyway** for two reasons: (a) ledger queries that filter all per-month tables by basis don't need a special-case join; (b) future-proofing if Xero ever surfaces a cash-basis BS variant (it does for some report shapes). The column simply gets the same numbers under both basis values for now. |
| `debtors_monthly` | AR is meaningful **only** under accrual — under cash basis there is no concept of receivable (revenue is recognised on receipt, not on invoice). Cash-basis rows in this table will be **empty** and we'll surface a UI affordance ("Debtors aren't tracked under cash basis — switch to accrual to see them") rather than fabricate zero rows. |

### 2.2 Natural-key change

Replace the existing `(report_id, report_month)` unique constraint on each of the three tables with `(report_id, report_month, accounting_basis)`. Both bases for the same `report_month` now coexist as two rows.

### 2.3 Migration `020_accounting_basis.sql`

Idempotent (per project convention). Skeleton the dev agent will own:

```sql
-- 020_accounting_basis.sql — Sprint 17 #17B
-- Adds dual-basis support to derived per-month tables.

ALTER TABLE financials_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

ALTER TABLE balance_sheet_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

ALTER TABLE debtors_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

-- Backfill: every existing row was written by the accrual-default sync.
UPDATE financials_monthly      SET accounting_basis = 'accrual';
UPDATE balance_sheet_monthly   SET accounting_basis = 'accrual';
UPDATE debtors_monthly         SET accounting_basis = 'accrual';

-- Replace natural keys.
ALTER TABLE financials_monthly      DROP CONSTRAINT IF EXISTS financials_monthly_report_id_report_month_key;
ALTER TABLE balance_sheet_monthly   DROP CONSTRAINT IF EXISTS balance_sheet_monthly_report_id_report_month_key;
ALTER TABLE debtors_monthly         DROP CONSTRAINT IF EXISTS debtors_monthly_report_id_report_month_key;

ALTER TABLE financials_monthly
  ADD CONSTRAINT financials_monthly_report_id_report_month_basis_key
    UNIQUE (report_id, report_month, accounting_basis);
ALTER TABLE balance_sheet_monthly
  ADD CONSTRAINT balance_sheet_monthly_report_id_report_month_basis_key
    UNIQUE (report_id, report_month, accounting_basis);
ALTER TABLE debtors_monthly
  ADD CONSTRAINT debtors_monthly_report_id_report_month_basis_key
    UNIQUE (report_id, report_month, accounting_basis);

-- Helpful read-side index (basis-first because the UI filters by basis on every read).
CREATE INDEX IF NOT EXISTS idx_financials_monthly_basis_month
  ON financials_monthly (accounting_basis, report_month);
```

The exact existing constraint names should be confirmed by the dev agent against the live migration history; the `IF EXISTS` guards keep the migration safe to re-run.

### 2.4 Sizing trade-off

Storing both bases ~doubles row counts on these three tables. For Binned-IT specifically:

- `financials_monthly`: 1 row/month × 12 months × 2 bases = **24 rows/year**
- `balance_sheet_monthly`: same shape, **24 rows/year**
- `debtors_monthly`: ~80 debtors × 12 months × 2 bases = **~1,920 rows/year** (cash-basis rows will be empty / absent — see §2.1)

Total annual incremental row count: ~250 for the meaningful tables, ~2k worst case for debtors. Trivial against any Postgres sizing concern. The decision to dual-store dominates the alternative (re-sync on toggle) on every dimension — latency, UX, audit-trail.

---

## 3. API design

### 3.1 `xero-sync.js` — `syncMonth()` signature

Today:
```
syncMonth(month, accessToken, tenantId, serviceKey, userId)
```

Proposed:
```
syncMonth(month, accessToken, tenantId, serviceKey, userId, basis = 'cash')
```

Where `basis ∈ ['cash', 'accrual']`. Default `'cash'` aligns the API surface with the new operator default. Each invocation **writes one basis**. To populate both bases, call twice.

### 3.2 Xero P&L call

Inside `fetchProfitAndLoss`:

- `basis === 'cash'`  → request param `paymentsOnly=true`
- `basis === 'accrual'` → request param `paymentsOnly=false` (or omit; Xero defaults to accrual)

This is a single line change at the URL-builder. The Sprint 10 mapper (`api/lib/xero-mapper.js`) is **basis-agnostic** — it consumes the JSON Xero returns and doesn't care which basis produced it. That's a happy property of the mapper rewrite and means no test churn in `xero-mapper.test.js`.

### 3.3 POST body shape

Existing operator-facing endpoint accepts:
```json
{ "month": "2026-04-01", "userId": "..." }
```

Extend to:
```json
{ "month": "2026-04-01", "basis": "cash", "userId": "..." }
```

For multi-month operations, extend the existing `sync_all` action:
```json
{ "action": "sync_all", "from_month": "2025-07-01", "to_month": "2026-04-01", "basis": "cash", "userId": "..." }
```

`basis` is optional in both payloads with a default of `'cash'`. Backwards-compatible for any existing operator scripts (they just keep getting cash now instead of accrual — a deliberate behaviour change).

### 3.4 New `sync_all_bases` action (recommended)

To avoid forcing operators to issue two POSTs per cron run, add a single convenience action:

```json
{ "action": "sync_all_bases", "month": "2026-04-01", "userId": "..." }
```

Internally this calls `syncMonth(...,'cash')` then `syncMonth(...,'accrual')` — sequentially, not in parallel, to keep Xero rate-limit pressure low (Xero is 60 req/min per app per tenant; doubling the basis count halves the headroom and we want the second basis to be a deliberate retry-friendly step).

### 3.5 Cron schedule

Today's nightly cron runs accrual-only (implicitly). Two options:

| Option | Pros | Cons |
|---|---|---|
| **A. Cron syncs both bases via `sync_all_bases`** | Both views always fresh; no operator action; Sarah and Mark always see latest data on either toggle. | Doubles the Xero API spend (still well within the 60 req/min limit — currently we use ~6 calls per sync). |
| **B. Cron syncs cash only; accrual on-demand** | Half the API calls. | Sarah switching to accrual after sync completion sees stale data until she manually triggers accrual sync. Surprise-vector. |

**Recommendation: Option A.** The API cost is negligible and the principle "the toggle is instant and never stale" is worth defending. This is a §8 open question for Mark to confirm, but the design assumes A.

---

## 4. Read-side design

### 4.1 Hook signatures

```js
useFinancials(reportMonth, basis)        // basis is part of React Query key
useBalanceSheet(reportMonth, basis)      // same
useDebtors(reportMonth, basis)           // same; basis='cash' returns empty + flag
```

The React Query key becomes `['financials', reportMonth, basis]`. When the toggle flips, the new key triggers a fresh query — but because both bases are pre-fetched (cron runs both nightly per §3.5), the data is in the cache and the UI swap is instantaneous.

### 4.2 Shared `useAccountingBasis()` hook

```js
// src/hooks/useAccountingBasis.js
export function useAccountingBasis() {
  // returns { basis, setBasis, isLocked }
  // - basis: 'cash' | 'accrual', read from localStorage with default 'cash'
  // - setBasis: persists to localStorage and triggers a context update
  // - isLocked: true for investor role (Andrew) — setBasis is a no-op, basis is forced to 'cash'
}
```

Components consume it once at the top of the tab (not in every KPI card) and pass the resolved `basis` down to the data hook calls. This avoids prop-drilling proliferation while keeping the data hook signatures explicit (no implicit context coupling — easier to test).

### 4.3 Why localStorage, not Supabase user prefs?

Trade-off, for the record:

- **localStorage:** instant. No network round-trip on toggle. Survives reload. Per-device (Sarah's laptop and her phone can have different defaults — feature, not bug).
- **Supabase user prefs:** synced across devices. Network latency on toggle (~80–200 ms) causes a perceptible page-flicker. UX research consistently shows users hate flicker on settings toggles more than they value cross-device sync for this kind of preference.

**Decision: localStorage.** If a user-preferences feature ships later for unrelated reasons (theme, timezone, etc.), basis can migrate then with a localStorage→Supabase one-time copy. Until that exists, localStorage is the right answer.

### 4.4 Fallback layer (`src/data/financials.js`)

The hardcoded fallback in `src/data/financials.js` (Jul 2025–Feb 2026) was generated from the **accrual** Xero export. Two options:

- **Option F1.** Generate a second fallback dataset for cash basis. Doubles the file size; matches "store both bases" principle on the read-side too.
- **Option F2.** Treat the fallback as "best-effort approximation" with a UI banner: *"Showing fallback data (cash-basis approximation) — connect to Supabase for accurate basis-specific figures."*

**Recommendation: Option F2** for now. The fallback path is itself a degraded mode (per CLAUDE.md, it's the "Supabase returns empty/error" case); doubling its maintenance cost to perfect a degraded path is a poor trade. F1 is reconsidered if/when the fallback becomes load-bearing (e.g. for an offline mode on the driver app). See §7 risks.

---

## 5. UI toggle

### 5.1 Placement

| Surface | Placement | Pattern |
|---|---|---|
| **Desktop header** (`src/App.jsx`) | Immediately right of the existing month selector. | Two-button segmented control. |
| **Mobile header** | Compact chip at the right edge of the header bar. | Two-letter abbreviation: `Cash` / `Accr`. |
| **Mobile hamburger drawer** | Settings section, near "Reports" / "Load Data". | Full-width segmented control, mirrors desktop. |

Putting it next to the month selector reinforces the mental model: *month + basis = the selector pair that determines what the dashboard is showing.* They live together because they answer together.

### 5.2 Visual treatment

Two-button segmented control, active button styled with `B.yellow` (matches existing brand-active treatment for nav and tab indicators). Inactive button: `B.cardBg` background, `B.text` foreground. 44×44 minimum tap target on mobile (per CLAUDE.md QA protocol).

```
┌──────┬─────────┐         ┌──────┬─────────┐
│ Cash │ Accrual │   →     │ Cash │ Accrual │   ← active = B.yellow
└──────┴─────────┘         └──────┴─────────┘
       (default state)        (Sarah switches)
```

### 5.3 Per-persona defaults

| Persona | Default basis | Toggle enabled? | Rationale |
|---|---|---|---|
| **Mark** (owner) | `cash` | Yes | Operator decisions are cash-driven. Toggle for monthly review with Meg. |
| **Sarah** (bookkeeper) | `cash` | Yes | Initial thought: default Sarah to accrual since she reconciles against Xero accrual. **Rejected** — keeping the universal default avoids a cross-persona divergence that would surprise Sarah when she pairs with Mark on a screen-share. She toggles to accrual when she reconciles; that toggle is one click. |
| **Jake** (fleet manager) | `cash` | Yes | Fleet tab numbers (fuel, repairs) are cash-relevant. |
| **Andrew** (investor) | `cash` | **No (locked)** | Per CFO methodology (Accountant.md §6 — "would I sign this?"), the read-only investor view should reflect what funds withdrawals. That is cash. Andrew sees a disabled toggle with a tooltip: *"Investor view is fixed to cash basis (CFO-recommended)."* |

### 5.4 Default rationale — why universal cash

Three factors aligned:

1. **Operator-first product positioning.** Mark is the primary user every day. Sarah is intermittent. Optimise the default for the daily case.
2. **Cash is decision-correct for operators.** Accrual is decision-correct for accountants. SkipSync is operator software.
3. **Toggle cost is one click.** Sarah's cost of switching to accrual when she needs it is trivial; Mark's cost of having accrual as the default would be a daily mental tax of "is this number cash or accrual?"

---

## 6. Migration path

| Day | Action | Owner |
|---|---|---|
| **D-0** | Ship code + migration `020_accounting_basis.sql`. Existing rows backfilled to `accounting_basis = 'accrual'` (truthful — that's what they were). New writes go in with explicit basis. | dev (Amelia) |
| **D+1** | Run the new `sync_all_bases` endpoint over the trailing 12 months. Result: every month from May 2025 onwards has both a cash-basis row and an accrual-basis row in `financials_monthly` / `balance_sheet_monthly`. Debtors-monthly: only the accrual rows are populated. | operator (Mark or Sarah via Settings → "Re-sync all months, both bases") |
| **D+2** | Verify Meg can run a 5-way reconciliation against either basis (Accountant.md §5). Meg confirms cash-basis numbers tie to the Xero Cash Basis P&L export. | Meg (Accountant) |
| **D+3 onwards** | Cron runs `sync_all_bases` nightly. Operators see cash by default; toggle works on every month with both bases populated. The original D-0 backfill rows (tagged `accrual`) remain — no data destroyed. | cron / Vercel |

**Rollback story.** If the basis-toggle behaviour misbehaves, revert the front-end commit; the schema change is additive and the new column is harmless to ignore. The migration itself does not need rolling back because both columns and data are non-destructive.

---

## 7. Risks

### R1. DELETE-INSERT pattern in `xero-sync.js` (P0 — must fix in implementation)

Today's writer keys deletes on `report_month`. Per Accountant.md §4 / Meg's notes: *"the xero-sync uses DELETE+INSERT (not upsert) to avoid Postgres 23505 unique-constraint violations on re-runs."*

After this change the DELETE must key on `(report_month, accounting_basis)`. Otherwise: syncing cash basis would wipe the just-stored accrual rows for that month. **This is the single biggest implementation gotcha.** The dev agent must add a Vitest assertion: "syncing basis A does not affect rows of basis B for the same month."

### R2. Hardcoded fallback (`src/data/financials.js`) is basis-blind (P1)

Per §4.4: fallback is currently shaped from the accrual export. Mitigation: surface a fallback banner including a basis disclaimer. Reconsider full dual-fallback if the fallback path becomes load-bearing for offline/driver scenarios.

### R3. Investor view documentation (P2)

`PRD-v6.md` §4.6 (investor view) does not currently specify the basis Andrew sees. After this lands, that section should be updated to read: *"Investor view (`/investor`) is fixed to cash basis. Toggle is disabled."* Tech-writer (Paige) owns this update.

### R4. Cron API spend (P3)

Doubling sync calls bumps Xero API usage from ~6 calls/sync to ~12 calls/sync. Well within Xero's 60-req/min limit. No risk in practice, called out for completeness.

### R5. Snapshot KPI tile interpretation (P2)

The Snapshot tab's headline KPIs (Revenue, Profit, Cash) will silently shift on toggle — a 20% net-profit swing between bases for a typical month per §1.1. This is correct behaviour (user toggled, user gets the new number) but the UI should make the active basis visible at the KPI tile, not just at the global toggle. Recommend adding a small `(cash)` / `(accrual)` suffix on the relevant KPI tiles. UX (Sally) owns the chip styling.

### R6. AR / debtors_monthly under cash basis (P2)

Cash-basis debtors rows will be empty. The Debtors tab needs an empty-state with an explanatory banner: *"Aged receivables don't apply under cash basis — switch to accrual at the top to see debtors."* If we don't ship this banner, Sarah toggling to cash will see "no debtors" and panic that AR sync broke again (per Sprint 10's P0-4 history).

---

## 8. Open questions for Mark

1. **Cron coverage.** Confirm Option A in §3.5 (cron syncs both bases nightly), or prefer Option B (cash-only nightly, accrual on-demand)? Design assumes A.
2. **Investor view (Andrew).** Cash-only as proposed? Or cash with a small accrual-net-profit asterisk for context? Proposed: cash-only, no asterisk — keep the read-only view ruthlessly simple.
3. **Snapshot KPI tile.** When the toggle is set to cash, show only the cash number? Or show both bases side-by-side with the active one emphasised? Proposed: active-only with a small basis chip on each tile (per R5). Side-by-side risks tile-bloat at mobile width.
4. **Sarah's default.** Confirm the universal default (`cash` for everyone except Andrew). Alternative considered and rejected: per-role default (Sarah → accrual). Reasoning in §5.3.
5. **Per-month override.** Should an individual month ever pin a basis (e.g. period-close month locks to accrual)? Proposed: no — period-close in Meg's workflow already uses accrual via her toggle, and pinning per month adds a state-management surface that is hard to discover. Out of scope for #17B.

---

## 9. Out of scope for #17B

- Cash/accrual toggle on the Wizard / Load-Data flow. Wizard captures manual entries — basis is determined by the user's input, not by a toggle. Wizard rows continue to be tagged `accrual` for audit-trail honesty.
- Multi-tenant basis prefs. Single-tenant SkipSync today; if/when multi-tenant lands, basis becomes a per-tenant setting in `platform_settings`.
- Cash-basis fallback dataset for `src/data/financials.js`. See §4.4 / R2.
- Quarterly / yearly aggregation across mixed bases. Aggregation queries should `WHERE accounting_basis = $basis` — single basis at a time. Cross-basis aggregation is not a valid accounting view.

---

## 10. Implementation handoff

This design doc is the contract. Sibling agents own the implementation:

- **Amelia (dev):** migration `020_accounting_basis.sql`, `xero-sync.js` basis param, `sync_all_bases` action, hook updates (`useFinancials`, `useBalanceSheet`, `useDebtors`, new `useAccountingBasis`), R1 Vitest regression.
- **Sally (UX):** segmented-control component, mobile chip variant, KPI-tile basis suffix per R5, Debtors empty-state banner per R6.
- **Paige (tech writer):** PRD-v6 §4.6 update per R3, README/CLAUDE.md note that operator default is cash.
- **Meg (accountant):** D+2 reconciliation per §6 — sign off that cash-basis sync ties to the Xero Cash Basis P&L export within materiality.

---

## 11. References

- `docs/audits/2026-05-06/audit-reconciliation.md` — Sprint 10 audit; §P2-5 (basis divergence), §"Numerical worked example — February 2026" (Feb 2026 cash vs accrual data).
- `agents/Accountant.md` — Meg Whitfield methodology; §5 (5-way reconciliation), §10 learnings log entries 2026-05-06 and 2026-05-07 (Sprint 10 mapper rewrite, basis gap noted).
- `api/xero-sync.js` — current sync implementation (accrual-only).
- `api/lib/xero-mapper.js` — basis-agnostic mapper (Sprint 10 deliverable; no churn expected from this change).
- `supabase/migrations/001_initial_schema.sql` — current `(report_id, report_month)` natural keys to be replaced.
- `PRD-v6.md` §4.6 — investor view (to be updated per R3).
- `CLAUDE.md` — code conventions, fallback rules, persona list.
