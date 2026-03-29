# Binned-IT Dashboard Hub

Management Intelligence Platform for Binned-IT Pty Ltd — skip bin hire, Seaford Melbourne.

**Live:** https://binnedit-hub.vercel.app
**Stack:** React 18 + Vite · Supabase PostgreSQL + Auth · Vercel Edge Functions · TanStack Query v5 · Claude Sonnet 4.6

---

## What it does

A single-screen operations dashboard replacing disconnected Xero exports, Bin Manager reports, and spreadsheets with a live, multi-user intelligence platform.

- **11-tab executive dashboard** — Snapshot, Revenue, Margins, Benchmarking, Competitors, BDM, Fleet, Debtors, Cash Flow, Risk/EPA, Work Plan
- **AI Business Assistant** — Claude Sonnet 4.6, streams insights with real financial context
- **Per-tab AI Insights** — one-click analysis for Snapshot, Revenue, and Competitor/Market Research tabs
- **40+ automated alerts** — categorised by severity (critical / warning / info / positive)
- **Mobile-responsive PWA** — installable, works on phone and tablet
- **Multi-user auth** — 4 roles: owner, manager, bookkeeper, viewer
- **User invite flow** — owner invites users by email + role via Supabase magic links
- **Fleet Assets module** — trucks, bins, maintenance records
- **Risk/EPA compliance** — training currency, vehicle rego expiry, asbestos documentation
- **PDF export** — print-optimised @media print CSS
- **Compare months** — side-by-side KPI comparison with delta arrows

---

## Quick start (local dev)

```bash
# Install dependencies
npm install

# Start Vite dev server (dashboard UI only)
npm run dev

# Start Vercel dev server (required for /api/chat and /api/invite Edge Functions)
vercel dev
```

**Environment variables** — create `.env.local`:
```
VITE_SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key from Supabase Settings → API>
VITE_APP_ENV=development
```

For Edge Functions (vercel dev only — never VITE_ prefix):
```
ANTHROPIC_API_KEY=<Anthropic API key>
SUPABASE_SERVICE_ROLE_KEY=<service role key from Supabase Settings → API>
SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
```

---

## Database setup

Run migrations in order via Supabase Dashboard → SQL Editor:

1. `supabase/migrations/001_initial_schema.sql` — all tables
2. `supabase/migrations/002_rls_policies.sql` — Row Level Security
3. `supabase/migrations/003_seed_data.sql` — reference data
4. `supabase/migrations/004_schema_additions.sql` — fleet + compliance tables
5. `supabase/migrations/004b_seed_historical_data.sql` — Jul 2025–Feb 2026 data
6. `supabase/migrations/005_fleet_tables.sql` — fleet assets

All migrations are idempotent — safe to re-run.

---

## Deployment

Auto-deploys to Vercel on push to `master`:

```bash
npm run build   # Must pass 0 errors
git push origin master
```

**Required Vercel environment variables** (Settings → Environment Variables):
- `ANTHROPIC_API_KEY` — AI chat (server-only, no VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` — invite + rate limiting (server-only)
- `SUPABASE_URL` — Supabase project URL (server-only)

---

## Architecture

```
src/
  components/
    tabs/           — 11 dashboard tab components
    AIInsightsPanel — Reusable AI analysis panel (streaming SSE)
    ChatPanel       — AI chat assistant (streaming SSE)
    SettingsPage    — Alert thresholds, users, bin types, notifications
    CompetitorPage  — Competitor pricing matrix + AI market research
    ErrorBoundary   — React class error boundary for all tabs
    MobileNav       — Bottom navigation bar (mobile)
  context/
    AuthContext     — Supabase auth state + role helpers
  data/
    financials.js   — Hardcoded fallback data (Jul 2025–Feb 2026)
    analysisEngine  — generateAlerts(monthCount) — 40+ business alerts
  hooks/
    useMonthData    — TanStack Query hooks for all report data
    useWorkPlan     — Work plan items + completions
    useCompetitors  — Competitor rates CRUD
    useAlerts       — Alerts log
    useBreakpoint   — isMobile responsive helper
  api/              — Supabase data access layer
  theme.js          — Brand tokens (B.*), formatters

api/
  chat.js           — Vercel Edge Function: Anthropic proxy (SSE stream)
  invite.js         — Vercel Edge Function: Supabase Admin invite

supabase/migrations/ — 6 SQL migration files (idempotent)
public/              — PWA assets (manifest.json, sw.js, icons)
```

---

## Test accounts

| User | Email | Password | Role |
|------|-------|----------|------|
| Mark Beddoe | mark@binnedit.com.au | BinnedIT2024x | owner |

---

## Key decisions

See `ARCHITECTURE.md` for full Architecture Decision Records (ADR-001 through ADR-018).

- **No TypeScript** — pure JS/JSX throughout; not worth the migration cost for a 1-developer product
- **Inline CSS only** — `style={{}}` props using `B.*` tokens from `theme.js`; no Tailwind, no CSS modules
- **Hardcoded fallback** — every tab reads from `src/data/financials.js` when Supabase is unavailable; dashboard never breaks
- **Edge Functions** — Anthropic and Supabase Admin API keys never reach the browser
- **TanStack Query v5** — replaces manual useEffect fetching for all Supabase data

---

## Known limitations

- Push notifications use a placeholder VAPID key — generate real keys before enabling: `npx web-push generate-vapid-keys`
- AI insights panels require `vercel dev` locally (Edge Functions don't run on `npm run dev`)
- Bundle largest chunk: ~536kB (Recharts + app code) — acceptable for dashboard use case
- Xero OAuth integration deferred to post-launch roadmap

---

*Built with Claude Code (Anthropic) · Binned-IT Pty Ltd 2026*
