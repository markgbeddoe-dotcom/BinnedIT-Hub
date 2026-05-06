# Architecture — SkipSync

**Generated:** 2026-05-06
**Repository type:** monolith
**Project type id:** `web`

For decision rationales, see `BinnedIT-Hub/ARCHITECTURE.md` (ADR-001 through ADR-018). This document is the AI-retrieval summary; the ADR log is the authoritative source for the *why*.

## Layered view

```
┌─────────────────────────────────────────────────────────┐
│  Browser / PWA                                          │
│   React 18 SPA (Vite-built)                             │
│   ├─ AuthGate (main.jsx)  ── Supabase Auth session      │
│   ├─ React Router v7      ── routes below               │
│   ├─ TanStack Query v5    ── all Supabase reads         │
│   └─ Inline-style design system (B.* tokens, theme.js)  │
└──────────────────┬──────────────────────────┬───────────┘
                   │                          │
        Supabase JS (anon key)         fetch /api/*
                   │                          │
┌──────────────────▼─────────┐  ┌─────────────▼───────────┐
│  Supabase                  │  │  Vercel Edge Functions  │
│   ├─ PostgreSQL (RLS)      │  │   ├─ /api/chat          │
│   │  30+ tables, 16 mig.   │  │   ├─ /api/invite        │
│   ├─ Auth (email + magic)  │  │   ├─ /api/book-confirm  │
│   └─ Service-role key      │  │   ├─ /api/invoice-*     │
│      used only server-side │  │   ├─ /api/xero-*        │
│      from Edge Functions   │  │   ├─ /api/push-send     │
│                            │  │   └─ crons: reminders,  │
│                            │  │     weekly-digest,      │
│                            │  │     invoice-chase       │
└────────────────────────────┘  └──────────┬──────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │  Anthropic API   │
                                  │  Xero API        │
                                  │  Web Push        │
                                  └──────────────────┘
```

## Key architectural patterns

### 1. Hardcoded fallback (dashboard-never-breaks)
Every tab reads through TanStack Query hooks (`src/hooks/use*.js`). When Supabase queries return empty/error, the hooks fall back to `src/data/financials.js` (Jul 2025–Feb 2026 seed). Result: a missing migration or RLS misconfiguration degrades data freshness but never blanks the UI.

### 2. Server-side secret containment
Two API keys exist server-side only and are NEVER prefixed `VITE_`:
- `ANTHROPIC_API_KEY` — used in `api/chat.js`
- `SUPABASE_SERVICE_ROLE_KEY` — used in `api/invite.js`, `api/chat.js` (rate limiter), Xero sync
The browser only ever sees `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

### 3. Inline-style design tokens
No Tailwind, no CSS modules, no styled-components. All styling is `style={{}}` props referencing tokens from `src/theme.js` (`B.yellow`, `B.cardBg`, `fontHead`, `fmt`, `fmtPct`). This is a deliberate ADR-006 decision — the cost of refactor outweighs the benefit for a 1-developer product.

### 4. Mobile responsiveness via `useBreakpoint()`
`src/hooks/useBreakpoint.js` returns `{ isMobile, isTablet, isDesktop }` based on viewport width. Components branch on `isMobile` for KPI grid columns (`repeat(2,1fr)` mobile vs `repeat(4,1fr)` desktop) and to swap the dashboard tab bar for `MobileNav`.

### 5. SSE streaming AI
Both the global `ChatPanel` and per-tab `AIInsightsPanel` POST to `/api/chat` and read the response with `response.body.getReader()`, parsing SSE deltas to update message state incrementally.

### 6. PWA + offline
`public/manifest.json` and `public/sw.js` make the app installable. `OfflineBanner` component listens for `online`/`offline` events. Service worker caches the app shell; React Query cache provides stale-while-revalidate for data.

### 7. Per-month data partitioning
The dominant query key shape is `[<table>, reportMonth]` — every report query is scoped to a specific `report_month` (date, first day of month). The `monthly_reports` table has `UNIQUE(report_month)` to enforce one report per month, and most data tables FK to `monthly_reports.id` with `ON DELETE CASCADE`.

## Routing map

Routes are defined in `src/App.jsx` (private) and `src/main.jsx` (public + auth gate):

| Route | Component | Auth |
|---|---|---|
| `/` | redirect → `/home` | session |
| `/home` | `App.Home` (tile menu) | session |
| `/dashboard/:tab` | `App.Dashboard` | session |
| `/wizard` | `Wizard` | session (writer roles) |
| `/dispatch` | `DispatchBoard` | session |
| `/bookings` | `BookingPage` | session |
| `/customers` | `CustomersPage` | session |
| `/drivers` | `DriverApp` | own auth |
| `/invoices` | `InvoicesPage` | session |
| `/fleet` | `FleetManagementPage` | session |
| `/fleet-assets` | `FleetAssetsTab` | session |
| `/settings` | `SettingsPage` | session (owner) |
| `/settings/audit` | `AuditLogPage` | session (owner) |
| `/settings/team` | `TeamPage` | session (owner) |
| `/history` | `App.HistoryScreen` | session |
| `/reports` | `App.ReportsScreen` | session |
| `/about` | `App.AboutScreen` | session |
| `/investor` | `InvestorView` | session (investor role) |
| `/book` | `BookingPage` | **public** |
| `/driver/*` | `DriverApp` | own auth |
| `*` | redirect → `/home` | — |

The `vercel.json` rewrites `/(.*)` → `/index.html` so all client routes resolve.

## Integration points

| Integration | Direction | File(s) | Notes |
|---|---|---|---|
| Anthropic Claude | server → external | `api/chat.js` | SSE streaming, model `claude-sonnet-4-6`, max 2048 tokens, 50 msg/user/day rate limit |
| Supabase PostgreSQL | client → DB | `src/lib/supabase.js`, `src/api/*.js` | Anon key + RLS; service-role for admin ops |
| Supabase Auth | client + server | `src/context/AuthContext.jsx`, `api/invite.js` | Email/password + magic-link invites; domain-restricted to `@binnedit.com.au` |
| Xero | server ↔ external | `api/xero-auth.js`, `api/xero-callback.js`, `api/xero-sync.js`, `api/xero-payment-sync.js` | OAuth 2.0; tokens persisted in `xero_tokens` table |
| Vercel Cron | scheduler → server | `vercel.json` `crons` | reminders 08:00 daily, invoice-chase 09:00 daily, weekly-digest 20:00 Sunday |
| Web Push | server → browser | `api/push-send.js`, `public/sw.js` | VAPID key currently a placeholder — must regenerate before production push |

## Data flow: monthly wizard submission

1. User completes 12-step `Wizard` (file uploads + manual input)
2. `App.handleWizardComplete()` saves to `localStorage` (backup)
3. Calls `createReport(reportMonth)` → upserts `monthly_reports` row
4. Calls `upsertFinancials(report.id, …)` → writes to `financials_monthly`
5. Calls `upsertCompliance(report.id, …)` if compliance data present
6. Invalidates queries `['available-months']` and `['financials', wMonth]` so dashboard refreshes
7. If any step fails, localStorage backup remains — failure is non-fatal

(Ongoing per ADR-005: planned RPC `submit_monthly_report` would wrap all writes in a single transaction.)

## Build & deployment

- `npm run build` → Vite produces `dist/` with manual chunks: `vendor-react`, `vendor-charts`, `vendor-supabase`, `vendor-query`
- `git push origin master` → Vercel auto-deploys
- Edge Functions deploy automatically alongside SPA (any file in `api/` becomes an endpoint)

## Security headers (vercel.json)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Known limitations / risks

- AI insight panels require `vercel dev` locally — Edge Functions don't run on `npm run dev` alone
- Largest bundle chunk ~536kB (Recharts + app); chunk size warning at build is expected
- VAPID push keys must be set in Vercel env (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, plus `VITE_VAPID_PUBLIC_KEY` for the browser) before push notifications work in production
- Pre-launch tests are scaffolded but minimal (one Vitest unit test, one Playwright smoke test) — expand alongside feature work
