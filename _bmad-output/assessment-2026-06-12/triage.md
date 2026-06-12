# SkipSync Full-System Assessment — Triage (2026-06-12)

7-agent fleet (DB-contract auditor + 5 personas + BMAD ideation). Findings deduped and ranked. Dominant root cause: **RLS + schema drift** — tables created by an early migration have RLS enabled with zero policies (silently dead), while a few have `qual=true` policies so permissive that low-privilege tokens can write operational data.

## WAVE 1 — Security & access control (DOING NOW, highest stakes)
- **SEC-1 (P0):** Investor/viewer/driver JWT can WRITE bookings + INSERT job_events/job_photos/vehicle_checklists/hazard_reports via PostgREST (`qual=true` policies). Andrew proved it at API level. Also READ leakage of customer PII/invoices/business data to investor token. → migration: replace permissive policies with role-correct ones; MUST preserve the working driver journey (driver updates own bookings + inserts own job rows).
- **SEC-2 (P1):** Unguarded routes — /settings, /settings/team, /settings/audit render for bookkeeper/manager via URL paste (no RequireRole). → App.jsx route guards.
- **SEC-3 (P1):** `hazard_reports` leftover `auth_update_hazard_reports` (true/true) ORs over the manager policy → anyone updates hazard status. → drop the permissive policy.
- **SEC-4 (P1):** fleet_manager (Jake) excluded from ~10 owner/manager write policies despite isManager UI exposing the buttons (fleet_assets, fleet maintenance, waste_audits, billing_adjustments, etc.). → extend policy role arrays with fleet_manager.

## WAVE 1b — Never-worked features (schema drift + missing policies)
- **DEAD-1 (P0):** staff_certificates + insurance_policies — UI filters `is_active` (column absent) AND both tables have zero RLS policies. Root cause of the standing console 400s. → reconcile columns + add policies.
- **DEAD-2 (P1):** notifications — zero policies (bell always empty) + every writer uses invalid payload (`type:'general'` fails CHECK; `body`/`related_*` columns absent; live cols are message/link). → policies + fix writers.
- **DEAD-3 (P1):** audit_log — RLS on, zero SELECT policy → audit UI blind for everyone incl. owner; migration-010 triggers also absent in live DB. → SELECT policy for office roles (write-side trigger deferred).
- **DEAD-4 (P0):** Rules Engine blocked for fleet_manager — content gate rejects role + RLS write policy excludes it. → content gate + RLS (folds into SEC-4).

## WAVE 2 — Honesty on transactional/data pages (fake data shown as real)
- **HON-1 (P0):** CollectionsPage shows HARDCODED fake overdue invoices whenever live query returns zero rows — Sarah saw fake debtors as real. → only fall back on error, never on legitimate empty; label fallback.
- **HON-2 (P0):** 5/12 dashboard tabs (Who Owes Us, New Customers, Trucks & Bins, Compare, Prices) render demo dataset as live; alerts computed from demo data. → "sample data" banner when falling back (full data wiring is larger, deferred).
- **HON-3 (P1):** cash/accrual toggle cosmetic — no tab passes basis to hooks + zero accrual rows. → deferred (needs accrual data pipeline); document.

## WAVE 3 — Data / wiring gaps (mostly need Mark's real data)
- fleet_assets EMPTY (0 trucks) → truck assignment impossible. Seed representative trucks (flag for Mark to correct, like tip rates).
- notify-booking never called from app (no customer SMS on status change). → wire into status mutation.
- No cancel-booking UI (DB allows cancelled). → add column/action.
- Managers can't reach Team page (ownerOnly menu) though they have edit rights. → menu gating.
- R7 efficiency insights has no reachable UI (OperationalEfficiencySection unmounted). → route/section.
- email_reminders_log CHECK violation loses collections send log. → CHECK or reminder_type value.
- ai_insights actioned/dismiss fake-succeed for non-managers. → hide for non-managers.
- bin_types empty → Pricing & Bins tab bare.
- About page stale metadata (says 8 months, live has 10).
- Compare tab == Prices tab (BenchmarkingTab is a thin PricingTab wrapper).

## Housekeeping
- 13 tmp-*.mjs persona scripts left in scripts/ by the fleet → delete.
- Chat greeting hardcoded "Hi Mark!" for every user → personalise.
- Checklist truck_id free-text with no roster validation → fold into fleet seeding.

## Process win (BMAD idea, adopt)
The DB-contract audit found 4 never-worked defects sharing one root cause (early-migration tables with RLS-on/zero-policies). Make the contract sweep (code supabase refs vs live schema/policies) a recurring gate — it is the cheapest catch for this entire defect class.
