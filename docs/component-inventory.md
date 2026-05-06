# Component Inventory — SkipSync

**Generated:** 2026-05-06
**Total components:** 36 (24 top-level + 12 dashboard tabs + driver subtree)

All components are pure JS/JSX. Styling is inline `style={{}}` referencing tokens from `src/theme.js`. Responsive logic uses `useBreakpoint()` from `src/hooks/useBreakpoint.js`.

## Layout / shell

| Component | Path | Role |
|---|---|---|
| `AuthGate` | `src/main.jsx` (inline) | Wraps the app; renders `LoginPage` when no session. Public route allowlist for `/book` and `/driver/*`. |
| `App` | `src/App.jsx` | Top-level: Header, SideMenu, Home tiles, Dashboard with 12 tabs, route table. |
| `Header` | inline in `App.jsx` | Sticky top nav: hamburger, logo, month selector (desktop), PDFExport, NotificationBell, Home. |
| `SideMenu` | inline in `App.jsx` | Slide-out left drawer with operations / reports / system sections. |
| `MobileNav` | `src/components/MobileNav.jsx` | Bottom tab bar (< 768px) — Home, Dashboard, Alerts (badge), Work Plan, Chat. |
| `OfflineBanner` | `src/components/OfflineBanner.jsx` | Listens to `online`/`offline` events. |
| `ErrorBoundary` | `src/components/ErrorBoundary.jsx` | React class boundary; wraps each dashboard tab keyed by tab id. |

## Auth + session

| Component | Path | Role |
|---|---|---|
| `AuthProvider` / `useAuth` | `src/context/AuthContext.jsx` | Supabase session, profile fetch, `isOwner`/`isManager`/`canWrite`, `signIn`/`signOut`. |
| `LoginPage` | `src/components/LoginPage.jsx` | Email + password form. |

## Home & navigation

| Component | Path | Role |
|---|---|---|
| `Home` (inline) | `App.jsx` | Tile menu: Dispatch / Bookings / Invoices / Customers / Fleet / Financial Reports / Load Data / Settings. |
| `MonthSelect` (inline) | `App.jsx` | Month grid for selecting wizard target month. |
| `HistoryScreen` (inline) | `App.jsx` | Months grid w/ revenue + complete state. |
| `ReportsScreen` (inline) | `App.jsx` | Coming-soon list (Monthly Mgmt, Profitability, Training, Incident, Cash Flow Forecast, Balance Sheet). |
| `AboutScreen` (inline) | `App.jsx` | Version metadata. |

## Dashboard tabs (12)

All accept `{ selectedMonth, monthCount, monthLabel, reportId, reportMonth }` and live under `/dashboard/:tab`.

| Tab id | Component | Source data |
|---|---|---|
| `snapshot` | `SnapshotTab.jsx` | `useFinancials` (financials_monthly) — KPI tiles + charts |
| `revenue` | `RevenueTab.jsx` | financials_monthly |
| `margins` | `MarginsTab.jsx` | financials_monthly |
| `benchmarking` | `BenchmarkingTab.jsx` | bin_type_performance |
| `competitors` | `CompetitorsTab.jsx` | competitor_rates (CRUD via `useCompetitors`) |
| `pricing` | `PricingTab.jsx` | bin_type_performance + competitor_rates |
| `bdm` | `BDMTab.jsx` | customer_acquisitions |
| `fleet` | `FleetTab.jsx` | bin_type_performance (fleet view of jobs) |
| `fleet-assets` (route only) | `FleetAssetsTab.jsx` | fleet_assets, fleet_maintenance_records |
| `debtors` | `DebtorsTab.jsx` | debtors_monthly |
| `cashflow` | `CashFlowTab.jsx` | financials_monthly + balance_sheet_monthly |
| `risk` | `RiskEPATab.jsx` | compliance_records |
| `workplan` | `WorkPlanTab.jsx` | work_plan_items + work_plan_completions |

## AI

| Component | Path | Role |
|---|---|---|
| `ChatPanel` | `src/components/ChatPanel.jsx` | Global slide-in chat. POSTs to `/api/chat`, reads SSE stream. |
| `AIInsightsPanel` | `src/components/AIInsightsPanel.jsx` | Reusable per-tab analysis trigger. Mounted on Snapshot, Revenue, Competitor (market research mode). |

## Operations pages (PRD v5 operations-first features)

| Component | Path | Role |
|---|---|---|
| `DispatchBoard` | `src/components/DispatchBoard.jsx` | Kanban board with `@hello-pangea/dnd` (drag-drop jobs across statuses). |
| `BookingPage` | `src/components/BookingPage.jsx` | Both `/book` (public customer flow) and `/bookings` (ops view). |
| `FleetManagementPage` | `src/components/FleetManagementPage.jsx` | Fleet truck/bin admin. |
| `CustomersPage` | `src/components/CustomersPage.jsx` | CRM list with churn risk. |
| `InvoicesPage` | `src/components/InvoicesPage.jsx` | Invoice list, payment status, dunning trigger. |
| `DriverApp` | `src/components/driver/DriverApp.jsx` | Driver portal (own auth) — run sheet, job photos, hazards. |

## Settings & admin

| Component | Path | Role |
|---|---|---|
| `SettingsPage` | `src/components/SettingsPage.jsx` | Alert thresholds, bin types, notification preferences. |
| `TeamPage` | `src/components/TeamPage.jsx` | `/settings/team` — list/invite users (calls `/api/invite`). |
| `AuditLogPage` | `src/components/AuditLogPage.jsx` | `/settings/audit` — read audit_log table. |
| `Wizard` | `src/components/Wizard.jsx` | 12-step monthly data entry — file uploads + manual input. |
| `CompetitorPage` | `src/components/CompetitorPage.jsx` | Competitor pricing matrix (also embedded as Competitors tab). |

## Specialised views

| Component | Path | Role |
|---|---|---|
| `InvestorView` | `src/components/InvestorView.jsx` | `/investor` — read-only, simplified KPI view. |
| `PDFExport` + `PrintStyles` | `src/components/PDFExport.jsx` | `@media print` CSS, "Export PDF" trigger. |
| `NotificationBell` | `src/components/NotificationBell.jsx` | Header bell — recent notifications dropdown. |
| `UIComponents` | `src/components/UIComponents.jsx` | Shared primitives: `AlertItem`, others. |

## Component conventions

- Every tab is wrapped in `ErrorBoundary` keyed by tab id, so a runtime error in one tab doesn't break the others
- KPI grids use `gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)'`
- Charts (Recharts) accept the same `tabProps` interface and read derived data from query hooks
- Components that mutate Supabase use the matching `src/api/<domain>.js` function and invalidate `queryClient` keys after success

## What's NOT here

- No CSS files (everything is inline)
- No Storybook
- No component-level tests
- No design system component library beyond `UIComponents.jsx`
