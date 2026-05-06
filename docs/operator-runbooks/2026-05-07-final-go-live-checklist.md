# 2026-05-07 — Final go-live checklist (Sprints 10-16)

After the multi-agent push that closed the entire 2026-05-06 audit backlog, three categories of work remain. Items that could be done autonomously by Claude Code are marked ✅; items that need YOUR direct action are marked 🔵.

---

## ✅ Done autonomously (already live in production)

- All 15 Sprint 10–16 commits pushed to `master` (15 deploys ● Ready in Vercel as of 2026-05-07 ~08:10).
- `RESEND_FROM=accounts@binnedit.com.au` set in **Production + Preview + Development** Vercel env (matches `legalTemplates.js` default sender).
- Live `bin_type` precheck: `bin_type_performance` is empty; `competitor_rates` has 6 rows ALL of which canonicalise cleanly (`12m3 GW → 12m General Waste`, etc.). **Migration 017's CHECK constraint will not reject any existing rows.**
- Public endpoints smoke-tested:
  - `GET /book` → 200
  - `GET /embed/binned-it` → 200
  - `GET /` → 200 (login screen renders)
  - `GET /driver-manifest.json` → 200 (NEW Sprint 11D)
  - `GET /sw-driver.js` → 200 (NEW Sprint 12A)
- Vitest 311/311 + Playwright 2/2 green locally.

---

## 🔵 Need YOUR action — apply 4 SQL migrations

Claude Code has `SUPABASE_SERVICE_ROLE_KEY` (PostgREST scope only) but not the database password or a Supabase Personal Access Token, so it cannot execute DDL. Migrations are bundled into one paste-ready file:

**File:** `docs/operator-runbooks/2026-05-07-apply-migrations.sql`

**How to apply:**
1. Open https://app.supabase.com/project/dkjwyzjzdcgrepbgiuei/sql/new
2. Paste the entire contents of the bundle file
3. Click **Run**
4. Should complete in <5 seconds with no errors (every statement is idempotent — safe to re-run)

**What it does:**
| Migration | Effect |
|---|---|
| `017_canonical_bin_types.sql` | PL/pgSQL `normalize_bin_type()` function + UPDATE existing rows + CHECK constraint pinning `bin_type_performance.bin_type` and `competitor_rates.bin_type` to the 40 canonical names. Verified safe — see `scripts/precheck-live-bintypes.js`. |
| `017_postal_letter_queue.sql` | New `postal_letter_queue` table for the Sprint 13 #10 collections postal-letter dispatch endpoint. |
| `018_per_bin_cost_detail.sql` | Adds 10 per-bin cost columns to `bin_type_performance` to back the Sprint 14 #15 derived loss-maker detection. |
| `019_opex_wages_super_split.sql` | Adds `opex_wages` + `opex_super` columns to `financials_monthly` (Sprint 15 #26). `opex_admin` retained as the legacy aggregate. |
| **`020_accounting_basis.sql` (NEW Sprint 17)** | **CRITICAL — fixes the cash-vs-accrual gap.** Adds `accounting_basis text NOT NULL DEFAULT 'cash' CHECK (cash|accrual)` to financials_monthly + balance_sheet_monthly + debtors_monthly. Replaces the natural key with `(report_id, report_month, accounting_basis)` so both bases coexist. Backfills every existing row to `'accrual'` since the Sprint 10 sync never sent `paymentsOnly`. After this Mark sees CASH by default; Sarah can toggle to ACCRUAL when reconciling against Xero's accrual report. |

**If anything fails:** every migration uses `IF NOT EXISTS` / `IF EXISTS` / `CREATE OR REPLACE` so partial application is safe to re-run. The 017 CHECK constraint is wrapped in a DO block that drops it first if it exists.

---

## 🔵 Need YOUR action — set Twilio credentials

Sprint 13 #21 wired real Twilio SMS for booking confirmations. The code is fail-soft (booking flow stays green if Twilio is misconfigured) but no SMS will actually send until you add three env vars to Vercel.

**Where to get the values:**
1. Sign up at https://www.twilio.com (or use existing account)
2. Console → Account Info → copy `Account SID` and `Auth Token`
3. Console → Phone Numbers → buy/use an Australian number → copy in E.164 format (e.g. `+61400000000`)

**How to add to Vercel:**

```bash
cd BinnedIT-Hub
npx vercel env add TWILIO_ACCOUNT_SID production --value "AC..." --yes
npx vercel env add TWILIO_AUTH_TOKEN production --value "..." --yes
npx vercel env add TWILIO_FROM_NUMBER production --value "+61..." --yes
# Repeat for preview + development if you want SMS to fire from PR previews / vercel dev
```

**To test post-set:** make a booking via `https://binnedit-hub.vercel.app/book` with your own mobile number — you should receive an SMS within ~5s.

---

## 🔵 Need YOUR action — configure company identity

Sprint 11 #11 + Sprint 13 #10 wired the legal-letter ABN/BSB to read from `platform_settings`. The Collections Send button is gated DISABLED until real values are saved.

**How to configure:**
1. Sign in as owner (mark@binnedit.com.au) at https://binnedit-hub.vercel.app
2. Side menu → Settings
3. Scroll to "🏢 Company Identity" section (Sprint 11B)
4. Fill in the 9 fields (Name, ABN, ACN, Address, Phone, Email, BSB, Account Number, Penalty Interest Rate)
5. Click "Save Company Identity"
6. The placeholder warning banner on Collections letters will disappear and Send will unlock

**Watch for:** the editor refuses to save if ABN equals `57 123 456 789` (placeholder) — you must use real values.

---

## 🔵 Need YOUR action — verify the Xero data integrity rewrite + cash basis

After applying migrations 017–020 (above), trigger fresh Xero syncs for a recent month and run Meg's reconciliation cycle. Specifically check:

1. **Cash basis Feb 2026 (the headline test)** — sync via `POST /api/xero-sync` with body `{ "action": "sync_all_bases", "month": "2026-02", "userId": "<your-uuid>" }`. Then in Settings → Reports tab, ensure the Cash/Accrual toggle defaults to **Cash**. Snapshot tab Net Profit should show **−$17,638.72** for Feb 2026 (a LOSS — was previously showing accrual's +$30,511.71 profit). Toggle to Accrual → number flips to +$30,511.71. The full per-month reconciliation Meg ran is at `docs/audits/2026-05-07-cash-vs-accrual-reconciliation.md`.
2. **Revenue mix** — `rev_other / rev_total < 1%` (was 64% before Sprint 10/14)
3. **Cash balance** — matches Xero's bank balance to the cent (was $0 before Sprint 10)
4. **Debtors count** — `SELECT COUNT(*) FROM debtors_monthly WHERE report_month = '<latest>' AND accounting_basis = 'accrual';` > 0 (debtors only meaningful under accrual)
5. **Loss-makers** — BenchmarkingTab now flags loss-makers from derived metrics (Sprint 14 #15) instead of static `pricingData.np`
6. **Opex split** — `opex_wages` and `opex_super` columns populated separately (Sprint 15 #26)
7. **Investor view RBAC + cash lock** — log in as a viewer/investor role; should be redirected to `/investor` AND the basis toggle should be disabled with the tooltip "Investor view is fixed to cash basis per CFO recommendation"

How to trigger sync: Settings → Xero → "Sync Current Month" (which now should do both bases — verify with Settings → Xero Sync Log table) OR direct API call as above.

The Playwright suite at `e2e/cash-accrual-toggle.spec.js` automates assertions 1 + 7. Run with `npm run test:e2e -- e2e/cash-accrual-toggle.spec.js` once the migration + Vercel deploy land.

---

## Summary

| Status | Item | Where |
|---|---|---|
| ✅ Done | All Sprint 10-16 code deployed | Vercel (15 deploys ● Ready) |
| ✅ Done | RESEND_FROM env var | Vercel (all 3 envs) |
| ✅ Done | Bin-type backfill safety verified | `scripts/precheck-live-bintypes.js` |
| ✅ Done | Public endpoint smoke tests | curl 200 across all routes |
| 🔵 You | Apply 4 SQL migrations | Supabase Dashboard SQL Editor (paste `2026-05-07-apply-migrations.sql`) |
| 🔵 You | Set 3 Twilio env vars in Vercel | After signing up at twilio.com |
| 🔵 You | Configure company identity | Settings UI → Company Identity section |
| 🔵 You | Trigger fresh Xero sync + verify | Settings UI → Xero |

After those four 🔵 items, the entire 38-item audit backlog from 2026-05-06 is **fully closed in production** and you're back to net-new feature work (PRD-v6 Phase 4-5 roadmap items: AI bin-content checking, OCR, travel optimisation, wages/rostering, web-search competitor intel, auto-Xero invoice on completion).
