# SkipSync User Manual

SkipSync is the operations platform for Binned-IT Pty Ltd, a skip bin hire business based in Seaford, Melbourne. It runs the whole job lifecycle: customer bookings, dispatch, the driver app, invoicing and collections, fleet and compliance, financial reporting, and an embedded AI assistant. This manual describes what is actually in the app — every label, route and permission below comes from the live code. It is also the knowledge base for the in-app AI chat assistant, so role rules and screen locations are stated precisely.

Quick reference — main routes:

| Route | Screen | Who can reach it |
|---|---|---|
| `/home` | Home tiles | Any logged-in office user |
| `/dispatch` | Dispatch Board (kanban) | Any logged-in office user |
| `/bookings` | Bookings (CRM) | Any logged-in office user |
| `/book` | Public booking funnel | Public — no login |
| `/embed/<slug>` | White-label booking widget | Public — no login, iframe-able |
| `/driver` | Driver app (standalone PWA) | Drivers (own login screen) |
| `/drivers` | Driver app inside the office shell | Office users (side menu "Drivers") |
| `/invoices` | Invoices | Any logged-in office user (edits: owner/bookkeeper) |
| `/collections` | Collections | Any logged-in office user |
| `/customers` | Customers (CRM) | Any logged-in office user |
| `/fleet` | Fleet Management | Any logged-in office user |
| `/waste-audits` | Waste Audits review queue | owner, manager, fleet_manager, bookkeeper |
| `/rules` | Rules Engine | owner, manager, fleet_manager |
| `/dashboard/<tab>` | Financial Reports | Any logged-in office user |
| `/history` | Monthly History | Any logged-in office user |
| `/month-select` then `/wizard` | Load Data wizard | Any logged-in office user |
| `/settings` | Settings | Any logged-in office user (most edits: owner) |
| `/settings/team` | Team & Staff | Route open; menu entry owner-only; edits owner/manager |
| `/settings/audit` | Audit Log | Route open; menu entry owner-only |
| `/investor` | Investor View (read-only) | viewer/investor are locked to it; owner can visit |
| `/about` | About / version info | Any logged-in office user |

---

## Getting around

### Logging in

1. Open the app (production: binnedit-hub.vercel.app). You land on the SkipSync login card — "Operations Intelligence Platform".
2. Enter your email and password, then press the sign-in button.
3. Forgot your password? Type your email in the Email field first, then click the **Forgot password** link — a reset email is sent with a link back to the app.
4. Drivers: use the **I'm a driver** link on the login page (or go straight to `/driver`). The driver portal has its own dark login screen titled "Driver Portal".

Two pages never require login: the public booking page at `/book` and the white-label widget at `/embed/<slug>`.

### Roles and what each role can see

Every user has exactly one role on their profile. The roles are: **owner**, **manager**, **fleet_manager**, **bookkeeper**, **driver**, **viewer** (with **investor** treated identically to viewer).

- **owner** (Mark) — everything. Only the owner sees the **Audit Log** and **Team** entries in the side menu, edits alert thresholds, invites users and edits company identity in Settings.
- **manager** and **fleet_manager** — treated as "manager-level" throughout the app. They can use the Rules Engine, approve/dismiss waste-audit adjustments, edit team member names/phones/roles, and mark AI insights actioned/dismissed. (In code, `isManager` is true for owner, manager and fleet_manager.)
- **bookkeeper** (Sarah) — can edit invoices (Mark as Sent / Mark as Paid), trigger Xero sync, create Xero draft invoices from completed bookings, run Collections, and read the Waste Audits queue (read-only there — she cannot approve adjustments, but she needs the queue to invoice approved amounts manually in Xero). The "Waste Audits" side-menu item is shown to managers and the bookkeeper only.
- **driver** (Tom, Dave) — uses the `/driver` mobile portal: pre-start checklist, today's job queue, photos, hazard reports, tip decisions. Drivers do not appear in office workflows except as assignees.
- **viewer / investor** (Andrew) — sandboxed. Any page a viewer opens redirects to `/investor`, a single read-only FY summary page (YTD revenue, net profit, margins, revenue/profit chart, balance sheet summary) with a Sign Out button. Viewers are also locked to the **cash** accounting basis.

### Home screen

After login you land on `/home`: "Welcome back, <first name>" plus nine tiles:

1. **Dispatch** — kanban job management & scheduling
2. **Bookings** — manage bin hire bookings & schedules
3. **Invoices** — auto-generated invoices, payment tracking & chasing
4. **Customers** — CRM: accounts, job history & churn risk
5. **Collections** — overdue accounts, escalating demand letters
6. **Fleet** — vehicles, bin inventory & maintenance log
7. **Financial Reports** — current month's P&L, KPIs and analysis
8. **Load Data** — the 12-step guided wizard
9. **Settings** — alert rules, competitors, thresholds

Below the tiles is a **Quick Alerts** card with the top alerts for the current data set.

### Header and side menu

The black header bar (sticky, top of every office page) contains: the **☰** burger that opens the side menu, the SkipSync logo, the month selector and **Cash/Accrual** toggle (only while you are on the Financial Reports dashboard), a PDF export button (dashboard, desktop only), the notification bell (🔔 with unread count; types include booking received, job completed, invoice paid, compliance expiry, hazard report), and a **Home** button on every page except Home.

The side menu is grouped:

- **OPERATIONS**: Dispatch, Bookings, Fleet, Drivers, Customers, Invoices, Collections, Waste Audits (managers + bookkeeper only)
- **REPORTS**: Reports (the dashboard), Monthly History, Load Data
- **SYSTEM**: Settings, Rules Engine (owner/manager/fleet_manager only), Audit Log (owner only), Team (owner only), About
- A separate **Investor View** entry at the bottom opens the read-only investor page.

### Mobile navigation

On phones a fixed bottom bar replaces the desktop tab bars, with five buttons plus chat: **Home**, **Dispatch**, **Jobs** (the Bookings page), **Load Data**, **Reports**, **Chat** (💬 toggles the AI assistant). Tapping **Reports** while already on the dashboard opens a bottom-sheet tab picker grouping all 12 report tabs ("At a glance", "Money", "Operations", "Comparison", "Compliance + Action").

### Month selector

The Financial Reports dashboard always shows one month. On desktop, change it with the "Viewing:" dropdown in the header; on mobile, a full-width month dropdown sits above the dashboard content. Months come from Supabase monthly reports, with a hardcoded fallback of Jul 2025 – Feb 2026. The selected month is also carried in the URL (`/dashboard/<tab>?month=2026-02`).

### Cash vs accrual toggle

A segmented **Cash | Accrual** toggle appears in the header whenever you are on the dashboard. Cash is the default. Switching to Accrual refetches every report tab on the new basis and shows a small "Accrual basis" pill on the active tab (and below the month selector on mobile) so you always know you are off the cash default. The choice persists in the browser. Viewer/investor accounts are locked to cash — the toggle is disabled for them with a tooltip: "Investor view is fixed to cash basis per CFO recommendation".

---

## Bookings & scheduling a new service

There are four ways a job enters SkipSync.

### 1. Public booking funnel (`/book`)

A customer-facing four-step form (steps shown in the progress bar: **Bin Size → Your Details → Delivery → Review & Confirm**):

1. **Choose Your Bin Size** — cards loaded from the tenant's configured bin sizes. The default Binned-IT set: 2m³ Mini Skip $195 (flagged "Most Popular"), 4m³ Small Skip $275, 6m³ Medium Skip $355, 8m³ Large Skip $435 — all prices inc. GST, delivery and collection.
2. **Your Details** — Full Name, Email, Phone (validated as an Australian number), Delivery Address, Suburb, Postcode (4 digits). All required.
3. **Delivery Details** — Delivery Date (must be at least tomorrow), Collection Date (must be after delivery), Type of Waste (one of: General Household Waste; Green Waste (Lawn, Branches, Leaves); Soil / Dirt / Sand; Mixed Renovation Waste; Concrete / Bricks / Pavers; Timber / Wood; Mixed Construction & Demolition), optional Special Instructions. A prohibited-items notice lists tyres, asbestos (separate service), chemicals, paint, gas cylinders, medical waste.
4. **Review Your Booking** — total price, hire period, all entered details, and a terms checkbox. Press **Confirm Booking**.

On success the customer sees "Booking Confirmed!" with a booking reference (the first 8 characters of the booking ID, uppercase) and a "What happens next" list. The booking row is inserted with status **pending**, and a confirmation email/SMS pipeline fires (`/api/book-confirm`). **No payment is taken online** — there is no payment gateway; payment is handled on invoice.

### 2. White-label widget (`/embed/<slug>`)

The exact same four-step form, themed with a partner tenant's logo, colours, phone and bin prices (from the `tenants` and `tenant_bin_sizes` tables). It is designed to be embedded in an iframe on a third party's website — Settings → White-Label Widget shows the copy-paste iframe snippet. Bookings created through it carry the tenant's `tenant_id`. To add a new tenant, insert rows into `tenants` and `tenant_bin_sizes`.

### 3. Office-side CRM booking (Bookings page)

For phone/email bookings against known customers:

1. Open **Bookings** (side menu or the Bookings tile) → click **+ New Booking**.
2. **Customer step** — search existing customers by name or suburb and pick one, or switch to new-customer mode and create one (name required; plus email, phone, address, suburb, postcode, ABN, account type — Commercial / Residential / Credit Account / COD Only — and payment terms COD/NET 7/14/21/30).
3. **Service step** — pick from the Service Matrix: General Waste (2m³ $195 up to 12m³ $595), Green Waste (2–8m³ $175–$395), Soil & Rubble (2–6m³ $295–$595), Concrete & Bricks (2–4m³ $345–$520), Mixed C&D (4–10m³ $315–$575), Asbestos (2m³ $695, 4m³ $995, larger volumes POA), Contaminated Soil (POA). Prices here are ex-GST.
4. **Details step** — Address* , Suburb*, Postcode, Delivery Date* (min tomorrow), Collection Date, Special Instructions (customer-visible), Internal Notes (not visible to the customer).
5. Click **Create Booking →**. The booking is created with status **pending**.

The Bookings page itself lists the latest 100 bookings with a search box (customer or suburb) and status filter chips (All / pending / confirmed / scheduled / in progress / completed). For **completed** bookings, owners and bookkeepers see a **+ Xero Invoice** button — note this calls the Xero invoice endpoint, which is held behind the `XERO_WRITE_ENABLED` kill-switch and currently refuses to push (see Known limitations).

### 4. NEW JOB on the Dispatch board

For quick dispatcher-entered jobs:

1. Open **Dispatch** → click **+ New Job**.
2. Fill the form: **Customer Name*** (the only required field), Address, Suburb, Estimated Cost ($), Margin %, Notes, **Bin Size** (2m³, 3m³, 4m³, 6m³, 8m³, 10m³, 12m³) and **Waste Type** (General Waste, Soil, Green Waste, Asbestos, Other).
3. Optionally complete the **Assignment (optional)** section: Driver (from the roster of profiles with the `driver` role), Truck (active trucks from fleet assets), Scheduled Date.
4. Click **Add Job**.

Birth status rule (shown in the modal as a hint): **driver + scheduled date at creation → the job is born "Scheduled"; leaving the driver empty creates it in "Pending" with an ⚠ Unassigned chip.**

---

## Dispatch board

Route `/dispatch`. A dark-themed kanban board headed "Dispatch Board" with today's date.

**Columns** (left to right): **Pending** ⏳ "Awaiting scheduling" · **Scheduled** 📅 "Assigned & ready" · **In Progress** 🚛 "Driver on job" · **Completed** ✓ "Done". A stats bar above the board shows Total Jobs, Pending, In Progress, Completed and **Pipeline Value** (sum of estimated cost of all non-completed jobs).

**Change a job's status:** drag its card to another column and drop it. The change saves immediately (optimistic update; rolls back if the database write fails). Swipe sideways on mobile to reach all four columns.

**Driver filter:** the "Driver:" dropdown offers **All Drivers**, **⚠ Unassigned only** (with a live count), each roster driver with their job count, and any "Legacy: <name>" entries (historical free-text driver names that don't match the roster). A **Clear** button resets the filter.

**⚠ Unassigned chips:** any **Scheduled** or **In Progress** card without a real driver assignment shows a clickable amber **⚠ UNASSIGNED** chip (Pending cards are expected to be unassigned, so they never show it). Column headers also show an ⚠ count badge of unassigned jobs in that column. Clicking the chip expands the card straight into the assignment panel.

### Assigning a driver, truck and date

1. Click a job card to expand it (cards show customer, status badge, bin size, waste type, suburb, cost and margin; expanded view adds full address, date and notes).
2. In the expanded card's **Assignment** panel, choose a **Driver** from the dropdown (drivers are profiles with the `driver` role — if the list says "No drivers yet — add in Team page", create driver accounts on the Team page first), a **Truck** (active trucks from the fleet roster, e.g. "TRK-01 — Mack Hook Lift"; "— None —" allowed), and a **Date**.
3. Click **Assign** (the button is disabled until a driver is selected). The job saves driver, truck and date in one update. If the job was Pending and now has both a driver and a date, it automatically moves to **Scheduled**.
4. To reassign, expand the card again, pick a different driver/truck/date and press Assign — assignment is editable up until the job is completed. The reassigned job appears in the new driver's phone queue on its next refresh.
5. To unassign, click **Clear** — driver fields are wiped (truck/date as currently shown are kept) and the ⚠ chip returns.

If the bookings table is empty the board shows sample jobs and assignment is disabled with the note "Sample data — connect the bookings table to assign drivers".

### Other dispatch controls

- **🗺 Live Map** — toggles the embedded live map above the board (see Live map section). The map only loads, and only polls, while toggled on.
- **Show job costing on cards** — a checkbox; when ticked, each expanded card includes a live job-costing widget (revenue / cost-so-far / margin). Off by default; your choice is remembered on this device.

---

## Driver app

Routes: `/driver` (standalone phone portal — this is what drivers should bookmark) and `/drivers` (the same app inside the office shell, reachable from the side menu so office staff can see what drivers see). The portal is dark-themed, phone-width, and shows "SS · DRIVER" in the top bar.

### Login and the pre-start gate

1. Sign in with your driver email and password on the Driver Portal screen.
2. You land on a locked screen: 🔒 **PRE-START REQUIRED** — "You can't see today's jobs until your vehicle checklist is complete." If jobs are waiting you see a teaser count ("3 jobs waiting for you") with blurred placeholder rows — no job details leak before the checklist.
3. Tap **✅ Start Checklist**.

### The vehicle pre-start checklist (hard gate)

The checklist screen is titled **Pre-Start Checklist** — "All 10 items + truck required to start shift". There is no close button while it is the pre-shift gate and there is no "Check All" shortcut.

1. Select your **Truck / Vehicle ID** (required) from the roster dropdown, or choose "Other / not listed…" and type a rego/fleet code.
2. Answer all 10 items with explicit **Pass** or **Fail** buttons: Tyres, Lights, Hydraulics, Brakes, Mirrors, Seatbelt, Fire Extinguisher, First Aid Kit, Water & Fuel, Load Restraints. Unanswered is not the same as failed — every item must be answered.
3. Any **Fail** opens a note box — a fault description of at least 5 characters is required.
4. Optional general notes.
5. The submit button stays disabled until everything is complete, with a reason line underneath (e.g. "2 unanswered · truck not selected") so you never have to guess.
6. If everything passed, press **✓ Submit — All Clear**; you get an "All Clear — have a safe shift" screen and the job queue unlocks.
7. If anything failed, pressing **Submit Checklist** opens a confirmation sheet: "⚠ N failed item(s) will be logged as a defect. Your fleet manager will be notified and your shift is blocked until cleared." Confirm with **Log Defect & Notify** or **Go Back**.

A failed checklist shows the amber **CHECKLIST FAILED — DEFECT LOGGED** gate screen with **Re-Run Checklist** and **📞 Call Dispatch** buttons. Whether a failed checklist blocks the shift is governed by the safety rule `checklist_block_shift` (default ON). If management relaxes it to warn mode, jobs unlock but a tappable warning banner stays at the top of the app. A *missing* checklist always blocks — only a submitted-but-failed one can be relaxed. The pass state is per calendar day and per driver; yesterday's pass never carries over. The checklist can be re-opened any time from the menu (✅ Pre-Start Checklist, badge ✓ or !).

### Today's jobs and the job state machine

Once unlocked, **Today's Jobs** lists your assigned jobs with stats (Remaining / Done / Total) and Active/All filter tabs. Jobs are cached for two hours so the list still shows in mobile black spots ("No signal — showing cached jobs").

Each job card expands to show special instructions, a **📍 Navigate** button, and one big action button at a time, driven by the state machine:

**pending/confirmed/scheduled → en_route → arrived → in_progress → completed**

1. **🚚 Start Drive (En Route)** — marks the job en route.
2. **📍 Mark Arrived** — *hard gate #1:* blocked (greyed out with "⚠ Complete the pre-start vehicle checklist first") unless today's checklist has passed.
3. **▶ Start Job** — marks in progress.
4. **✓ Mark Complete** — *hard gate #2:* blocked with "📸 Take a delivery photo before completing" until at least one delivery photo exists for the job. Tapping the warning opens the camera.

Every transition records a GPS-stamped job event (lat/lng/accuracy) for costing and audit. Status changes that fail offline show "Failed to update — check connection"; retry when you have signal.

### Photos

Three photo buttons per job: **Delivery Photo** 🚛, **Collection Photo** 🔄, **Tip Docket Photo** 🧾. Tap one to open the device camera, preview, and confirm upload. The delivery button turns green ✅ once a delivery photo exists (that's what unlocks Mark Complete).

**AI waste audit on collection photos:** after a collection photo uploads, the app offers an AI load check. The photo is analysed in seconds by Claude vision: detected waste types, dominant type, density class, whether it matches what the customer declared, confidence (shown as percentage + word: High ≥75%, Medium ≥50%, Low) and a short rationale. Drivers never see dollar amounts. If the contents don't match the declaration, the result is flagged for the office queue; the driver can also manually flag the load with a note. Low-confidence results go to "needs human eyes" review rather than asserting a verdict. AI being unavailable never blocks the job — the photo is already saved.

### Hazard reports

Tap **🚨 Report Hazard** on any job. Choose a hazard type — Asbestos ☠️, Electrical ⚡, Structural 🏚️, Access Issue 🚧, Chemical Spill 💧, Animal/Wildlife 🐍, Other ⚠️ — describe it (required), and submit. Your GPS position is attached automatically when available. Reports land in Fleet → Driver Compliance for the office to acknowledge and resolve.

### GPS location sharing (consent-based)

Once your shift is active, a one-time banner asks: "📡 Share your live location with dispatch while on shift? It powers the live map and only runs while the app is open." Tap **Share Location** to consent (stored on your profile). After that, while a shift is active and the app is foregrounded, the app publishes your position at most every 15 seconds and only after you've moved at least 25 m (with a 4-minute heartbeat while parked); poor fixes (>100 m accuracy) are dropped. A 📡 icon in the top bar shows when publishing is live. Nothing is published outside an active shift or before consent.

### Navigate

The **📍 Navigate** button opens Google Maps turn-by-turn with the job's destination pre-filled — geocoded coordinates when the booking has them, otherwise the raw address text. SkipSync never does in-app navigation; it hands off to Google Maps like every production driver app.

### Tip or Return decision

After a pickup (job in progress or completed), tap **🗑 Tip or Return?**. The screen shows your current load (bin size, waste type, estimated tonnage — defaults to ~1 t until weighed) and a ranked list of options, each with an estimated dollar cost and an expandable breakdown: ~km, fuel $, labour $, tip fee, recycling credit, redeploy saving. Options are: tip at each eligible nearby site (sites that don't accept your waste type are excluded) then run the next job, versus **🏠 Return to Base**. The cheapest gets a ★ Recommended badge. Each tip site has its own Navigate button. Choose with **✓ Tipping Here** or **✓ Heading Back** — your actual choice is what's recorded; the recommendation is advisory only. On-screen caveat (take it seriously): "Distances are road estimates. Tip rates are seeded placeholders until verified." All the rates feeding this screen (fuel $/km, driver $/hr, search radius, redeploy minimum) come from the Rules Engine.

---

## Waste audits & billing adjustments

Route `/waste-audits` ("Waste Audits" in the side menu — visible to managers and the bookkeeper). Route access: **owner, manager, fleet_manager, bookkeeper**. Approve/Dismiss actions: **owner, manager, fleet_manager only** — the bookkeeper sees a read-only queue.

The page header says it plainly: "AI bin-photo checks. Adjustments are internal records only — Xero is never written."

How to process the queue:

1. Open **Waste Audits**. Two tabs: **pending** and **resolved**.
2. Each card shows: the bin photo (click to open full size), the customer/booking details, chips for **Declared: <type>** vs **AI saw: <type>**, the confidence percentage, the AI's written rationale, and any driver note / "Driver flagged" chip.
3. For a genuine misdeclaration, set the **Adjustment $** (pre-filled from the `weight_overage_rate_per_tonne` rule — default $95/t), type a **Reason** (e.g. "soil in general waste bin") and click **✓ Approve Adjustment**.
4. For a false positive, click **Dismiss (False Positive)**.
5. Resolved cards keep a summary line of each adjustment's status, amount and reason.

Critical to understand: an approved adjustment is an **internal record with an evidence trail** (photo, declared vs detected, confidence, rationale, who approved). **Nothing is pushed to Xero** — the card itself reminds you: "Internal record only — Sarah invoices any approved amount manually in Xero." Xero is read-only by design until the proof-of-concept validates writes (the `XERO_WRITE_ENABLED` switch defaults off). The AI never bills anyone unilaterally: drafts are only created at confidence ≥ 0.7, every adjustment needs human approval (`adjustment_requires_approval` rule, default ON), and per-driver analysis is capped at 50 photos/day.

---

## Invoices & collections

### Invoices (`/invoices`)

Invoices are **auto-generated when a job is marked completed** (the empty state says exactly that). Numbering is `INV-YYYY-NNNNN`. Each invoice carries the ex-GST amount, GST (10%) and inc-GST total.

The page shows four KPI cards (Outstanding $, Overdue count, Paid total, Drafts), status filter chips (**All / Draft / Sent / Overdue / Paid**), and the invoice list (Invoice #, Customer, Amount, Due, Overdue days, Status).

Working an invoice:

1. Click a row to open the detail modal: amounts breakdown, Created/Due/Sent/Paid dates, the **Payment Reminders** strip showing whether the 7-day, 14-day and 30-day reminders have gone out, the customer email, and a Xero badge ("Xero ✓" or "Xero pending") if the invoice is linked to Xero.
2. Owners and bookkeepers can press **Mark as Sent** (drafts) and **Mark as Paid**.
3. The **Sync Xero** button (top right, owner/bookkeeper) pulls payment status *from* Xero and marks matching invoices paid — a read-only sync, reported as "Synced N invoices — N marked paid".

Automation behind the scenes (Vercel crons):

- **Invoice chase** — daily at 9:00 UTC (≈7 pm AEST). Marks past-due invoices overdue and emails escalating reminders: friendly at 7+ days, firm at 14+ days, final notice at 30+ days — each sent once, tracked on the invoice.
- **Reminders** — daily at 8:00 UTC, a second reminder stream driven by the aged-debtors buckets.
- **Xero payment sync** — daily at 10:00 UTC.

Note: reminder emails are currently domain-restricted to `@binnedit.com.au` recipients (a deliberate safety hold) — see Known limitations.

### Collections (`/collections`)

The accounts-receivable enforcement page for seriously overdue invoices. Escalation ladder (badges on every overdue invoice):

- **Level 0 — Current** (0–4 days)
- **Level 1 — Notice** (5–9 days) → action **Send Overdue Notice** (friendly reminder)
- **Level 2 — Formal Notice** (10–14 days) → formal notice with interest warning
- **Level 3 — Letter of Demand** (15–20 days) → legal letter of demand
- **Level 4 — Statutory Demand** (21+ days) → wind-up warning under the Corporations Act

Sending a letter:

1. Open **Collections**, find the overdue invoice, and choose the escalation action for its level.
2. A letter preview modal renders the full CFO-grade HTML letter (in a sandboxed frame so you can also **print** just the letter).
3. Pick the delivery method — **email**, post, or manual — and press Send. Email goes out via the accounts address; "post" currently only queues the letter (postal dispatch is a stub awaiting a provider integration); "manual" records the event without sending.
4. Every dispatch is recorded as a collections event with a verbatim copy of the letter, so the audit trail survives a dispute.

Guard rail: if the company identity (ABN/ACN/BSB etc.) hasn't been configured in Settings, the modal shows "⚠ Company config not set… this letter would be legally defective if sent" — configure Settings → Company Identity first. Director-guarantee and security-over-assets letter templates also exist for account customers (generated from the Customers page workflows).

---

## Fleet

Route `/fleet` — "Fleet Management: vehicles, bin inventory, maintenance records & rego tracking." KPI row: Vehicles Total, Vehicles In Use, Bins On Site, **Rego Alerts** (registrations due within 90 days).

Four tabs:

- **Vehicles** — a card per truck/trailer: identifier, description, status badge (Available / In Use / In Transit / Maintenance / Retired), rego and expiry, year, odometer, location (🏭 depot, 📍 on-site, 🚛 in-transit, 🔧 workshop), next service. Badges escalate: "REGO 90d" amber → "REGO DUE 30d" red → "REGO OVERDUE", plus "SERVICE DUE Nd" within 30 days. A red banner at the top lists every vehicle with rego expiring within 90 days.
- **Bin Inventory** — location summary counts (depot / on-site / in-transit / workshop) and a row per bin with status, location and notes (e.g. which job it's on).
- **Maintenance Log** — table of maintenance records (Asset, Description, Type — service/repair/inspection/registration/other — Date, Cost, Next Due, performed by). Add records via **+ Log Maintenance**: pick the asset, type, description, date performed (required), next due date, cost, provider, notes → **Log Record**. (Current limitation: the visible log list still renders seeded sample records; new entries save to the database but don't yet appear in this list.)
- **Driver Compliance** — the fleet manager's review hub. Two sections: **vehicle checklists** (filter by date range, driver and pass/fail; failed items and the driver's defect notes are shown — the pass verdict comes from the database, so it can't be massaged) and **hazard reports** (filter by status; move reports **open → acknowledged → resolved**). Note: the resolve/acknowledge database write is currently permitted for owner/manager roles only — a fleet_manager sees the buttons but the save can fail until the access policy is extended (known limitation).

---

## Rules engine

Route `/rules` ("Rules Engine" in the side menu). Access: **owner, manager, fleet_manager** — everyone else is redirected and the page itself re-checks the role.

Rules are grouped by category: **Routing, Tipping, Billing, Safety, Pricing, Dispatch**. The seeded rules and defaults:

| Rule | Default | Category | Controls |
|---|---|---|---|
| Fuel cost per km | $0.68/km | Routing | Tip-decision ranking and route costing |
| Driver cost per hour | $45/hr | Routing | Tip-decision labour costing |
| Tip search radius | 25 km | Tipping | How far to look for candidate tip sites after a pickup |
| Redeploy savings minimum | $25 | Tipping | Minimum saving before suggesting tip-and-redeploy over return-to-base |
| Checklist blocks shift | ON | Safety | Hard gate: drivers can't see/start jobs until today's checklist passes. Fails closed if unreadable |
| Weight overage threshold | 15% | Billing | How far estimated weight may exceed declared before a billing review flag |
| Weight overage rate per tonne | $95/t | Billing | Pre-fills the adjustment $ in the Waste Audits queue (internal records only) |
| Adjustment requires approval | ON | Billing | Billing adjustments need owner/manager approval — no machine ever bills a customer alone |
| Max jobs per truck per day | 8 | Dispatch | Soft cap; dispatch warns beyond it |
| AI confidence floor | 0.5 | Billing | Below this confidence, waste audits are stored for human review only, no auto-draft |

How to edit:

1. **Numbers** — click the value, adjust with the − / + steppers or type, then **Save** (Enter saves, Esc cancels). Input is validated client-side (non-numeric and negative values are rejected; percentages capped at 100; the confidence floor capped at 1).
2. **Booleans** — flip the ON/OFF toggle; it saves immediately and shows a 5-second **Undo** toast.
3. **Safety rules** get deliberate friction: turning one off requires typing the rule's name to confirm.
4. **History** — every rule has a per-rule change history (old value → new value, who, when), written automatically by a database trigger. Use it to trace "why did the tip engine change its mind on Tuesday".

Changes apply on the next computation that reads the rule — no deploy needed. A disabled rule behaves as if absent: consumers fall back to the hardcoded default (for safety rules that default is the restrictive setting, so a broken table can never relax a safety gate). If the rules table is unreachable the page renders the defaults read-only under an amber banner.

---

## Live map

Toggled with the **🗺 Live Map** button on the Dispatch board.

- **Driver markers** — a heading arrow plus a name·truck pill for each driver publishing GPS, polled every 10 seconds. The popup shows status, speed, "Last seen N min ago", the driver's current job, and a **View job** button that jumps to the kanban card.
- **Staleness** — a fix older than 5 minutes greys the marker and adds a 🕐 age badge ("🕐 12m") so dispatch never mistakes stale for live. Older than 30 minutes, the driver leaves the map entirely and is listed in a collapsible "Offline" row.
- **Booking pins** — today's jobs as teardrop pins colour-matched to the kanban columns (amber pending, blue scheduled/en-route, purple arrived/in-progress, green completed/faded). Pin popups show bin/waste/address, the assigned driver or an "⚠ Unassigned" warning, and an **Open card** button.
- **Geocoding** — booking addresses are geocoded on demand via OpenStreetMap Nominatim, strictly one request per second, and the result is cached on the booking forever (max 15 geocodes per map mount). A booking whose address can't be geocoded simply has no pin; the driver's Navigate button still works by passing the raw address to Google Maps. Geocoding failure never blocks bookings or jobs.
- The map auto-fits to contain all markers and offers a manual fit control; OpenStreetMap attribution is mandatory and must not be removed.

If the locations table is unavailable, an amber "Live positions unavailable — retrying…" strip appears and job pins still render.

---

## Financial reports

Route `/dashboard/<tab>` — the **Financial Reports** tile / **Reports** menu entry. Twelve tabs, by their visible labels:

**Overview · Sales · Profit · Compare · Competitors · Prices · New Customers · Trucks & Bins · Who Owes Us · Cash · Compliance · Action List**

(Internally these map to snapshot, revenue, margins, benchmarking, competitors, pricing, bdm, fleet, debtors, cashflow, risk and workplan — relevant only if you're reading URLs.)

How to use:

1. Pick a month with the **month selector** (header dropdown on desktop, full-width dropdown on mobile). The URL keeps the month, so links are shareable.
2. Pick the accounting **basis** with the Cash/Accrual toggle (cash is default; the active tab shows an "Accrual basis" pill when switched).
3. Click through tabs. Most tabs end with a **Recommended Actions** panel listing alerts for that area (critical / warning / info / positive). **Action List** is the working to-do list — items can be ticked off and the tick is remembered.
4. **PDF export** — on desktop a PDF export button sits in the header while on the dashboard; it produces a print-formatted report with a header ("SkipSync — <TAB>", period, generated date).

**Monthly History** (`/history`) shows a card per month, green-bordered "Complete" months with their revenue, grey "No data" months. Click any month to open it on the Overview tab.

**Load Data wizard** — Home tile "Load Data" or menu entry → pick the month (`/month-select`) → the 12-step wizard (`/wizard`):

1. P&L — Accrual (Monthly) — Xero export upload
2. Cash Summary — Xero upload
3. Aged Receivables — Xero upload
4. Balance Sheet — Xero upload
5. Bin Type Usage — Bin Manager export
6. Jobs by TipSite — Bin Manager export
7. Westpac Bank Statement — the true cash position
8. Data Quality Check — unreconciled items, is this P&L final, known missing invoices
9. Operational & Compliance — WHS incidents, near-misses, toolbox talks, training, certifications, asbestos docs, EPA licence, vehicle inspections
10. Market, Business & Cash — competitor pricing, outlook, expected payments
11. Review & Generate — warnings and a 6-month cash projection preview
12. Generate Report

Each upload step includes the exact Xero/Bin Manager menu path to produce the file. On completion the data saves locally and to Supabase, and you're dropped onto the dashboard Overview for that month.

The separate `/reports` screen (Monthly Management Report, Profitability by Bin Type, Training Register, Incident Register, Cash Flow Forecast, Balance Sheet Analysis) is a list of **Coming Soon** placeholders — none of those documents generate yet.

---

## Team & settings

### Settings (`/settings`)

Two navigation cards at the top — **Team & Staff** and **Audit Log** — then the sections:

- **Alert Thresholds** — the table of warning/critical values behind dashboard alerts; the owner can edit each row.
- **User Management** (owner) — invite users by email and set roles.
- **Bin Types** — bin type/pricing reference data.
- **Company Identity** — company name, ABN, ACN, registered address, accounts phone/email, BSB, bank account, penalty interest rate, plus a letterhead logo upload (PNG/JPG/SVG, max 2 MB). These values feed the collections letters — until they're filled in, letter sending is flagged as legally defective.
- **White-Label Widget** — the iframe embed snippet for `/embed/<slug>` partners.
- **Xero** — connection status, connect button and sync controls (read-only sync of financials; a green "Xero Connected Successfully" toast confirms linking).
- **Push notifications** — enable/disable browser push.

### Team & Staff (`/settings/team`)

Owner-only menu entry (the route itself renders for any office user; edits need owner/manager).

1. The **Team Members** list shows each profile with a role badge. Owner/manager click **Edit** to change full name, phone, and role — roles selectable: owner, manager, bookkeeper, **driver**, fleet_manager, viewer. Setting someone to **driver** is what makes them appear in the Dispatch assignment dropdown and gives them the `/driver` portal experience.
2. Click a member to expand their **Recent Activity** (their audited inserts/updates/deletes).
3. Below the list, the **Compliance panel** manages staff certificates and insurance policies with 30-day and 7-day expiry warnings.

### Audit Log (`/settings/audit`)

Owner-only menu entry. An immutable record of every INSERT/UPDATE/DELETE on bookings, invoices and customers, with field-level before→after diffs, filterable by table, action and date range, paged 50 at a time. AI-made driver assignments also land here, marked `ai_assign_job`.

### Investor View (`/investor`)

A deliberately limited, read-only one-pager: FY performance summary (YTD revenue, net profit, gross margin, annualised run-rate), the monthly revenue/net-profit chart, and a balance sheet summary, with a "read-only investor dashboard" notice and Sign Out. Viewer/investor accounts can see nothing else — any other URL bounces them back here. Owners and managers can open it from the side menu to preview exactly what the investor sees (an "investor view sandbox").

---

## AI features

### Chat assistant

Open it with the yellow **💬** floating button (bottom-right on desktop) or the **Chat** button in the mobile bottom bar. The panel is titled **SkipSync Assistant — Powered by Claude** and shows the month it has context for. Suggested starter questions: "What's my biggest cash flow risk?", "How does this month compare to last month?", "Which bin type has the worst margin?", "What compliance items are due soon?".

The assistant streams answers with the selected month's financial data and active alerts injected as context. There is a rate limit of **50 messages per user per day**. In local development it only works under `vercel dev` (not plain `npm run dev`) because it's a serverless function.

**What the assistant can DO (agentic tools).** The chat endpoint has role-gated tools wired to the live database:

- **Read tools — any authenticated user:**
  - *get_jobs* — look up bookings/jobs (by date, status, or unassigned-only; "today" resolves in Melbourne time).
  - *get_roster* — today's roster: all drivers, active trucks, who has passed today's pre-start checklist, and each driver's current job count.
  - *get_business_rules* — current values of every rules-engine setting.
- **Write tool — owner, manager and fleet_manager only:**
  - *assign_job* — set the driver, truck and/or scheduled date on one booking. It follows exactly the same rules as the Dispatch board: a pending job given both a driver and a date becomes Scheduled; jobs already en route/arrived/in progress keep their status; completed and cancelled jobs cannot be assigned. Capped at 20 assignments per conversation turn, and every AI assignment is written to the Audit Log with the marker `ai_assign_job`.

So an owner can type "assign tomorrow's unassigned Frankston jobs to Tom" and the assistant will look up the jobs and roster, prefer checklist-passed drivers, respect `max_jobs_per_truck_day`, make the assignments, and report what it did. A bookkeeper or viewer asking the same gets information only — the assistant cannot assign anything for roles outside owner/manager/fleet_manager, and it never writes anything else (no invoices, no rules, no Xero — ever).

### AI insights panel

On the dashboard, the **Overview**, **Sales** and **Competitors** tabs include an AI insights panel with a Generate button that streams an analysis of that tab's numbers.

The Overview tab additionally carries the **Operational Efficiency** section: a feed of dollar-quantified findings mined daily from operational data (categories: tipping, fuel, routing, pricing, recycling, pipeline, general), each with an estimated monthly saving and a confidence rating. Owner/manager/fleet_manager can mark each insight **Actioned** or **Dismiss** (dismissed findings stay suppressed for 30 days), and owner/manager can hit the refresh button to re-run the analysis on demand.

### Scheduled AI/automation jobs (Vercel crons)

- **Efficiency insights** — daily 19:00 UTC (≈5 am Melbourne): mines costs, tip fees, fuel variance, pipeline and recycling rates; writes only to the insights feed, never touches operational data. With thin data it honestly reports "insufficient data" rather than inventing savings.
- **Weekly digest** — Sundays 20:00 UTC (Monday morning Melbourne): a plain-English AI summary of revenue trends, debtors, compliance and alerts, emailed to Mark.
- **Reminders** (08:00 UTC daily), **Invoice chase** (09:00 UTC daily) and **Xero payment sync** (10:00 UTC daily) — described in the Invoices section.

### AI waste audit

Claude vision analysis of collection photos — see the Driver app and Waste audits sections. Guardrails: 50 analyses per driver per day, 5 MB image cap, text in photos is treated as scene content (never instructions), confidence below 0.5 never drafts an adjustment, and analysis failure never blocks a job.

---

## Known limitations

Things that exist in seeded/placeholder form, are deliberately disabled, or aren't built yet. The assistant should be upfront about these.

1. **Xero is read-only.** The `XERO_WRITE_ENABLED` kill-switch defaults off, so nothing pushes to Xero: billing adjustments are internal records (Sarah invoices manually), and the "+ Xero Invoice" button on completed bookings currently returns a "held until POC validated" refusal rather than creating anything. Payment-status sync *from* Xero (read) works. Writes stay off until Mark validates them in the POC.
2. **Tip site rates are placeholders.** The four seeded south-east Melbourne tip sites (Frankston, Hampton Park, Clayton, Mornington) carry unverified rates; the Tip-or-Return screen says so on every render. Distances are straight-line estimates, not road km. The depot coordinates and the driver app's "Call Dispatch" phone number are also placeholders pending real values.
3. **No payment gateway.** The public booking funnel takes no money — bookings are pay-on-invoice. There is no customer portal, no customer login, and no customer-facing "track your driver" link; dispatch relays ETAs by phone.
4. **The `/reports` document centre is all "Coming Soon"** — management report, training register, incident register, cash-flow forecast and balance-sheet analysis documents don't generate yet. Use the dashboard tabs and PDF export instead.
5. **Reminder/digest emails are domain-restricted** to `@binnedit.com.au` recipients as a safety hold — real customers won't receive automated chasing emails until that restriction is lifted.
6. **Postal letters are queued, not posted.** Collections "post" delivery writes to a dispatch queue; no postal provider is integrated yet.
7. **No offline-first sync.** The driver app caches the job list for two hours and shows an offline banner, but actions (status changes, photos, GPS points) need connectivity; missed GPS points are not replayed. Phone OSes throttle background GPS, so position gaps while the phone is pocketed are expected — that's why markers show their data age.
8. **Checklist is per day, per starting truck.** Swapping trucks mid-day does not force a second checklist (logged as a future enhancement). Hazard/asbestos AI detections are loud advisories, not hard job blocks.
9. **Fleet quirks:** the Maintenance Log list still displays seeded sample records (new entries save but don't appear in the list yet), and hazard-report acknowledge/resolve database writes are limited to owner/manager — a fleet_manager may see the buttons fail until the access policy is extended.
10. **Sample-data fallbacks everywhere.** When database tables are empty or unreachable, Dispatch, Fleet, Customers, Collections and the dashboards render labelled sample/fallback data rather than crashing. Look for the "Showing sample data" or fallback banners before trusting numbers.
11. **Chat limits:** 50 messages per user per day; AI assignment writes are capped at 20 per conversation turn; the assistant only works in deployed environments or under `vercel dev` locally.
12. **Investor view is fixed to cash basis** and a single summary page by design.
