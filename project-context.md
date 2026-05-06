---
project_name: 'SkipSync'
user_name: 'Bed_w'
date: '2026-05-06'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing', 'code_quality', 'workflow', 'dont_miss']
existing_patterns_found: 18
---

# Project Context for AI Agents

This file contains critical rules and patterns AI agents must follow when implementing code in the **SkipSync** project. Focus is on unobvious details that agents would otherwise miss.

*(SkipSync was formerly "Binned-IT Dashboard Hub" / "Binned-IT Hub" — same product. Use SkipSync for any new user-facing strings.)*

The application code lives in `BinnedIT-Hub/`. All paths below are relative to that subdirectory unless prefixed with `/`.

For decision rationales, read `BinnedIT-Hub/ARCHITECTURE.md` (ADR-001..018). For autonomous-action rules, read `BinnedIT-Hub/CLAUDE.md`.

---

## Technology Stack & Versions

**Frontend / build:**
- React 18.2 (pure JSX — **no TypeScript**)
- Vite 5.2 with `@vitejs/plugin-react` 4.2
- React Router 7.13
- TanStack Query 5.95 (+ devtools)
- Recharts 2.12
- @hello-pangea/dnd 18.0 (DispatchBoard kanban)
- xlsx 0.18 (Wizard imports)

**Backend / data:**
- Supabase JS 2.100 (PostgreSQL + Auth, project ref `dkjwyzjzdcgrepbgiuei`)
- Vercel Edge Functions (`runtime: 'edge'`) — auto-detected from `api/*.js`
- Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`, max 2048 tokens)

**Hosting & infra:**
- Vercel auto-deploy on push to `master` (no manual deploy)
- Supabase Postgres for all persistence
- Domain: `binnedit-hub.vercel.app`

**Notable absences (don't add without explicit approval):**
- No TypeScript / no `tsconfig.json`
- No Tailwind, CSS modules, or styled-components
- Vitest + Playwright are now configured (one Vitest unit test, one Playwright desktop+mobile smoke test). Expand both alongside feature work; don't let coverage rot
- No linter/formatter configs in repo (no `.eslintrc`, `.prettierrc`)

---

## Critical Implementation Rules

### Language-Specific Rules (JavaScript / JSX)

- **Never introduce TypeScript.** ADR-001 deliberately rejects it. Files are `.js` / `.jsx` only.
- **ES modules only** — `package.json` has `"type": "module"`. Use `import` / `export`, never `require()`.
- **Async patterns** use `async/await` with `try/catch`. The wizard submission in `App.handleWizardComplete` is the canonical example: each Supabase write is awaited; failures log `console.warn` and fall through (non-fatal).
- **Environment variables:**
  - Browser-visible vars MUST be prefixed `VITE_` (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Read via `import.meta.env`.
  - Server-only vars must NEVER carry the `VITE_` prefix. Read in Edge Functions via `process.env`. Critical examples: `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  - Mixing these up exposes credentials in the browser bundle.
- **Supabase client:** import from `src/lib/supabase.js` only. That file gracefully handles missing env vars by using placeholders so the app keeps rendering with hardcoded fallback data.

### Framework-Specific Rules

**React:**
- Function components only. There's exactly one class component (`ErrorBoundary`) — keep it that way.
- Wrap each dashboard tab render in `<ErrorBoundary key={dashTab}>` so a failure in one tab doesn't crash neighbors. The keying matters — it forces remount on tab change.
- `useAuth()` must be called inside an `<AuthProvider>` — `main.jsx` already wraps the tree.

**TanStack Query:**
- ALL Supabase reads go through hooks in `src/hooks/use*.js`. Don't call `supabase.from(...).select()` directly inside components.
- Default `staleTime`: 5 minutes for monthly report data, 30s for shared/work-plan, `Infinity` for competitor rates.
- Mutations must invalidate matching query keys via `queryClient.invalidateQueries({ queryKey: [...] })` — see App.handleWizardComplete for the pattern.
- Query key shape: `[<domain>, reportMonth]` — `reportMonth` is always the first day of the month as a date string (e.g. `'2026-02-01'`).

**React Router v7:**
- Routes are split between `src/main.jsx` (public + auth gate) and `src/App.jsx` (private). Public allowlist: `/book` and `/driver/*`.
- SPA fallback is in `vercel.json`: `"source": "/(.*)", "destination": "/index.html"` — don't break this when changing build config.

**Vercel Edge Functions:**
- Every file under `api/` is an HTTP endpoint. Each must export a default `async function handler(req)` and `export const config = { runtime: 'edge' }`.
- Always handle `OPTIONS` preflight when the endpoint will be called from the browser.
- Cron-driven endpoints are listed in `vercel.json` `crons` — see also the duplicate-key warning below.

**Supabase Auth & RLS:**
- Browser uses anon key only. RLS in migration `002_rls_policies.sql` enforces role-based access.
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is for Edge Functions only and bypasses RLS — use it sparingly and never log it.
- `/api/invite` additionally domain-restricts emails to `@binnedit.com.au` at the application layer; preserve this restriction unless explicitly told otherwise.

### Styling Rules

- **Inline `style={{}}` only.** Never add CSS files, Tailwind, CSS modules, or styled-components.
- All colours/fonts come from `src/theme.js` exports: `B.*` (palette), `fontHead` (Oswald), `fontBody` (DM Sans), `catColors` (waste-category map), and the formatters `fmt`, `fmtFull`, `fmtPct`.
- Responsive layout uses `useBreakpoint()` from `src/hooks/useBreakpoint.js` — branch on `isMobile`. KPI grids must be `repeat(2,1fr)` on mobile and `repeat(4,1fr)` on desktop.
- Print styling lives in `src/components/PDFExport.jsx` (`PrintStyles` component + `@media print` CSS). Add `className="no-print"` to elements that should hide on PDF export.

### Data Layer Rules

- **Hardcoded fallback is sacred.** Every tab must render even when Supabase returns empty/error — fall back to data from `src/data/financials.js`. The dashboard never blanks out. This is ADR-005 and is enforced everywhere.
- The wizard writes to BOTH `localStorage` (immediate backup) AND Supabase (best-effort). Supabase failure is non-fatal.
- Per-month partitioning: `monthly_reports.report_month` is `UNIQUE`. Every per-month table FKs back to `monthly_reports.id` with `ON DELETE CASCADE`.
- New Supabase data functions go in `src/api/<domain>.js`. New hooks go in `src/hooks/use<Domain>.js`. Never bypass these layers from a component.
- **⚠ Known integrity issues as of 2026-05-06** (see `docs/audits/2026-05-06/audit-reconciliation.md` for full evidence; `docs/audits/2026-05-06/FIXES-NEEDED.md` for the prioritised backlog):
  - Xero `mapPLToFinancials` mis-classifies ~64% of YTD revenue ($1.0M) into `rev_other` — WMF/CON/Transport SKUs don't match the keyword classifier; `rev_general` is hard-coded to 0.
  - `Math.abs()` on negative trading-income rows inflates revenue by ~$340 YTD (customer credits become positive revenue).
  - `parseBalanceSheet` cash matcher misses the $77,811 operating account because the bank row is named "Binned-It Pty Ltd" (no `cash`/`bank`/`westpac` keyword).
  - AR sync is fully disabled (`void arData` in `syncMonth()`); `debtors_monthly` receives zero rows from Xero.
  - PricingTab uses real bin data only when `monthIndex === 7` (Feb 2026); other months extrapolate from YTD proportions and are unreliable.
  - Several tabs (FleetTab, DebtorsTab, BDMTab, SnapshotTab cash/AR) fall back to non-month-keyed `D.*` data — switching months silently shows Feb 2026.
  - Until these are fixed, treat any per-month dashboard number for any month other than Feb 2026 as suspect, and treat the live Xero sync output as unsuitable for business decisions.

### AI / Streaming Rules

- All Anthropic calls go through `/api/chat`. Never call `api.anthropic.com` directly from the browser (ADR-004 — this was a previous security incident).
- Client streaming uses `response.body.getReader()` + `TextDecoder` — see `ChatPanel` and `AIInsightsPanel` for the canonical pattern.
- Daily rate limit: 50 messages/user, counted in `ai_chat_sessions`. Rate-limit logic lives in `api/chat.js` and silently skips if Supabase env vars are absent.

### Database Migration Rules

- New migrations go in `supabase/migrations/NNN_<name>.sql` with a **unique** numeric prefix — the existing `007_*` and `010_*` collisions are legacy and should not be repeated.
- All migrations must be **idempotent** (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, etc.) — they're applied via Supabase Dashboard SQL Editor or `supabase db push` and re-runs must be safe.
- After changing schema, also update the matching `src/api/<domain>.js` reader/writer.

### Testing Rules

- **Vitest** runs unit tests under `src/**/*.{test,spec}.{js,jsx}` (jsdom env, Testing Library). Run via `npm test` (one-shot) or `npm run test:watch`.
- **Playwright** runs E2E specs under `e2e/*.spec.js` against a Vite dev server it auto-starts. Project matrix: Desktop Chrome 1440×900 + iPhone 14 390×844 — matches the manual QA protocol from `CLAUDE.md`. Run via `npm run test:e2e` (after a one-time `npm run test:e2e:install` to fetch browsers).
- Co-locate unit tests next to the file under test (`theme.js` ↔ `theme.test.js`); don't introduce a separate `__tests__/` tree.
- The manual QA protocol from `CLAUDE.md` still applies after significant changes:
  1. `npm run build` — must exit 0 errors
  2. `npm test` — Vitest unit tests must pass
  3. Smoke-test in browser at 1440×900 (desktop) and 390×844 (mobile) — KPI grid `repeat(2,1fr)` on mobile, MobileNav visible, no horizontal overflow
  4. Switch month selector Jul→Feb and verify KPIs + alerts update

### Code Quality & Style

- No linter configured. Match the existing code style: 2-space indent, single quotes, no trailing semicolons in JSX, terse prop spreads (`{...tabProps}`).
- Components are PascalCase, hooks are camelCase prefixed `use`, files match the export name.
- No JSDoc requirement — header comments exist on Edge Functions and `AuthContext.jsx`; follow that style for new server-side files but don't add them everywhere.
- Don't introduce new npm packages without checking `package.json` first. Prefer the existing toolset.

### Development Workflow Rules

- `master` is the only branch that auto-deploys. Push there only after `npm run build` exits clean.
- Commit messages are descriptive prose; no enforced convention (Conventional Commits, etc.) — match the existing history.
- For Edge Function or AI/invite work, run `vercel dev` locally — `npm run dev` alone won't execute `api/*.js`.
- `BinnedIT-Hub/CLAUDE.md` documents autonomous-action allowlist for Claude Code (e.g. `supabase db push`, `git push origin master`, `npm run dev`/`build`). When operating in that mode, those are pre-approved.

### Auth / RBAC Rules

- The role values stored in `profiles.role` are `owner | manager | bookkeeper | viewer | fleet_manager`. The `useAuth()` value exposes `isOwner`, `isManager` (owner / manager / fleet_manager), `isBookkeeper` (owner / bookkeeper), `canWrite` (owner / bookkeeper). All four must exist — `isBookkeeper` was historically missing and silently broke Sarah's invoice/sync writes.
- Route-level RBAC: `main.jsx` AuthGate currently lets any authenticated session reach all admin routes. The `/investor` allowlist for the viewer role is open work (see `docs/audits/2026-05-06/FIXES-NEEDED.md` item #12).
- Driver portal lives at `/driver` and `/driver/*` (singular) and handles its own auth. Admin "manage drivers" should NOT collide with this — `main.jsx` matches the singular path with regex `/^\/driver(\/|$)/`. Adding an admin "Drivers" admin page belongs at a new path (e.g. `/admin/drivers`), not `/drivers`.

### Critical Don't-Miss Rules

- **Never expose secrets to the browser** — the `VITE_` vs non-`VITE_` distinction is the live guardrail. Putting `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` behind a `VITE_` prefix would re-create the security incident that ADR-004 fixed.
- **Don't break the hardcoded fallback** — even when wiring up new live data, leave the `financials.js` path intact so the dashboard survives a Supabase outage.
- **Don't add CSS files / Tailwind / a styling library.** This is repeatedly rejected in CLAUDE.md and ADR-006. Tokens in `theme.js` + inline styles is the architecture.
- **Don't introduce TypeScript.** Same source: ADR-001.
- **VAPID push keys must be set as env vars before push works.** The browser reads `VITE_VAPID_PUBLIC_KEY` (in `SettingsPage.jsx`); the Edge Function reads `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (in `api/push-send.js`). Generate a keypair with `npx web-push generate-vapid-keys --json` and set all three in Vercel + `.env.local`.
- **Migration prefix collisions** (`007_*` and `010_*` files) — legacy. See `supabase/migrations/README.md` for the convention. Pick fresh unique prefixes (next available: `012_*`).
- **Product name is SkipSync.** Older docs say "Binned-IT Dashboard Hub" / "Binned-IT Hub" — that's the same product. Use **SkipSync** for any new user-facing strings. Company name "Binned-IT Pty Ltd", domain `@binnedit.com.au`, GitHub repo `BinnedIT-Hub`, and Vercel URL `binnedit-hub.vercel.app` are unchanged.
- **Write paths for migrations are SQL only.** The Supabase JS client does not run DDL — schema changes happen via SQL files applied from the Supabase Dashboard or `supabase db push`.
- **`/api/invite` domain restriction (`@binnedit.com.au`)** is intentional, not a bug. Don't relax it without explicit approval.

---

## File-touching cheat sheet

| Goal | Edit |
|---|---|
| Change a tab's UI | `src/components/tabs/<Tab>.jsx` |
| Change Supabase read/write logic | `src/api/<domain>.js` + matching `src/hooks/use<Domain>.js` |
| Add a new HTTP endpoint | drop a `.js` file into `api/` (Vercel auto-detects) |
| Add a database table | new `supabase/migrations/<NNN>_<name>.sql` (unique prefix, idempotent) |
| Change colours / fonts | `src/theme.js` |
| Change responsive breakpoints | `src/hooks/useBreakpoint.js` |
| Change route table | `src/App.jsx` (private routes) + `src/main.jsx` (public + auth gate) |
| Change cron schedule | `vercel.json` `crons` (deduplicate the array first) |
| Change alert generator | `src/data/analysisEngine.js` (or DB `alert_thresholds`) |
