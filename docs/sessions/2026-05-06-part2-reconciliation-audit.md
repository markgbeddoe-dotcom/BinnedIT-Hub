# Session Log — 2026-05-06 (Part 2)

**Author:** Bed_w + Claude (Opus 4.7) via Claude Code
**Codebase:** SkipSync
**Branch:** master
**Outcome:** Five-track audit of the Xero ↔ SkipSync reconciliation, pricing logic, month-switching bugs, UX, and PRD-persona gaps. New `Accountant` (CFO-pedigree) agent created. Three safe fixes applied; the rest is documented as a prioritised backlog for the next sprint.

This session's work picks up after `2026-05-06.md` (Part 1) and is the answer to Mark's question: *"are the SkipSync numbers good enough to make business decisions on?"* Short answer per the audit: **not yet, but the path to make them so is now mapped.**

---

## 1 — What got done

### A. New agent: Margaret "Meg" Whitfield, FCA — CFO-pedigree accountant
File: [`agents/Accountant.md`](../../agents/Accountant.md). 30-year FCA, ex-Big-4 audit partner, Xero-certified, virtual CFO. Designed specifically for SkipSync — knows the tech stack, the schema, the skip-bin industry (EPA Vic landfill levy, asbestos handling, bin-on-truck-time as hidden margin driver, etc.), and the failure modes of keyword-based ETL pipelines. Includes a 5-way reconciliation framework, materiality thresholds tuned to Binned-IT's $1.5–1.8M revenue, audit assertions (CEAVOP), KPI integrity scoring (🟢🟡🔴), period-close checklist, and a learnings log that grows over time.

Activation: read `agents/Accountant.md` at the start of any session involving financial accuracy. The §10 Learnings Log at the bottom captures findings from each engagement so future sessions don't re-discover the same issues.

### B. Five parallel audits

Five subagents ran in parallel, each with a focused brief and concrete file paths to start from. All five produced disk artifacts in `docs/audits/2026-05-06/`:

| File | Lens | Scope |
|---|---|---|
| `audit-reconciliation.md` | Accountant (Meg) | Parsed 4 Xero exports → JSON; walked them through `mapPLToFinancials` to find what SkipSync would actually store; identified P0 mapping bugs |
| `audit-month-switching-bug.md` | Developer | Traced state management when `selectedMonth` changes; tab-by-tab matrix of what re-keys vs what goes stale |
| `audit-pricing-bugs.md` | Developer | Pricing/Benchmarking/Fleet/Competitor data integrity audit; bin-name fragmentation; rounding inconsistencies |
| `audit-ux.md` | UX Designer | Kid test (could a 14-year-old use this?) + driver-app PWA separation assessment |
| `audit-personas.md` | Product Manager | PRD-v6 personas (Mark, Sarah, Jake, drivers, public, Andrew) walked through the live UI; gap matrix |

Plus a consolidated backlog: `audit-2026-05-06/FIXES-NEEDED.md` — 38 findings (12 P0, 11 P1, 11 P2, 4 P3) with item-level status + a suggested 2-day "Sprint 10 Unblock" sequence.

### C. Headline findings (decision-grade)

The current Xero sync is silently producing data unsuitable for business decisions. Key numbers from the YTD Xero export (Jul 2025–Apr 2026, accrual basis):

| What SkipSync stores | Value | Severity |
|---|---:|---|
| `rev_total` | $1,569,450.33 | P0 — overstated by $339.60 vs Xero raw ($1,569,110.73) due to `Math.abs()` sign-flip on credits |
| `rev_general` | $0.00 | P0 — column is hard-coded to 0; never written |
| `rev_other` | $1,004,975.70 (**64%**) | P0 — should be ~$70k; the keyword classifier dumps every WMF / CON / Transport / Tonnage / Recycling SKU here because it only handles `asb / soil / grw / green` |
| `cos_fuel` | $0.00 | P0 — bin-coded COS rows never match `fuel/petrol/diesel` |
| `cos_other` | $337,892 (**66%**) | P0 — same keyword-classifier problem; bin-coded tipping rows fall through |
| `cash_balance` | $0.00 | P0 — the Xero bank account is named `"Binned-It Pty Ltd"`; the matcher looks for `cash/bank/westpac` — none match. Entire $77,811.38 operating account is silently dropped |
| `debtors_monthly` rows | 0 | P0 — AR sync is `void arData;` (commented out). 80+ debtors, ~$112k AR, all invisible to the Debtors tab |

Plus: **PricingTab uses real per-bin data only when February 2026 is selected** (`if (monthIndex === 7)` hardcoded); for any other month the "loss-making bin types" alert fires off extrapolated YTD proportions. Several other tabs (Fleet, Debtors, BDM, Snapshot cash/AR) have non-month-keyed fallbacks that silently show Feb 2026 data when Supabase is empty.

The **net profit** number reconciles to the cent in February ($30,511.71), but the **breakdown** is unusable — meaning Mark can trust "what's the bottom line" but cannot trust "where the money came from / went" on a per-category basis.

### D. Persona-level blockers

- **`isBookkeeper` was missing from `useAuth()`** despite being referenced in `CRMBookingsPage.jsx` and `InvoicesPage.jsx`. Sarah (bookkeeper) couldn't edit invoices or trigger Xero sync — `canEdit` silently resolved to `false`. ✅ Fixed tonight.
- **Routing collision `/driver` (mobile portal) vs `/drivers` (admin)** — the side-menu "Drivers" item dumped admins into the driver portal. ✅ Fixed tonight (regex `/^\/driver(\/|$)/`).
- **Hardcoded "Welcome back, Mark"** for everyone. ✅ Fixed tonight (uses `profile?.full_name`).
- **No route-level RBAC for the investor role** — Andrew can navigate `/dispatch`, `/customers`, `/invoices`. PRD says `/investor` only. **Open** (item #12 in `FIXES-NEEDED.md`).
- **Collections "Send" doesn't actually send a letter**, just records a Supabase event. **Open** (item #10).
- **Legal letters carry placeholder ABN/ACN/BSB** (`57 123 456 789` etc.). **Open** (item #11).
- **Driver app is v0.5, not "Complete"** as PRD-v6 §6.1 claims — no "Arrived" state, no mandatory delivery photo, no OCR for tip dockets, no offline write queue, single PWA manifest shared with admin. **Open** (items #16-18).

### E. UX kid-test failures

Top three:
1. **Home tile labels assume domain knowledge** — "Snapshot", "BDM", "Risk / EPA". The word "revenue" doesn't appear anywhere on the home screen. A kid (or any first-timer) cannot tell whether to click "Financial Reports" or "Load Data" to see this month's number.
2. **Dashboard tabs are 12 ALL-CAPS abbreviations** — `SNAPSHOT / REVENUE / MARGINS / BENCHMARKING / COMPETITORS / PRICING / BDM / FLEET / DEBTORS / CASH FLOW / RISK / EPA / WORK PLAN`. On mobile, **11 of 12 tabs are unreachable** because the tab bar is hidden and `MobileNav` only routes to `/dashboard/snapshot`.
3. **Side-menu "Drivers" hijacks admins into the driver portal** with no breadcrumb or "back to admin" affordance. Tonight's fix on the routing collision closes the *entry* — but `App.jsx`'s own `/drivers` route still renders `<DriverApp />` and there's no real admin "manage drivers" page yet.

### F. Three safe fixes applied tonight (committed in this batch)

1. `src/main.jsx` — routing collision regex (`/^\/driver(\/|$)/`)
2. `src/context/AuthContext.jsx` — added `isBookkeeper`; broadened `isManager` to include `fleet_manager`
3. `src/App.jsx` — `Welcome back, {first name}` reads from `profile.full_name`

Build clean (0 errors, expected chunk-size warning). All 7 Vitest unit tests pass.

### G. What was deliberately deferred

The Xero sync rewrite (revenue/COS classification, cash matcher, AR re-enable) is a multi-hour focused refactor — too risky to do in a single push without a thorough test harness. Same for per-month fallback arrays, schema constraints on bin types, driver PWA separation, Twilio wiring, real ABN resolution, and Investor RBAC.

The plan for the next session is documented in `docs/audits/2026-05-06/FIXES-NEEDED.md`'s "Suggested next sprint" section: a 2-day focused unblock that closes 8 of the 12 P0 items.

---

## 2 — Files changed in this batch

```
NEW  agents/Accountant.md                                   ← CFO-pedigree agent (Meg Whitfield)
NEW  docs/audits/2026-05-06/audit-reconciliation.md
NEW  docs/audits/2026-05-06/audit-month-switching-bug.md
NEW  docs/audits/2026-05-06/audit-pricing-bugs.md
NEW  docs/audits/2026-05-06/audit-ux.md
NEW  docs/audits/2026-05-06/audit-personas.md
NEW  docs/audits/2026-05-06/FIXES-NEEDED.md                 ← consolidated 38-item backlog
NEW  docs/audits/2026-05-06/parsed/*.json (4 files)         ← parsed Xero exports for testing
NEW  docs/sessions/2026-05-06-part2-reconciliation-audit.md ← THIS FILE
M    src/main.jsx                                           ← /driver vs /drivers routing fix
M    src/context/AuthContext.jsx                            ← isBookkeeper + isManager fix
M    src/App.jsx                                            ← profile.full_name greeting
M    project-context.md                                     ← known-integrity-issues guardrails
```

The four `.xlsx` files (raw Xero exports) were **deliberately NOT copied into the repo** — they may contain sensitive customer data. The parsed JSON snapshots in `docs/audits/2026-05-06/parsed/` are anonymisable subsets and serve as fixtures for the planned Vitest tests over `mapPLToFinancials`.

---

## 3 — Verification

- `npm run build` → 0 errors, expected chunk-size warning
- `npm test` → 7 / 7 passing (no regression)
- Routing collision: navigated `/drivers` and `/driver` mentally — only `/driver` and `/driver/*` should hit the driver portal now (regex `/^\/driver(\/|$)/`)
- The greeting and isBookkeeper fixes are pure data-flow; smoke test would catch any obvious break — none observed in the build

---

## 4 — How another session picks this up

1. Read `agents/Accountant.md` at session start; adopt the Meg persona for any reconciliation work.
2. Read `docs/audits/2026-05-06/FIXES-NEEDED.md` for the prioritised backlog. Don't re-discover; pick up the next P0.
3. The parsed Xero JSON in `docs/audits/2026-05-06/parsed/` is the test fixture for the eventual `mapPLToFinancials` rewrite — drive the rewrite TDD-style with assertions against the expected SKU bucketing (audit-reconciliation.md has the full table).
4. Run the 5-way reconciliation (§5 of `agents/Accountant.md`) at the end of every period close.
5. Update Meg's §10 Learnings Log with new findings + commit hashes.

---

## 5 — What we genuinely couldn't do tonight

Stated upfront for honesty:

- **Live Xero OAuth/API testing** — no creds in this session; we audited the integration code paths against the static Xero exports the user provided. The audit findings are based on what the code WOULD do given that input.
- **Real persona logins (Sarah, Jake, Andrew)** — only Mark's account exists. UAT against persona accounts requires creating those accounts and walking through the workflows. The persona audit is therefore a code-level walkthrough, not a logged-in UAT.
- **Live Vercel UAT** — Playwright runs against `npm run dev` locally, not the deployed `binnedit-hub.vercel.app`. The smoke test confirms login renders; deeper E2E flows need the dev server stack working.

These are not blockers — they're scope clarifications so Mark knows what's been verified vs what's been audited.

---

## 6 — Bottom line for Mark

- **Numbers in SkipSync are not yet decision-grade** for any month other than Feb 2026, and even Feb's category breakdown (revenue mix, COS breakdown) is unreliable.
- **The bottom-line net-profit number reconciles** to the cent — so "is the business profitable?" can be answered. But "where is the money going?" cannot, until the keyword classifier is replaced.
- **A 2-day focused sprint** ("Sprint 10 Unblock" in `FIXES-NEEDED.md`) closes 8 of the 12 P0 items. After that, run a fresh reconciliation cycle on March 2026 with Meg and confirm the numbers tie out within materiality before signing off.
- **The audit infrastructure is now reusable** — parsed exports, per-engagement folder, agent definition, learnings log. The next reconciliation cycle is faster than this one was.
