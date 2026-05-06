# SkipSync UX/UI Audit — Kid Test + Driver App Separation

**Auditor:** Claude (Opus 4.7)
**Date:** 2026-05-06
**Build:** SkipSync v2.2.0 (per `App.jsx:51`)
**Lenses:** (1) Could a 14-year-old who knows nothing about the business view this month's revenue? (2) Is the driver app actually a separate, mobile-first PWA?

---

## Executive Summary

The platform is functional and visually polished, but the kid test fails badly at three points: the home tile labels assume domain knowledge ("Snapshot", "BDM", "Risk / EPA"), the path to "current month revenue" requires choosing between two nearly identical tiles ("Financial Reports" vs "Load Data") and then decoding 12 ALL-CAPS jargon tabs, and the side menu's "Drivers" item dumps an admin into the driver portal with no warning.

Driver app separation is **partial**. The driver UX/UI is genuinely a separate component and styled differently, BUT:
- It shares the **same** `manifest.json`, the **same** `sw.js`, and the **same** install-prompt — there is no "Install Driver App" path distinct from the admin Hub.
- It is reachable from the admin nav (`/drivers` in the side menu) which is a confusing cross-over.
- Offline support is implemented for *jobs list only* (2-hour localStorage cache) — every other driver action (start job, upload photo, complete) silently fails offline because `JobCard.jsx` writes directly to Supabase without a queue.
- "Mobile-first" is true for layout but the driver login at `DriverLogin.jsx` and the menu in `DriverApp.jsx:171–229` use desktop-style overlays without any explicit mobile breakpoints.

---

## 1. Kid Test — Top 10 Confusion Points (Ranked)

| # | Severity | Where | What confuses a non-business 14-year-old |
|---|----------|-------|------------------------------------------|
| 1 | **CRITICAL** | `App.jsx:67` — Home tile "Financial Reports" with sub-text "Select month to view" | A kid trying to "see this month's revenue" cannot tell whether to click **Financial Reports** or **Load Data** ("12-step guided wizard"). The word "revenue" doesn't appear anywhere on the home screen. |
| 2 | **CRITICAL** | `App.jsx:73-76` — Dashboard tabs `SNAPSHOT / REVENUE / MARGINS / BENCHMARKING / COMPETITORS / PRICING / BDM / FLEET / DEBTORS / CASH FLOW / RISK / EPA / WORK PLAN` | 12 ALL-CAPS abbreviations. "BDM"? "Snapshot"? "Risk / EPA"? Even an adult outside the bin trade has to guess. A kid will scroll right past "REVENUE" because the tab bar overflows on mobile (`overflowX:'auto'` at `App.jsx:390`) and the active tab marker is small. |
| 3 | **CRITICAL** | `App.jsx:578` + side-menu item "Drivers" `App.jsx:85` | Clicking **Drivers** in the burger menu navigates to `/drivers`, which `main.jsx:28` intercepts (`startsWith('/driver')`) and renders the **full-screen Driver Portal**, replacing the entire admin UI with no warning, no breadcrumb, and no "Back to admin" affordance other than buried "Back to Hub" inside the driver burger menu (`DriverApp.jsx:206`). The kid (or any admin) loses all context. |
| 4 | **HIGH** | `App.jsx:68` — Tile "Load Data" / "12-step guided wizard" / sub "Upload files + manual input" | The icon is a wrench (🔧). It sounds like settings or maintenance. A kid will not realise this is **the only way to add a new month**. |
| 5 | **HIGH** | `App.jsx:62` — Tile "Bookings" / sub "Operations" vs `App.jsx:65` "Collections" / sub "AR enforcement" | "Operations" and "AR enforcement" mean nothing to a layperson. "Collections" sounds like art collections. |
| 6 | **HIGH** | `App.jsx:305` — Home greeting "Welcome back, Mark" is **hardcoded** | Always says "Mark" regardless of who logged in. Confusing for any other user. |
| 7 | **HIGH** | `MobileNav.jsx:8` — Bottom nav label "Collect" (icon ⚖️) | Truncated to fit 60-px column. A kid sees a scales-of-justice icon labelled "Collect" — utterly opaque. |
| 8 | **MEDIUM** | `App.jsx:275` — Burger button (☰) and `App.jsx:294` "Home" button | Two affordances with very different scopes. The header has a burger AND a `Home` text button; mobile users have a *third* "Home" entry in the bottom nav (`MobileNav.jsx:5`). Three home-ish controls is one too many. |
| 9 | **MEDIUM** | `App.jsx:282-287` — Desktop month selector | A `<select>` styled to look exactly like a static label ("Viewing: Feb 2026"). The drop-down arrow is a tiny native chevron on a dark `#333` background; users frequently miss it is interactive. |
| 10 | **MEDIUM** | `App.jsx:91` — Side-menu items "Reports" (with icon 📊) AND "Monthly History" (🗓️) AND home tile "Financial Reports" (📊) | Three labels, two icons, one underlying screen group. Plus side menu has "Investor View" (📈) at `App.jsx:455` which looks like a fourth reports area but is a separate read-only mode. |

### 1.1 Walking the Kid Test — "Show me this month's revenue"

1. Lands on `/home`. Greeting says "Welcome back, Mark" — kid is not Mark, mild confusion.
2. Looks at 9 tiles. Sees no "Revenue". Best candidates:
   - **Dispatch** — "Kanban job management & scheduling" → not it
   - **Financial Reports** — "Current month's P&L, KPIs and analysis" → **kid does not know what P&L is**
   - **Load Data** — "12-step guided wizard" → ambiguous; sounds like setup
3. Picks "Financial Reports". Lands on `/dashboard/snapshot`.
4. Sees 12 ALL-CAPS tabs. Active tab is "SNAPSHOT" — what does that mean? The kid does not see a tab called "Revenue at a glance" or "This Month".
5. The Snapshot tab does include current-month KPIs near the top. Mild win.
6. But to view *only* revenue the kid clicks "REVENUE" tab. Page loads with 5 sub-categories (`General Waste`, `Asbestos`, `Soil`, `Green Waste`, `Other` per `RevenueTab.jsx:48-52`). No headline "$X this month" — just a stacked bar chart and a pie chart.

**Verdict:** Time-to-revenue is ~6 clicks if lucky, 15+ if not. The kid will likely give up at step 4.

---

## 2. Per-Screen Findings

### 2.1 Home (`App.jsx:302-335`)

**Wins:**
- Tile-grid layout is responsive (`gridTemplateColumns: isMobile?'repeat(2,1fr)':'repeat(3,1fr)'`, line 308) — good.
- Coloured left-border on each tile (`borderLeft:4px solid ${t.color}`, line 317) gives quick visual scanning.
- Quick Alerts section provides at-a-glance status (`App.jsx:328-333`).

**Issues:**
- **`App.jsx:305`** — Greeting "Welcome back, Mark" is hardcoded; should read from `profile.full_name`.
- **`App.jsx:60-70`** — Tile titles use insider language ("Dispatch", "BDM" not on home but tabs do, "Collections", "Load Data"). For first-run users, `desc` and `sub` need to be **what** the user does there in plain English (e.g. "See today's jobs", "Add this month's numbers", "Chase unpaid invoices"). Current sub-text is jargon-laden ("Jake's operations module" line 66 — Jake is internal staff name; "AR enforcement" line 65; "Configure platform" line 69).
- **`App.jsx:62`** — `Bookings` tile description: "Manage bin hire bookings & schedules" — fine. Sub: "Operations" — useless; remove.
- **`App.jsx:67`** — `Financial Reports` desc says "Current month's P&L, KPIs and analysis". P&L is jargon. Sub "Select month to view" is OK.
- No empty state if user has no months loaded — `availableMonths` falls back to FALLBACK_MONTHS so it always looks populated (`App.jsx:54-58`). If a real user logs in first time they will see Mark's data, not their own — major brand/trust issue.
- "Alerts" section (`App.jsx:328`) renders critical & margin alerts globally; no link to the source tab — kid sees alarming text with no obvious "what do I do".

### 2.2 Login (`LoginPage.jsx`)

**Wins:**
- Clean, focused single-card design (line 35-119).
- Uses `autoComplete` correctly via native input types.
- Good error-state UI (line 92-99).

**Issues:**
- **`LoginPage.jsx:11-19`** — Defines its own local `brand` colour palette instead of importing from `theme.js`. Inconsistent with the rest of the codebase.
- **`LoginPage.jsx:65`** — Email placeholder hardcoded to `you@binnedit.com.au`. White-label widget exists (per PRD-v6 §15.6) but login page advertises a single tenant.
- **No "Forgot Password" link** anywhere in the form. Real users will get locked out.
- **No driver-portal entry point.** A driver visiting the root URL `/` cannot log in to the driver portal — they must know to type `/driver` in the URL bar manually. Login page should either auto-detect driver role and redirect, or offer a "I'm a driver" link.
- **`LoginPage.jsx:117`** — Footer "Binned-IT Pty Ltd — Seaford, Melbourne" leaks the underlying company name despite the rebrand to SkipSync.

### 2.3 Dashboard Tab Bar (`App.jsx:390-399`, tab labels at `:73-76`)

**Wins:**
- Active-state styling clear: yellow background, dark text, underline (line 393-396).
- `overflowX:auto` keeps it from breaking small screens.

**Issues:**
- **`App.jsx:73-76`** — Tab labels are domain-jargon. Recommended renames:
  - `SNAPSHOT` → `Overview`
  - `REVENUE` → `Sales`
  - `MARGINS` → `Profit`
  - `BENCHMARKING` → `Compare`
  - `COMPETITORS` → `Competitors` (lowercase — not all caps)
  - `PRICING` → `Prices`
  - `BDM` → **`New Customers`** (BDM = Business Development Manager — never explained)
  - `FLEET` → `Trucks & Bins`
  - `DEBTORS` → `Who Owes Us`
  - `CASH FLOW` → `Cash`
  - `RISK / EPA` → `Compliance`
  - `WORK PLAN` → `To-Do`
- **All caps + tracking-wide letters** (`letterSpacing:'0.06em'`, line 395) reduces readability ~25%. Reserve all-caps for short tab IDs only.
- 12 tabs do not fit on a 390-px viewport; user must horizontally scroll. **No scroll affordance** (no fade gradient, no chevrons) — looks like the bar just ends at "BENCHMARKING".
- On mobile the tab bar is hidden entirely (`display:isMobile?'none':'flex'`, line 390). The dashboard tab is then changed via `MobileNav` — but `MobileNav` only exposes `dashboard → snapshot` (one tab). **Mobile users cannot reach 11 of 12 tabs at all.**

### 2.4 Side Menu (`App.jsx:428-461`)

**Wins:**
- Sensible operations-first ordering matches PRD-v6 §5.1.
- Section headers ("OPERATIONS", "REPORTS", "SYSTEM") provide grouping (line 437-441).
- Slide-in animation feels native (line 430).

**Issues:**
- **`App.jsx:85`** — Item `Drivers` (icon 👷) navigates to `/drivers`, which renders the *driver portal full-screen* due to `main.jsx:28`. There is no "manage drivers" admin screen. The kid (and any admin) is dumped into a driver-only UI with no breadcrumb home except a small `Back to Hub` button buried at `DriverApp.jsx:206`.
  - **Severity: critical** for navigation clarity — see also Driver App audit §3.1.
- **`App.jsx:91`** — `Reports` and `Monthly History` are split, but home has them combined under `Financial Reports`. Pick one model.
- **`App.jsx:452`** — `Investor View` is shoved below the section dividers as if it's an after-thought. It is not labelled with a section header. For a kid this looks like a bug.
- **Active state missing.** Side menu does not visually show which item corresponds to the current screen — every item is the same dim grey (line 445).
- **No keyboard support / focus traps.** Pressing Esc does not close the menu; tabbing through it eventually leaves the modal.
- The menu width is hardcoded to 280 px (line 430). On a 360-px-wide phone this leaves only 80 px of darkened backdrop — feels cramped.

### 2.5 Mobile Nav (`MobileNav.jsx`)

**Wins:**
- Bottom-tab pattern is conventional for mobile apps.
- Uses sticky positioning correctly.

**Issues:**
- **`MobileNav.jsx:4-11`** — Six tabs is one too many at 60-px height with 9-pt labels (line 55). Apple HIG recommends ≤5.
- **`MobileNav.jsx:8`** — Label `Collect` (icon ⚖️) for Collections is opaque; scales icon implies legal/justice; should be `Chasers` or `Overdue`.
- **`MobileNav.jsx:7`** — Label `Jobs` for Bookings — good rename. But it lands on `CRMBookingsPage`, not the dispatch board which actually shows today's jobs. Mismatched mental model.
- **`MobileNav.jsx:23-26`** — `item.tab` is referenced but `NAV_ITEMS` never sets `tab` on any item — dead code.
- **`MobileNav.jsx:30`** — `if (item.id === 'alerts')` branch is also dead — no item with id=`alerts` exists.
- **`MobileNav.jsx:43-53`** — `alertCount` badge code only fires for `id==='alerts'` which never exists. The badge feature is implemented but unreachable.
- **No Settings, Customers, Invoices, Fleet, or Drivers in the bottom bar.** Mobile users cannot reach those without opening the burger menu.

### 2.6 Wizard (`Wizard.jsx`)

**Wins:**
- Three-part progress bar with colour coding (yellow/amber/green) at line 179-184.
- Click-through any step (line 181) — gives a sense of overview.
- Good empty-state for upload zone with dashed border (line 207-223).

**Issues:**
- **`Wizard.jsx:188`** — "Step X of Y" is shown in tiny 11-pt muted grey on the right side. Easy to miss.
- **`Wizard.jsx:144`** — `wizardSteps[step]` — 12 steps is a lot. There is no "Skip / I'll do this later" affordance. Kid (or Sarah after a long day) will abandon halfway.
- **`Wizard.jsx:202`** — Instructions block uses `whiteSpace:'pre-line'` and assumes the source data label is a verbatim Xero export. References to "Westpac Statement" (`Wizard.jsx:252`) are bank-specific and hardcoded.
- **No save-and-resume.** Closing the browser mid-wizard loses everything (no `localStorage` checkpoint visible until `handleWizardComplete` at the very end, `App.jsx:166`).
- **`Wizard.jsx:168`** — Errors surface via `alert()` which is jarring on mobile.
- **`Wizard.jsx:101-141`** — 30+ `useState` hooks for compliance/ESG fields. Maintenance hazard but invisible to user.

### 2.7 Settings (`SettingsPage.jsx`)

**Wins:**
- Clear section grouping with `WhiteLabelWidget` (line 22), thresholds, profiles, etc.
- Embed-code copy-to-clipboard works (line 29-44) including legacy fallback.

**Issues:**
- **`SettingsPage.jsx:18-20`** — Tenant list is hardcoded to a single entry. The page advertises white-label as a feature but only one tenant slug works.
- **No search** across the long settings list — finding "Claude AI" or "Alert thresholds" requires scrolling.
- **`SettingsPage.jsx:26`** — Hardcoded production URL `https://binnedit-hub.vercel.app/embed/...`. Will break on staging or custom-domain deployment.
- **No mobile layout consideration** — settings page assumes desktop width; the embed-code `<pre>` block (line 83-91) overflows horizontally on phones.

### 2.8 Dispatch (`DispatchBoard.jsx`)

**Wins:**
- Strong dark-theme separation (`D` palette at line 8-19) signals "this is operational, not reports".
- Drag-and-drop columns with clear icons & colours (line 21-26).
- Sample fallback data ensures the board is never empty (line 36-44).

**Issues:**
- **`DispatchBoard.jsx:8-19`** — Defines its own `D` palette overriding global `B` tokens. Inconsistent with theme.js, makes light/dark theming impossible later.
- **No mobile fallback.** Four kanban columns each ~280 px wide = horizontal scroll on phones. Drag-and-drop is awkward on touch. PRD-v6 says Mark uses 60% mobile but the board is desktop-shaped.
- **No filter by driver or by date.** A kid trying to see "today's jobs" sees ALL jobs across all statuses.
- **`DispatchBoard.jsx:36`** — `SAMPLE_JOBS` array has Mark's actual customer names hardcoded (Smith Constructions, Nguyen Renovations, etc.). PII / privacy risk in fallback data.

### 2.9 Bookings (`CRMBookingsPage.jsx`, `BookingPage.jsx`)

Two distinct pages:
- `/bookings` (admin CRM, `App.jsx:573`) → `CRMBookingsPage`
- `/book` (public, `App.jsx:574`) → `BookingPage` (also surfaced via `main.jsx:19`)

**Wins:**
- Public `BookingPage` has a separate, friendlier `SK` palette (line 9-24) and 4-step linear wizard (line 64). Good UX for end customers.
- Strong validation (`BookingPage.jsx:87-100`) with Australian phone-number regex.

**Issues:**
- **Naming collision.** `/book` is public booking; `/bookings` is internal CRM. The two URLs differ by one letter but the experience is fundamentally different. Easy for staff to bookmark wrong one.
- **`BookingPage.jsx:9-24`** — Yet another local palette `SK`. Three palettes now: `B` (global), `D` (dispatch), `SK` (public booking).
- The CRM Bookings page (`CRMBookingsPage.jsx:9-82`) hardcodes a **Service Matrix** of bin sizes and prices. Same data exists in `BookingPage.jsx:27-52` and `EmbedBookingPage.jsx`. Three sources of truth for prices.
- **Inline customer creation** (PRD §15.2) is genuinely a UX win. No major issue.

### 2.10 Customers (`CustomersPage.jsx`)

**Wins:**
- Risk-bar component (`RiskBar`, line 54-64) is a nice visual encoding.
- Fallback data realistic (line 18-25).

**Issues:**
- **`CustomersPage.jsx:31-42`** — Status taxonomy (`unrated/approved/review/declined` × `residential/commercial/account/cod`) is dense. A kid sees four pill colours and no legend.
- **`CustomersPage.jsx:18-25`** — Fallback customer data hardcodes real customer names again — PII concern.
- "ABN" / "ACN" / "PPSR" abbreviations appear with no tooltip.

### 2.11 Drivers (`/drivers` route)

**This is the trap.** See Driver App assessment in §3 — clicking "Drivers" in side menu does not take an admin to a "manage drivers" page; it takes them into the **Driver Portal** (full-screen, dark theme, no admin chrome). There is **no admin view of drivers anywhere in the app**.

### 2.12 Invoices (`InvoicesPage.jsx`)

**Wins:**
- KPI summary cards (line 52-72) follow the same pattern as other tabs — consistent.
- Status badges with semantic colour map (line 30-36).

**Issues:**
- **`InvoicesPage.jsx:11-18`** — `daysOverdue` calculated locally with no timezone awareness — Australia is UTC+10/+11.
- No bulk actions (no select-all, no batch send-reminder).
- `fmtMoney` (line 25-28) prepends `$` but invoices may have multi-currency in future.

---

## 3. Driver App Assessment

### 3.1 Separation from SkipSync Chrome — **PARTIAL**

| Check | Status | Evidence |
|-------|--------|----------|
| Separate component tree | ✅ Yes | `DriverApp.jsx` is self-contained; renders own header (line 78-123), own menu (line 165-229), own bottom-content layout (line 157-162). |
| Skips main App chrome (no `Header`, `SideMenu`, `MobileNav`) | ✅ Yes | `main.jsx:28` — `if (location.pathname.startsWith('/driver')) return <DriverApp />` short-circuits before `App` mounts. The full SkipSync Header / SideMenu / MobileNav never render. |
| Distinct visual language | ✅ Yes | DriverApp uses `B.black` background (line 73), single-action big-tap targets, dark-theme cards, 56-px sticky nav (line 84) — clearly differentiated from the light-theme admin Hub. |
| Reachable only by drivers | ❌ **No** | `App.jsx:85` adds a side-menu `Drivers` item navigating to `/drivers`, which `main.jsx:28` matches via `startsWith('/driver')`. So an **admin** clicking that menu item is hijacked into the driver portal. |
| Admin "manage drivers" screen exists | ❌ **No** | There is no admin view to list/edit driver profiles, assign trucks, see who's checked in. The "Drivers" side-menu item silently redirects into the driver portal. |
| Driver portal hard-blocks admin features | ❌ **No** | Driver burger menu has a `Back to Hub` button (`DriverApp.jsx:206`) that calls `navigate('/')` — taking the driver into the admin home. If a driver's Supabase role is `driver` they may still see the admin home; if anything, role-based routing should split here. |
| Public / unauth path | ⚠️ Partial | `/driver` is treated as public (no auth check before render) — but `DriverLogin` then handles auth. Same Supabase auth context as main app though (line 16: `useAuth()`). |

**Verdict:** UX/UI separation: ~80% achieved. **Routing separation: broken.** The `startsWith('/driver')` rule in `main.jsx:28` collides with the `/drivers` admin route in `App.jsx:578`/`:85`. Either:
- (a) rename admin route to `/admin/drivers` (a real management screen), or
- (b) remove the `Drivers` side-menu item entirely until an admin view exists.

### 3.2 PWA Readiness — **FAIL (single-manifest problem)**

| Check | Status | Evidence |
|-------|--------|----------|
| Driver-specific manifest | ❌ **No** | `public/manifest.json` is the sole manifest. Both admin and driver use it. Name = "SkipSync", `start_url: '/'` (line 5) — installs to admin home, not driver portal. |
| Driver-specific service worker | ❌ **No** | `public/sw.js` is the sole SW. Cache name `skipsync-v2-2` (line 4). Caches `/`, `/manifest.json`, `/logo.jpg`, `/favicon.svg`. **None of the driver shell, JobQueue, JobCard JS chunks are pre-cached.** |
| Driver install prompt | ❌ **No** | No `beforeinstallprompt` handler anywhere in the driver code. A driver who taps "Add to Home Screen" gets the admin app icon, name, and start URL. |
| Push notifications wired for driver | ⚠️ Partial | `sw.js:76-86` has a generic `push` handler. No subscription flow inside `DriverApp.jsx` to register a driver-specific subscription. The handler routes to `data.url || '/'` — **always the admin home**. |
| Apple touch icon for driver | ❌ **No** | `index.html:9` sets `<link rel="apple-touch-icon" href="/logo.jpg">` — single icon. iOS PWAs share it. |
| Standalone start_url drops driver in driver portal | ❌ **No** | `manifest.json:5` is `"/"` — installed PWA opens admin home; driver must navigate manually each session. |

**Concrete fix proposal — split manifests:**
```
public/
├── manifest.json           ← admin, start_url:'/', name:'SkipSync'
└── driver-manifest.json    ← driver, start_url:'/driver', name:'SkipSync Driver',
                              theme_color:'#000006', background_color:'#000006',
                              icons:[ '/driver-icon-192.png', ... ]
```
And in `DriverApp.jsx` (or a `DriverLayout`), dynamically inject the driver manifest:
```jsx
useEffect(() => {
  const link = document.querySelector('link[rel=manifest]')
  link.href = '/driver-manifest.json'
  return () => { link.href = '/manifest.json' }
}, [])
```
And register a separate scoped service worker:
```js
navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver/' })
```

### 3.3 Mobile-First Compliance — **MOSTLY YES, with rough edges**

| Aspect | Mobile-First? | Notes |
|--------|---------------|-------|
| Layout container | ✅ | `DriverApp.jsx:157` — `maxWidth: 520, margin: '0 auto', padding: '16px'` — tuned for phones. |
| Tap targets | ✅ | Vehicle pre-start banner (`DriverApp.jsx:128-153`) is full-width, ≥44 pt tall. JobCard expand button likely meets HIG. |
| Forms | ✅ | DriverLogin inputs `padding: '14px 12px'` (line 77) and `fontSize: 16` (line 81 — prevents iOS zoom). Good. |
| Side menu | ⚠️ | 260-px width (line 172) on a 320-px iPhone SE leaves ~60 px of backdrop tap area. Functional but tight. |
| Job cards | (assumed) | Not fully read — but JobQueue stats grid (line 110-132) uses `flex: 1` 3-column on the same row regardless of viewport. On a narrow phone the three KPIs squeeze tight. |
| `useBreakpoint()` usage | ❌ | DriverApp.jsx **never imports** `useBreakpoint`. No explicit mobile/desktop branching — relies on the `maxWidth: 520` constraint to look OK on tablet/desktop. |
| Tablet behavior | ⚠️ | On an iPad in landscape (1024 px), driver app sits in a 520-px column with vast empty black margins on each side. Looks broken. |
| Safe-area insets | ❌ | No `env(safe-area-inset-bottom)` padding on the sticky top bar (line 78-89) or on the menu (line 171-176). Notch / home-bar collisions possible. |

### 3.4 Offline Support — **PARTIAL — read-only**

| Capability | Status | Evidence |
|-----------|--------|----------|
| Job list visible offline | ✅ | `JobQueue.jsx:6-25` — `loadCachedJobs()` reads from `localStorage` with 2-hour TTL. `JobQueue.jsx:42-46` — fetch-failure path falls through to cache. |
| Offline indicator | ✅ | `JobQueue.jsx:97-107` — explicit `📶 No signal` banner when `!online`. |
| **Start Job offline** | ❌ | `JobCard.jsx:53-60` — calls `updateJobStatus()` then `recordJobEvent()` directly to Supabase; no queue. **Silently fails offline** — driver thinks the start was recorded but it wasn't. |
| **Photo capture offline** | ❌ | `uploadJobPhoto` imported at `JobCard.jsx:3` — uploads to Supabase Storage. No offline queue. Photos taken in remote areas are lost when the page unmounts. |
| **Vehicle checklist offline** | ❌ | `VehicleChecklist.jsx:39-40` — `submitChecklist()` direct to Supabase. No queue, no retry. |
| **Hazard report offline** | ❌ | `HazardReport.jsx` (not fully read but `submitHazardReport` import at line 3) — same pattern. Critical safety reports lost if signal drops. |
| Background sync via SW | ❌ | `sw.js` has no `sync` event handler. Workbox / Background Sync API not used. |
| GPS recorded with events | ✅ | `JobCard.jsx:25-34` — `getGPS()` with 8-s timeout. |
| Last-updated indicator | ✅ | `JobQueue.jsx:212-222` — shows last fetch time + manual refresh. |

**Verdict:** A driver in a mobile-blackspot can *read* their jobs but **cannot reliably record completion, photos, or hazards**. This is the single biggest gap for the driver app and directly contradicts PRD-v6 §2 ("Mobile-First for Drivers — everything a driver needs on their phone") and §4.4 (drivers in remote locations).

**Concrete fix proposal — outbound queue:**

```js
// src/lib/driverQueue.js
const QUEUE_KEY = 'skipsync_driver_pending_actions'
export function enqueue(action) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  q.push({ ...action, ts: Date.now(), id: crypto.randomUUID() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  if ('sync' in self.registration) self.registration.sync.register('driver-sync')
}
export async function flush() {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  for (const action of q) { /* replay */ }
}
```
Wrap every Supabase write in `JobCard.jsx`, `VehicleChecklist.jsx`, `HazardReport.jsx`, and `PhotoCapture.jsx` with try/enqueue-on-failure. Photos go to `IndexedDB` (not localStorage — too big).

---

## 4. Concrete Fix Proposals (Prioritised)

### P0 — Ship This Week

1. **Rename dashboard tabs to plain English** (`App.jsx:73-76`).
2. **Rename home tile sub-text** (`App.jsx:60-70`) — kill "Operations", "AR enforcement", "Jake's operations module".
3. **Remove or fix the `Drivers` side-menu item** (`App.jsx:85` + `:578`). Either build an admin "Drivers" management screen at `/admin/drivers`, or delete the menu entry until you do.
4. **Hardcoded greeting** (`App.jsx:305`) — read from `useAuth().profile.full_name`.
5. **Driver offline write queue** — at minimum for `recordJobEvent`, `updateJobStatus`, `submitChecklist`, `submitHazardReport`. Photos can wait one sprint.

### P1 — Within Two Sprints

6. **Driver-specific manifest + SW** (`public/driver-manifest.json`, `public/driver-sw.js`). Allows driver "Install" experience to be branded "SkipSync Driver" with start_url `/driver`.
7. **Mobile dashboard tab access.** Either expose all 12 tabs via a horizontal swipe + page-dot indicator on `/dashboard`, or fold them into a `<select>` for mobile.
8. **Forgot-password link** on `LoginPage`.
9. **Settings: white-label tenants from Supabase**, not hardcoded array (`SettingsPage.jsx:18-20`).
10. **Single source of truth for bin prices** — extract `BIN_SIZES` / `SERVICE_MATRIX` to a shared module used by `BookingPage`, `CRMBookingsPage`, `EmbedBookingPage`.

### P2 — Quality-of-Life

11. **Side menu active state** — highlight current item.
12. **Empty states** — first-time user with no months loaded should see a guided "Welcome — let's load your first month" call-to-action, not Mark's fallback data.
13. **PII scrub fallbacks** — replace real customer names in `DispatchBoard.jsx:36-44`, `CustomersPage.jsx:18-25`, `CRMBookingsPage` fallbacks with generic placeholders ("Customer A", "Demo Pty Ltd").
14. **Tab reset to 5 mobile-nav items** (`MobileNav.jsx:4-11`) — drop "Collect" or fold it into a floating "Alerts" badge.

---

## 5. Mockup — Reworked Home Tile

```
┌─────────────────────────────────────────┐
│  Welcome, [Real Name]                   │
│  Last data: Feb 2026 (8 months loaded)  │
└─────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🗂️           │ │ 📅           │ │ 🧾           │
│ TODAY'S JOBS │ │ NEW BOOKING  │ │ INVOICES     │
│ See & dispatch│ │ Book a bin   │ │ Send & track │
│ trucks       │ │ for a customer│ │ payment      │
│              │ │              │ │              │
│ 12 active    │ │              │ │ 4 overdue ⚠ │
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 👥           │ │ 🚛           │ │ ⚖️           │
│ CUSTOMERS    │ │ FLEET        │ │ CHASE OVERDUE│
│ Accounts &    │ │ Trucks, bins │ │ Letters &    │
│ history      │ │ & maintenance │ │ enforcement  │
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📊           │ │ 📥           │ │ ⚙️           │
│ MONEY VIEW   │ │ ADD MONTH    │ │ SETTINGS     │
│ Revenue,     │ │ Upload Xero  │ │              │
│ profit, cash │ │ files        │ │              │
└──────────────┘ └──────────────┘ └──────────────┘
```

Notable changes:
- `Financial Reports` → **"Money View"** (revenue/profit/cash). Five-year-old understands "money".
- `Load Data` → **"Add Month"** with download-arrow icon. Clearer this is the action that adds a new month.
- `Collections` → **"Chase Overdue"** with the legal-scale icon retained.
- `Bookings` → **"New Booking"** because the operational entry point is creating one. CRM listing accessed via tab.
- Tile *count* on each tile (e.g. "12 active", "4 overdue") gives at-a-glance status without the user clicking through.

---

## 6. What's Actually Well-Designed (Honest Wins)

- **Operations-first nav order** (`App.jsx:80-94`) genuinely matches PRD-v6 §5.1 — Dispatch, Bookings, Fleet are at the top of the side menu.
- **Public booking widget separation** (`BookingPage.jsx`) has its own palette and 4-step wizard — well thought out for end customers.
- **Wizard progress bar** (`Wizard.jsx:179-184`) with three colour-coded parts is a nice touch.
- **Offline banner** (`OfflineBanner.jsx`) is simple and effective.
- **Driver portal visual differentiation** — black background, yellow accents, large tap targets, sticky top bar — feels noticeably different from the admin Hub. UX/UI separation is the strongest part of the driver experience.
- **JobQueue cache fallback** (`JobQueue.jsx:42-46`) shows real care for poor-signal drivers — even if it's incomplete.
- **Inline customer creation in Bookings** (PRD §15.2) is a real workflow win.
- **Investor read-only view** at `/investor` is a clean access-pattern split.
- **Notification bell with `refetchInterval: 30000`** (`NotificationBell.jsx:23`) — sensible polling.

---

## File-and-Line Index of All Cited Issues

| Topic | File:Line |
|-------|-----------|
| Hardcoded greeting "Mark" | `src/App.jsx:305` |
| Tile titles/subs jargon | `src/App.jsx:60-70` |
| Dashboard tab labels (12, all caps) | `src/App.jsx:73-76` |
| Tab bar hidden on mobile | `src/App.jsx:390` |
| Side-menu Drivers item | `src/App.jsx:85` |
| /drivers route inside admin | `src/App.jsx:578` |
| AuthGate startsWith('/driver') | `src/main.jsx:28` |
| MobileNav six items | `src/components/MobileNav.jsx:4-11` |
| MobileNav dead alert badge code | `src/components/MobileNav.jsx:30, 43-53` |
| LoginPage local palette | `src/components/LoginPage.jsx:11-19` |
| LoginPage tenant leak | `src/components/LoginPage.jsx:65, 117` |
| Wizard step count | `src/components/Wizard.jsx:188` |
| Wizard alert() error | `src/components/Wizard.jsx:168` |
| Settings hardcoded tenant | `src/components/SettingsPage.jsx:18-20` |
| DispatchBoard local palette | `src/components/DispatchBoard.jsx:8-19` |
| DispatchBoard real customer names | `src/components/DispatchBoard.jsx:36-44` |
| BookingPage local palette | `src/components/BookingPage.jsx:9-24` |
| Single manifest | `public/manifest.json` (entire file) |
| Single SW, no driver assets cached | `public/sw.js:4-13` |
| SW push handler routes to admin | `public/sw.js:76-86` |
| index.html SW registration | `index.html:27-37` |
| DriverApp full-screen take-over | `src/components/driver/DriverApp.jsx:70-232` |
| DriverApp no useBreakpoint | `src/components/driver/DriverApp.jsx` (entire file) |
| JobCard direct Supabase write (no queue) | `src/components/driver/JobCard.jsx:53-60` |
| VehicleChecklist no offline queue | `src/components/driver/VehicleChecklist.jsx:39-40` |
| JobQueue 2-hour cache | `src/components/driver/JobQueue.jsx:6-25` |
| OfflineBanner simple impl | `src/components/OfflineBanner.jsx` |

---

*End of audit.*
