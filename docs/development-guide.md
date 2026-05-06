# Development Guide — SkipSync

**Generated:** 2026-05-06
**Working directory:** `BinnedIT-Hub/` (all commands assume cwd = repo's `BinnedIT-Hub/` folder)

## Prerequisites

- Node.js (any LTS version compatible with Vite 5 — Node ≥18 recommended)
- npm (bundled with Node)
- Vercel CLI (`npm i -g vercel`) — required to test Edge Functions locally
- Access to the Supabase project `dkjwyzjzdcgrepbgiuei` (URL + anon key from Settings → API)

## Environment variables

Create `.env.local` in `BinnedIT-Hub/`:

```
# Browser-visible (must use VITE_ prefix)
VITE_SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key from Supabase Settings → API>
VITE_APP_ENV=development

# Server-only (no VITE_ prefix — only for `vercel dev`)
ANTHROPIC_API_KEY=<Anthropic API key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
```

**Critical:** never prefix the server-only keys with `VITE_` — that would expose them to the browser.

## Install

```bash
npm install
```

## Run modes

| Command | What it does | When to use |
|---|---|---|
| `npm run dev` | Vite dev server on port 3000 (or next free) | UI-only iteration; AI panels and `/api/invite` will fail |
| `vercel dev` | Vercel Edge runtime + Vite | Required when working on Edge Functions, AI panels, or invites |
| `npm run build` | Vite production build → `dist/` | Pre-push validation. Must exit 0 errors |
| `npm run preview` | Serve built `dist/` | Smoke-test the production bundle |
| `npm test` | Vitest unit tests (jsdom + Testing Library) | Run before pushing logic changes |
| `npm run test:watch` | Vitest watch mode | While iterating on a unit |
| `npm run test:e2e` | Playwright E2E (auto-starts `npm run dev`) | Smoke-test desktop + mobile flows |
| `npm run test:e2e:install` | Download Playwright browsers | One-time setup before first E2E run |

## Database setup (one-time per environment)

Apply migrations in order via Supabase Dashboard → SQL Editor (or `supabase db push` if Supabase CLI is configured):

1. `001_initial_schema.sql`
2. `002_rls_policies.sql`
3. `003_default_thresholds.sql`
4. `004_schema_additions.sql`
5. `004b_seed_historical_data.sql`
6. `005_fleet_tables.sql`
7. `006_xero_integration.sql`
8. `007_ar_invoices.sql`
9. `007_esg_columns.sql`
10. `007_operational_features.sql`
11. `008_bookings.sql`
12. `009_driver_jobcosting.sql`
13. `009_invoices.sql`
14. `010_customers.sql`
15. `010_phase6_audit_team_compliance.sql`
16. `011_fleet_status.sql`

All migrations are idempotent — re-running them is safe.

## Test login

`mark@binnedit.com.au` / `BinnedIT2024x` (owner role).

## Coding conventions

The conventions below are non-negotiable per `BinnedIT-Hub/CLAUDE.md`:

- **No TypeScript** — pure JS/JSX throughout
- **No new npm packages** without checking `package.json` first
- **Inline styles only** — `style={{}}` props referencing tokens from `src/theme.js`. No Tailwind, no CSS modules, no `.css` files
- **Hardcoded fallback always** — every tab must read from `src/data/financials.js` when Supabase returns empty/error. The dashboard never blanks
- **`useBreakpoint()` for responsive layout** — KPI grids: `repeat(2,1fr)` mobile, `repeat(4,1fr)` desktop
- **Build before pushing** — `npm run build` must exit with 0 errors

## Project layout (where to put new code)

| Adding a… | Goes in… |
|---|---|
| Dashboard tab UI | `src/components/tabs/<Name>Tab.jsx` |
| Operational page | `src/components/<Name>Page.jsx` |
| Supabase data function | `src/api/<domain>.js` |
| TanStack Query hook | `src/hooks/use<Domain>.js` |
| Vercel Edge Function | `api/<endpoint>.js` (auto-detected) |
| Migration | `supabase/migrations/<NNN>_<name>.sql` (use unique prefix; idempotent) |
| Design token | `src/theme.js` |
| Alert generator | `src/data/analysisEngine.js` |

## QA protocol (after significant changes)

1. `npm run build` — must be 0 errors
2. `npm test` — Vitest unit tests must pass
3. `npm run test:e2e` — Playwright desktop + mobile smoke tests (auto-spawns dev server)
4. Manual smoke at **1440×900 desktop** + **390×844 mobile** for affected tabs — confirm KPI grid is `repeat(2,1fr)` on mobile, MobileNav is visible, no horizontal overflow
5. Switch month selector Jul→Feb and verify KPIs + alerts update correctly
6. If you touched auth, log in as `mark@binnedit.com.au` and confirm session persists across reload

## Personas for UAT

| Persona | Login | What they see |
|---|---|---|
| Mark (owner) | `mark@binnedit.com.au` | Full app |
| Sarah (bookkeeper) | invited via `/api/invite` | Wizard + dashboard read |
| Jake (fleet manager) | invited | Fleet tab + dashboard read |
| Andrew (investor) | invited as viewer | `/investor` route only |

## Common gotchas

- Supabase 400/401 errors in console are **expected** until migrations are applied — fallback data still renders
- AI Chat + `/api/invite` will fail under `npm run dev` alone; use `vercel dev` to test them
- Push notifications need `VITE_VAPID_PUBLIC_KEY` (browser) and `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (server) set in env. Generate with `npx web-push generate-vapid-keys --json` if not yet stored
- Bundle largest chunk ~536kB (Recharts + app) — chunk-size warning at build is non-blocking
- Some routes from PRD v5 (post-launch Xero invoice flows) are partially wired — check `api/xero-*.js` before assuming they're complete

## Useful one-liners

```bash
npm run build                              # validate before push
npm test                                   # Vitest unit tests
npm run test:e2e                           # Playwright smoke (desktop + mobile)
vercel dev                                 # full local stack incl. Edge Functions
git push origin master                     # trigger Vercel auto-deploy
npx web-push generate-vapid-keys --json    # regenerate push keys
```

For Claude Code automation rules (`supabase db push`, `git push origin master`, etc.), see `BinnedIT-Hub/CLAUDE.md`.
