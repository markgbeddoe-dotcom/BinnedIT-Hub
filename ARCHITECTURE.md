I have now read all files and have a complete picture of the codebase. Let me now compose the full Architecture Decision Record. This is a large document — I will output it directly as my response since I am in read-only mode and cannot write files.

---

# Binned-IT Dashboard Hub — Architecture Decision Record

## Version 1.0 | Date: 27 March 2026 | Status: Accepted

---

## Executive Summary

Binned-IT Dashboard Hub is a React 18/Vite SPA backed by Supabase PostgreSQL, deployed on Vercel, serving four user roles (Owner, Manager, Bookkeeper, Viewer) for a single skip bin hire company. Sprint 1 delivered a fully functional dashboard reading from hardcoded data (`src/data/financials.js`) with localStorage persistence. Sprint 2 is the bridge sprint that migrates all persistence to Supabase — the API layer (`src/api/*.js`) is already written but completely unwired from the UI. The most urgent blocking concern is the Anthropic API key being called directly from the browser in `App.jsx`, which is a live credential exposure that must be resolved in the same sprint as data wiring, not deferred to Sprint 3.

The architecture decisions in this ADR deliberately choose pragmatism over elegance. For a one-developer team building a product for a ~10-user organisation, the right choices are: no TypeScript now, no CSS framework change, no routing library before the data layer is wired, inline styles kept exactly as-is, and React Query introduced gradually alongside (not instead of) the existing useState patterns. The single most consequential decision is the component extraction sequencing: extract each tab into its own file first (before wiring to Supabase), because doing it the other way results in debugging two problems simultaneously.

The revised sprint plan splits what the PRD calls "Sprint 2" into two concrete phases: Phase 2A (schema migration 004, Wizard Supabase write, seed data) and Phase 2B (all 11 tabs reading live data). The Vercel Edge Function for the AI chat (`api/chat.js`) is moved from Sprint 3 into Phase 2A because the API key exposure is a production security risk that cannot wait. Mobile (Sprint 3) stays after data wiring is confirmed working — there is no value in making an app that shows hardcoded data beautifully responsive.

---

## Decision Log

### ADR-001: State Management

**Status:** Accepted

**Context:** App.jsx uses `useState` throughout. AuthContext.jsx wraps Supabase auth state. There is no data caching layer — every re-render or tab switch re-reads from the hardcoded `financials.js` arrays. Once the data source becomes Supabase, each tab switch will trigger a network request unless caching is added.

**Decision:** Add TanStack Query v5 (`@tanstack/react-query`) for all Supabase data fetching. Keep `useState` for purely local UI state (which tab is open, which modal is showing, form field values). Keep AuthContext exactly as-is — it is correct and complete.

**Rationale:** The alternative of continuing with `useEffect` + `useState` for data fetching would require manually implementing: loading states, error states, cache invalidation, stale-while-revalidate, background refetch, and retry logic. TanStack Query provides all of these in ~5KB gzipped. For a 1-developer team, this is the correct tradeoff. The monthly data patterns (rarely changes, ~16 tables, staleTime of 5 minutes is appropriate) are exactly what React Query is designed for. Zustand or Redux would be significant over-engineering — there is no complex shared mutation state between distant components.

**Consequences:**
- `QueryClientProvider` wraps the app in `main.jsx` (one line above `AuthProvider`)
- All `useEffect(() => { fetchData() }, [selectedMonth])` patterns in tab components are replaced with `useQuery` calls from `src/hooks/*.js`
- The existing `src/api/*.js` functions are used directly as `queryFn` arguments — no API layer change required
- React Query DevTools can be added to development build for debugging cache state

**Implementation:**
1. Install: `@tanstack/react-query` and `@tanstack/react-query-devtools`
2. Create `src/hooks/useMonthData.js` with hooks: `useFinancials(reportMonth)`, `useYTDFinancials(fyStart, toMonth)`, `useBalanceSheet(reportMonth)`, `useDebtors(reportMonth)`, `useBinPerformance(reportMonth)`, `useCompliance(reportMonth)`, `useCustomerAcquisitions(reportMonth)`
3. Create `src/hooks/useWorkPlan.js` with: `useWorkPlanItems()`, `useMarkComplete(itemId)`, `useUnmarkComplete(itemId)`
4. Create `src/hooks/useAlerts.js` with: `useAlertsForReport(reportId)`, `useAcknowledgeAlert()`
5. Create `src/hooks/useCompetitors.js` with: `useCompetitorRates()`, `useUpsertRate()`
6. Standard staleTime: `5 * 60 * 1000` (5 minutes) for all report data; `30 * 1000` (30 seconds) for work plan (shared state); competitor rates use `Infinity` (only refetch on mutation)
7. `QueryClient` config: `defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } }`

**Query key conventions:**
```
['financials', reportMonth]          // e.g. ['financials', '2026-02-01']
['financials-ytd', fyStart, toMonth]
['balance-sheet', reportMonth]
['debtors', reportMonth]
['bin-performance', reportMonth]
['compliance', reportMonth]
['acquisitions', reportMonth]
['work-plan']
['alerts', reportId]
['competitors']
['available-months']
```

---

### ADR-002: Client-Side Routing

**Status:** Deferred to Sprint 3 (not Sprint 2)

**Context:** Current routing is a single `screen` state variable in App.jsx. There is no URL change when navigating between screens or tabs. The PRD Sprint 2 does not list React Router as a requirement; Sprint 3 lists it as P0.

**Decision:** Do NOT add React Router in Sprint 2. Add React Router v6 in Sprint 3 as planned. In Sprint 2, the `screen` state pattern is retained unchanged. The `availableMonths` hardcoded array is replaced with a React Query hook fetching from Supabase `monthly_reports`, but the navigation structure does not change.

**Rationale:** Adding React Router during the Supabase wiring sprint introduces two simultaneous refactors, doubles debugging surface, and provides zero business value in Sprint 2. The investor sharing use case (deep-linkable URLs) is a Sprint 3 requirement. The cost of deferring: no deep links for 2 more weeks. The cost of adding it now: potentially breaking the working navigation while simultaneously debugging Supabase connectivity.

**Consequences for Sprint 3:** When React Router v6 is added, the full route map is:

```
/                           → Redirect to /home
/home                       → HomePage (tile menu)
/dashboard                  → Redirect to /dashboard/latest/snapshot
/dashboard/:month/:tab      → DashboardPage with month + tab params
/wizard                     → WizardPage (protected: owner/bookkeeper only)
/wizard/:month              → WizardPage for specific month (edit mode)
/settings                   → SettingsPage (protected: owner only)
/settings/:section          → SettingsPage with section param (thresholds/users/bin-types/branding)
/investor                   → InvestorView (simplified, viewer role)
*                           → 404 redirect to /home
```

The `vercel.json` rewrite `"source": "/(.*)", "destination": "/index.html"` already handles SPA routing correctly — no Vercel config change is needed when React Router is added.

---

### ADR-003: Mobile Architecture

**Status:** Accepted

**Context:** The PRD confirms PWA (not React Native) as the mobile strategy. Mark uses phone 60% of the time; Jake is 70% mobile. The current app has no responsive breakpoints — it renders a fixed-width desktop layout at all screen sizes. The 11-tab layout is the biggest mobile challenge.

**Decision:** Fully responsive CSS with PWA capabilities (manifest + service worker). Use Tailwind CSS for responsive variants — BUT only for layout/spacing via utility classes added to wrapper divs, not for replacing the existing inline style design tokens. The existing `src/theme.js` tokens remain the single source of truth for colours and typography. Tailwind is added exclusively for responsive layout (`hidden md:block`, `grid-cols-1 md:grid-cols-4`).

**Rationale reconsidered from PRD guidance:** The PRD says "Tailwind would require full refactor". This is only true if Tailwind replaces the inline styles. A hybrid approach — Tailwind for responsive layout, inline styles for design tokens — avoids a full refactor while solving the mobile problem cleanly. The alternative (adding responsive logic to every inline style object) produces code like `style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)' }}` repeated 60+ times, which is harder to maintain than Tailwind utilities. The Tailwind install takes 5 minutes; the responsive classes take the same effort either way.

**Revised Decision if team resists Tailwind:** Use a `useBreakpoint()` custom hook returning `{ isMobile, isTablet, isDesktop }` based on `window.innerWidth` with a ResizeObserver. Pass this as a prop or via context to components that need it. This is less elegant but avoids adding a dependency. Given the 1-developer/AI team, Tailwind is recommended.

**Mobile navigation pattern:** Bottom tab bar for screens below 768px. The bar contains 5 items: Home, Dashboard, Alerts (badge count), Work Plan, Chat. The existing hamburger menu is hidden on mobile. The bottom bar is a new `src/components/MobileNav.jsx` component fixed to the viewport bottom.

**Breakpoints (matching PRD spec):**
```
default (mobile-first): 0–639px
sm:  640px+   (large phone)
md:  768px+   (tablet — breakpoint for bottom nav vs hamburger)
lg:  1024px+  (desktop)
xl:  1280px+  (wide desktop)
```

**Tabs requiring redesign for mobile:**

| Tab | Mobile treatment |
|-----|----------------|
| Snapshot | Stack 4 KPI tiles to 2x2; charts go full-width stacked |
| Revenue | Single chart, swipeable horizontal scroll |
| Margins | Single chart, swipeable |
| Benchmarking | Card list per bin type (collapse the dense table) |
| Competitors | Read-only horizontal scroll; edit disabled on mobile |
| BDM | Card list |
| Fleet | Card list |
| Debtors | Top 5 debtor cards + aging donut chart; full table hidden |
| Cash Flow | KPI stack + simplified chart |
| Risk/EPA | Traffic light cards — works well at mobile width already |
| Work Plan | Card list with large (48px) checkbox touch target |

**PWA implementation:**
- `public/manifest.json`: created in Sprint 3
- `vite-plugin-pwa` (Workbox): preferred over manual service worker — handles asset caching, update prompts, and offline fallback automatically
- Install: `vite-plugin-pwa`
- Icons required: `public/icon-192.png`, `public/icon-512.png` (generate from logo.jpg)
- The existing `public/logo.jpg` is the source; generate WebP versions

**Offline cache scope:**
- Cache-first: app shell (HTML, JS, CSS, fonts)
- Stale-while-revalidate: all Supabase data (served from React Query cache via `@tanstack/query-sync-storage-persister`)
- Background sync: work plan completions queued when offline (using Workbox BackgroundSync)
- Online-only: Wizard file upload steps (disable with clear message)

---

### ADR-004: AI Assistant Security

**Status:** Accepted — BLOCKING (must be fixed in Sprint 2, not Sprint 3)

**Context:** `App.jsx` lines 115–119 call `https://api.anthropic.com/v1/messages` directly from the browser. The `ANTHROPIC_API_KEY` is passed as a request header. This means anyone opening DevTools → Network tab can read the API key in plaintext. This is a live production security incident, not a future risk.

**Decision:** Create a Vercel Edge Function at `api/chat.js`. Move the Anthropic API call there. The `ANTHROPIC_API_KEY` is set only as a Vercel server-side environment variable (NOT prefixed with `VITE_`). The client sends a `POST` to `/api/chat` with the message history and selected month. The Edge Function fetches live context from Supabase using the `SUPABASE_SERVICE_ROLE_KEY` (server-side only), builds the system prompt, and streams the response back.

**Why Edge Function over Serverless Function:** Edge Functions run closer to the user, have lower cold-start latency (important for streaming), and support the Web Streams API natively. The Anthropic SDK's `stream.toReadableStream()` works directly in Edge runtime. Serverless Functions also work but have higher latency and a 10-second default timeout that can be hit during long AI responses.

**Why not Supabase Edge Function:** The app is already on Vercel; adding a Supabase Edge Function introduces a second serverless provider to manage. Vercel Edge Functions are already in scope (the `vercel.json` is configured). Keep the server-side logic in one place.

**File location:** `api/chat.js` (Vercel Edge Function, detected by Vercel automatically)

**Request format (client → Edge Function):**
```json
{
  "messages": [{"role": "user", "content": "What's my biggest risk?"}],
  "reportMonth": "2026-02-01",
  "userId": "uuid-from-auth-session"
}
```

**Response format:** Server-Sent Events (SSE) streaming. The client reads the stream using `response.body.getReader()` and appends delta text to the chat message as it arrives.

**System prompt construction:** Server-side in the Edge Function, using `SUPABASE_SERVICE_ROLE_KEY` to fetch:
- `financials_monthly` for the selected month and YTD range
- `balance_sheet_monthly` for the latest month
- `debtors_monthly` for the selected month (top 5 by outstanding)
- `alerts_log` for critical and warning alerts for the selected report
- `bin_type_performance` for net_margin_pct < 0 rows

**Streaming client code pattern:**
```javascript
const response = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({messages, reportMonth, userId}) })
const reader = response.body.getReader()
const decoder = new TextDecoder()
let buffer = ''
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buffer += decoder.decode(value, { stream: true })
  // parse SSE events from buffer, extract text deltas, update chatMsgs state
}
```

**Environment variables required (add to Vercel before Sprint 2 starts):**
- `ANTHROPIC_API_KEY` — server-side only, not VITE_ prefixed
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, not VITE_ prefixed

**Rate limiting:** Implement in the Edge Function: check `ai_chat_sessions` message count per user per day before calling Anthropic. Return HTTP 429 with a friendly message if exceeded.

---

### ADR-005: Data Layer Architecture

**Status:** Accepted

**Context:** `src/api/*.js` files are fully written (reports.js, workplan.js, alerts.js, competitors.js) but never called. The dashboard reads exclusively from `src/data/financials.js` (hardcoded arrays). The migration challenge is switching all 11 tabs from hardcoded data to live Supabase data without breaking the dashboard mid-sprint.

**Decision:** Implement a "parallel data bridge" pattern. Keep `src/data/financials.js` intact as the fallback/seed data. Add a `useLiveData` flag (React Query's `enabled` prop) that is `true` when a Supabase month record exists and `false` when falling back to hardcoded data. Tabs always call the React Query hooks — those hooks decide whether to return live data or shimmed seed data based on `isSuccess` from the query.

**Migration sequence (order matters):**

1. Write `src/hooks/useAvailableMonths.js` — replaces the hardcoded `availableMonths` array in App.jsx. This is the first wire to make because it affects the month selector dropdown and is completely self-contained.

2. Wire `src/hooks/useFinancials.js` to the Snapshot tab only. Snapshot is the simplest tab (4 KPI tiles + 2 charts). Validate that data flows correctly from Supabase → hook → component props.

3. Seed historical data (Jul 2025–Feb 2026) into Supabase using migration 004 or a seed script. This is required before step 4.

4. Wire remaining tabs one at a time, in order of dependency:
   - Revenue tab (uses same financials data as Snapshot — trivially easy after step 2)
   - Margins tab (same financials data)
   - Cash Flow tab (balance_sheet_monthly + financials_monthly — both already in reports.js)
   - Debtors tab (debtors_monthly)
   - Benchmarking/Pricing tab (bin_type_performance — but the cost allocator `src/data/costAllocator.js` needs refactoring since it currently reads from hardcoded arrays; defer this or use stored net_margin_pct from Supabase)
   - Work Plan tab (work_plan_items + completions via workplan.js)
   - Competitors tab (competitor_rates via competitors.js)
   - BDM tab (customer_acquisitions)
   - Fleet tab (bin_type_performance — same as Benchmarking)
   - Risk/EPA tab (compliance_records)

5. Wire the Wizard to write to Supabase on completion. This is the last step, not the first, because it is the most complex (6+ writes, transaction safety required).

**Transition without breakage:** During the wire-up period, tabs that are not yet wired continue to read from `financials.js` — they simply don't call any hooks yet. This is the existing behaviour. Each tab is independently and safely switchable.

**The `src/data/financials.js` retirement plan:** After all tabs are wired and seeded data is validated, `financials.js` is marked as `// SEED DATA ONLY — not used by UI components`. It is not deleted — it serves as the source of truth for the data seed migration and for the `importLegacyData` function in `dataStore.js`.

**Wizard transaction safety (OQ-01 resolved):** Use a Supabase RPC call to a PostgreSQL function for the final wizard submission. The function writes `monthly_reports`, `financials_monthly`, `balance_sheet_monthly`, `debtors_monthly`, `bin_type_performance`, `customer_acquisitions`, `compliance_records` in a single database transaction. Write migration 004 to create this function. If the network call to `rpc('submit_monthly_report', payload)` fails, nothing is written (full rollback). The Wizard component calls this single RPC instead of calling 7 separate `upsert` functions.

**Column mapping issue identified:** `src/data/financials.js` stores `wages` in the opex arrays, but the schema stores it as `cos_wages` (it is COS in Xero, not Opex). The `analysisEngine.js` reads wages from both the opex allocation and separately — this mismatch must be resolved in migration 004 by confirming with Sarah whether wages appear in COS or Opex in the Xero P&L export structure, then normalising all data to match.

---

### ADR-006: Component Architecture

**Status:** Accepted — Extract BEFORE wiring to Supabase

**Context:** `App.jsx` is approximately 800 lines. It contains the `Dashboard` function component inline, which itself contains all 11 tab render blocks (`{dashTab === 'snapshot' && <div>...`). The `WorkPlanTab` sub-component is also inline. `PricingTab.jsx`, `CompetitorPage.jsx`, `Wizard.jsx`, and `LoginPage.jsx` are already extracted. The chat panel (`sendChat`, chat state, chat UI) is inline in App.jsx.

**Decision:** Extract each tab into its own file FIRST, before wiring any tab to Supabase. The sequence:

**Phase A: Extract (do this before any Supabase wiring):**
```
src/components/tabs/SnapshotTab.jsx
src/components/tabs/RevenueTab.jsx
src/components/tabs/MarginsTab.jsx
src/components/tabs/BenchmarkingTab.jsx      (was PricingTab.jsx — rename)
src/components/tabs/CompetitorsTab.jsx        (was CompetitorPage.jsx — move to tabs/)
src/components/tabs/BDMTab.jsx
src/components/tabs/FleetTab.jsx
src/components/tabs/DebtorsTab.jsx
src/components/tabs/CashFlowTab.jsx
src/components/tabs/RiskEPATab.jsx
src/components/tabs/WorkPlanTab.jsx
src/components/ChatPanel.jsx                  (extract from App.jsx)
src/components/MobileNav.jsx                  (new — Sprint 3)
src/components/AlertBadge.jsx                 (new — Sprint 3)
```

**Phase B: Wire each tab to Supabase using React Query hooks (one tab at a time).**

**Rationale:** Extracting first gives each tab a clean component boundary. When wiring to Supabase, each tab's props interface becomes explicit. If something breaks, it is isolated to one file. When wiring is done after extraction, the `App.jsx` Dashboard component simply `import`s each tab and passes the `selectedMonth` prop and the query results. The current inline pattern would require refactoring and wiring simultaneously — two operations, double the risk.

**App.jsx after extraction:** Should be under 200 lines. It handles: auth gate, screen state, month selector state, and renders `<Header />`, `<MobileNav />`, and the current screen component. The `Dashboard` function becomes a simple router that renders the active tab component.

**Props contract for each tab:**
Each tab receives `selectedMonth` (ISO date string `"2026-02-01"`) and `monthCount` (number of months since FY start). Each tab internally uses React Query hooks to fetch its own data. Tabs do NOT receive data as props from a parent data-fetcher — this avoids prop drilling and keeps each tab self-contained.

**Rationale for tab-level data fetching vs page-level:** With React Query caching, if two tabs request the same query key, the second request is served from cache instantly. There is no performance penalty for each tab fetching independently. The benefit is that tab components are portable and testable in isolation.

---

### ADR-007: CSS Strategy

**Status:** Accepted — Keep inline CSS as primary; add Tailwind for responsive layout utilities only

**Context:** 100% inline styles using `src/theme.js` tokens. The pattern is consistent throughout the codebase. All colour, typography, spacing, and border decisions are made via inline style objects referencing `B.yellow`, `B.cardBg`, `fontHead`, etc.

**Decision:** Keep the inline CSS pattern for all design token usage (colours, typography, shadows, borders). Add Tailwind CSS v3 for responsive layout utilities only (`grid-cols-1`, `md:grid-cols-4`, `hidden`, `block`, `flex`, `gap-*` equivalents used only for breakpoint-conditional layout). This is a surgical addition, not a refactor.

**Rationale:** The team has documented concern about a full Tailwind migration requiring a full refactor. This concern is valid. However, solving mobile without some form of responsive CSS requires either Tailwind utilities or a `useBreakpoint()` hook injecting inline style logic everywhere. The hook approach spreads breakpoint logic across 11 tab files and 50+ components. Tailwind utilities, used only for layout, solve this with 2 class names per element instead of conditional inline logic. The constraint: Tailwind classes MUST NOT be used for colours, typography, or any value already in `theme.js`. This is enforced by convention, documented in the ADR.

**If the team decides against Tailwind:** Implement `src/hooks/useBreakpoint.js`:
```javascript
export function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return { isMobile: width < 768, isTablet: width >= 768 && width < 1024, isDesktop: width >= 1024 }
}
```
This hook is used in each tab component to conditionally select between mobile and desktop layouts. It is less elegant but requires no new dependencies.

**Final call:** Given the one-developer/AI team, Tailwind for layout is recommended. The `npm install` is one command; the configuration is 10 lines in `tailwind.config.js`. The benefit in Sprint 3 is substantial.

---

### ADR-008: TypeScript Migration

**Status:** Rejected for current phase

**Context:** Pure JavaScript codebase. Vite + React 18 support TypeScript natively. Supabase can generate TypeScript types from the database schema using `supabase gen types typescript`.

**Decision:** Do NOT migrate to TypeScript during Sprints 2–4. Revisit as a Sprint 6 or post-Sprint 6 decision.

**Rationale:** The cost/benefit calculation for this specific project:
- **Cost:** Every `.js` file becomes `.tsx`. Every API function needs return type annotations. The `src/data/financials.js` arrays need typed interfaces. The analysis engine needs typed inputs. Estimated refactor time: 1–2 full sprint days for a TypeScript novice working with AI assistance. Zero user-facing value delivered.
- **Benefit for a 1-developer AI-assisted team:** Moderate. TypeScript catches certain bugs at compile time that Claude would catch during code review anyway. The AI assistant (`claude-sonnet-4-6`) is highly effective at JavaScript and does not need TypeScript to produce correct code.
- **The real benefit is for the API layer:** `supabase gen types typescript` would produce exact types for all 16 tables, preventing column name typos. This is genuinely useful.
- **Compromise:** Add JSDoc `@typedef` comments to the critical API files (`src/api/reports.js`, `src/api/workplan.js`) documenting the expected return shapes. This gives IDE autocomplete hints without requiring a TypeScript compilation step.

**Revisit trigger:** If the team grows to 2+ developers, or if a significant proportion of bugs traced in production are type errors, migrate then. The Vite + React setup makes the migration straightforward when the time comes.

---

### ADR-009: Testing Strategy

**Status:** Accepted — Minimum viable test suite targeting 3 highest-risk areas

**Context:** No tests exist. The project has Playwright MCP available for E2E testing via Claude. The CI pipeline runs only `npm run build` (compile check).

**Decision:** Do not add unit tests in Sprint 2. Add E2E tests in Sprint 3 using Playwright. The minimum viable test suite covers the 3 highest-risk user flows:

**Priority 1 (Sprint 3):** Wizard submission end-to-end
- Reason: The wizard writes to 6+ Supabase tables. A silent parse failure or transaction error could result in corrupt or missing data that Mark and Sarah would not notice until a month-end review. This is the highest-risk code path.
- Test: Upload sample Xero Excel files (store in `/tests/fixtures/`), complete all 12 steps, submit, verify data appears correctly on the Snapshot tab for that month.

**Priority 2 (Sprint 3):** Authentication and role enforcement
- Reason: RLS misconfiguration is listed as Risk 1 in the PRD. An E2E test logging in as each role and attempting forbidden actions is the most practical way to verify RLS.
- Tests: Viewer role attempts to access Settings → verify 403 or redirect. Bookkeeper attempts to create a work plan item → verify the UI blocks it. Manager attempts to submit wizard → verify the UI blocks it.

**Priority 3 (Sprint 4):** Work plan real-time sync
- Reason: The work plan completion state is shared between Jake and Mark. A bug where one user's completion is not visible to the other is a usability failure that would undermine trust in the tool.
- Test: Two browser contexts (two users logged in simultaneously), one marks an item complete, verify the other sees the update within 2 seconds (Supabase Realtime subscription).

**Unit tests:** Add Jest + Testing Library only for `src/data/analysisEngine.js` and `src/data/fileParser.js`. These are pure functions (or near-pure) with complex logic — the COS anomaly detection, fuel anomaly, AR overdue calculation, and all Xero Excel parsing logic. A breaking change in these functions produces wrong alerts and wrong data silently.

**CI additions (add to `.github/workflows/ci.yml`):**
- `npm run test` (unit tests on Jest) — runs on every push
- `npx playwright test` (E2E, Sprint 3+) — runs on push to `develop` and `main`

---

### ADR-010: Database Migration Strategy

**Status:** Accepted — Write migration 004 BEFORE Sprint 2 build begins

**Context:** Three migration files exist and have been applied to Supabase (`001_initial_schema.sql`, `002_rls_policies.sql`, `003_default_thresholds.sql`). The PRD section 7.3 documents a "target schema" that differs from what is in the migration files in 7 ways. The current deployed schema (from 001) is incomplete relative to the target.

**Gaps identified by comparing 001 schema vs PRD target schema:**

1. `profiles` table: Missing `is_active boolean`, `avatar_url text`, `phone text` columns (present in PRD target, absent in 001)
2. `financials_monthly`: Missing `opex_depreciation numeric(12,2)`, `cash_income numeric(12,2)`, `cash_expenses numeric(12,2)`, `cash_net_movement numeric(12,2)` columns
3. `balance_sheet_monthly`: Missing `non_current_assets`, `ato_clearing`, `superannuation_payable`, `director_loans`, `retained_earnings`, `current_year_earnings` columns
4. `debtors_monthly`: Missing `customer_type text`, `older_bucket numeric(12,2)` columns
5. `customer_acquisitions`: Missing `customer_type text`, `first_job_date date`, `revenue_in_month numeric(12,2)` columns
6. `competitor_rates`: Missing `competitor_source text`, `rate_type text` columns
7. `compliance_records`: Significant additions — `whs_incident_details`, `whs_near_miss`, `whs_near_miss_details`, `whs_last_toolbox_talk`, `asbestos_clearance_certs`, `asbestos_complaints`, `asbestos_complaint_details`, `epa_renewal_status`, `vehicles_off_road`, `vehicles_off_road_reason`, `vehicle_rego_dates`, `fleet_inspections_current`, `public_liability_current`, `public_liability_expiry`, `workers_comp_current`, `workers_comp_expiry` columns
8. `alerts_log`: Missing `acknowledge_notes text`, `is_suppressed boolean` columns
9. `file_uploads`: Missing `parsed_rows integer` column
10. `ai_chat_sessions`: Missing `message_count integer` column
11. `alert_thresholds`: Missing `unit text` column
12. `work_plan_items`: Missing `source_alert_id uuid`, `created_by uuid` columns

**New tables required for Sprint 4 (not yet in migrations):** `bin_types`, `fleet_assets`, `fleet_maintenance_records`, `disposal_receipts`, `push_subscriptions`, `notification_log`

**Decision:** Write `004_schema_additions.sql` immediately, before any Sprint 2 code is written. Apply it to Supabase before the first tab is wired. Writing UI code against the 001 schema and then discovering a missing column mid-sprint is a debugging tax that is entirely preventable.

**Migration 004 contents:**
- All column additions listed above (via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
- The `submit_monthly_report` PostgreSQL function for atomic wizard submission (resolves OQ-01)
- Additional RLS policies for new columns (where needed)
- Indexes on the new columns that will be queried

**Migration 005 (Sprint 4, when Fleet module begins):**
- `bin_types` table
- `fleet_assets` table
- `fleet_maintenance_records` table
- `disposal_receipts` table
- RLS policies for all of the above

**Migration 006 (Sprint 6, when Push Notifications begin):**
- `push_subscriptions` table
- `notification_log` table

**Historical data seed:** Write `004b_seed_historical_data.sql` (or a separate seed script) that inserts the Jul 2025–Feb 2026 data from `src/data/financials.js` into `monthly_reports`, `financials_monthly`, `balance_sheet_monthly`, `debtors_monthly`, `bin_type_performance`. This script runs once against the production Supabase database. The `importLegacyData()` function in `dataStore.js` is the reference implementation for field mapping.

**Blocking Sprint 2 items (must be done before first UI wire):**
- Migration 004 applied to Supabase
- Historical seed data inserted
- `.env.local` configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Vercel environment variables set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### ADR-011: Offline/PWA Strategy

**Status:** Accepted — Tiered offline capability, not full offline-first

**Context:** Mark wants to check KPIs on his phone in the yard (possibly no signal). Jake needs to log compliance records from tip sites with no mobile coverage. Full offline (writing new data while offline) is significantly more complex than read-only offline.

**Decision:** Two-tier offline strategy:

**Tier 1 (Sprint 3 — implement):** Read-only offline via React Query cache + Workbox
- React Query cache persisted to IndexedDB using `@tanstack/query-persist-client-core` and `@tanstack/query-sync-storage-persister`
- Workbox caches app shell (all static assets) with cache-first strategy
- When offline: the app loads from cache, React Query serves stale data with a visible "Offline — showing data from [date]" banner
- User cannot submit new data, run wizard, or use AI chat while offline
- This covers 100% of Mark's morning briefing use case

**Tier 2 (Sprint 4 — implement for Jake's use case):** Offline work plan completions
- Jake marks a work plan item complete in the field (no signal)
- The completion is queued in `localStorage` with a "pending" flag
- When connectivity returns, a background sync (Workbox BackgroundSync) or a `useEffect` on focus fires the Supabase insert
- If the item was already marked complete by someone else while Jake was offline: the completion upsert succeeds (the UNIQUE constraint on `item_id` means it's idempotent)
- Display a "pending sync" indicator on items queued for upload

**NOT in scope:** Full offline wizard submission (file parsing requires memory, Supabase Storage upload requires connectivity), offline competitor rate editing, offline AI chat.

**Manifest configuration:** `public/manifest.json` with:
- `start_url`: `/dashboard`
- `display`: `standalone`
- `background_color`: `#000000`
- `theme_color`: `#F5C518` (note: this is the brand yellow used in LoginPage, not the `#7B8FD4` blue renamed to `yellow` in `theme.js` — verify with client which is the correct brand colour. The `LoginPage.jsx` hardcodes `#F5C518`; `theme.js` uses `#7B8FD4`. These differ. The LoginPage appears to be the original brand colour; the theme.js value may be a design evolution. Use `#F5C518` for the PWA manifest.)

---

### ADR-012: Multi-tenancy Future-proofing

**Status:** Accepted — Minimal changes now, major changes deferred

**Context:** The PRD lists multi-tenant SaaS as a "Won't Have" for Sprint 3–6 but mentions it as a future possibility. The current schema is explicitly single-organisation.

**Decision:** Add one column to `profiles` table now: `organisation_id uuid` (nullable, defaults to `null`, representing the single-org model). Do not add it to any other table yet. Document in schema comments that `organisation_id IS NULL` means "Binned-IT default organisation".

**Rationale:** The cost of this change is one `ALTER TABLE` in migration 004. The cost of NOT doing it and then needing to add it later is: adding `organisation_id` to every data table, rewriting every RLS policy to include `organisation_id = auth.jwt() ->> 'organisation_id'`, and migrating all existing data rows. The `profiles.organisation_id` column costs nothing now and saves a week of work if multi-tenancy is ever activated.

**What NOT to change now:** Do not add `organisation_id` to `monthly_reports`, `financials_monthly`, or any other data table. The single-organisation RLS model (all authenticated users share one dataset) works perfectly for the current use case. Adding the column to every table now would require updating all RLS policies, all API functions, and all query hooks — a net negative for current development velocity.

**The future migration path:** When adding a second organisation, migration NNN adds `organisation_id` to all data tables with `DEFAULT` pointing to the "Binned-IT" organisation row, then rewrite RLS policies. The transition is mechanical but contained.

---

### ADR-013: Real-time Requirements

**Status:** Accepted — Supabase Realtime for work plan only; polling for everything else

**Context:** The PRD (section 7.7) identifies three tables as candidates for real-time: `work_plan_completions`, `alerts_log`, `competitor_rates`. OQ-05 asks whether real-time is worth the complexity.

**Decision:** Enable Supabase Realtime for `work_plan_completions` only. Use React Query's `refetchInterval` (30-second polling) for `alerts_log`. Use manual refetch (only on mutation) for `competitor_rates`.

**Rationale per table:**

`work_plan_completions`: MUST be real-time. The core UX promise is that Jake marking an item complete is visible to Mark immediately. Polling every 30 seconds is not acceptable for a collaborative checklist. The Supabase Realtime subscription pattern shown in the PRD (section 7.7) is correct: subscribe to `postgres_changes` on `work_plan_completions`, call `queryClient.invalidateQueries(['workplan'])` on any event. This is ~10 lines of code.

`alerts_log`: Does NOT need real-time. Alerts are generated when a wizard is submitted (monthly event). A 30-second poll is adequate — if a new alert arrives while the dashboard is open, it appears within 30 seconds. The WebSocket overhead of a permanent subscription for an event that happens once a month is not justified.

`competitor_rates`: Does NOT need real-time. Only Owner and Manager can edit. The user base is small enough that simultaneous editing is extremely unlikely. If it happens, the last-write-wins behaviour of the `upsert` is acceptable. Add an optimistic update pattern in the React Query mutation (update local cache immediately, reconcile with server on next refetch) to give instant UI feedback without a WebSocket.

**Supabase Realtime subscription setup** (in `src/hooks/useWorkPlan.js`):
```javascript
useEffect(() => {
  const channel = supabase
    .channel('work-plan-completions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_plan_completions' },
      () => queryClient.invalidateQueries({ queryKey: ['workplan'] }))
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [queryClient])
```

**Note:** Supabase Realtime must be enabled in the Supabase dashboard for the `work_plan_completions` table. This is a dashboard toggle — not a code change.

---

### ADR-014: File Upload Architecture

**Status:** Accepted

**Context:** The wizard uploads Xero Excel files. The PRD mentions Supabase Storage. The current `Wizard.jsx` parses files client-side using SheetJS and stores parsed data in component state — there is no upload to any server yet.

**Decision:**

**Parsing:** Keep client-side (SheetJS). This is already working correctly in `src/data/fileParser.js` and `Wizard.jsx`. PDF parsing (for Westpac bank statements, Sprint 6) is deferred — it requires either pdf.js (client-side, complex) or a server-side PDF-to-text function. PDF parsing is NOT in scope for Sprint 2 or 3.

**File storage:** Upload raw Xero Excel files to Supabase Storage AFTER client-side parsing. The upload is not blocking — it is an audit trail. The parsed data is what matters for the dashboard; the raw file is stored for retrospective re-parsing if the parser changes.

**Bucket structure:**
```
supabase-storage://reports/
  {report_month}/           e.g. 2026-02/
    pl_monthly.xlsx
    cash_summary.xlsx
    aged_ar.xlsx
    balance_sheet.xlsx
    bin_manager.xlsx
    bank_statement.pdf       (Sprint 6 only)
```

**File naming convention:** `{file_type}.{extension}` — always the same name per type per month. This means re-submitting overwrites the previous file (intended — the most recent parse is canonical).

**Storage bucket RLS:** Private bucket (not public). Access requires authenticated JWT. RLS policy: authenticated users with role `owner` or `bookkeeper` can upload; all authenticated users can read their organisation's files. This matches the `file_uploads` table RLS policies already written in migration 002.

**File size limits:** 10MB per file. Xero Excel exports are typically 50–500KB. A 10MB limit provides extreme headroom. Set at the Supabase Storage level via bucket configuration.

**After upload:** The raw file is kept permanently (not deleted after parsing). Storage use is negligible — 5 files × 500KB × 12 months = 30MB per year. At Supabase pricing, this is essentially free.

**What happens if upload fails:** The wizard has already parsed the data and can submit to Supabase PostgreSQL regardless. The file upload failure is logged to `file_uploads.parse_status = 'failed'` and a non-blocking toast notification is shown. The financial data is not lost.

**Client-side PDF parsing viability:** Not viable for Westpac statements in Sprint 2–4. PDF structure varies by bank. pdf.js can extract text but bank statement parsing requires regex heuristics that will break on format changes. Decision: Westpac PDF is a Sprint 6 feature, implemented as a Vercel Serverless Function using `pdfjs-dist` server-side. In the meantime, Mark manually enters the bank balance confirmation in wizard step 7 (already implemented).

---

### ADR-015: Sprint Sequencing Validation

**Status:** Revised — Sprint 2 split into 2A and 2B; AI security moved earlier

**Context:** The PRD Sprint 2 plan attempts to wire all data, the wizard, work plan, competitors, and compliance in a single sprint. This is achievable but the API key exposure issue makes a specific task ordering important.

**Revised Sprint Execution Plan:**

**Sprint 2A (Week 1) — Security + Schema + Foundation:**
1. Create `api/chat.js` Vercel Edge Function (AI key security — MUST be day 1)
2. Write and apply `004_schema_additions.sql` to Supabase
3. Insert seed historical data into Supabase (Jul 2025–Feb 2026)
4. Extract all 11 tab components to individual files (component extraction)
5. Install and configure TanStack Query
6. Wire `useAvailableMonths` hook — replace hardcoded `availableMonths` array
7. Wire Snapshot tab to Supabase (first data wire validation)

**Sprint 2B (Week 2) — Full Data Wiring:**
1. Wire Revenue, Margins, Cash Flow tabs (all use `financials_monthly` — trivial after Snapshot)
2. Wire Debtors tab (`debtors_monthly`)
3. Wire Work Plan tab + Supabase Realtime subscription
4. Wire Competitors tab (read from `competitor_rates`)
5. Wire BDM tab (`customer_acquisitions`)
6. Wire Fleet + Benchmarking tabs (`bin_type_performance`)
7. Wire Risk/EPA tab (`compliance_records`)
8. Wire Wizard → Supabase write (last, most complex — use `submit_monthly_report` RPC)
9. Wire Wizard → Supabase Storage file upload (bonus if time permits)

**Sprint 3 — Mobile + React Router + PWA:**
- As per PRD, no changes to scope
- Add Tailwind (layout utilities only)
- React Router v6
- `MobileNav.jsx` bottom bar
- PWA manifest + vite-plugin-pwa
- React Query cache persister (offline Tier 1)

**Sprint 4 — Operations Module:**
- As per PRD, no changes to scope
- Apply migration 005 (fleet tables) at sprint start
- Jake's compliance logging from mobile
- Offline work plan completions (Tier 2)

**Sprint 5 — AI Enhancement + PDF + Settings:**
- As per PRD
- AI streaming is already set up by Sprint 2A's edge function; Sprint 5 adds chat history, suggested questions, rate limiting
- Settings UI for thresholds and user management
- PDF export (client-side react-to-print)

**Sprint 6 — Push Notifications + Polish:**
- As per PRD
- Apply migration 006 (push subscription tables)
- Westpac PDF parser (serverless function)
- Sentry integration

**Critical path analysis:**

The critical path is: `Schema migration 004` → `Historical seed data` → `Snapshot tab wire` → `Wizard Supabase write`. Everything else can proceed in parallel once the schema is deployed.

**Quick wins to move earlier (from later sprints):**
- `AlertBadge.jsx` (Sprint 3 component) can be created as an empty shell in Sprint 2A — takes 30 minutes and unblocks Sprint 3 badge implementation
- The `api/chat.js` Edge Function is a Sprint 3 P0 item moved to Sprint 2A day 1 (resolves live security incident)
- `ChatPanel.jsx` extraction (Sprint 3) can happen during Sprint 2A component extraction with zero extra cost

**Mobile should stay in Sprint 3, not Sprint 4:** The PRD correctly places mobile in Sprint 3. Moving it to Sprint 4 (after operations) would delay Mark's primary use case (morning phone check) by two more weeks. Jake's operational needs are important but Mark's mobile use is the product's primary value proposition.

---

## Target File Structure

```
binnedit-hub v2.2/
├── api/
│   ├── chat.js                    ← Vercel Edge Function (AI proxy) [CREATE SPRINT 2A]
│   └── push-send.js               ← Vercel Edge Function (Web Push) [CREATE SPRINT 6]
├── public/
│   ├── logo.jpg                   ← Existing
│   ├── manifest.json              ← PWA manifest [CREATE SPRINT 3]
│   ├── icon-192.png               ← PWA icon [CREATE SPRINT 3]
│   ├── icon-512.png               ← PWA icon [CREATE SPRINT 3]
│   └── sw.js                      ← Generated by vite-plugin-pwa [SPRINT 3]
├── src/
│   ├── api/
│   │   ├── reports.js             ← Existing (no changes needed)
│   │   ├── workplan.js            ← Existing (no changes needed)
│   │   ├── alerts.js              ← Existing (no changes needed)
│   │   ├── competitors.js         ← Existing (no changes needed)
│   │   ├── fleet.js               ← New [SPRINT 4]
│   │   ├── compliance.js          ← New disposal receipts [SPRINT 4]
│   │   ├── settings.js            ← New thresholds/users/bin-types [SPRINT 5]
│   │   └── push.js                ← New push subscriptions [SPRINT 6]
│   ├── components/
│   │   ├── UIComponents.jsx       ← Existing (no changes)
│   │   ├── LoginPage.jsx          ← Existing (no changes)
│   │   ├── ChatPanel.jsx          ← Extract from App.jsx [SPRINT 2A]
│   │   ├── MobileNav.jsx          ← New bottom tab bar [SPRINT 3]
│   │   ├── AlertBadge.jsx         ← New alert count badge [SPRINT 3]
│   │   ├── OfflineBanner.jsx      ← New offline indicator [SPRINT 3]
│   │   ├── Wizard.jsx             ← Existing (add Supabase write in 2B)
│   │   └── tabs/
│   │       ├── SnapshotTab.jsx    ← Extract from App.jsx [SPRINT 2A]
│   │       ├── RevenueTab.jsx     ← Extract from App.jsx [SPRINT 2A]
│   │       ├── MarginsTab.jsx     ← Extract from App.jsx [SPRINT 2A]
│   │       ├── BenchmarkingTab.jsx← Rename from PricingTab.jsx [SPRINT 2A]
│   │       ├── CompetitorsTab.jsx ← Move from CompetitorPage.jsx [SPRINT 2A]
│   │       ├── BDMTab.jsx         ← Extract from App.jsx [SPRINT 2A]
│   │       ├── FleetTab.jsx       ← Extract from App.jsx [SPRINT 2A]
│   │       ├── DebtorsTab.jsx     ← Extract from App.jsx [SPRINT 2A]
│   │       ├── CashFlowTab.jsx    ← Extract from App.jsx [SPRINT 2A]
│   │       ├── RiskEPATab.jsx     ← Extract from App.jsx [SPRINT 2A]
│   │       └── WorkPlanTab.jsx    ← Extract from App.jsx [SPRINT 2A]
│   ├── context/
│   │   └── AuthContext.jsx        ← Existing (no changes needed)
│   ├── data/
│   │   ├── financials.js          ← Existing (seed data only after migration)
│   │   ├── analysisEngine.js      ← Existing (refactor for live data SPRINT 2B)
│   │   ├── dataStore.js           ← Existing (retain as offline cache layer)
│   │   ├── workplan.js            ← Existing (deprecated after seed; keep as reference)
│   │   ├── wizardSteps.js         ← Existing (no changes)
│   │   ├── fileParser.js          ← Existing (no changes)
│   │   └── costAllocator.js       ← Existing (refactor for live data SPRINT 2B)
│   ├── hooks/
│   │   ├── useMonthData.js        ← New React Query hooks [SPRINT 2A]
│   │   ├── useWorkPlan.js         ← New + Realtime subscription [SPRINT 2B]
│   │   ├── useAlerts.js           ← New [SPRINT 2B]
│   │   ├── useCompetitors.js      ← New [SPRINT 2B]
│   │   └── useBreakpoint.js       ← New (if Tailwind rejected) [SPRINT 3]
│   ├── lib/
│   │   └── supabase.js            ← Existing (no changes needed)
│   ├── pages/                     ← New directory [SPRINT 3 with React Router]
│   │   ├── HomePage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── WizardPage.jsx
│   │   ├── SettingsPage.jsx
│   │   └── InvestorView.jsx
│   ├── App.jsx                    ← Refactor (extract tabs, slim to <200 lines)
│   ├── main.jsx                   ← Add QueryClientProvider [SPRINT 2A]
│   └── theme.js                   ← Existing (no changes needed)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  ← Existing (deployed)
│       ├── 002_rls_policies.sql    ← Existing (deployed)
│       ├── 003_default_thresholds.sql ← Existing (deployed)
│       ├── 004_schema_additions.sql   ← CREATE NOW [BLOCKING]
│       ├── 004b_seed_data.sql         ← Historical seed [SPRINT 2A]
│       ├── 005_fleet_tables.sql       ← [SPRINT 4]
│       └── 006_push_tables.sql        ← [SPRINT 6]
├── tests/
│   ├── fixtures/
│   │   ├── xero_pl_sample.xlsx        ← Sample Xero file for E2E tests [SPRINT 3]
│   │   └── xero_ar_sample.xlsx
│   └── e2e/
│       ├── wizard.spec.js             ← Wizard submission E2E [SPRINT 3]
│       ├── auth.spec.js               ← Role enforcement E2E [SPRINT 3]
│       └── workplan-sync.spec.js      ← Realtime sync E2E [SPRINT 4]
├── .env.local                         ← Git-ignored; VITE_SUPABASE_URL etc.
├── .github/workflows/ci.yml          ← Existing (add Playwright in SPRINT 3)
├── package.json                       ← Add dependencies per Pre-Build Checklist
├── vercel.json                        ← Existing (no changes needed)
├── vite.config.js                     ← Add vite-plugin-pwa [SPRINT 3]
├── tailwind.config.js                 ← New [SPRINT 3 if Tailwind accepted]
├── PRD.md                             ← Existing
└── ARCHITECTURE.md                    ← This document
```

---

## Component Dependency Map

```
main.jsx
  └── QueryClientProvider (@tanstack/react-query)
        └── AuthProvider (AuthContext.jsx)
              └── AuthGate
                    ├── LoginPage.jsx
                    │     └── useAuth() ← AuthContext
                    └── App.jsx
                          ├── Header (inline in App.jsx)
                          │     └── useAvailableMonths() ← useMonthData.js
                          ├── MobileNav.jsx [SPRINT 3]
                          │     └── useAlerts() ← badge count
                          ├── ChatPanel.jsx
                          │     └── POST /api/chat ← Vercel Edge Function
                          ├── Home (inline in App.jsx)
                          │     └── useAlerts() ← quick alerts
                          └── Dashboard (inline in App.jsx)
                                ├── SnapshotTab.jsx
                                │     ├── useFinancials(month)
                                │     ├── useYTDFinancials(fyStart, month)
                                │     └── useBalanceSheet(month)
                                ├── RevenueTab.jsx
                                │     └── useYTDFinancials(fyStart, month)
                                ├── MarginsTab.jsx
                                │     └── useYTDFinancials(fyStart, month)
                                ├── BenchmarkingTab.jsx (was PricingTab.jsx)
                                │     └── useBinPerformance(month)
                                ├── CompetitorsTab.jsx (was CompetitorPage.jsx)
                                │     └── useCompetitorRates()
                                ├── BDMTab.jsx
                                │     └── useCustomerAcquisitions(month)
                                ├── FleetTab.jsx
                                │     └── useBinPerformance(month)
                                ├── DebtorsTab.jsx
                                │     └── useDebtors(month) [+ prior 2 months]
                                ├── CashFlowTab.jsx
                                │     ├── useYTDFinancials(fyStart, month)
                                │     └── useBalanceSheet(month)
                                ├── RiskEPATab.jsx
                                │     └── useCompliance(month)
                                └── WorkPlanTab.jsx
                                      └── useWorkPlanItems() [+ Realtime sub]

src/hooks/ ── src/api/ ── src/lib/supabase.js ── Supabase PostgreSQL
                     └── /api/chat.js (Vercel Edge) ── Anthropic API

UIComponents.jsx (KPITile, SectionHeader, ChartCard, AlertItem, CustomTooltip)
  └── used by: all tab components (no data dependency — pure presentational)

theme.js (B, fontHead, fontBody, catColors, fmt, fmtFull, fmtPct)
  └── imported by: all components that render styled elements
```

---

## Data Flow Architecture

```
WRITE PATH (Wizard Submission):
User → Wizard.jsx → fileParser.js (SheetJS) → parsed data
     → supabase.rpc('submit_monthly_report', payload)
     → PostgreSQL transaction (atomic write to 6+ tables)
     → Supabase Storage upload (async, non-blocking)
     → queryClient.invalidateQueries(['available-months'])
     → Dashboard tab refetches automatically

READ PATH (Dashboard Tab):
Component mounts → useFinancials('2026-02-01') (React Query hook)
                → queryKey: ['financials', '2026-02-01']
                → Cache HIT: serve from memory (0ms)
                → Cache MISS/STALE: getFinancialsForMonth() from src/api/reports.js
                                  → supabase.from('financials_monthly').select('*').eq('report_month', month)
                                  → Supabase PostgreSQL (RLS: auth.uid() NOT NULL)
                                  → Data returned, cached for 5 minutes
                → Component renders with data

REAL-TIME PATH (Work Plan):
useWorkPlanItems() hook subscribes to Supabase Realtime channel
Jake marks item complete on phone → Supabase insert to work_plan_completions
                                  → Realtime event fires on all connected clients
                                  → queryClient.invalidateQueries(['workplan'])
                                  → Mark's browser refetches work plan
                                  → Completion visible within ~1 second

AI CHAT PATH:
User types message → ChatPanel.jsx → POST /api/chat (Vercel Edge Function)
                   → Edge Function fetches context from Supabase (service role key)
                   → Edge Function calls Anthropic API (API key NEVER leaves server)
                   → SSE stream returned → ChatPanel reads stream → text appended live

OFFLINE PATH (Tier 1, Sprint 3):
User goes offline → Service worker serves app shell from cache
                 → React Query serves stale data from IndexedDB persisted cache
                 → OfflineBanner.jsx shows "Offline — data from [timestamp]"
                 → Write operations disabled (Wizard shows "Requires internet")
```

---

## Sprint Execution Plan (Revised)

### Pre-Sprint 2A Checklist (do before writing a single line of code)

- [ ] Apply `004_schema_additions.sql` to Supabase dashboard (SQL editor)
- [ ] Insert seed data `004b_seed_data.sql` into Supabase (Jul 2025–Feb 2026 from financials.js)
- [ ] Set Vercel environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Create `.env.local` locally with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Enable Supabase Realtime for `work_plan_completions` table in Supabase dashboard
- [ ] Verify login works on the deployed Vercel URL with a real Supabase user account

### Sprint 2A (Week 1) — Security + Schema + Foundation + Extraction

| Day | Task | Files Touched |
|-----|------|--------------|
| 1 (Mon) | Create `api/chat.js` Edge Function; remove direct Anthropic call from App.jsx | `api/chat.js`, `src/App.jsx` |
| 1 (Mon) | Install TanStack Query; wrap main.jsx | `package.json`, `src/main.jsx` |
| 2 (Tue) | Extract all 11 tabs to `src/components/tabs/` | 11 new files, `src/App.jsx` |
| 2 (Tue) | Extract `ChatPanel.jsx` from App.jsx | `src/components/ChatPanel.jsx`, `src/App.jsx` |
| 3 (Wed) | Create `src/hooks/useMonthData.js` (all financials hooks) | `src/hooks/useMonthData.js` |
| 3 (Wed) | Wire `useAvailableMonths` — replace hardcoded array in App.jsx | `src/App.jsx` |
| 4 (Thu) | Wire `SnapshotTab.jsx` to Supabase (first live tab) | `src/components/tabs/SnapshotTab.jsx` |
| 4 (Thu) | Validate seed data appears correctly on Snapshot tab | (testing) |
| 5 (Fri) | Wire `RevenueTab.jsx`, `MarginsTab.jsx`, `CashFlowTab.jsx` (same hook) | 3 tab files |
| 5 (Fri) | Write `src/hooks/useWorkPlan.js` with Realtime subscription | `src/hooks/useWorkPlan.js` |

### Sprint 2B (Week 2) — Remaining Data + Wizard Write

| Day | Task | Files Touched |
|-----|------|--------------|
| 1 (Mon) | Wire `WorkPlanTab.jsx` to Supabase + Realtime | `src/components/tabs/WorkPlanTab.jsx` |
| 1 (Mon) | Wire `DebtorsTab.jsx` | `src/components/tabs/DebtorsTab.jsx` |
| 2 (Tue) | Wire `CompetitorsTab.jsx` (read from Supabase; keep edit in localStorage during migration; cut over to Supabase writes) | `src/components/tabs/CompetitorsTab.jsx` |
| 2 (Tue) | Wire `BDMTab.jsx`, `FleetTab.jsx` | 2 tab files |
| 3 (Wed) | Wire `BenchmarkingTab.jsx` (bin_type_performance + cost allocator refactor) | `src/components/tabs/BenchmarkingTab.jsx`, `src/data/costAllocator.js` |
| 3 (Wed) | Wire `RiskEPATab.jsx` | `src/components/tabs/RiskEPATab.jsx` |
| 4 (Thu) | Wire Wizard → `submit_monthly_report` Supabase RPC | `src/components/Wizard.jsx` |
| 4 (Thu) | Wire Wizard → Supabase Storage file upload | `src/components/Wizard.jsx` |
| 5 (Fri) | Full integration test: complete wizard → verify all 11 tabs show new data | (testing) |
| 5 (Fri) | Fix any column mapping issues (especially wages/COS mismatch) | various |

### Sprint 3 — Mobile + Router + PWA (as per PRD, no changes)

### Sprint 4 — Operations Module (as per PRD, no changes; apply migration 005 on day 1)

### Sprint 5 — AI Enhancement + PDF + Settings (as per PRD, no changes)

### Sprint 6 — Push Notifications + Polish (as per PRD, no changes; apply migration 006 on day 1)

---

## Pre-Build Checklist

Everything that must be done before Sprint 2A code begins:

### Schema
- [ ] Write `supabase/migrations/004_schema_additions.sql` covering all 12 gap items listed in ADR-010
- [ ] Write `supabase/migrations/004b_seed_data.sql` — historical Jul 2025–Feb 2026 data from `financials.js`
- [ ] Include `submit_monthly_report` PostgreSQL function in migration 004
- [ ] Apply migration 004 to Supabase (SQL editor in Supabase dashboard)
- [ ] Run seed migration 004b
- [ ] Verify data exists: `SELECT COUNT(*) FROM financials_monthly;` should return 8 rows

### Supabase Configuration
- [ ] Enable Realtime for `work_plan_completions` table in Supabase Dashboard → Database → Replication
- [ ] Create Supabase Storage bucket `reports` with private access
- [ ] Verify RLS policies from 002 are active (check `pg_policies` view)
- [ ] Create a test user in Supabase Auth with `owner` role in profiles

### Environment Variables (Vercel Dashboard)
- [ ] `VITE_SUPABASE_URL` (client-side, VITE_ prefix required)
- [ ] `VITE_SUPABASE_ANON_KEY` (client-side, public)
- [ ] `ANTHROPIC_API_KEY` (server-side only, NO VITE_ prefix)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-side only, NO VITE_ prefix)
- [ ] `ANTHROPIC_MODEL` = `claude-sonnet-4-6` (server-side)
- [ ] `VITE_APP_ENV` = `production`

### Local Development
- [ ] Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Verify `npm run dev` starts without errors on http://localhost:3000
- [ ] Verify login to Supabase works locally

### Package Installs (run before Sprint 2A coding)
```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

### Package Installs (Sprint 3 — do not install in Sprint 2)
```bash
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npm install @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister
npx tailwindcss init -p
```

### Package Installs (Sprint 5)
```bash
npm install react-to-print
```

### Package Installs (Sprint 6)
```bash
npm install web-push
npm install @sentry/react
```

### Blocking Issues Found in Codebase

1. **CRITICAL — API Key Exposure:** `src/App.jsx` lines 115–119 call `https://api.anthropic.com/v1/messages` directly from the browser without an API key. The API key appears to be missing (no auth header in the visible code), which means the AI chat is currently returning 401 errors in production. If an API key was ever present in this code path, it was exposed. Create `api/chat.js` on Sprint 2A Day 1 regardless.

2. **CRITICAL — Theme Colour Inconsistency:** `src/theme.js` defines `B.yellow = '#7B8FD4'` (which is actually a periwinkle blue, not yellow). `src/components/LoginPage.jsx` independently hardcodes `yellow: '#F5C518'` (which is a real yellow). The PWA manifest `theme_color` should match the brand. Confirm with Mark/client which colour is the actual brand yellow and normalise `theme.js` before Sprint 3 PWA manifest is created.

3. **MEDIUM — `availableMonths` hardcoded with 2026-02 as the last month:** `src/App.jsx` line 40–41 hardcodes the months array ending at `2026-02`. Once live data is wired, the month selector must pull from Supabase `monthly_reports` table. The `getAvailableMonths()` function in `src/api/reports.js` exists and is correct — this is a Sprint 2A day 3 task.

4. **MEDIUM — `dataStore.js` writes to localStorage during wizard completion:** `src/App.jsx` `handleWizardComplete` (line 57–76) calls `saveMonthData(monthKey, monthRecord)` which writes to `localStorage`. Once the wizard writes to Supabase, this `localStorage` write should be removed or replaced with a query cache invalidation. Leaving both in place is redundant; `localStorage` becoming the primary source of truth after a refresh is incorrect once Supabase is the database.

5. **LOW — `src/data/analysisEngine.js` imports hardcoded data:** `analysisEngine.js` line 2 imports `import * as D from './financials'`. Once the dashboard reads live data, the analysis engine must be refactored to accept the live data as a parameter rather than importing the hardcoded arrays. This is a Sprint 2B task (after all tabs are reading live data).

6. **LOW — `src/components/Wizard.jsx` imports `wizardSteps` from `src/data/wizardSteps.js`:** The file `src/data/wizardSteps.js` exists in the glob output but was not read. Verify this file's content before extracting the Wizard to ensure no hidden dependencies are broken during the extraction phase.

7. **LOW — LoginPage has its own hardcoded brand colours object:** `LoginPage.jsx` defines `const brand = { yellow: '#F5C518', ... }` internally instead of importing from `theme.js`. This should be aligned with `theme.js` as a minor housekeeping task in Sprint 2A.

---

## Recommended Sprint 2 Starting Point

**First file to touch:** `api/chat.js`

Create the Vercel Edge Function first. This resolves the live security exposure, demonstrates that Vercel serverless infrastructure works in the development environment, and gives the team confidence in the full-stack deployment setup before any data wiring begins. The template from PRD section 7.8 is ready to use — it takes approximately 45 minutes to implement and test.

**Second file to touch:** `src/main.jsx`

Add `QueryClientProvider` wrapping the existing `AuthProvider`. Two import lines and one JSX wrapper. This validates that TanStack Query is installed correctly and gives access to React Query DevTools in development immediately.

**Third file to touch:** `src/components/tabs/SnapshotTab.jsx` (new file)

Cut the Snapshot tab render block out of `App.jsx`, paste it into the new file, import `useYTDFinancials` and `useFinancials` hooks, replace the hardcoded `D.*` references with data from the hooks. When this renders correctly with live Supabase data, the migration pattern is proven and every other tab follows the same template.

---

## Summary Answers to the 5 Required Output Items

### 1. The 5 Most Important Architectural Decisions and Their Verdicts

**ADR-004 (AI Security):** URGENT — move Anthropic API call to Vercel Edge Function immediately. The API key is exposed in a running production application. This is Sprint 2A Day 1, not Sprint 3. Status: RESOLVED — Vercel Edge Function implemented Sprint 2A. Model upgraded to Sonnet 4.6 Sprint 7.

**ADR-005 (Data Layer):** The parallel data bridge pattern is the right call. Wire tabs one at a time in dependency order, keep hardcoded data as fallback during transition. The Wizard writes last via a PostgreSQL RPC function for atomicity. Do not wire all tabs simultaneously.

**ADR-006 (Component Architecture):** Extract all 11 tab components BEFORE wiring any to Supabase. The refactor cost is lower when done cleanly before database concerns enter the picture.

**ADR-010 (Database Migration):** Write migration 004 now. The gap between the deployed schema (001) and the PRD target schema is significant — 12 tables have missing columns. Wiring the UI against the incomplete schema and then fixing it mid-sprint is avoidable.

**ADR-001 (State Management):** TanStack Query is justified and not over-engineering for this project. The monthly data patterns (stale for 5 minutes, invalidated on mutation) are exactly what React Query was built for. The alternative (manual useEffect fetching) requires reinventing caching, loading states, error retry, and background refetch for every tab.

### 2. Decisions That Should Change the Sprint Plan

- **AI security (ADR-004):** Moved from Sprint 3 P0 to Sprint 2A Day 1. This is the only material change to sprint scope.
- **Component extraction (ADR-006):** Made explicit as Sprint 2A work before data wiring. The PRD implied this but didn't specify ordering.
- **Migration 004 timing (ADR-010):** Made a pre-Sprint-2 gate, not an in-sprint task. Schema must be deployed before UI code begins.
- **Tailwind install (ADR-003):** Moved to Sprint 3 with a clear constraint (layout only). If resisted, the `useBreakpoint()` hook alternative is documented.

### 3. Exact `npm install` Commands Before Build Begins

```bash
# Sprint 2A — required before first code commit
npm install @tanstack/react-query @tanstack/react-query-devtools

# Sprint 3 — do not install early
npm install react-router-dom
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
npm install @tanstack/query-persist-client-core @tanstack/query-sync-storage-persister

# Sprint 5
npm install react-to-print

# Sprint 6
npm install web-push @sentry/react
```

### 4. Blocking Issues Found in Codebase

In priority order:
1. Migration 004 not written — blocks all data wiring (create before Sprint 2A)
2. Historical seed data not in Supabase — tabs will show empty state until seeded (create 004b before Sprint 2A)
3. Vercel server-side environment variables not set — Edge Function will fail without `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
4. `availableMonths` array hardcoded — must be replaced with Supabase query in Sprint 2A
5. Brand colour inconsistency (`#7B8FD4` in theme.js vs `#F5C518` in LoginPage) — must resolve before PWA manifest creation in Sprint 3

### 5. Recommended Sprint 2 Starting Point

Touch `api/chat.js` first (new Vercel Edge Function — resolves the live API key exposure). Touch `src/main.jsx` second (add QueryClientProvider — 5 lines). Touch `src/components/tabs/SnapshotTab.jsx` third (first tab extraction + first live data wire — proves the end-to-end pattern works). Once Snapshot renders live data from Supabase, the remaining 10 tabs are a repetition of the same pattern.

---

### Critical Files for Implementation

- `C:\Dev\Binned-IT Dev\binnedit-hub v2.2\src\App.jsx`
- `C:\Dev\Binned-IT Dev\binnedit-hub v2.2\src\api\reports.js`
- `C:\Dev\Binned-IT Dev\binnedit-hub v2.2\supabase\migrations\001_initial_schema.sql`
- `C:\Dev\Binned-IT Dev\binnedit-hub v2.2\src\data\analysisEngine.js`
- `C:\Dev\Binned-IT Dev\binnedit-hub v2.2\src\components\Wizard.jsx`

---

### ADR-016: AI Assistant Architecture

**Status:** Accepted — Implemented Sprint 2A + Sprint 7

**Context:** Sprint 1 had the Anthropic API key directly in the React app (`App.jsx`), called from the browser. This exposed a live production credential. Additionally, the AI had no access to financial data context, making responses generic.

**Decision:**
1. Move all Anthropic API calls to a Vercel Edge Function (`api/chat.js`)
2. Build context from two sources: (a) Supabase financials_monthly + alerts_log, (b) client-supplied `financialSummary` built from `src/data/financials.js` hardcoded data
3. Add per-tab `AIInsightsPanel` component for structured analysis
4. Use Claude Sonnet 4.6 (not Haiku) for business-grade reasoning quality
5. Stream responses via Server-Sent Events (SSE) for real-time UX

**Rationale:**
- Server-side proxy is the only acceptable way to use API keys in a browser app
- Dual context sources (Supabase + hardcoded fallback) ensure AI always has financial context regardless of database state
- SSE streaming eliminates the perceived latency of waiting for a full AI response
- Sonnet 4.6 produces structured, actionable business insights; Haiku 4.5 produced generic answers
- Per-tab panels reduce cognitive load vs a single global chat — users get insights in context

**Consequences:**
- `api/chat.js` is a Vercel Edge Function — requires `vercel dev` locally (not `npm run dev`)
- `ANTHROPIC_API_KEY` must be set in Vercel environment variables (server-only, no `VITE_` prefix)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` also required server-side for rate limiting and context fetch
- Rate limiting: 50 messages/user/day enforced via `ai_chat_sessions` Supabase table
- `AIInsightsPanel` is stateless between sessions — insights are not persisted (by design — regeneration is cheap)

**Implementation files:**
- `api/chat.js` — Edge Function, model: claude-sonnet-4-6, max_tokens: 2048, SSE streaming
- `src/components/ChatPanel.jsx` — Chat UI, builds financialSummary from D.* data
- `src/components/AIInsightsPanel.jsx` — Reusable insights panel, props: tabName, contextSummary, selectedMonth, selLabel
- `src/components/tabs/SnapshotTab.jsx` — Uses AIInsightsPanel for business snapshot analysis
- `src/components/tabs/RevenueTab.jsx` — Uses AIInsightsPanel for revenue analysis
- `src/components/CompetitorPage.jsx` — Uses AIInsightsPanel with marketResearch context

---

### ADR-017: PWA and Offline Strategy

**Status:** Accepted — Implemented Sprint 3 + Sprint 6

**Context:** The dashboard is used by Mark on-site and by Jake in the yard — network connectivity may be intermittent. A PWA install prompt improves daily engagement.

**Decision:** Implement PWA with service worker (cache-first for static assets, network-first for Supabase API) and install prompt. Icons are JPEG files served from /icon-192.png and /icon-512.png paths (browser accepts JPEG at PNG path for PWA purposes).

**Rationale:** Full offline capability for a data-heavy dashboard would require complex sync logic. The pragmatic approach: cache the app shell (static assets) so it loads offline, but show a "No connection" banner for data operations that require Supabase. This gives the install/home-screen benefit without offline-sync complexity.

**Consequences:**
- `public/sw.js` caches static assets on install
- `public/manifest.json` declares PWA metadata and icon paths
- VAPID keys for push notifications are placeholder — must generate real keys with `npx web-push generate-vapid-keys` before enabling push in production
- `src/components/OfflineBanner.jsx` shows when navigator.onLine is false

---

### ADR-018: Code Splitting Strategy

**Status:** Accepted — Implemented Sprint 6

**Context:** Initial bundle was 1,379kB (Vite default: single chunk). Lighthouse flagged this as a performance concern.

**Decision:** Use Vite `manualChunks` in `vite.config.js` to split into 5 vendor chunks: vendor-react, vendor-charts, vendor-supabase, vendor-query, and main app code.

**Rationale:** Manual chunking is more predictable than automatic splitting for this dependency profile. Recharts (largest dependency) warrants its own chunk so tabs that don't use charts don't pay the load cost. Supabase client is similarly isolated.

**Result:** Largest chunk reduced from 1,379kB to ~536kB (app code). Total assets: 5 chunks. Chunk size warning remains in Vite output but is non-blocking.

**Consequences:**
- `vite.config.js` contains explicit chunk assignments per npm package
- Any new large dependency should be assessed for its own chunk assignment
- Lazy loading of route-level components (React.lazy + Suspense) is the recommended next step if bundle size becomes a blocking concern