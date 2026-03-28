# Binned-IT Dashboard Hub — Claude Code Instructions

## Project
React 18 + Vite SPA. Supabase PostgreSQL + Auth. Vercel deployment. TanStack Query v5. React Router v6.

**Owner:** Mark Beddoe — Binned-IT Pty Ltd, skip bin hire, Seaford Melbourne.
**Supabase project ref:** `dkjwyzjzdcgrepbgiuei`
**Supabase URL:** `https://dkjwyzjzdcgrepbgiuei.supabase.co`
**GitHub repo:** `https://github.com/markgbeddoe-dotcom/BinnedIT-Hub`
**Vercel:** `binnedit-hub.vercel.app` (auto-deploys from `master` branch)
**Dev server:** `npm run dev` — runs on port 5173 (or next available)
**Test login:** `mark@binnedit.com.au` / `BinnedIT2024x` (owner role)

## Credentials (from .env.local — never commit)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Admin API access
- `ANTHROPIC_API_KEY` — Claude API for AI chat feature
- `VERCEL_TOKEN` — Vercel CLI deployments

## Autonomous operation — do these without asking

### Apply database migrations
```bash
supabase db push
```
Migration files are in `supabase/migrations/`. Always apply in numeric order. All migrations are idempotent (safe to re-run).

### Deploy to Vercel
```bash
git add -A
git commit -m "description"
git push origin master
```
Vercel auto-deploys on push to `master`. No manual deploy step needed.

### Run dev server
```bash
npm run dev
```

### Build check (always run before pushing)
```bash
npm run build
```
Build must pass with 0 errors. Chunk size warning is expected and acceptable.

### Use Vercel CLI for Edge Function testing locally
```bash
vercel dev
```
Required for `/api/chat` and `/api/invite` Edge Functions to work in local dev.

## Code conventions — always follow these
- **Inline CSS only** — `style={{}}` props using `B.*` tokens from `src/theme.js`. No Tailwind, no CSS modules.
- **No TypeScript** — pure JS/JSX throughout
- **No new npm packages** without checking `package.json` first
- **Hardcoded fallback always** — tabs read from `src/data/financials.js` when Supabase returns empty. Never break the dashboard.
- **`useBreakpoint()`** — import from `src/hooks/useBreakpoint.js` for any responsive layout. KPI grids must be `repeat(2,1fr)` on mobile, `repeat(4,1fr)` on desktop.
- **Build before pushing** — always run `npm run build` and confirm 0 errors first.

## Architecture
- `src/main.jsx` — AuthGate wraps App, reads session from AuthContext
- `src/App.jsx` — React Router, tab routing, month selector, alert generation
- `src/data/financials.js` — hardcoded fallback data (Jul 2025–Feb 2026)
- `src/data/analysisEngine.js` — `generateAlerts(monthCount)` — always pass monthCount
- `src/hooks/` — TanStack Query hooks for all Supabase data
- `src/api/` — Supabase data access functions
- `src/components/tabs/` — 11 tab components
- `src/theme.js` — brand tokens (light mode: bg=#D8D5E0, cardBg=#FFFFFF)
- `api/chat.js` — Vercel Edge Function (Anthropic proxy)
- `api/invite.js` — Vercel Edge Function (Supabase Admin invite)
- `supabase/migrations/` — 6 migration files (001–005)

## QA protocol
After any significant change:
1. `npm run build` — must be 0 errors
2. Playwright at 1440×900 (desktop) — check affected tabs
3. Playwright at 390×844 (mobile) — check KPI grids, MobileNav, no overflow
4. Switch month selector Jul→Feb, verify KPIs and alerts update correctly

## Personas for UAT
- **Mark** (owner) — `mark@binnedit.com.au` / `BinnedIT2024x` — full access
- **Sarah** (bookkeeper) — wizard + dashboard read, no settings
- **Jake** (fleet manager) — fleet tab + dashboard read
- **Andrew** (investor) — `/investor` route only, read-only

## Known issues / watch out for
- Supabase 400/401 errors in console are expected until migrations applied — app falls back to hardcoded data
- AI Chat and invite flow require `vercel dev` locally (Edge Functions don't run on `vite dev`)
- VAPID key for push notifications is a placeholder — generate real keys with `npx web-push generate-vapid-keys` before going live
- Chunk size warning (1,368 kB) is expected — non-blocking
