# Data Models — SkipSync

**Generated:** 2026-05-06
**Database:** Supabase PostgreSQL (project ref `dkjwyzjzdcgrepbgiuei`)
**Migrations:** 21 files in `BinnedIT-Hub/supabase/migrations/` — applied in numeric order, all idempotent (`CREATE TABLE IF NOT EXISTS …`)

The authoritative schema is in the SQL migration files — this document is an AI-retrieval index, not a replacement.

## Migration sequence

| File | Purpose |
|---|---|
| `001_initial_schema.sql` | Core tables: profiles, monthly_reports, financials, balance, debtors, bin_type_performance, customers, competitor_rates, compliance, work plan, alerts, file uploads, ai chat sessions, alert thresholds |
| `002_rls_policies.sql` | Row Level Security — role-based read/write per table |
| `003_default_thresholds.sql` | Seeds `alert_thresholds` with default warning/critical values |
| `004_schema_additions.sql` | Fleet + compliance column additions |
| `004b_seed_historical_data.sql` | Seeds Jul 2025–Feb 2026 financial history |
| `005_fleet_tables.sql` | `bin_types`, `fleet_assets`, `fleet_maintenance_records`, `disposal_receipts` |
| `006_xero_integration.sql` | `xero_tokens`, `xero_sync_log` |
| `007_ar_invoices.sql` | `ar_invoices` |
| `007_esg_columns.sql` | ESG columns added to `financials_monthly` (tonnes diverted, recycling rate, CO2 offset) |
| `007_operational_features.sql` | `email_reminders_log`, `customer_order_history` |
| `008_bookings.sql` | `bookings` lifecycle table |
| `009_driver_jobcosting.sql` | `job_photos`, `job_events`, `vehicle_checklists`, `hazard_reports` |
| `009_invoices.sql` | `invoices` (Phase 5 invoice generation) |
| `010_customers.sql` | Extended `customers` columns |
| `010_phase6_audit_team_compliance.sql` | `audit_log`, `notifications`, `insurance_policies`, `staff_certificates` |
| `011_fleet_status.sql` | `customer_notes`, fleet status fields |
| `012_white_label_tenants.sql` | `tenants`, `tenant_bin_sizes`. Adds `tenant_id` to `bookings`. Anon-read RLS for the embed widget. Seeds the `binned-it` demo tenant. |
| `013_fix_rls_policies.sql` | Drops/recreates permissive INSERT policies on `bookings`, `vehicle_checklists`, `job_events`, `job_photos`, `hazard_reports` — driver writes were failing without an explicit `driver_id`. |
| `014_crm_collections.sql` | 8 new tables: `customer_contacts`, `customer_directors`, `customer_trade_refs`, `credit_applications`, `account_contracts`, `customer_notes`, `collections_events`, `payment_history`. ALTER on `customers` adds 19+ columns (ABN, ACN, credit_status/limit, CreditorWatch, PPSR, risk_score, director_guarantee, outstanding/overdue balances, on_time_payment_pct, etc.). |
| `015_platform_settings.sql` | New `platform_settings` (key/value) table — runtime config for API keys (e.g. Anthropic). Owner-only RLS. |
| `016_booking_xero_invoice.sql` | Adds `xero_invoice_id` + `xero_invoice_status` to `bookings`. Tracks the booking → Xero invoice round-trip. |

## Tables grouped by domain

### Auth & users
- `profiles` — extends `auth.users`. Columns: `id`, `full_name`, `role` (`owner|manager|bookkeeper|viewer`), timestamps. Trigger `handle_new_user()` auto-creates profile on signup.

### Monthly reporting (P&L cycle)
- `monthly_reports` — one per month. `report_month UNIQUE`, `status (draft|complete)`, `uploaded_by` FK→profiles.
- `financials_monthly` — P&L data per report. Revenue (general/asbestos/soil/green/other/total), COS (fuel/disposal/wages/tolls/repairs/other/total), gross profit/margin, opex (rent/admin/advertising/insurance/other/total), net profit/margin. ESG columns added in `007_esg_columns.sql`.
- `balance_sheet_monthly` — assets, liabilities, loans, equity per report.
- `debtors_monthly` — AR aging by debtor: current/30/60/90+/total.
- `bin_type_performance` — per bin type per month: deliveries, avg hire days, revenue, avg price, COS per job, gross per job, net margin %.
- `customer_acquisitions` — new customers per report month.
- `compliance_records` — WHS, asbestos, EPA, vehicle, insurance flags + dates per report.
- `file_uploads` — audit trail of wizard imports (`parse_status: pending|success|failed`).

### Operations
- `bookings` — booking lifecycle (added in 008). Now has `tenant_id` (012), `xero_invoice_id`/`xero_invoice_status` (016).
- `customers` — CRM (extended in 010, hugely extended in 014 with credit/risk/CreditorWatch/PPSR fields).
- `customer_order_history` — historical order summary.
- `customer_notes` — free-text notes on customers (originally 011, formalised in 014).
- `tenants`, `tenant_bin_sizes` — white-label tenancy (012). Powers the iframe embed at `/embed/<slug>`.

### CRM / Collections (added 014)
- `customer_contacts` — multiple contacts per customer with role.
- `customer_directors` — for director-guarantee tracking.
- `customer_trade_refs` — trade references collected during credit application.
- `credit_applications` — application records + outcome.
- `account_contracts` — agreed terms, signed copies.
- `collections_events` — log of every dunning action (call, email, letter sent).
- `payment_history` — per-customer payment timeline; source for on-time-payment-pct.

### Platform configuration (added 015)
- `platform_settings` — generic key/value runtime config. Schema: `(key TEXT PK, value TEXT, updated_at, updated_by FK auth.users)`. Currently used to store the Anthropic API key (managed via Settings UI by owner).

### Fleet
- `bin_types` — SKU catalog of bin sizes/types.
- `fleet_assets` — trucks and bins inventory.
- `fleet_maintenance_records` — maintenance log against assets.
- `disposal_receipts` — tip docket records.

### Driver / job costing
- `job_photos` — photos taken during jobs (bin contents, hazards).
- `job_events` — timeline events per job (arrived, loaded, weighed, etc.).
- `vehicle_checklists` — pre-shift vehicle checks.
- `hazard_reports` — driver-flagged hazards (asbestos, heavy load).

### Invoicing & accounting
- `ar_invoices` — accounts receivable register (Phase 5).
- `invoices` — invoice records (Phase 5 generation).
- `email_reminders_log` — record of reminder emails sent.
- `xero_tokens` — Xero OAuth tokens.
- `xero_sync_log` — sync events with Xero.

### Competitors & pricing
- `competitor_rates` — per `(competitor_name, bin_type)` UNIQUE — rate, notes, who updated when.

### Work plan
- `work_plan_items` — library: title, description, area, horizon (`week|month|quarter`), priority, effort hours, business_impact, owner_role, `is_active`, `is_system`.
- `work_plan_completions` — `item_id UNIQUE` (one completion per item), `completed_by`, `completed_at`, notes.

### Alerts & settings
- `alerts_log` — generated alerts: category, severity (`critical|warning|info|positive`), message, acknowledged metadata.
- `alert_thresholds` — `(category, metric_key) UNIQUE` configurable warning/critical values.

### AI
- `ai_chat_sessions` — per-user chat history (jsonb messages); used by `/api/chat` for rate limiting.

### Audit & team / HR / insurance
- `audit_log` — append-only audit trail.
- `notifications` — in-app notifications + push subscriptions.
- `insurance_policies` — policy register with renewal dates.
- `staff_certificates` — training currency, certifications.

## Key constraints & invariants

- `monthly_reports.report_month` is `UNIQUE` — one report per calendar month.
- All `*_monthly` tables FK back to `monthly_reports.id` with `ON DELETE CASCADE` — deleting a report wipes all its derived data.
- `competitor_rates` enforces uniqueness on `(competitor_name, bin_type)` — upsert pattern is canonical.
- `work_plan_completions.item_id` is `UNIQUE` — only one completion per item; toggling unmarks via DELETE.
- `profiles.role` constrained to `owner|manager|bookkeeper|viewer`.
- `alerts_log.severity` constrained to `critical|warning|info|positive`.

## RLS (migration 002, refined in 013)

Per-table policies enforce:
- All authenticated users can read most tables
- Writes restricted by `role` claim from `profiles`
- Some tables (`alerts_log`, `compliance_records`) restrict reads by report ownership
- **Anon read** of `tenants` (where `is_active=true`) and `tenant_bin_sizes` — required for the iframe embed at `/embed/<slug>` which has no auth.
- **Anon insert** to `bookings` — required for the public booking widget. Migration 013 fixed this after `tenant_id` was added to `bookings` in 012.
- Driver-side tables (`vehicle_checklists`, `job_events`, `job_photos`, `hazard_reports`) accept inserts from any authenticated user — the per-row `driver_id` check that was blocking owner/manager submissions was relaxed in 013.

For the canonical policy set, read `002_rls_policies.sql` and `013_fix_rls_policies.sql` directly.

## Indexes (from 001)

```
idx_financials_report_month       on financials_monthly(report_month)
idx_balance_report_month          on balance_sheet_monthly(report_month)
idx_debtors_report_month          on debtors_monthly(report_month)
idx_bin_perf_report_month         on bin_type_performance(report_month)
idx_alerts_report_id              on alerts_log(report_id)
idx_alerts_severity               on alerts_log(severity)
idx_chat_user_id                  on ai_chat_sessions(user_id)
idx_file_uploads_report           on file_uploads(report_id)
```

Later migrations add more indexes for fleet, bookings, invoices — see those files.

## Migration ordering quirks

There are **three** files numbered `007_` and **two** files numbered `009_` and `010_`. They are differentiated by suffix (`_ar_invoices`, `_esg_columns`, `_operational_features`, etc.) and applied alphabetically within the same numeric prefix. Idempotency makes ordering forgiving, but when adding a new migration, prefer a unique numeric prefix to avoid ambiguity.
