# Source Tree Analysis — SkipSync

**Generated:** 2026-05-06

```
SkipSync/                              # repo root (workspace)
├── _bmad/                             # BMad Method install — not application code
├── _bmad-output/                      # planning + implementation artifacts (BMad)
├── docs/                              # ← THIS DOCUMENTATION (generated 2026-05-06)
└── BinnedIT-Hub/                      # application code (everything below is here)
    ├── package.json                   # Vite + React deps; scripts: dev/build/preview
    ├── vite.config.js                 # React plugin; manualChunks for vendor splits
    ├── vercel.json                    # framework: vite; crons; SPA rewrite; security headers
    ├── index.html                     # Vite entry HTML
    ├── README.md                      # quick start + stack summary
    ├── CLAUDE.md                      # Claude Code instructions / autonomous-action allowlist
    ├── ARCHITECTURE.md                # full ADR log (ADR-001..018)
    ├── PRD.md                         # v4.0 (delivered)
    ├── PRD-v5.md                      # v5.0 (active — drives ongoing work)
    │
    ├── src/                           # ── React SPA source (all client code)
    │   ├── main.jsx                   # entry: BrowserRouter + QueryClientProvider + AuthProvider + AuthGate
    │   ├── App.jsx                    # main app: Header, SideMenu, Routes, Home tile menu, 12-tab Dashboard
    │   ├── theme.js                   # design tokens (B.*), font stacks, fmt/fmtPct helpers
    │   │
    │   ├── components/                # 36 React components (.jsx)
    │   │   ├── tabs/                  #   12 dashboard tabs
    │   │   │   ├── SnapshotTab.jsx    #     KPI tiles + revenue/profit charts
    │   │   │   ├── RevenueTab.jsx
    │   │   │   ├── MarginsTab.jsx
    │   │   │   ├── BenchmarkingTab.jsx
    │   │   │   ├── CompetitorsTab.jsx
    │   │   │   ├── BDMTab.jsx         #     business development / customer acquisitions
    │   │   │   ├── FleetTab.jsx
    │   │   │   ├── FleetAssetsTab.jsx
    │   │   │   ├── DebtorsTab.jsx
    │   │   │   ├── CashFlowTab.jsx
    │   │   │   ├── RiskEPATab.jsx     #     compliance traffic-light cards
    │   │   │   └── WorkPlanTab.jsx
    │   │   ├── driver/                #   driver portal components (own subtree)
    │   │   │   └── DriverApp.jsx (+ children)
    │   │   ├── AIInsightsPanel.jsx    # streaming Claude per-tab analysis
    │   │   ├── ChatPanel.jsx          # global Claude chat (SSE)
    │   │   ├── AuditLogPage.jsx
    │   │   ├── BookingPage.jsx        # public /book route + ops bookings view
    │   │   ├── CompetitorPage.jsx
    │   │   ├── CustomersPage.jsx
    │   │   ├── DispatchBoard.jsx      # kanban (hello-pangea/dnd)
    │   │   ├── ErrorBoundary.jsx      # wraps every tab in App.Dashboard
    │   │   ├── FleetManagementPage.jsx
    │   │   ├── InvestorView.jsx       # /investor route
    │   │   ├── InvoicesPage.jsx
    │   │   ├── LoginPage.jsx          # rendered by AuthGate when no session
    │   │   ├── MobileNav.jsx          # bottom tab bar < 768px
    │   │   ├── NotificationBell.jsx
    │   │   ├── OfflineBanner.jsx      # listens to online/offline events
    │   │   ├── PDFExport.jsx          # @media print CSS + PrintStyles
    │   │   ├── PricingTab.jsx
    │   │   ├── SettingsPage.jsx       # alert thresholds, users, bin types, notifications
    │   │   ├── TeamPage.jsx           # /settings/team — invite users
    │   │   ├── UIComponents.jsx       # shared primitives (AlertItem, etc.)
    │   │   └── Wizard.jsx             # 12-step monthly data load
    │   │
    │   ├── api/                       # Supabase data-access layer (one per domain)
    │   │   ├── alerts.js              # alerts_log CRUD
    │   │   ├── audit.js               # audit_log
    │   │   ├── bookings.js            # bookings table
    │   │   ├── competitors.js         # competitor_rates
    │   │   ├── customers.js           # customers + acquisitions
    │   │   ├── driver.js              # driver-side: jobs, photos, events, hazards
    │   │   ├── fleet.js               # fleet_assets, maintenance, bin_types
    │   │   ├── invoices.js            # ar_invoices / invoices
    │   │   ├── notifications.js       # notifications, push subscriptions
    │   │   ├── reports.js             # monthly_reports, financials_monthly, balance/compliance
    │   │   ├── settings.js            # alert_thresholds
    │   │   ├── team.js                # profiles, roles
    │   │   ├── workplan.js            # work_plan_items + completions
    │   │   └── xero.js                # xero_tokens, xero_sync_log
    │   │
    │   ├── hooks/                     # TanStack Query hooks (read patterns)
    │   │   ├── queryClient.js         # QueryClient config (staleTime defaults)
    │   │   ├── useAlerts.js
    │   │   ├── useBookings.js
    │   │   ├── useBreakpoint.js       # responsive { isMobile, isTablet, isDesktop }
    │   │   ├── useChurnRisk.js
    │   │   ├── useCompetitors.js
    │   │   ├── useCustomers.js
    │   │   ├── useFleet.js
    │   │   ├── useInvoices.js
    │   │   ├── useMonthData.js        # useAvailableMonths, useFinancials, etc.
    │   │   └── useWorkPlan.js
    │   │
    │   ├── context/
    │   │   └── AuthContext.jsx        # Supabase session + role helpers (isOwner, canWrite)
    │   │
    │   ├── lib/
    │   │   └── supabase.js            # createClient with persistSession + autoRefresh
    │   │
    │   └── data/
    │       ├── financials.js          # hardcoded fallback data Jul 2025–Feb 2026
    │       ├── analysisEngine.js      # generateAlerts(monthCount) — 40+ alerts
    │       ├── costAllocator.js       # bin-type cost allocation logic
    │       ├── dataStore.js           # localStorage helpers (saveMonthData, etc.)
    │       ├── fileParser.js          # xlsx parsing (Wizard imports)
    │       ├── wizardSteps.js         # 12-step wizard configuration
    │       └── workplan.js            # defaultWorkPlan items
    │
    ├── api/                           # ── Vercel Edge Functions (auto-detected)
    │   ├── chat.js                    # POST /api/chat — Anthropic SSE proxy + rate limit
    │   ├── invite.js                  # POST /api/invite — Supabase Admin invite (owner-only, @binnedit.com.au)
    │   ├── book-confirm.js            # booking confirmation flow
    │   ├── invoice-chase.js           # cron: 09:00 daily
    │   ├── invoice-generate.js        # generate invoice from job/booking
    │   ├── push-send.js               # web-push notification dispatch
    │   ├── reminders.js               # cron: 08:00 daily
    │   ├── weekly-digest.js           # cron: 20:00 Sunday
    │   ├── xero-auth.js               # OAuth start
    │   ├── xero-callback.js           # OAuth callback
    │   ├── xero-payment-sync.js       # pull payments from Xero
    │   └── xero-sync.js               # push invoices / customers to Xero
    │
    ├── supabase/migrations/           # 21 SQL files, applied in numeric order, idempotent
    │   ├── README.md                              # convention: unique prefix, idempotency, next = 017_*
    │   ├── 001_initial_schema.sql                 # 16 base tables (profiles → financials → alerts)
    │   ├── 002_rls_policies.sql                   # Row Level Security policies
    │   ├── 003_default_thresholds.sql             # alert_thresholds seed
    │   ├── 004_schema_additions.sql               # fleet + compliance extensions
    │   ├── 004b_seed_historical_data.sql          # Jul 2025–Feb 2026 financial seed
    │   ├── 005_fleet_tables.sql                   # bin_types, fleet_assets, maintenance, disposal_receipts
    │   ├── 006_xero_integration.sql               # xero_tokens, xero_sync_log
    │   ├── 007_ar_invoices.sql                    # ar_invoices
    │   ├── 007_esg_columns.sql                    # ESG columns added to financials_monthly
    │   ├── 007_operational_features.sql           # email_reminders_log, customer_order_history
    │   ├── 008_bookings.sql                       # bookings
    │   ├── 009_driver_jobcosting.sql              # job_photos, job_events, vehicle_checklists, hazard_reports
    │   ├── 009_invoices.sql                       # invoices (Phase 5)
    │   ├── 010_customers.sql                      # extended customers
    │   ├── 010_phase6_audit_team_compliance.sql   # audit_log, notifications, insurance_policies, staff_certificates
    │   ├── 011_fleet_status.sql                   # customer_notes + fleet status
    │   ├── 012_white_label_tenants.sql            # tenants, tenant_bin_sizes; bookings.tenant_id
    │   ├── 013_fix_rls_policies.sql               # permissive inserts: bookings, driver tables
    │   ├── 014_crm_collections.sql                # 8 CRM tables + 19 customer columns (CreditorWatch, PPSR, risk)
    │   ├── 015_platform_settings.sql              # platform_settings (key/value runtime config)
    │   └── 016_booking_xero_invoice.sql           # bookings.xero_invoice_id, xero_invoice_status
    │
    ├── public/                        # Vite-served static assets
    │   ├── manifest.json              # PWA manifest
    │   ├── sw.js                      # service worker (offline cache)
    │   ├── favicon.svg
    │   ├── icon-192.png / icon-512.png  # PWA icons
    │   └── logo.jpg                   # SkipSync logo
    │
    └── node_modules/                  # — not part of source tree
```

## Recent additions (April 2026 — not yet in the tree above)

These files landed on master between 7 and 27 April 2026 but post-date the directory listing above. Consult them directly when working in those areas.

- `api/lib/xero-token.js` — shared OAuth token refresh helper for Xero endpoints
- `api/xero-invoice.js` — POST endpoint: create a Xero invoice from a booking row
- `scripts/apply-migration-013.js` — one-off utility for applying migration 013
- `src/api/collections.js` — collections engine API (overdue accounts, dunning state)
- `src/components/CRMBookingsPage.jsx` — CRM-driven bookings list + inline customer creation
- `src/components/CollectionsPage.jsx` — collections workflow UI (dunning timeline + letter generation)
- `src/components/CustomersPage.jsx` — extensively reworked for the CRM accounts feature
- `src/components/EmbedBookingPage.jsx` — public iframe-embeddable booking widget at `/embed/<tenant-slug>`
- `src/hooks/useCollections.js` — TanStack Query hooks for collections data
- `src/lib/legalTemplates.js` — letter templates: dunning, demand, statutory

Plus the schema additions for these features in migrations 012–016 (above).

## Critical entry points

- **Browser app entry:** `BinnedIT-Hub/src/main.jsx` (renders `<AuthGate />` into `#root`)
- **Vite config:** `BinnedIT-Hub/vite.config.js`
- **Vercel runtime config:** `BinnedIT-Hub/vercel.json`
- **Auth state provider:** `BinnedIT-Hub/src/context/AuthContext.jsx`
- **Database schema (read first):** `BinnedIT-Hub/supabase/migrations/001_initial_schema.sql`
- **AI server logic:** `BinnedIT-Hub/api/chat.js`

## Where to make changes (cheat sheet)

| Want to change… | Edit… |
|---|---|
| A dashboard tab's content | `src/components/tabs/<Tab>Tab.jsx` |
| Data shape from Supabase | matching file in `src/api/<domain>.js` |
| Caching/staleTime for a query | matching `src/hooks/use<Domain>.js` |
| Routes / top-level navigation | `src/App.jsx` (`Routes` block) + `src/main.jsx` (public routes) |
| Design tokens (colours, fonts) | `src/theme.js` |
| Alert thresholds logic | `src/data/analysisEngine.js` (or DB `alert_thresholds`) |
| Cron schedule | `vercel.json` `crons` array |
| Add a new Edge Function endpoint | drop a `.js` file into `api/` (Vercel auto-detects) |
| Add a database table | new `supabase/migrations/NNN_*.sql` (idempotent) |
