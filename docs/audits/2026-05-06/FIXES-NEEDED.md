# SkipSync — Consolidated Fix Backlog (2026-05-06 audit cycle)

**Source:** five parallel audits run on 2026-05-06 — see the per-audit `.md` files in this folder for full evidence.
**Decision-grade implication:** Mark is making live business decisions on this data. Several items below mean current numbers are off enough that decisions could be wrong. Treat anything tagged P0 as blocking.

This file is the single source of truth for what needs to happen next. Group by sprint. Update statuses as work lands.

---

## Sprint 10 Unblock — closed 2026-05-07

| # | Item | Status |
|---|---|---|
| 1 | Xero revenue classifier (WMF/CON → rev_general) | ✅ DONE — extracted to `api/lib/xero-mapper.js`, 106 Vitest tests cover real SKU names from the Xero exports |
| 2 | `Math.abs()` sign-flip on credits | ✅ DONE — sign preserved; credits correctly reduce revenue |
| 3 | Cash balance matcher ("Binned-It Pty Ltd" row) | ✅ DONE — `findCashBalance()` walks Assets→Bank section by structure, not row name |
| 4 | AR sync + per-debtor write + Older bucket | ✅ DONE — `parseAgedReceivables()` reads Cells[1..6], per-debtor INSERT, `void arData;` removed |
| 11 | Legal-letter ABN/BSB into platform_settings | ✅ DONE — `useCompanyConfig()` hook + `legalTemplates.js` accepts `company` param + UI gate disables Send when placeholders detected |
| 10 | Collections "Send" UX honesty | ⚠ DONE (interim) — default delivery method is "Mark as sent (manual)" with explicit warning that email/post dispatch isn't wired. Resend integration still open. |
| 12 | Investor RBAC sandbox | ✅ DONE — `main.jsx` AuthGate redirects role=`viewer`/`investor` to `/investor` regardless of URL |
| 20 | Wizard side-menu entry | ✅ DONE — `Load Data` (📥) added under Reports section |

**Verification:** `npm run build` exits 0 errors; `npm test` 106/106 passing including the new `api/lib/xero-mapper.test.js` (99 new assertions covering every audit P0/P1 finding).

**Net effect on data quality:** the six P0 reconciliation issues that made the Xero → SkipSync pipeline unreliable are now fixed at the code layer. Production behaviour will change at the next Vercel deploy + next Xero sync run. To confirm post-deploy, Meg (the Accountant agent) should run a fresh reconciliation on March 2026 data and verify rev_other / cos_other / cash_balance / debtors_monthly all reconcile against the Xero export within materiality.

**Out of Sprint 10 (still open):** items #13 (COS classifier — partially addressed by the new module but full coverage of explicit tipping/disposal language), #14 (bin-type name fragmentation), #15 (loss-making detection), #16-#18 (Driver app PWA, offline queue, v0.5 → v1), #19 (JobCostingWidget orphan), #21 (Twilio SMS), #22-#23 (UX rebrand of dashboard tabs + mobile nav), and the P2/P3 backlog. See sections below for details.

---

## P0 — Critical (decision-changing this period). Must fix before the next pricing review or month-end close.

### 1. Xero revenue classifier is silently dumping ~$1.0M YTD into `rev_other`
**Source:** `audit-reconciliation.md` §P0-1
**Where:** `api/xero-sync.js:131-147` (the "Binned-IT fallback" branch in `mapPLToFinancials`)
**Symptom:** All 11 WMF SKUs ($882k YTD) plus CON SKUs ($33k) plus Transport, Tonnage, Recycling Income, Fuel Levy, etc. fall through to `rev_other`. Schema's `rev_general` column is hard-coded to 0 and never written.
**Fix:** Add explicit prefix matching for `wmf`, `con`, plus a "general waste" classifier covering Transport, Tonnage, Recycling Income, Fuel Levy, Council Permits, Long Term Bin Rental, Machinery Hire, Plastic and Tape, Other Fees. Write to `rev_general` (currently hard-coded to 0 at line 236).
**Test contract:** `WMF -1.1` → `general`; `WMF - 6m Heavy` → `general`; `CON - 6m FOR JOBS NOT RECYCLING` → `general`; `Revenue - Transport` → `general`; `ASB - 8m` → `asbestos`; `SOI 4.1` → `soil`; `GRW 6.1` → `green`. Adopt the test list from `audit-reconciliation.md` Appendix.
**Status:** OPEN

### 2. `Math.abs()` on negative trading-income rows inflates revenue
**Source:** `audit-reconciliation.md` §P0-2
**Where:** `api/xero-sync.js:137` — `const amt = Math.abs(row.amount)` inside the trading-income loop
**Symptom:** Customer credits/refunds (negative rows in Xero) get sign-flipped, inflating revenue. YTD overstatement: $339.60. Oct 2025 net-profit overstated $3,000 (a -$1,500 credit became +$1,500). Jan 2026 overstated $344.14.
**Fix:** Drop `Math.abs()` inside the loop. Sum signed values then take absolute at the end if needed for display (or — better — preserve sign so credits show as revenue reductions, which is the correct accounting treatment).
**Status:** OPEN

### 3. Cash balance loses entire $77,811.38 operating account
**Source:** `audit-reconciliation.md` §P0-3
**Where:** `api/xero-sync.js`, `parseBalanceSheet` (lines 263-303), specifically the cash matcher: `if (name.includes('cash') || name.includes('bank') || name.includes('westpac'))`
**Symptom:** The bank account in Xero is named `"Binned-It Pty Ltd"` — none of the keywords match, so the entire $77,811.38 is silently dropped from `cash_balance`.
**Fix:** Match by the section title (`Bank` section) AND the row's parent section context, not just the row's own name. Alternative: use Xero's Bank Summary report endpoint instead of pulling cash out of the Balance Sheet.
**Status:** OPEN

### 4. AR sync fully disabled
**Source:** `audit-reconciliation.md` §P0-4
**Where:** `api/xero-sync.js:467` — `void arData` (commented out)
**Symptom:** `debtors_monthly` table receives zero rows from Xero. ~$112k AR with 80+ debtors invisible to SkipSync's analytics. The `Debtors` tab shows fallback (Feb 2026) data only.
**Fix:** Re-enable AR write. Per-debtor rows (one row per debtor in `debtors_monthly`) — fix the column-shift bug noted in §P1 (the `Older` bucket is dropped because `Cells[1..5]` only covers 5 of 6 ageing buckets).
**Status:** OPEN

### 5. PricingTab Feb-only data branch
**Source:** `audit-month-switching-bug.md` + verified directly
**Where:** `src/components/PricingTab.jsx:56` — `if (monthIndex === 7) { /* Feb: real data */ } else { /* estimate */ }`
**Symptom:** Only Feb 2026 (monthIndex 7) uses real `binTypesData`. Other months extrapolate from YTD `pricingData` proportions, which aren't accurate for any specific month. The "loss-making bin types" alert fires off this extrapolated data.
**Fix:** Replace the Feb-only branch with per-month real data. Requires `binTypesDataByMonth` array in `src/data/financials.js` AND a Supabase-backed `useBinPerformance(reportMonth)` hook that returns per-month bin performance.
**Status:** OPEN

### 6. Month-switching: stale fallback data on FleetTab, DebtorsTab, BDMTab, SnapshotTab cash/AR
**Source:** `audit-month-switching-bug.md`
**Where:**
- `FleetTab.jsx:27` — fallback `D.binTypesData` (Feb only, no per-month variants)
- `DebtorsTab.jsx:44-49` — fallback `D.arData` / `D.topDebtors` (Feb only)
- `BDMTab.jsx:13` — `useChurnRisk()` takes no `reportMonth` param
- `SnapshotTab.jsx:121-122` — `D.cashBalance[mi]` / `D.arOverdue` not month-keyed
**Symptom:** Switching months shows stale Feb 2026 data for these tabs when Supabase is empty. User cannot tell.
**Fix:** Add per-month fallback arrays to `src/data/financials.js`: `binTypesDataByMonth`, `arDataByMonth`, `topDebtorsByMonth`, `dormantCustomersByMonth`. Pass `reportMonth` into `useChurnRisk(reportMonth)`.
**Status:** OPEN

### 7. `isBookkeeper` missing from AuthContext — Sarah cannot edit invoices or sync Xero
**Source:** `audit-personas.md` §1.2
**Where:** `src/context/AuthContext.jsx:65-75` (the `value` object) — referenced in `CRMBookingsPage.jsx`, `InvoicesPage.jsx`
**Symptom:** `const { isBookkeeper } = useAuth()` silently returns `undefined`. `canEdit = isOwner || isBookkeeper` → false for Sarah. The "Sync Xero" button and several edit affordances are hidden for bookkeepers.
**Fix:** ✅ FIXED 2026-05-06 (this session) — added `isBookkeeper: ['owner', 'bookkeeper'].includes(profile?.role)` and broadened `isManager` to include `fleet_manager`.
**Status:** ✅ DONE — verify with Sarah's test account in next UAT.

### 8. Routing collision: `/drivers` (admin) vs `/driver` (mobile portal)
**Source:** `audit-ux.md` §1.2
**Where:** `src/main.jsx:28` — `startsWith('/driver')` matched both
**Symptom:** Admin clicks "Drivers" in the side menu → dumped into the driver portal with no warning.
**Fix:** ✅ FIXED 2026-05-06 — changed to regex `/^\/driver(\/|$)/` (singular only). Note: `App.jsx` `/drivers` route still renders `<DriverApp />` so we still don't have a real admin "manage drivers" page — Jake clicking Drivers will now reach the App routes' /drivers entry which still routes to DriverApp. Need a real DriversAdminPage as a follow-up.
**Status:** ⚠ PARTIAL — main.jsx fixed; App.jsx `/drivers` route still dumps to DriverApp. Add admin DriversManagementPage in next sprint.

### 9. Hardcoded "Welcome back, Mark" greeting
**Source:** `audit-ux.md` §1.1, `audit-personas.md`
**Where:** `src/App.jsx` (Home component)
**Symptom:** Sarah / Jake / Andrew all see "Welcome back, Mark"
**Fix:** ✅ FIXED 2026-05-06 — uses `profile?.full_name?.split(' ')[0]` from useAuth, fallback "there".
**Status:** ✅ DONE

### 10. Collections "Send" doesn't actually send a letter
**Source:** `audit-personas.md` §1.2
**Where:** `CollectionsPage.jsx`, `legalTemplates.js`
**Symptom:** Sarah clicks "Send" expecting an email/post; Supabase records the event but no letter goes out. Customers receive nothing.
**Fix:** Wire to Resend (email) + a postal-letter integration (e.g. CourierPost API). Until then: gate the button with a clear "Mark as sent (manual)" UX so user expectations match reality.
**Status:** OPEN

### 11. Legal letters carry placeholder ABN/ACN/BSB/phone/bank-account-number
**Source:** `audit-personas.md` §1.2 + PRD-v6 risk register
**Where:** `src/lib/legalTemplates.js` `COMPANY` constant — `57 123 456 789` etc.
**Symptom:** Sarah generates a legal letter for an overdue customer; the ABN, ACN, BSB, bank-account number on the letter are placeholders. Legally defective if sent.
**Fix:** Move `COMPANY` constants out of code into `platform_settings` table (Supabase). Add a UI gate that disables Send until the values are configured (no longer "57 123 456 789").
**Status:** OPEN

### 12. No route-level RBAC for Andrew (investor) — sees all ops data
**Source:** `audit-personas.md`
**Where:** `src/main.jsx:36-41`
**Symptom:** Investor role can navigate to `/dispatch`, `/customers`, `/collections`, `/invoices` etc. PRD-v6 §4.6 says Andrew must only see `/investor`.
**Fix:** In `main.jsx` AuthGate: if `profile.role === 'viewer'` (or 'investor' if added), wrap all routes inside `<Routes>` with redirects-to-`/investor` for non-allowlisted paths.
**Status:** OPEN

---

## P1 — High (decision-changing this quarter). Schedule into the next sprint.

### 13. COS keyword classifier mis-buckets 30 of 36 rows ($337k = 65.6%) into `cos_other`
**Source:** `audit-reconciliation.md` §P1
**Where:** `api/xero-sync.js`, `mapPLToFinancials` lines 178-181
**Symptom:** Bin-coded tipping rows like `W- 4m`, `WMF - 12M (313)`, `ASB - 4m (324)` never match `tip|disposal|landfill|waste levy|tipping|recycling`. They drop into `cos_other` ($337k = 65.6% of all COS).
**Fix:** Same approach as #1 (revenue classifier). Add explicit bin-code prefix matching for tipping costs, plus `landfill levy` / `waste levy` / `recycling` keyword expansion.
**Status:** OPEN

### 14. Bin type name fragmentation across 4 sources
**Source:** `audit-pricing-bugs.md` §2
**Where:** `binTypesData` ("WMF - 6m"), `pricingData` ("6m General Waste"), `competitor_rates.bin_type` (free text), `bin_type_performance.bin_type` (free text)
**Symptom:** Three parallel naming conventions with manual mapping (`binNameMap` in PricingTab) prone to silent breakage on a single rename.
**Fix:** Standardise on canonical names like `4m General Waste`, `6m Asbestos`. Add CHECK constraints to `bin_type_performance.bin_type` and `competitor_rates.bin_type`. Migration `017_canonical_bin_types.sql`.
**Status:** OPEN

### 15. Loss-making bin detection on static `np` field, not derived metric
**Source:** `audit-pricing-bugs.md` §3
**Where:** `PricingTab.jsx:160` — `if (d.feb.np < 0)` reads from static `pricingData.np`, not the cost allocator output
**Symptom:** A bin with `pricingData.np = -2.6` gets flagged even when live allocator shows +1.2%; or vice versa, real loss-makers go unflagged.
**Fix:** Compute NP fresh from allocator at render time. Schema add: per-bin cost detail columns (tipping_per_job, fuel_per_job, wages_direct_per_job, etc.) — see `audit-pricing-bugs.md` §3 for the proposed migration.
**Status:** OPEN

### 16. Driver app — single-manifest, single-SW, no dedicated PWA install
**Source:** `audit-ux.md` §3 (driver assessment)
**Where:** `public/manifest.json`, `public/sw.js`, `src/main.jsx:28`
**Symptom:** "Install SkipSync" prompt installs the admin Hub. Driver who installs from `/driver` then opens the PWA → lands on `/` (admin home), not `/driver`.
**Fix:** Add a second manifest (`/driver-manifest.json`) with `start_url: '/driver'`, `name: 'SkipSync Driver'`, separate icons. Route the `<link rel="manifest">` based on URL path (or use `manifest-meta-tag` switching in `main.jsx` based on detection of driver path on initial render). Add a separate `sw-driver.js` if cache strategy needs to differ.
**Status:** OPEN

### 17. Driver app — offline writes silently fail
**Source:** `audit-ux.md` §3, `audit-personas.md` §1.4
**Where:** `JobCard.jsx`, `HazardReport.jsx`, etc. — every write hits Supabase synchronously
**Symptom:** Driver in a 4G blackspot tries to record `Arrived` or upload a photo — write fails, UI swallows the error, user thinks it worked.
**Fix:** Implement a write queue using Workbox Background Sync OR a manual IndexedDB queue with retry-on-online. Surface "queued (will send when online)" state in UI.
**Status:** OPEN

### 18. Driver app v0.5, not "Complete" as PRD-v6 §6.1 claims
**Source:** `audit-personas.md`
**Where:** `src/components/driver/*`
**Symptom:** No "Arrived" state (only `in_progress`/`completed`), no mandatory delivery photo gate, no OCR for tip dockets/fuel/maintenance, pre-start checklist is non-blocking, offline cache is 2h not 8h.
**Fix:** Update PRD-v6 §6.1 status to "v0.5 — Phase 3 partial". Then resequence the missing pieces into Phase 3 deliverables.
**Status:** OPEN — first action: PRD truthfulness fix.

### 19. JobCostingWidget orphaned (built, not imported anywhere)
**Source:** `audit-personas.md`
**Where:** `src/components/...JobCostingWidget*` (search needed)
**Symptom:** PRD-v6 §1 promises "Mark sees live job costing per job as it happens". Widget exists in code but no parent page imports it.
**Fix:** Wire it into Dispatch board (per-card expanded view) or Bookings detail.
**Status:** OPEN

### 20. Side menu omits Wizard / Load Data
**Source:** `audit-personas.md` §1.2
**Where:** `App.jsx:80-95` (`menuItems` array)
**Symptom:** Sarah can only reach the wizard from the Home tile — no sidebar entry. Awkward when she's deep in another page.
**Fix:** Add `{id:'month-select', icon:'📥', label:'Load Data', section:null}` to the OPERATIONS or REPORTS section.
**Status:** OPEN

### 21. Twilio SMS not wired — booking confirmation is `console.log` placeholder
**Source:** `audit-personas.md`
**Where:** `api/book-confirm.js:15-17`
**Symptom:** Public bookings via `/book` don't get SMS confirmation despite the PRD claim.
**Fix:** Wire the Twilio (or alternative — MessageBird, Sinch) integration. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` to Vercel env. Replace `console.log` with the actual `twilio` SDK call.
**Status:** OPEN

### 22. ALL-CAPS jargon dashboard tabs — kid test fails
**Source:** `audit-ux.md` §1.1, §2.3
**Where:** `App.jsx:73-76`
**Symptom:** "BDM", "RISK / EPA", "BENCHMARKING" — opaque to anyone outside the bin trade. Tab bar overflows on mobile.
**Fix:** Rename labels to plain English: `Overview`, `Sales`, `Profit`, `Compare`, `Competitors`, `Prices`, `New Customers`, `Trucks & Bins`, `Who Owes Us`, `Cash`, `Compliance`, `Action List`. Drop ALL-CAPS.
**Status:** OPEN

### 23. 11 of 12 dashboard tabs unreachable on mobile
**Source:** `audit-ux.md` §1
**Where:** `App.jsx:390` (tab bar `display:isMobile?'none'`), `MobileNav.jsx`
**Symptom:** MobileNav only routes to `/dashboard/snapshot`. The other 11 tabs cannot be reached on mobile.
**Fix:** Add a tab-picker drawer (long-press the dashboard MobileNav item or open a sheet) so all 12 tabs are reachable on mobile. Or split MobileNav to have multiple "report" entries.
**Status:** OPEN

---

## P2 — Medium. Schedule when capacity allows.

24. **Westpac Business Cash Reserve double-categorised** (audit-reconciliation §P1) — a liability that the cash matcher pulls into `cash_balance` but is also still a liability.
25. **AR parser drops `Older` bucket** (audit-reconciliation §P1) — `Cells[1..5]` covers 5 of 6 ageing buckets; need `Cells[1..6]`.
26. **`opex_admin` silently bundles Wages + Super** (audit-reconciliation §P2) — split into `opex_wages` and `opex_super` for clarity.
27. **`parseAmount` doesn't handle parenthesised negatives** (audit-reconciliation §P2) — `"$(1,500)"` parses as 1500 not -1500.
28. **Unused schema columns** — `accounts_payable`, `fixed_assets`, `loan_noncurrent` exist in schema but `parseBalanceSheet` never writes them.
29. **Money rounding inconsistency** (audit-pricing §5) — `Math.round`, `.toFixed`, unrounded floats mixed throughout. Add `roundMoney()` / `roundPercent()` helpers.
30. **Competitor rate join is case-sensitive** (audit-pricing §4) — `c.rates[service]` direct lookup; mis-cased names silently drop.
31. **Hardcoded fallback data isn't versioned** (audit-pricing §6) — add `fallbackDataMetadata` constant with `source`, `effective_from`, `effective_to`.
32. **DriverApp doesn't use `useBreakpoint`** (audit-ux §3) — desktop-style overlays at any viewport width.
33. **Login page hardcoded to `@binnedit.com.au` placeholder** (audit-ux §2.2) — leaks single tenant despite white-label.
34. **No "Forgot Password" link on LoginPage** (audit-ux §2.2).

---

## P3 — Low. Backlog.

35. AuditLogPage and TeamPage exist as routes (`/settings/audit`, `/settings/team`) with no nav entry — orphaned features.
36. `CompetitorPage` duplicates the `Competitors` tab.
37. Two booking flows (`/book` and `/embed/:slug`) with different bin SKU lists.
38. PRD-v6 §1 features with zero implementation: AI bin-content/hazmat checking, OCR, travel optimisation, wages/overtime/rostering, web-search competitor intelligence, automatic Xero invoice on job completion (`XERO_WRITE_ENABLED` defaults to false).

---

## Suggested next sprint (the "Sprint 10 Unblock")

A focused 2-day sprint to close the highest-damage gaps:

- Day 1 morning: items #1, #2, #3 (Xero sync revenue + sign-flip + cash matcher) — pair-program, write Vitest unit tests as you go
- Day 1 afternoon: item #4 (re-enable AR sync + per-debtor write + column-shift fix)
- Day 2 morning: items #10, #11 (Collections send + ABN/ACN/BSB resolution into `platform_settings`)
- Day 2 afternoon: items #12 (Andrew RBAC) + #20 (sidemenu Wizard entry) + UAT regression

After sprint: ship → ask Meg (the Accountant agent) to run a fresh reconciliation cycle on a recent month (March 2026) and confirm the audit findings reduce to within materiality.

---

## How to verify progress

Each item in this list has a status: `OPEN`, `⚠ PARTIAL`, `✅ DONE`. As work lands, update the status here in the same commit. The Accountant.md learnings log (§10) gets a new entry per sprint with the commit hashes and the post-fix reconciliation numbers.
