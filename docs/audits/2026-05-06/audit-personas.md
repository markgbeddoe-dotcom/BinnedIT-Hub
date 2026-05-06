# SkipSync — Persona vs Build Audit

**Audit date:** 6 May 2026
**PRD audited:** PRD-v6.md (active, 27 April 2026), with cross-reference to PRD-v5.md (3 April 2026) for personas marked "unchanged".
**Codebase audited:** `C:\Local Dev\SkipSync\BinnedIT-Hub\src\` at `BUILD_DATE = '27 March 2026'`, `VERSION = '2.2.0'` (per `src/App.jsx:51-52`).
**Auditor:** product-manager review against PRD personas (Mark, Sarah, Jake, drivers, public customer, Andrew).

> **Headline finding.** Most of the visible "build" matches the PRD chrome (nav, tiles, page shells), but several persona-critical workflows are either (a) blocked by a code-level RBAC bug — `useAuth().isBookkeeper` is referenced in two pages but **does not exist on the AuthContext value** — or (b) only present as UI shells with hard-coded fallback data and no real backing. Phase 3 (Driver app) and Phase 4 (auto-invoicing, dunning, job costing) are claimed in places but only partially live.

---

## 1. Persona Walkthroughs

Legend: ✓ built and accessible to this persona | ✗ gap — feature missing or persona blocked | ⚠ feature exists but role-gating is wrong / hidden / broken / data is mocked.

### 1.1 Mark — Owner / Director / Operator

PRD-v6 §4.1 (cross-ref PRD-v5 §4.1). Daily reality: 60% mobile, 5-minute morning check on his phone — today's jobs, yesterday's billing, cash position. v6 adds Collections tile to Home and AI key management.

| Step in PRD daily flow | Status | Notes / file refs |
|---|---|---|
| Open phone, see today's jobs (PRD: "today's jobs loading correctly") | ⚠ | Mobile bottom nav has Dispatch (`src/components/MobileNav.jsx:6-11`), tap loads `DispatchBoard` (`src/components/DispatchBoard.jsx`). However the dispatch board is fed from `SAMPLE_JOBS` hardcoded in `DispatchBoard.jsx:36-44` plus `useBookings()`. There is no "today" filter / no driver-pin map. PRD-v5 §4.3 calls out a Live Job Map — not built. |
| See "any problems with yesterday's billing" | ⚠ | `/invoices` exists (`src/components/InvoicesPage.jsx`) — but mobile nav ("Jobs" item) routes to `/bookings`, not `/invoices`. To reach Invoices on mobile, Mark must open the burger menu → Invoices. Two-step. |
| Cash position in 5 minutes | ✓ partially | `SnapshotTab` shows "Bank Balance (Xero)" tile (`src/components/tabs/SnapshotTab.jsx:256`) and "ATO Clearing" tile (line 261). On mobile this is reachable via Reports tab in MobileNav. However the dashboard requires picking a month (Feb 2026 default) — no live cash today. |
| "Loss-making bin types" surfaced (per task brief) | ⚠ | `PricingTab.jsx:166` has the string "loss-making" inside an alert. It only surfaces under the Pricing/Benchmarking dashboard tab (financial Reports area). It is **not** elevated to the Home screen, the Dispatch board, or the Quick Alerts panel. Mark must drill: Home → Reports tile → Benchmarking tab → expand a bin type. Not 5-minute-on-phone friendly. |
| "Pricing decisions needed" surfaced | ✗ | Grep returns no matches for `pricing decision`, no badge/widget/alert pattern. The PRD-v5 §8.8 FR-A02 "Pricing recommendation engine" and FR-A01 "Weekly AI pricing intelligence report" are not built. `/api/weekly-digest.js` exists but emails Mark — not surfaced inside the app. |
| "ATO liability vs cash position" comparison | ⚠ | The two values exist as separate KPI tiles on Snapshot tab (`SnapshotTab.jsx:256, 261`) but there is no headline tile/widget that shows the **comparison** ("cash $X vs GST+PAYG owed $Y → net free $Z"). The CashFlow tab shows neither. |
| Live alerts (hazmat flags, driver delays, unbilled jobs) | ✗ | `NotificationBell` component exists in header (`src/App.jsx:42, 292`), but I found no event source pushing hazmat / delay / unbilled alerts to it. Driver app has `HazardReport.jsx` but it stores to Supabase, no realtime channel into NotificationBell. |
| Weekly AI pricing intelligence report | ⚠ | `api/weekly-digest.js` is wired up (Vercel cron `0 21 * * 0`). It calls Claude and emails Mark. Not visible in-app. No "view last week's digest" page. PRD-v5 FR-A04 competitor web search is not built (no Bing/Google search API found). |
| Collections tile on Home (v6 add) | ✓ | `src/App.jsx:65` — tile present with red accent. |
| AI API key management | ✓ | `SettingsPage.jsx:177-182, 696-` gated on `isOwner`. Works as PRD-v6 §15.3 describes. |
| Push notifications on phone | ⚠ | Framework wired (`SettingsPage.jsx:258-285`) but `VITE_VAPID_PUBLIC_KEY` is not generated (PRD-v6 risk register row "VAPID push notification keys (placeholder)" — Likelihood: High). |

**Verdict for Mark:** he can _technically_ see his data, but the platform does not surface "what needs your decision today" in the way PRD-v6 §1 promises ("Mark sees live job costing per job as it happens"). The Home screen tiles are static buttons, not signal cards.

---

### 1.2 Sarah — Office Manager / Bookkeeper

PRD-v6 §4.2. Desktop-90%. Role: invoicing, AR follow-up, Xero reconciliation, monthly close. v6 adds: Collections page with one-click letter generation, inline customer creation, ABN + payment terms at booking time, formal/legal letters.

| Step in PRD daily flow | Status | Notes / file refs |
|---|---|---|
| Log in (bookkeeper role) | ✓ | Standard Supabase auth. |
| Take a new booking with inline customer creation | ⚠ | UI exists (`CRMBookingsPage.jsx`, NewBookingModal, ABN + payment terms fields). **However the page contains a code bug: `const { isOwner, isBookkeeper } = useAuth(); const canCreateInvoice = isOwner \|\| isBookkeeper` — `isBookkeeper` is **never exported** from `AuthContext.jsx:65-75`. It will be `undefined`. So for Sarah (role=bookkeeper) `canCreateInvoice` resolves to `false`, and any UI hidden behind that flag is invisible to her.** |
| Invoice management (review/approve drafts before send — PRD-v5 FR-I03) | ⚠ | Same bug: `InvoicesPage.jsx:230-231` `const { isOwner, isBookkeeper } = useAuth(); const canEdit = isOwner \|\| isBookkeeper`. For Sarah, `canEdit === false`, so the **Sync Xero** button (line 279-289) and any other edit affordances are hidden. **P0 — she literally cannot do her job through the UI.** Owner-only fallback works only because Mark is owner. |
| Reach the Wizard for monthly data entry | ⚠ | Wizard route `/wizard` and `/month-select` exist (`App.jsx:566-567`). Home tile "Load Data" routes there (`App.jsx:68, 312`). **But the side-menu (`menuItems` array in `App.jsx:80-95`) does not include "Load Data" / wizard / month-select**. So Sarah can only reach the wizard by going Home → Load Data tile. From any deep page, no sidebar entry. P1 friction. |
| AR aging dashboard | ✓ | `DebtorsTab.jsx` — reachable via Reports → Debtors. |
| Collections page — one-click level letters | ✓ | `CollectionsPage.jsx` route `/collections` is **not role-gated** in `App.jsx:577` — Sarah can reach it. The 4-level letter generation works (`generateCollectionsLetter` from `legalTemplates.js`). |
| Send the letter (per PRD-v6 §15.1 "Record & Send") | ⚠ | The button records the event in `collections_events` and updates `invoices.collections_level`, but the PRD §15.1 explicitly states: "**The 'Send' action currently only records the event in Supabase — it does not dispatch an email or post the letter.**" Sarah will think she sent it; the customer will receive nothing. This is a P0 latent integrity bug for collections. |
| Generate Security Over Assets letter for >$5k | ✓ | Modal exists (`CollectionsPage.jsx:91-`), `generateSecurityOverAssetsLetter` works. Same caveat re: not actually sending. |
| Legal letter ABN/ACN values are correct | ✗ | PRD-v6 §15.1 "Known Limitations" — `legalTemplates.js` has placeholder ABN `57 123 456 789`, ACN, phone, BSB, bank account number. **Sarah will send legally-defective letters if she trusts the system.** Per PRD-v6 risk register: "must update before any letter is sent" — no UI gate enforces this. |
| Xero reconcile / monthly close | ⚠ | `Sync Xero` button is gated by the broken `canEdit` flag (above). Settings → Xero sync is owner-gated (`SettingsPage.jsx:142,147` use `isOwner`/`isManager`). PRD-v6 §4.2 says "Bookkeeper role — all ops + all financial dashboards, **no system settings**" — but Xero integration management is in Settings, so Sarah has no path to manually trigger a sync. P1. |
| Automated dunning (PRD-v5 §8.6) | ⚠ | `api/invoice-chase.js` cron exists (7/14/30-day reminders via Resend). Operating outside the UI. There is no "preview & cancel within 2 hours" review screen for Sarah (PRD-v5 FR-P02). No dunning history view in the app — only via Supabase tables. |

**Verdict for Sarah:** the v6 features look complete in the PRD but **a single missing key on AuthContext (`isBookkeeper`) breaks her invoice and booking write paths**. Plus the Collections "Send" doesn't actually send. Two latent P0 bugs.

---

### 1.3 Jake — Fleet / Operations Manager

PRD-v5 §4.3 (referenced as "unchanged" by v6). 70% mobile. Drag-drop dispatch, live driver status, bin inventory, maintenance, EPA compliance.

| Step in PRD daily flow | Status | Notes / file refs |
|---|---|---|
| Open Dispatch board on phone, drag-drop assign jobs | ⚠ | `DispatchBoard.jsx` exists with `@hello-pangea/dnd` drag-drop. **But the kanban column layout on a 390px phone is awkward — 4 horizontally scrolled columns with full-width cards is a desktop pattern.** Jake's "70% mobile" reality is poorly served. The Dispatch tile description says "Drag & drop board" (`App.jsx:61`) — no mobile-specific simplified view. Also driver/truck assignment is buried in the expand panel rather than column-headed lanes (PRD-v5 FR-D04 says "Driver column view: each truck/driver has a column…"). |
| Live job status updates (Realtime) | ✗ | `useBookings`/`useUpdateBookingStatus` hooks exist (`DispatchBoard.jsx:5`) but no `supabase.realtime` channel. Status changes from a driver's phone do not auto-move cards on Jake's board (PRD-v5 FR-D06 explicitly requires Supabase Realtime). |
| Driver locations on a map | ✗ | No `LiveJobMap` / `DriverMap` component. PRD-v5 §5.2 "Live Job Map" sidebar item is not in `menuItems`. |
| Bin inventory dashboard (PRD-v5 §8.9 FR-BI01-05) | ⚠ | `FleetManagementPage.jsx` lists `FALLBACK_BINS` array — 7 hardcoded bins. No real-time count by size. No over-hire alerts. No condition tracking. Bin Manager replacement (PRD-v6 §3.3 strategic goal #1) is not delivered. |
| Maintenance log + countdown to service | ✓ partially | `FleetManagementPage.jsx` has `LogMaintenanceModal` and `daysUntil()` helper (`FleetManagementPage.jsx:31-36`); `RegoBadge` colour-codes 30/90 day windows. Solid v1. |
| EPA compliance quick-log on phone | ⚠ | `RiskEPATab.jsx` exists but `canWrite` is referenced — let me verify. `Grep canWrite` shows it is imported in RiskEPATab. Manager role is `isManager: ['owner', 'manager']`. Jake is a fleet manager, role is likely `'manager'` or `'fleet_manager'`. `TeamPage.jsx:14` lists both `manager` and `fleet_manager` as separate roles. **`isManager` only matches `manager`/`owner`, not `fleet_manager`.** If Jake has role `fleet_manager` he loses manager-gated write access. P1. |
| Driver day sheet auto-generated | ⚠ | Driver app exists (`/driver` portal). But Jake has no view of "what each driver sees today" in the main app — Drivers menu item routes to `/drivers` which renders `DriverApp` (see below). |
| Pre-start checklist alerts (driver fails) | ⚠ | `VehicleChecklist.jsx` records pass/fail but no notification path to Jake. PRD-v5 FR-M05 says "Fail on any item triggers alert to Jake/office" — not implemented. |

**Verdict for Jake:** he has the building blocks (dispatch, fleet page, driver app exists separately) but no realtime, no live map, no bin inventory truth, and probable role-mismatch if his role is `fleet_manager`.

---

### 1.4 Drivers (Tom, Dave, …)

PRD-v5 §4.4. 100% mobile. Run sheet, navigate, status taps, photo capture, tip docket OCR, pre-start checklist, offline mode.

| Step in PRD daily flow | Status | Notes / file refs |
|---|---|---|
| Driver login (separate state) | ✓ | `main.jsx:28` — `if (location.pathname.startsWith('/driver')) return <DriverApp />` — driver gets their own UI shell with own auth. Good. |
| Run sheet — today's jobs in order | ✓ | `JobQueue.jsx` calls `getTodayJobs()`, sorts active/completed. Date header is correct (`JobQueue.jsx:73-93`). |
| Tap navigation → Maps | ✓ | `JobCard.jsx:45-47` builds `https://www.google.com/maps/dir/...` URL. |
| One-tap status (En Route → Arrived → Delivered → Picked Up) | ⚠ | Only **two** status changes implemented (`handleStart` → `in_progress`, `handleComplete` → `completed`) (`JobCard.jsx:49-95`). PRD-v5 FR-M04 requires the four-state flow. Drivers cannot mark "Arrived" separately, which breaks the customer "30-min ETA" SMS trigger (FR-C03) too. |
| Pre-start checklist (mandatory before first job) | ⚠ | `VehicleChecklist.jsx` exists, **but the checklist is non-blocking** — `DriverApp.jsx:125-153` renders an amber "needs checklist" banner over the JobQueue, not a hard gate. PRD-v5 FR-M05 says "must be completed before first job unlocks". |
| Bin delivery photo (mandatory after Delivered) | ⚠ | `PhotoCapture.jsx` exists; `JobCard.jsx:97-114` has `handlePhotoCapture`. **Not enforced as mandatory** — driver can mark complete without uploading (no precondition check in `handleComplete`). |
| Tip docket photo + OCR | ⚠ | Tip docket is a photo type (`PhotoCapture.jsx:7`, `JobCard.jsx:258`) — uploads to Supabase Storage. **No OCR** anywhere in codebase (grep `ocr`/`vision` returns only PRD docs). PRD-v5 FR-M08 promises OCR extraction of tonnage/cost — **Phase 3 not delivered**. |
| Fuel receipt OCR | ✗ | No `fuel_receipt` photo type, no OCR. PRD-v5 FR-M09 not built. |
| AI bin content check (hazmat / heavy load) | ✗ | `HazardReport.jsx` is a manual report form, not an AI vision check. PRD-v5 FR-M07 not built. |
| Offline mode — 8 hours cache, sync on reconnect | ⚠ | `JobQueue.jsx:13-17` caches for **2 hours** in localStorage, not 8. Status updates while offline are NOT queued — `JobCard.jsx:67` shows "Failed to start job — check connection" is the offline behaviour, not optimistic write + sync. PRD-v5 FR-M10 not delivered. |
| Manual weight input at transfer station | ✗ | No weight input field in `JobCard` — only photo upload. |
| In-app call to customer | ✗ | No `tel:` link or "Call customer" button in JobCard. P2 per PRD but missing. |

**Verdict for drivers:** the mobile shell is impressive, but several P0 PRD requirements (4-state job status, mandatory photo, blocking pre-start, OCR, real offline) are not delivered. Drivers can use it as a digital run sheet — they cannot use it for billing-grade evidence capture.

---

### 1.5 Customers — Public Booking & White-Label Widget

PRD-v6 §4.5 + §15.6. v6 adds white-label embeddable booking widget.

| Step in PRD flow | Status | Notes / file refs |
|---|---|---|
| 24/7 online booking at `/book` | ✓ | `BookingPage.jsx` — public, no auth (`main.jsx:19`). 4-step form, bin sizes, waste types. |
| Real-time bin availability check (PRD-v5 FR-B02) | ✗ | `BookingPage.jsx` has hardcoded `BIN_SIZES` array (lines 27-52). No `bin_inventory` query, no "X available for [date]". |
| Instant pricing calculator with surcharges (PRD-v5 FR-B03) | ⚠ | Hardcoded prices per bin, no waste-type surcharge logic, no access fee. |
| Embeddable iframe for binned-it.com.au (v6) | ✓ | `EmbedBookingPage.jsx` mounted at `/embed/:slug` (`main.jsx:22-25`); Settings page generates iframe code (`SettingsPage.jsx:22-`). |
| Confirmation SMS | ✗ | `book-confirm.js:15-17` — SMS is a "placeholder console log" only. Twilio not wired. |
| Confirmation email | ⚠ | Resend is wired but email only sends if `RESEND_API_KEY` is set; falls back silently. |
| Day-before reminder SMS | ✗ | `api/reminders.js` exists but Twilio not wired. |
| Driver-on-way ETA SMS | ✗ | Requires "Arrived" trigger that doesn't exist (see drivers). |
| Online invoice payment link (Stripe / Xero pay) | ✗ | Not built. PRD-v5 FR-P03 not implemented. |

**Verdict for customers:** they can submit a booking; they will not get the confirmation SMS the PRD promises and there is no real-time availability gate. The white-label widget itself is solid.

---

### 1.6 Andrew — Investor / Silent Partner

PRD-v6 §4.6 (unchanged from v5). Read-only `/investor` route, no ops data, monthly email digest.

| Step in PRD flow | Status | Notes / file refs |
|---|---|---|
| `/investor` route serves read-only KPIs | ✓ | `InvestorView.jsx` — YTD revenue, net profit, monthly chart, signs out button. |
| **Investor cannot reach ops/customer/financial detail** (PRD §4.6 "no access to bookings, driver data, or customer records") | ✗ | **`main.jsx:36-41` — there is NO role check.** If Andrew's profile role is anything (e.g. `viewer`) and he types `/dispatch` in the URL, he gets the full App with full sidebar (`App.jsx`). Conversely an owner like Mark can reach `/investor` too — by design, that's fine. **The P0 leak is that Andrew is not sandboxed to `/investor`.** Anyone with a session sees everything. |
| Monthly email digest | ⚠ | `api/weekly-digest.js` sends only to `mark@binnedit.com.au` (line 22 `DIGEST_TO`); Andrew is not on the list. |

**Verdict for Andrew:** the read-only view is fine. The platform leaks operational/customer data to him because there is zero route-level RBAC outside `/investor`.

---

## 2. P0 Gaps — persona literally cannot do the job

| # | Persona | Gap | Evidence |
|---|---------|-----|----------|
| P0-1 | **Sarah (bookkeeper)** | Cannot edit invoices or trigger Xero sync. UI is gated on `isBookkeeper` which is **not exported from AuthContext**. Resolves to `undefined`, so `canEdit = false`. | `src/components/InvoicesPage.jsx:230-231`, `src/components/CRMBookingsPage.jsx:435-436` vs `src/context/AuthContext.jsx:65-75`. |
| P0-2 | **Sarah (bookkeeper)** | Collections "Record & Send" records the event but **does not actually email/post the letter**. Customers receive nothing. | PRD-v6 §15.1 "Known Limitations / TODOs"; confirmed in `useCreateCollectionsEvent` flow — no Resend dispatch. |
| P0-3 | **Sarah (bookkeeper)** | Legal letters carry placeholder ABN `57 123 456 789`, ACN, BSB, bank account. No UI guard. First "real" send is legally defective. | PRD-v6 §15.1 + Risk Register row "Legal letter ABN/ACN placeholders". `src/lib/legalTemplates.js` `COMPANY` constant. |
| P0-4 | **Drivers** | Mandatory delivery photo not enforced. `handleComplete` (`JobCard.jsx:73-95`) marks the job complete without checking the bin photo was uploaded. PRD-v5 FR-M06 requires it as a hard gate; downstream auto-invoice loses POD. | `src/components/driver/JobCard.jsx:73-95`. |
| P0-5 | **Drivers** | No "Arrived" status — only `in_progress` and `completed`. Breaks the PRD-v5 4-state job flow and the customer "30 min ETA" SMS trigger (FR-C03). | `src/components/driver/JobCard.jsx:49-95`. |
| P0-6 | **Drivers** | No tip docket OCR — photos are stored, no extraction. Real-time job costing (PRD-v6 §1, §3.3 Goal #3 "sub-5-minute job costing") is impossible without it. Phase 3 not delivered. | grep `ocr|vision` returns no implementation files. `src/components/driver/PhotoCapture.jsx` is plain photo upload. |
| P0-7 | **Andrew (investor)** | Not sandboxed. Any authenticated session can browse `/dispatch`, `/customers`, `/collections`, `/invoices`. PRD §4.6 explicitly states "no access to bookings, driver data, or customer records". | `src/main.jsx:36-41` — `<Route path="/investor" />` then `<Route path="/*" element={<App />} />` with no role guard. |
| P0-8 | **Mark (owner)** | "Live job costing per job" promised in PRD-v6 §1 is not surfaced. `JobCostingWidget.jsx` exists but is **not imported anywhere** in the app. | grep `JobCostingWidget` returns only its own definition. |
| P0-9 | **Customers (public)** | Confirmation SMS — Twilio not wired. SMS is a `console.log` placeholder. PRD-v5 FR-B04 required. | `api/book-confirm.js:15-17`. |
| P0-10 | **Jake (fleet manager)** | If Jake's role is `fleet_manager` (it's a separate enum value — `TeamPage.jsx:14`), `isManager` check (`['owner','manager']`) excludes him. Settings, manager-gated Settings sections, anywhere using `isManager` denies him. | `src/context/AuthContext.jsx:73`, `src/components/TeamPage.jsx:14`. |

---

## 3. P1 Gaps — friction, multi-click, unclear nav

| # | Persona | Gap |
|---|---------|-----|
| P1-1 | Sarah | Wizard / "Load Data" / Month Select is on the Home tile but **not** in the side menu (`menuItems` array, `App.jsx:80-95`). To re-enter wizard from a deep page she must home → tile. |
| P1-2 | Mark (mobile) | `MobileNav` "Jobs" tab routes to `/bookings`, but the PRD calls "today's jobs" the dispatch use case. The label is misleading — "Jobs" should map to Dispatch, or the dispatch label "Dispatch" should be renamed. (Both Dispatch and "Jobs"/Bookings are present in the bottom nav so this is naming confusion, not absence.) |
| P1-3 | Mark | Quick Alerts panel on Home (`App.jsx:328-333`) only shows snapshot+margins alerts. It does not pull from Collections (overdue customers), Risk/EPA, or Fleet (rego expiring). Loses the "what needs you today" punch. |
| P1-4 | Mark | "ATO liability vs cash position" — both values exist but as separate KPI tiles on different rows of Snapshot, no comparison widget. Mental math required. |
| P1-5 | Jake | Drag-drop dispatch is a desktop pattern delivered for a 70%-mobile persona. No simplified mobile lane / list view. |
| P1-6 | Jake | Side menu "Drivers" (`/drivers`) routes to the **DriverApp** (`App.jsx:578`) — a driver portal with its own dark theme, login, job queue. Jake clicking "Drivers" sees the **driver portal**, not a list of his drivers. Confusing/broken navigation. |
| P1-7 | Drivers | Pre-start checklist is a banner nudge, not a hard gate. `DriverApp.jsx:125-153`. |
| P1-8 | Drivers | Offline cache is 2 h, PRD says 8 h. Status updates while offline are not queued — `JobCard.jsx:67` returns "check connection" instead of optimistic local write. |
| P1-9 | Drivers | No `tel:` link to call customer from job card. |
| P1-10 | Customers | No live bin availability shown on `/book`. Hardcoded `BIN_SIZES`. Risk: overbooking. |
| P1-11 | Sarah | Collections page is not gated to bookkeepers/owners — a `viewer` or `driver` could navigate to `/collections` and view debt detail. PRD-v6 §4 expects financial info confidential to bookkeeper+owner. Same applies to `/customers`, `/invoices`. |
| P1-12 | Mark | Investor View link in side menu (`App.jsx:451-457`) is shown to all roles. Confusing for non-investor users. |
| P1-13 | All | `availableMonths` is hardcoded (`App.jsx:54-58`) for fallback; the dashboard's "month selector" can only choose Jul 2025–Feb 2026. Today's date is May 2026 but the wizard cannot create a "May 2026" record from the Home page without going Home → Load Data → MonthSelect (which only lists those 8 months). P1 — the platform feels stuck in early 2026. |

---

## 4. Out-of-PRD Scope Creep

Features in the codebase that have NO mention in PRD-v6 (or are positioned differently):

| Item | File | PRD position |
|---|---|---|
| **Audit Log page** | `src/components/AuditLogPage.jsx`, route `/settings/audit` | PRD-v6 §6.1 lists "Audit log (immutable change trail)" as Complete — but it's not in any persona workflow, no nav entry visible. Hidden URL only. Scope creep or undocumented placement. |
| **Team page** | `src/components/TeamPage.jsx`, route `/settings/team` | PRD-v6 §6.1 lists "Team & Staff management page" as Complete. Not referenced in any persona's workflow. Roles list (`TeamPage.jsx:14`) includes `fleet_manager` which is **not** anywhere in `AuthContext` role helpers — extra role with no effect. |
| **Per-tab AI Insights panels** | `src/components/AIInsightsPanel.jsx` used in `SnapshotTab.jsx:8` | PRD lists this as built but it isn't shown in personas' day. |
| **`api/weekly-digest.js`** | Cron runs Mondays | PRD-v6 §1 mentions weekly intelligence report but doesn't specify it's email-only / out-of-app. |
| **Notification Bell** | `src/components/NotificationBell.jsx`, used in header `App.jsx:292` | Not referenced anywhere in PRD-v6 §4 personas. No event source feeding it. |
| **CompetitorPage.jsx** | Standalone component | The PRD-v6 §6.1 lists "Competitor pricing matrix" but the page is duplicated as both a tab and a standalone — unclear which is canonical. |
| **`/book` vs `/embed/:slug`** | Two booking forms (`BookingPage.jsx`, `EmbedBookingPage.jsx`) | PRD-v6 §15.6 only describes the embed widget. The unbranded `/book` route exists too with different bin sizes/prices than `EmbedBookingPage.jsx`. Two sources of truth for bin pricing. |

Conversely, **features promised in PRD-v6 §1 with no implementation at all**:
- "AI checks bin contents photos for hazardous materials or heavy load risk" — no Vision API integration.
- "OCR of receipts from tips, fuel refills, driver costs, any maintenance" — no OCR.
- "Travel optimisation" — no route optimisation engine.
- "Wages and overtime critical management aspects" — no `clock_in`/`timesheet`/`roster` table or component (`grep` returns only one analysis-engine alert string).
- "Internet searches to provide intelligence around shifting costs" — no Bing/Google Search API integration.
- "Job completion triggers automatic Xero invoice creation" — `api/invoice-generate.js` exists with `XERO_WRITE_ENABLED` flag (defaults to `false`), but no UI/cron triggers it on job status change automatically.
- "Customer portal" — listed for Phase 6 in PRD-v6 §9, fine, but not in v6 work.

---

## 5. Recommended Changes

### 5.1 Code fixes (close P0 gaps before any further roadmap work)

1. **Fix AuthContext export to include `isBookkeeper`** (and consider `isFleetManager`). One-line addition in `src/context/AuthContext.jsx:65-75`:
   ```jsx
   isBookkeeper: ['owner', 'bookkeeper'].includes(profile?.role),
   isFleetManager: ['owner', 'manager', 'fleet_manager'].includes(profile?.role),
   ```
   This unblocks Sarah on Invoices and Bookings (P0-1). Also extend `isManager` to include `fleet_manager` or rename to `isOpsLead`.

2. **Sandbox investor / viewer roles in `src/main.jsx`.** Before `<Route path="/*" element={<App />} />`, redirect by role:
   ```jsx
   if (profile?.role === 'investor' || profile?.role === 'viewer') {
     return <Navigate to="/investor" replace />
   }
   if (profile?.role === 'driver') {
     return <Navigate to="/driver" replace />
   }
   ```
   Closes P0-7 (Andrew leak) and re-routes drivers to their portal even if they typo a path.

3. **Wire Resend send for Collections.** `useCreateCollectionsEvent` should call an Edge Function that sends the letter HTML/PDF before recording the event. Closes P0-2.

4. **Block letter generation when `legalTemplates.js` `COMPANY` constant is unedited.** Add a runtime guard: `if (COMPANY.abn === '57 123 456 789') throw new Error('ABN placeholder must be replaced')`. Closes P0-3.

5. **Wire `JobCostingWidget` into Mark's Snapshot tab and Home Quick Alerts.** Currently orphaned. Closes P0-8.

6. **Driver app: enforce mandatory delivery photo before "Complete".** In `JobCard.jsx:73`, check for an existing photo record before calling `updateJobStatus`. Add "Arrived" intermediate state. Closes P0-4 / P0-5.

7. **Twilio integration for booking confirm and ETA SMS.** Replace `console.log` placeholder in `book-confirm.js`. Closes P0-9.

8. **Block `/wizard`, `/settings`, `/collections`, `/invoices`, `/customers` routes from drivers and viewers.** Add a wrapper that checks role.

### 5.2 PRD changes (where the doc oversells the build)

1. **PRD-v6 §1 Executive Summary** says "Mark sees live job costing per job as it happens" and "AI checks bin contents photos…". Both are not built. Move these to a "Phase 3/4 — planned" section, or add an explicit "Build Coverage Matrix" appendix that flags which executive-summary claims are live.
2. **PRD-v6 §6.1** lists "Driver app (mobile run sheet) — Complete". It's a v0.5; flag the missing pieces (4-state status, OCR, mandatory photo, blocking checklist, 8h offline).
3. **PRD-v6 §15.1** correctly notes Send doesn't dispatch — but this should be promoted from "Known Limitations" to a P0 launch blocker badge.
4. **Add a Persona-Build Matrix** to PRD: rows = personas, cols = workflow stages, cells = ✓/⚠/✗. This audit's Section 1 can serve as the v1.
5. **Document the role enum.** PRD-v6 §4 names roles informally (owner, bookkeeper, manager, driver, investor). The codebase uses `owner`, `manager`, `bookkeeper`, `driver`, `viewer`, `fleet_manager` (`TeamPage.jsx:14`). Reconcile and put it in §10 Technical Architecture as a contract.
6. **Acknowledge `/book` vs `/embed/:slug` duplication.** Decide which is the canonical public booking flow and deprecate or align bin SKUs/prices.

### 5.3 Build priorities (next sprint suggestion)

1. **Sprint 10 — Sarah unblock & RBAC hardening:** the four-line AuthContext fix, route-level role guards, Resend wiring for Collections, COMPANY-constant guard. ~2 days.
2. **Sprint 11 — Driver evidence capture:** 4-state status, mandatory photo, blocking pre-start, 8h offline queue. Then layer Vision API for hazmat / OCR for tip dockets. ~5–7 days.
3. **Sprint 12 — "Mark's morning"**: Home Quick Alerts pulls from collections/risk/fleet/jobcost. JobCostingWidget on Snapshot. ATO-vs-cash comparison widget. Pricing-decision-needed badge. ~3 days.

---

## 6. Quick reference — every file path cited

- PRD-v6: `C:\Local Dev\SkipSync\BinnedIT-Hub\PRD-v6.md`
- PRD-v5: `C:\Local Dev\SkipSync\BinnedIT-Hub\PRD-v5.md`
- App + nav: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\App.jsx`
- Auth/role helpers: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\context\AuthContext.jsx`
- Auth gate / route shell: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\main.jsx`
- Mobile nav: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\MobileNav.jsx`
- Dispatch: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\DispatchBoard.jsx`
- CRM bookings (broken `isBookkeeper`): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\CRMBookingsPage.jsx`
- Invoices (broken `isBookkeeper`): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\InvoicesPage.jsx`
- Collections: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\CollectionsPage.jsx`
- Legal templates (placeholder ABN): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\lib\legalTemplates.js`
- Customers: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\CustomersPage.jsx`
- Settings: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\SettingsPage.jsx`
- Team: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\TeamPage.jsx`
- Investor: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\InvestorView.jsx`
- Driver portal: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\DriverApp.jsx`
- Driver job card: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\JobCard.jsx`
- Driver queue: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\JobQueue.jsx`
- Photo capture: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\PhotoCapture.jsx`
- Pre-start checklist: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\VehicleChecklist.jsx`
- Hazard report: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\HazardReport.jsx`
- Job costing widget (orphaned): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\driver\JobCostingWidget.jsx`
- Public booking: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\BookingPage.jsx`
- White-label embed: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\EmbedBookingPage.jsx`
- Snapshot tab (cash + ATO KPIs): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\tabs\SnapshotTab.jsx`
- Pricing tab (only "loss-making" mention): `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\PricingTab.jsx`
- Cash flow tab: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\tabs\CashFlowTab.jsx`
- Fleet management page: `C:\Local Dev\SkipSync\BinnedIT-Hub\src\components\FleetManagementPage.jsx`
- Booking confirm Edge Function (Twilio placeholder): `C:\Local Dev\SkipSync\BinnedIT-Hub\api\book-confirm.js`
- Invoice generation (`XERO_WRITE_ENABLED=false` default): `C:\Local Dev\SkipSync\BinnedIT-Hub\api\invoice-generate.js`
- Invoice chase cron: `C:\Local Dev\SkipSync\BinnedIT-Hub\api\invoice-chase.js`
- Weekly digest cron: `C:\Local Dev\SkipSync\BinnedIT-Hub\api\weekly-digest.js`

---

*End of audit.*
