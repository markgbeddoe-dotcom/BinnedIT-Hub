# Product Requirements Document
## Binned-IT Dashboard Hub — v2.2
**Organisation:** Binned-IT Pty Ltd
**Author:** Product & Engineering Team
**Date:** 27 March 2026
**Status:** Approved — Sprint 2 Architecture Kickoff

---

## 1. Executive Summary

Binned-IT Dashboard Hub is a web-based Management Intelligence Platform for Binned-IT Pty Ltd's skip bin hire operations in Seaford, Melbourne. It centralises financial analysis, operational monitoring, compliance tracking, and strategic planning into a single, cloud-hosted application used by the business owner and management team.

Sprint 1 delivered a fully functional React SPA with hardcoded data and localStorage persistence. Sprint 2 migrates this to a proper cloud-native architecture: React front-end on Vercel, Supabase (PostgreSQL) backend, GitHub CI/CD, and full multi-user support.

---

## 2. Problem Statement

The business currently manages its performance through:
- Disconnected Excel exports from Xero, Bin Manager, and Westpac
- Manual spreadsheet analysis with no automated insights
- No centralised visibility across finance, operations, compliance, and BDM
- No historical trend analysis or period comparison capability
- No collaborative work planning or action tracking

This results in delayed decisions, missed compliance obligations, and pricing that leaves money on the table.

---

## 3. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Single source of truth | All KPIs from one URL | ✅ Achieved Sprint 1 |
| Cloud persistence | Data survives device loss | Sprint 2 |
| Multi-user access | Owner + bookkeeper + manager | Sprint 2 |
| Historical trend depth | 13+ months of data | Sprint 2 |
| Alert response rate | Actions completed within 7 days | >70% |
| Wizard completion rate | Reports generated per month | ≥1/month |
| Uptime | System availability | 99.5%+ |

---

## 4. Users & Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | Business owner (primary user) | Full access: all dashboards, wizard, settings, admin |
| **Manager** | Operations/fleet manager | Dashboard read + work plan |
| **Bookkeeper** | External accountant | Wizard upload only + snapshot tab |
| **Viewer** | Silent investor / advisor | Dashboard read-only |

---

## 5. Core Features — Sprint 2 Scope

### 5.1 Authentication & Multi-Tenancy
- Email/password login via Supabase Auth
- Role-based access control (RBAC) enforced server-side via Supabase RLS
- Single organisation per deployment (Binned-IT); architecture supports future multi-tenant SaaS expansion

### 5.2 Data Persistence (localStorage → Supabase)
- All financial data stored in PostgreSQL via Supabase
- Wizard-submitted data writes to `monthly_reports` table
- Work plan completions sync to `work_plan_items` table
- Competitor pricing saved to `competitor_rates` table
- Compliance inputs saved to `compliance_records` table

### 5.3 Data Ingestion Wizard (Enhanced)
- 12-step wizard preserved from Sprint 1
- File uploads (Xero P&L, Cash Summary, AR, Balance Sheet; Bin Manager; Westpac) parsed client-side via SheetJS
- Parsed data posted to Supabase API
- Duplicate detection (month already loaded)
- Data quality scoring before submission
- Audit log of each import (who, when, what files)

### 5.4 Executive Dashboard (11 Tabs — Unchanged UX)
1. **Snapshot** — YTD KPIs, P&L summary, balance sheet highlights
2. **Revenue** — By category, trend, concentration
3. **Margins** — COGS and OpEx drill-down, anomaly flags
4. **Benchmarking / Pricing** — 18 bin types, per-job profitability
5. **Competitors** — 6 competitor pricing matrix (editable, cloud-saved)
6. **BDM** — New customers, dormant risk, acquisition trends
7. **Fleet** — Bin utilisation, hire duration, yield per type
8. **Debtors** — AR aging, top debtors, concentration risk
9. **Cash Flow** — Monthly movements, 6-month projection, tax reserves
10. **Risk / EPA** — Compliance status: WHS, asbestos, vehicles, EPA, insurance
11. **Work Plan** — Prioritised actions with cloud-synced completion tracking

### 5.5 Period Selection & Comparison
- Select any loaded month (Jul 2025 onward)
- Side-by-side month comparison view
- YTD view always available

### 5.6 Analysis Engine
- 40+ server-evaluated rules generating alerts
- Alert history log (never lose a past warning)
- Alert acknowledgement and notes

### 5.7 AI Assistant (Claude Integration)
- Chat interface for conversational BI queries
- Context: current month's data sent as system prompt
- Calls Anthropic API (`claude-sonnet-4-6` model)
- Query history stored per user session

### 5.8 Report Generation
- PDF export of any dashboard tab
- Monthly summary email (auto-scheduled or on-demand)

### 5.9 Settings
- Alert threshold configuration (per category)
- Bin type configuration (add/remove/rename)
- Competitor list management
- User management (Owner role only)

---

## 6. Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| **Performance** | Dashboard loads < 2s on 4G mobile |
| **Security** | All API calls authenticated; RLS on all Supabase tables; secrets in env vars |
| **Data privacy** | Business financial data encrypted at rest (Supabase default); no third-party analytics |
| **Availability** | Vercel Edge + Supabase managed infra; target 99.5% uptime |
| **Browser support** | Chrome, Firefox, Safari, Edge (last 2 versions); mobile responsive |
| **Backup** | Supabase daily automated backup; 30-day retention |

---

## 7. Out of Scope (Sprint 2)

- Mobile native app
- Multi-tenant SaaS (architecture supports it, not activated)
- Westpac PDF bank statement parsing (complex; deferred to Sprint 3)
- Real-time push notifications
- Xero OAuth direct integration (wizard manual upload is sufficient for now)
- Public-facing customer portal

---

## 8. Architecture Overview

### 8.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Front-end** | React 18 + Vite | Existing codebase; fast HMR; modern tooling |
| **UI Library** | Keep inline CSS + Recharts | Preserve brand consistency from Sprint 1 |
| **State Management** | React Context + `useState` | Sufficient for single-org SPA |
| **API Client** | Supabase JS SDK v2 | Auth, DB, Storage in one library |
| **Backend / DB** | Supabase (PostgreSQL 15) | Managed Postgres, Auth, RLS, Storage |
| **File Storage** | Supabase Storage | Uploaded Excel files archived per report |
| **Hosting** | Vercel (Edge Network) | Zero-config React/Vite deploys; preview URLs per branch |
| **CI/CD** | GitHub Actions + Vercel GitHub Integration | Auto-deploy on PR merge |
| **AI** | Anthropic Claude API (claude-sonnet-4-6) | Business intelligence chat |

### 8.2 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              React SPA (Vite Build)                  │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │   │
│  │  │  Auth    │  │Dashboard │  │   Wizard (12-step)│  │   │
│  │  │  (Login) │  │(11 tabs) │  │   File Upload     │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │   │
│  │       │             │                  │             │   │
│  │  ┌────▼─────────────▼──────────────────▼──────────┐ │   │
│  │  │           Supabase JS SDK v2                   │ │   │
│  │  │   Auth Client │ DB Client │ Storage Client     │ │   │
│  │  └──────────────────────────┬─────────────────────┘ │   │
│  └─────────────────────────────┼───────────────────────┘   │
└────────────────────────────────┼────────────────────────────┘
                                 │ HTTPS / WSS
┌────────────────────────────────▼────────────────────────────┐
│                        SUPABASE                             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ Auth Service │  │  PostgreSQL  │  │     Storage      │ │
│  │  (JWT/RLS)  │  │   Database   │  │  (Excel Uploads) │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    Anthropic Claude API  │
                    │   (AI Chat Assistant)    │
                    └─────────────────────────┘
```

---

## 9. Database Schema (Supabase / PostgreSQL)

### Core Tables

```sql
-- Users managed by Supabase Auth (auth.users)
-- profiles extends auth.users
profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users,
  full_name   text,
  role        text CHECK (role IN ('owner','manager','bookkeeper','viewer')),
  created_at  timestamptz DEFAULT now()
)

-- One record per wizard submission (one per month)
monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month    date NOT NULL,        -- e.g. 2026-02-01
  status          text DEFAULT 'draft', -- draft | complete
  uploaded_by     uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(report_month)
)

-- P&L financial data per month
financials_monthly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  -- Revenue
  rev_general     numeric(12,2),
  rev_asbestos    numeric(12,2),
  rev_soil        numeric(12,2),
  rev_green       numeric(12,2),
  rev_other       numeric(12,2),
  rev_total       numeric(12,2),
  -- Cost of Sales
  cos_fuel        numeric(12,2),
  cos_disposal    numeric(12,2),
  cos_wages       numeric(12,2),
  cos_tolls       numeric(12,2),
  cos_other       numeric(12,2),
  cos_total       numeric(12,2),
  gross_profit    numeric(12,2),
  -- Operating Expenses
  opex_rent       numeric(12,2),
  opex_admin      numeric(12,2),
  opex_advertising numeric(12,2),
  opex_repairs    numeric(12,2),
  opex_insurance  numeric(12,2),
  opex_other      numeric(12,2),
  opex_total      numeric(12,2),
  net_profit      numeric(12,2)
)

-- Balance sheet snapshot per month
balance_sheet_monthly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  cash_balance    numeric(12,2),
  accounts_receivable numeric(12,2),
  total_assets    numeric(12,2),
  accounts_payable numeric(12,2),
  total_loans     numeric(12,2),
  gst_liability   numeric(12,2),
  payg_liability  numeric(12,2),
  total_liabilities numeric(12,2),
  net_equity      numeric(12,2)
)

-- AR aging per month
debtors_monthly (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  debtor_name     text NOT NULL,
  current_amount  numeric(12,2) DEFAULT 0,
  overdue_30      numeric(12,2) DEFAULT 0,
  overdue_60      numeric(12,2) DEFAULT 0,
  overdue_90plus  numeric(12,2) DEFAULT 0,
  total_outstanding numeric(12,2) DEFAULT 0
)

-- Bin type performance per month
bin_type_performance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  bin_type        text NOT NULL,        -- e.g. "4m³ General Waste"
  deliveries      integer DEFAULT 0,
  avg_hire_days   numeric(6,1),
  revenue         numeric(12,2),
  avg_price       numeric(10,2),
  cos_per_job     numeric(10,2),
  net_margin_pct  numeric(6,2)
)

-- Customer records
customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  is_active       boolean DEFAULT true,
  first_job_date  date,
  last_job_date   date,
  total_jobs      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
)

-- New customer acquisitions per month
customer_acquisitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  customer_id     uuid REFERENCES customers(id),
  customer_name   text NOT NULL,
  jobs_in_month   integer DEFAULT 0
)

-- Competitor pricing (persistent, editable)
competitor_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  bin_type        text NOT NULL,
  rate            numeric(10,2),
  notes           text,
  updated_at      timestamptz DEFAULT now(),
  updated_by      uuid REFERENCES profiles(id),
  UNIQUE(competitor_name, bin_type)
)

-- Compliance records per month
compliance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  -- WHS
  whs_incidents   integer DEFAULT 0,
  whs_register_current boolean DEFAULT false,
  -- Asbestos
  asbestos_jobs   integer DEFAULT 0,
  asbestos_docs_complete boolean DEFAULT false,
  -- EPA
  epa_license_current boolean DEFAULT false,
  epa_expiry_date date,
  -- Vehicles
  vehicle_inspections_current boolean DEFAULT false,
  -- Insurance
  insurance_current boolean DEFAULT false,
  insurance_expiry_date date,
  -- Notes
  compliance_notes text
)

-- Work plan items (persistent library)
work_plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  area            text,                -- Pricing | Cash Flow | BDM | Margins | Risk
  horizon         text,               -- week | month | quarter
  priority        integer DEFAULT 50,
  effort_hours    numeric(4,1),
  business_impact text,
  owner_role      text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
)

-- Work plan completion tracking
work_plan_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid REFERENCES work_plan_items(id),
  completed_by    uuid REFERENCES profiles(id),
  completed_at    timestamptz DEFAULT now(),
  notes           text
)

-- System alerts log
alerts_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id),
  category        text,               -- snapshot | revenue | margins | ...
  severity        text,               -- critical | warning | info | positive
  message         text NOT NULL,
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  notes           text,
  created_at      timestamptz DEFAULT now()
)

-- File upload audit
file_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES monthly_reports(id),
  file_type       text NOT NULL,      -- pl_monthly | cash_summary | aged_ar | ...
  original_name   text NOT NULL,
  storage_path    text,               -- Supabase Storage path
  uploaded_by     uuid REFERENCES profiles(id),
  uploaded_at     timestamptz DEFAULT now(),
  parse_status    text DEFAULT 'pending' -- pending | success | failed
)

-- AI chat history
ai_chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id),
  report_month    date,
  messages        jsonb DEFAULT '[]',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
)

-- Alert threshold settings
alert_thresholds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  metric_key      text NOT NULL,
  warning_value   numeric,
  critical_value  numeric,
  updated_by      uuid REFERENCES profiles(id),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(category, metric_key)
)
```

---

## 10. Sprint 2 — Development Branches & Work Breakdown

### Branch Strategy: GitHub Flow

```
main (production → Vercel)
├── develop (integration branch)
│   ├── feature/supabase-setup
│   ├── feature/auth
│   ├── feature/database-schema
│   ├── feature/data-migration
│   ├── feature/wizard-backend
│   ├── feature/dashboard-backend
│   ├── feature/work-plan-sync
│   ├── feature/competitor-sync
│   ├── feature/compliance-backend
│   ├── feature/ai-assistant
│   ├── feature/report-pdf
│   └── feature/settings
```

### Sprint 2 — Work Items by Branch

| Branch | Scope | Priority |
|--------|-------|----------|
| `feature/supabase-setup` | Supabase project init, env vars, SDK install, Vercel link | P0 |
| `feature/auth` | Login/logout UI, Supabase Auth, route guards, user profiles | P0 |
| `feature/database-schema` | All SQL migrations, RLS policies, seed data | P0 |
| `feature/data-migration` | Migrate hardcoded financials.js data → Supabase seed | P1 |
| `feature/wizard-backend` | Wizard writes to Supabase; file uploads to Storage | P1 |
| `feature/dashboard-backend` | Dashboard reads from Supabase instead of financials.js | P1 |
| `feature/work-plan-sync` | Work plan completions sync to Supabase | P2 |
| `feature/competitor-sync` | Competitor rates read/write Supabase | P2 |
| `feature/compliance-backend` | Compliance records persist to Supabase | P2 |
| `feature/ai-assistant` | Claude API integration, chat history persistence | P2 |
| `feature/report-pdf` | PDF export per tab (react-to-print or similar) | P3 |
| `feature/settings` | Alert thresholds, user mgmt, bin type config | P3 |

---

## 11. Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]

# Anthropic (server-side only — use Vercel Edge Function)
ANTHROPIC_API_KEY=[api-key]

# App
VITE_APP_ENV=production
```

---

## 12. Deployment Pipeline

```
Developer pushes branch →
  GitHub PR created →
    Vercel Preview URL generated (auto) →
      PR review + approval →
        Merge to develop →
          Vercel preview deploy of develop →
            QA sign-off →
              Merge develop → main →
                Vercel production deploy →
                  Supabase migrations applied (manual for now, GitHub Actions in Sprint 3)
```

---

## 13. Security Considerations

- All Supabase tables protected by Row Level Security (RLS)
- `anon` key only allows auth operations; all data requires authenticated JWT
- Anthropic API key never exposed to client; routed through Vercel Edge Function
- Excel files parsed client-side (no file contents sent to third parties except Supabase Storage)
- HTTPS enforced everywhere (Vercel default + Supabase default)
- Sensitive env vars stored in Vercel environment settings (not in repo)

---

## 14. Definition of Done — Sprint 2

- [ ] User can log in with email/password
- [ ] Wizard submits data to Supabase and data persists across devices
- [ ] All 11 dashboard tabs load live data from Supabase
- [ ] Work plan completions sync across users
- [ ] Competitor pricing changes saved to database
- [ ] Compliance records persisted
- [ ] AI assistant chat works with Anthropic API
- [ ] Deployed to Vercel production with custom domain (optional)
- [ ] All secrets in Vercel env (zero secrets in git)
- [ ] RLS policies verified: users can only see own org data

---

## 15. Future Roadmap (Sprint 3+)

| Feature | Sprint |
|---------|--------|
| Westpac PDF bank statement parsing | 3 |
| Xero OAuth direct integration | 3 |
| Multi-tenant SaaS (multiple businesses) | 4 |
| Mobile responsive polish | 3 |
| Email scheduling (monthly report) | 3 |
| GitHub Actions for automated DB migrations | 3 |
| Seasonal forecasting / trend ML | 4 |
| Customer portal | 5 |
