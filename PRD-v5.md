# Binned-IT Hub — Product Requirements Document v5.0

**Version:** 5.0
**Date:** 3 April 2026
**Status:** ACTIVE — Master PRD, drives all ongoing development
**Author:** Mark Beddoe + Claude Code (Anthropic)
**Supersedes:** PRD v4.0, WasteManager PRD v1.0, WasteManager Ultra-MVP Phase 1

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision Statement](#2-vision-statement)
3. [Business Context](#3-business-context)
4. [User Personas](#4-user-personas)
5. [UX/UI Architecture — Navigation Overhaul](#5-uxui-architecture--navigation-overhaul)
6. [What's Already Built](#6-whats-already-built)
7. [Feature Map by Workflow Stage](#7-feature-map-by-workflow-stage)
8. [Complete Feature Requirements](#8-complete-feature-requirements)
9. [Phased Delivery Plan](#9-phased-delivery-plan)
10. [Technical Architecture](#10-technical-architecture)
11. [Integration Map](#11-integration-map)
12. [Data Model Changes](#12-data-model-changes)
13. [Success Metrics](#13-success-metrics)
14. [Risk Register](#14-risk-register)

---

## 1. Executive Summary

Binned-IT Hub v5 is a complete end-to-end skip bin hire management platform built exclusively for Binned-IT Pty Ltd. It unifies daily operations, financial intelligence, driver management, customer communication, and business analytics into a single system — replacing the current fragmented stack of Bin Manager, Xero manual exports, paper run sheets, and spreadsheets.

**The fundamental shift from v4 to v5:**

v4 was a _financial reporting dashboard_ with operations as an afterthought. v5 flips this: **operations is the primary interface**. The home screen is the dispatch board showing today's jobs. Financial reporting is still here — now it's a tab within a broader operational platform rather than the whole product.

**What this platform will do when complete:**
- A customer calls or books online → booking created automatically
- Booking triggers availability check, auto-schedules to a truck, confirms to customer via SMS/email
- Driver opens their mobile run sheet, sees jobs for the day with navigation
- Driver photographs bin, captures tip docket via OCR, records weight
- AI checks bin contents photos for hazardous materials or heavy load risk
- Job completion triggers automatic Xero invoice creation
- Overdue invoices trigger automated follow-up sequence
- Mark sees live job costing per job as it happens
- Weekly AI intelligence report surfaces pricing changes needed, cost shifts, competitor intel
- All historical reporting (financial P&L, AR aging, margins, compliance) remains fully intact

This is the single source of truth for running Binned-IT from first customer contact to final payment, with intelligence layered on top to make every decision faster and better.

---

## 2. Vision Statement

Mark's words, preserved verbatim:

> "The operational use should be the mainstay as this will be used daily — bookings coming in from customers, scheduling, tracking location, updating customers, confirming delivery, tipping tracking, recycling tracking at the transfer station. Getting realtime costs for each job. OCR of receipts from tips, fuel refills, driver costs, any maintenance. Travel optimisation, truck driver running sheet dashboard on mobile devices. Processes for truck drivers to photo bins and ensure correct weight, billing, contents, AI checking of bin contents photos to flag potentially heavy loads, hazardous materials, automate invoices and payments. Wages and overtime critical management aspects. We need a key overview of running the business end to end.
>
> Full skip bin hire management solution including all the items we have built, removing Bin Manager so we can keep all the ops data in the same location as the reporting tool, integrated with Xero so we get invoices out quickly, automate import and reconciliation in Xero, get notices out for overdues and get flagging happening for follow up ASAP. Fully automate the flow from order to delivery, invoice, chase payment, report and pricing. Manage shifting costs and use internet searches to provide intelligence around shifting costs and suggest urgent pricing changes."

**Platform Principles:**
1. **Operations First** — dispatch board is home, not the dashboard
2. **One Platform** — replace Bin Manager entirely, all ops data here
3. **Full Automation** — order → delivery → invoice → payment chase with minimal manual steps
4. **Real-Time Intelligence** — live job costing, cost alerts, competitor pricing via web
5. **Mobile-First for Drivers** — everything a driver needs on their phone
6. **AI Everywhere** — bin content checking, hazmat flagging, pricing recommendations, cost intelligence
7. **Preserve What's Built** — all 7 sprints of existing Hub features retained and integrated

---

## 3. Business Context

### 3.1 Company Profile

**Binned-IT Pty Ltd** — skip bin hire, Seaford, Melbourne.
- FY Revenue: ~$1.5–1.8M annually
- Fleet: multiple trucks (hook-lift and tilt-tray)
- Bin types: 18+ SKUs, 4m³ to 23m³
- Waste streams: general waste, asbestos, soil, green waste, contaminated
- Staff: 6–10 including drivers, admin, management
- Accounting: Xero (accrual basis)
- Current ops system: Bin Manager (to be replaced)
- Banking: Westpac

### 3.2 Current Pain Points

| Pain | Impact | Solution in v5 |
|------|--------|---------------|
| Bin Manager is separate from Hub — double handling | 30+ min/day admin overhead | Replace Bin Manager entirely; all ops in Hub |
| No live job costing — profitability unknown until end of month | Cannot reprice quickly | Real-time cost capture per job |
| Manual Xero invoice entry after each job | 5–10 min per job × 80 jobs/week = 6+ hrs/week | Auto-invoice on job completion |
| Paper run sheets for drivers | Lost data, no accountability, no photos | Mobile driver dashboard |
| No automated customer communications | Staff time + missed follow-ups | Automated SMS/email at every stage |
| Tip dockets filed manually or lost | Cannot verify tipping costs | OCR receipt capture on driver phone |
| No overdue invoice automation | Debtors blow out | Automated dunning sequence |
| No pricing intelligence from market | Pricing decisions on gut feel | Web-sourced cost and competitor intelligence |
| Wages/overtime tracked in Xero only | No operational visibility | Rostering + time tracking module |

### 3.3 Strategic Goals

1. **Eliminate Bin Manager** — all operational data in one place
2. **Zero manual invoicing** — every completed job auto-invoices to Xero
3. **Sub-5-minute job costing** — real costs captured as job happens, not end of month
4. **Driver accountability** — photos, weights, signatures, dockets from every job
5. **Cash flow protection** — automated overdue chasing from day 1 overdue
6. **Pricing intelligence** — weekly AI-generated pricing review with market data

---

## 4. User Personas

### 4.1 Mark — Owner / Director / Operator

**Age:** 45 | **Device:** 60% mobile, 40% desktop
**Role:** Business owner, primary decision-maker, often in the yard or on the road
**Access:** Full owner access — all features

**Daily reality:** Mark starts his day in the yard watching trucks leave. He needs to see today's jobs loading correctly, any problems with yesterday's billing, and his cash position — all in 5 minutes on his phone before the day gets chaotic. Currently this takes 30–45 minutes of digging through Bin Manager, Xero, and a spreadsheet.

**What v5 gives Mark:**
- Morning: opens Dispatch Board on phone — today's jobs, any issues flagged red
- Throughout day: live alerts for hazmat flags, driver delays, unbilled jobs
- Weekly: AI pricing intelligence report with recommended rate changes
- Monthly: financial snapshot auto-populated from Xero sync, no manual entry needed

**Critical mobile features:** Dispatch board, live job status, driver locations, AI pricing alerts, debtor summary, cash balance

### 4.2 Sarah — Office Manager / Bookkeeper

**Age:** 38 | **Device:** 90% desktop, 10% tablet
**Role:** Invoicing, AR follow-up, payroll, Xero reconciliation, monthly close
**Access:** Bookkeeper role — all ops + all financial dashboards, no system settings

**Daily reality:** Sarah currently enters bookings into Bin Manager, then re-enters billing data into Xero. She chases overdue debtors manually by phone. She spends 45–60 minutes each month reformatting Xero exports for Mark.

**What v5 gives Sarah:**
- Booking enters once in Hub → flows to Xero automatically
- Overdue debtors automatically chased; she reviews/approves escalations
- Month-end: Xero auto-syncs into Hub; no manual export/reformat
- AR aging visible with trend at a glance, not buried in Xero

**Critical features:** Booking entry, invoice management, AR aging with trends, automated dunning approval, Xero sync dashboard

### 4.3 Jake — Fleet / Operations Manager

**Age:** 34 | **Device:** 70% mobile (yard/road), 30% desktop
**Role:** Driver coordination, bin logistics, fleet maintenance, EPA compliance
**Access:** Manager role — all ops + dashboard + compliance entry

**Daily reality:** Jake uses a whiteboard to assign trucks each morning. He has no real-time visibility of where jobs are at. Maintenance records are in a folder. EPA compliance records are in another folder. He tracks bin availability by walking around the yard.

**What v5 gives Jake:**
- Dispatch board: drag-drop job assignment to drivers/trucks
- Live job status: see each driver's progress in real time
- Bin inventory: auto-updates as jobs are scheduled/completed
- Maintenance due dates surfaced in dashboard with countdown
- EPA compliance records centrally logged, expiry alerts to his phone

**Critical mobile features:** Dispatch board, driver status map, bin inventory, compliance quick-log

### 4.4 Drivers (Tom, Dave, and others)

**Age:** 25–50 | **Device:** 100% mobile (Android/iOS)
**Role:** Deliver and collect bins, tip waste, capture proof of delivery
**Access:** Driver role — their run sheet only, no financial data

**Daily reality:** Drivers currently get a paper run sheet each morning. They navigate manually. They file paper tip dockets. They call the office if there's a problem. No proof of delivery is captured systematically.

**What v5 gives drivers:**
- Digital run sheet on phone: jobs in order, tap for navigation
- One-tap job status updates: en route → arrived → delivered → photo captured
- Tip docket photo: OCR extracts tonnage and cost automatically
- Bin photo: AI checks for hazmat/heavy load flags before they lift
- Weight capture: input tipping weight at transfer station
- Pre-start vehicle checklist: digital, creates compliance record

**Critical mobile features:** Run sheet, navigation tap-through, job status, photo capture, tip docket OCR, pre-start check

**UX requirement:** Must work with gloves. Large touch targets (min 44px). Offline mode — jobs cached for 8 hours, sync on connection return.

### 4.5 Customers (Public Booking)

**Device:** Mix of mobile and desktop
**Role:** Book bins, receive updates, pay invoices
**Access:** Public booking form only (no login required for basic booking)

**What v5 gives customers:**
- 24/7 online booking with live pricing and availability
- Instant confirmation SMS + email
- Day-before reminder SMS
- "Driver on way" notification with ETA
- Post-delivery confirmation with bin placement photo
- Online invoice payment link

### 4.6 Andrew — Investor / Silent Partner

**Age:** 55 | **Device:** 50% desktop, 50% tablet
**Role:** Equity investor, non-operational
**Access:** Investor view — read-only financial snapshot, no ops data

**What v5 gives Andrew:**
- Unchanged from v4: read-only financial dashboard at `/investor`
- Monthly email digest with key KPIs
- No access to bookings, driver data, or customer records

---

## 5. UX/UI Architecture — Navigation Overhaul

### 5.1 The Fundamental Change

**v4 structure (current):** Financial reporting dashboard → operations was a future feature
**v5 structure:** Operations dispatch board → reporting is a section within a broader platform

### 5.2 Primary Navigation (Desktop — Left Sidebar)

```
BINNED-IT HUB
─────────────────────
[TODAY'S OPERATIONS]   ← HOME — dispatch board, today's jobs
  Dispatch Board
  Live Job Map
  Driver Runsheets

[BOOKINGS]
  New Booking
  All Bookings
  Customer Database

[FLEET & BINS]
  Bin Inventory
  Vehicle Fleet
  Maintenance Log

[INVOICING & PAYMENTS]
  Pending Invoices
  Overdue Accounts
  Xero Sync Status

[REPORTS & INTELLIGENCE]
  Financial Dashboard  ← all 11 existing tabs live here
  Job Costing
  Pricing Intelligence
  ESG & Recycling

[COMPLIANCE]
  EPA & Licences
  WHS Records
  Driver Certifications

[SETTINGS]             ← owner only
  Users & Roles
  Pricing Rules
  Notification Settings
  Integrations
─────────────────────
AI Assistant (floating, all screens)
```

### 5.3 Mobile Navigation (Bottom Bar)

```
[Dispatch] [Bookings] [Jobs] [Reports] [More]
```

- **Dispatch** — today's jobs, driver assignments
- **Bookings** — new booking + recent bookings list
- **Jobs** — live job tracking, status updates
- **Reports** — financial dashboard (existing 11 tabs)
- **More** — fleet, compliance, settings, AI chat

### 5.4 Driver Mobile App (Separate Login State)

When a user with `driver` role logs in on mobile, they see the **Driver View**:

```
[Run Sheet] [Navigate] [Capture] [Pre-Start]
```

- **Run Sheet** — their jobs for today in sequence, status controls
- **Navigate** — tap job to open in Maps
- **Capture** — photo capture for bins, tip dockets, proof of delivery
- **Pre-Start** — vehicle checklist (morning only, blocks jobs until complete)

### 5.5 Screen Breakpoints (unchanged from v4)

380px (small phone) / 640px (large phone) / 768px (tablet) / 1024px (desktop) / 1440px (wide desktop)

KPI grids: `repeat(2,1fr)` on mobile, `repeat(4,1fr)` on desktop — unchanged from current implementation.

---

## 6. What's Already Built

All of the following is **complete and retained in v5** — nothing is removed:

### 6.1 Hub v2.2 — 7 Sprints Complete (as at 29 March 2026)

| Feature | Status |
|---------|--------|
| React 18 + Vite SPA with React Router v6 | Complete |
| Supabase PostgreSQL backend + Auth | Complete |
| Multi-user roles (owner/manager/bookkeeper/viewer) | Complete |
| 11-tab financial reporting dashboard | Complete |
| 12-step monthly data entry wizard | Complete |
| Xero OAuth 2.0 integration (read: P&L, BS, AR sync) | Complete |
| 40+ automated alerts with configurable thresholds | Complete |
| AI assistant (Claude claude-sonnet-4-6 via Vercel Edge Function) | Complete |
| Per-tab AI insights panels | Complete |
| PDF export | Complete |
| Push notifications framework (VAPID — needs real keys) | Complete |
| Mobile PWA (installable on iOS/Android) | Complete |
| Investor read-only view at `/investor` | Complete |
| Competitor pricing matrix (editable, Supabase-persisted) | Complete |
| Work plan tracker with shared completion state | Complete |
| ESG tracking (recycling, landfill diversion) | Complete |
| User invite flow (Supabase admin API via Vercel Edge Function) | Complete |
| 6 database migrations applied | Complete |
| Vercel deployment with GitHub CI/CD | Complete |
| Error boundaries throughout | Complete |

### 6.2 Financial Dashboard Tabs (all retained)

1. Snapshot — KPIs, revenue/profit chart, balance sheet highlights
2. Revenue — category breakdown, concentration risk
3. Margins — COS analysis, cost drivers, anomaly flags
4. Benchmarking/Pricing — per-bin profitability, price calculator
5. Competitors — live competitor rate matrix
6. BDM — new customers, dormant accounts
7. Fleet — bin utilisation, hire duration flags
8. Debtors — AR aging, trend, top debtor concentration
9. Cash Flow — cash in/out, tax liability, runway
10. Risk/EPA — compliance traffic lights, expiry countdowns
11. Work Plan — prioritised actions with shared completion

These tabs move into **Reports & Intelligence** section of the new navigation — content unchanged.

### 6.3 Xero Integration (existing — to be extended)

Currently reads: P&L, Balance Sheet, AR aging → syncs to Supabase.
v5 adds **write** capabilities: invoice creation, payment reconciliation, contact sync.

---

## 7. Feature Map by Workflow Stage

The full operational lifecycle flows through 8 stages. Each stage has existing features (retained) and new features to build.

```
CUSTOMER BOOKING
      ↓
DISPATCH & SCHEDULING
      ↓
DRIVER OPERATIONS (Mobile)
      ↓
DELIVERY & TIPPING
      ↓
INVOICING & BILLING
      ↓
PAYMENT CHASING
      ↓
FINANCIAL REPORTING
      ↓
BUSINESS INTELLIGENCE
```

### Stage 1: Customer Booking

| Feature | Status | Priority |
|---------|--------|----------|
| Online public booking form (24/7, with live pricing + availability) | New | P0 |
| Phone booking entry by admin (guided workflow) | New | P0 |
| Real-time bin availability check on booking form | New | P0 |
| Instant pricing calculator (bin size × waste type × duration × address) | New | P0 |
| Customer confirmation SMS (Twilio) | New | P0 |
| Customer confirmation email (Resend) | New | P0 |
| Google Maps address autocomplete on booking form | New | P0 |
| Booking auto-routes to dispatch queue | New | P0 |
| Customer database (history, account status, credit tier) | New | P1 |
| Repeat customer self-service portal (book/view history) | New | P2 |

### Stage 2: Dispatch & Scheduling

| Feature | Status | Priority |
|---------|--------|----------|
| Kanban dispatch board (Pending → Scheduled → In Progress → Completed) | New | P0 |
| Drag-drop job assignment to drivers and trucks | New | P0 |
| Visual calendar view of scheduled jobs | New | P0 |
| Bin availability check before scheduling (blocks overbooking) | New | P0 |
| Route optimisation: suggest efficient job bundling | New | P1 |
| Map view of scheduled jobs for the day | New | P1 |
| Driver day sheet — auto-generated from dispatch board | New | P0 |
| Delivery window time slot management | New | P0 |
| Live job status tracking (colour-coded by stage) | New | P0 |

### Stage 3: Driver Operations (Mobile)

| Feature | Status | Priority |
|---------|--------|----------|
| Driver mobile run sheet (their jobs for today, in order) | New | P0 |
| One-tap job status updates (en route → arrived → done) | New | P0 |
| Navigation tap-through to job address | New | P0 |
| Pre-start vehicle checklist (digital, blocks jobs until complete) | New | P0 |
| Offline mode — jobs cached 8 hours, sync on reconnect | New | P0 |
| Bin delivery photo capture (geo-stamped, timestamped) | New | P0 |
| AI bin content check — flags hazmat, heavy load risk | New | P1 |
| Customer signature on delivery (optional) | New | P2 |
| In-app call to customer / office | New | P2 |
| Driver pre-start fail workflow (reassigns jobs if truck fails) | New | P2 |

### Stage 4: Delivery & Tipping

| Feature | Status | Priority |
|---------|--------|----------|
| Tip docket photo capture → OCR (tonnage, waste type, cost) | New | P0 |
| Manual weight input at transfer station | New | P0 |
| Fuel receipt photo → OCR (litres, cost, odometer) | New | P1 |
| Tipping facility database (location, accepted types, hours, pricing) | New | P1 |
| Recycling weight capture (material type, weight, recovery value) | New | P1 |
| GPS chain of custody logging (pickup → tip) | New | P2 |
| EPA chain of custody for regulated waste (asbestos, soil) | New | P1 |
| Real-time job cost update as tipping data captured | New | P0 |

### Stage 5: Invoicing & Billing

| Feature | Status | Priority |
|---------|--------|----------|
| Auto-invoice creation on job completion → Xero | New | P0 |
| Invoice line items: bin hire + waste type + tipping fee + extra charges | New | P0 |
| Tonnage-based pricing option (for weight-sensitive jobs) | New | P1 |
| Invoice review + approve before sending (optional safety step) | New | P1 |
| Bulk invoice creation (end of day batch) | New | P1 |
| Xero contact auto-create/match (no duplicate contacts) | New | P0 |
| Invoice status sync from Xero (paid/unpaid/overdue) | Existing (Xero sync) | P0 |
| Invoice adjustment for extras (overweight, contamination surcharges) | New | P1 |

### Stage 6: Payment Chasing

| Feature | Status | Priority |
|---------|--------|----------|
| Automated dunning sequence (7-day email → 14-day SMS → 30-day hold) | New | P0 |
| Overdue invoice alert dashboard (Sarah's daily view) | New | P0 |
| One-click "send reminder" from debtor view | New | P0 |
| Account hold flag (blocks new bookings for accounts in arrears) | New | P1 |
| Payment receipt link in invoice email | New | P1 |
| Credit risk flag for new customers (manual tier assignment) | New | P2 |
| Write-off workflow for bad debts (syncs to Xero) | New | P2 |

### Stage 7: Financial Reporting

| Feature | Status | Priority |
|---------|--------|----------|
| All 11 existing dashboard tabs | Complete | Retained |
| Xero auto-sync (P&L, BS, AR) replacing manual upload wizard | Extend existing | P0 |
| Monthly wizard retained as manual override option | Existing | Retained |
| Per-job profitability report (estimated vs actual) | New | P1 |
| Driver profitability attribution | New | P1 |
| Vehicle cost-per-job analysis | New | P1 |
| Tipping fee trend analysis (by facility, by waste type) | New | P1 |
| Wages and overtime reporting (beyond Xero summary) | New | P1 |

### Stage 8: Business Intelligence

| Feature | Status | Priority |
|---------|--------|----------|
| Weekly AI pricing intelligence report (web-sourced cost data) | New | P1 |
| Fuel cost trend alerts with pricing recommendations | New | P1 |
| Competitor web search for current pricing (automated, weekly) | New | P1 |
| AI virtual CFO — weekly strategic recommendations | New | P1 |
| Demand forecasting (seasonal, weather, construction pipeline) | New | P2 |
| Recycling revenue optimisation (sort vs tip cost comparison) | New | P2 |
| Fleet composition recommendation (AI based on job patterns) | New | P2 |

---

## 8. Complete Feature Requirements

### 8.1 Customer Booking System

**FR-B01:** Public booking form accessible without login at `/book` (or embedded on binned-it.com.au). Captures: customer name, phone (AU mobile format), email, delivery address (Google Maps autocomplete), bin size, waste type, hire duration, preferred delivery date/window, payment type, special instructions.

**FR-B02:** Real-time availability display on booking form — "3 × 6m³ bins available for [selected date]" — reads from `bin_inventory` table.

**FR-B03:** Instant price calculation displayed before submission. Pricing rules configurable in Settings (not hardcoded). Formula: base rate (bin size × duration) + waste type surcharge + any applicable access fee.

**FR-B04:** On submission: create booking record in Supabase, decrement available bin count, route to dispatch queue as `status = 'pending'`, send confirmation SMS and email to customer.

**FR-B05:** Admin new booking entry — same form but inside the authenticated app, with additional fields: internal notes, assigned truck (optional at this stage), credit account flag, purchase order number.

**FR-B06:** Booking edit/cancel — any booking in `pending` or `scheduled` status can be edited or cancelled. Cancellation triggers customer notification SMS.

**FR-B07:** Customer database — every booking creates/updates a customer record. View customer's full booking history, total revenue, payment behaviour, account status from a single screen.

### 8.2 Dispatch Board

**FR-D01:** Kanban board as the home screen for owner and managers. Columns: **Unscheduled** | **Today** | **In Progress** | **Completed**. Each job is a card showing customer name, address, bin size, waste type, delivery window.

**FR-D02:** Drag-and-drop job assignment to drivers and trucks. Assigning a job generates/updates that driver's run sheet.

**FR-D03:** Jobs colour-coded by waste type (red = asbestos, orange = contaminated, green = general, blue = green waste) for instant visual triage.

**FR-D04:** Driver column view: each truck/driver has a column showing their jobs for the day in sequence. Reorder by dragging to optimise route.

**FR-D05:** Calendar view: week-ahead grid showing job density per day, useful for planning bin inventory requirements.

**FR-D06:** Live status updates: as driver marks job `in progress` / `completed` on their phone, card moves column automatically (Supabase Realtime).

**FR-D07:** Overbooking prevention: if a bin size has zero available inventory for the scheduled date, the system warns before allowing the booking to proceed.

**FR-D08:** Delivery window management: AM (7am–12pm) / PM (12pm–5pm) slots shown visually; warning if a driver has more jobs than reasonably completable in a window.

### 8.3 Driver Mobile App

**FR-M01:** Driver login — same Supabase auth, driver role sees driver view only. No financial data visible.

**FR-M02:** Run sheet — drivers see their jobs for the day in assigned sequence. Each card shows: address, bin size, waste type, customer name, phone, special instructions, delivery window. Tap card to expand full details.

**FR-M03:** Navigation — tap address to open in Google Maps (or Apple Maps on iOS) with the job address pre-loaded.

**FR-M04:** Job status controls — large buttons: **En Route** → **Arrived** → **Delivered** → **Picked Up**. Each tap timestamps and updates the job record in real time.

**FR-M05:** Pre-start checklist — morning only, must be completed before first job unlocks. Digital form: brakes, tyres, lights, hydraulics, licence check, phone charged. Creates compliance record. Fail on any item triggers alert to Jake/office.

**FR-M06:** Bin delivery photo — after marking `Delivered`, driver is prompted to photo the bin placement. Mandatory (cannot proceed without photo). Photo is geo-stamped and timestamped, stored in Supabase Storage, attached to the job record.

**FR-M07:** AI bin content check — when driver photographs an open bin (at pickup for collection jobs), photo is sent to AI vision API. Flags: potentially hazardous materials (visible asbestos, drums, batteries), estimated heavy load (visual assessment). Result shown to driver immediately: ✅ Clear / ⚠️ Possible heavy load / 🔴 Potential hazmat. Alert to office on any flag.

**FR-M08:** Tip docket capture — after tipping, driver photographs the weigh docket. OCR (Google Vision or similar) extracts: tonnage, waste type, tipping fee, facility name, timestamp. Driver confirms extracted data, saves to job record. This feeds real-time job costing.

**FR-M09:** Fuel receipt capture — driver photographs fuel receipt. OCR extracts: litres, cost per litre, total cost, odometer reading. Creates fuel cost record linked to that vehicle for the day.

**FR-M10:** Offline mode — all jobs for the day cached locally on app startup. Status updates, photos, and data captured offline are queued and sync automatically when connectivity returns. Driver sees sync status indicator.

**FR-M11:** Driver notes — free-text note on any job (e.g. "bin not accessible, left at gate"). Visible to office immediately.

### 8.4 Real-Time Job Costing

**FR-J01:** Every job has a `job_costs` record that accumulates actual costs as the job executes:
- Estimated at booking: fuel (distance-based), driver time, tipping fee (from facility database), bin depreciation, overhead allocation
- Actuals added in real time: tip docket OCR cost, fuel receipt, driver clock-in/out time

**FR-J02:** Job cost summary card visible to Mark and Jake on the job detail screen: Estimated Profit / Actual Profit to date / Variance. If actual significantly exceeds estimate, alert fires.

**FR-J03:** Post-job variance analysis: "Estimated profit: $142 | Actual profit: $98 | Variance: -$44 | Reasons: tipping fee $30 higher than database, driver 45 min longer than estimated."

**FR-J04:** Variance data feeds a learning model — over time, cost estimates improve for similar jobs. Mark reviews variance summary weekly; system flags job types with consistently negative variance for pricing review.

### 8.5 Invoicing & Xero Integration (Extended)

**FR-I01:** On job status = `completed`, system auto-creates a draft invoice in Xero via API. Invoice includes: customer contact (auto-created if new), line items (bin hire + waste type + duration + tipping surcharge if applicable), amount, due date (14 days), reference (BINNEDIT-[JobID]).

**FR-I02:** Tonnage-based billing: if waste type is asbestos, soil, or other regulated stream, invoice line item includes tipping weight from tip docket and tipping fee surcharge.

**FR-I03:** Invoice approval step: by default, invoices are created in Xero as `Draft`. Sarah reviews pending drafts in Hub's Invoicing section and approves to `Awaiting Payment` with one click (or batch approve all). Toggle to skip approval step in Settings.

**FR-I04:** Xero contact management: when creating invoice, system searches Xero for existing contact by email/phone. If found, links. If not found, creates new contact with full details. No duplicate contacts.

**FR-I05:** Invoice status sync: daily background job pulls Xero payment status for all open invoices. Hub displays paid/unpaid/overdue status on all booking and debtor screens.

**FR-I06:** Xero auto-reconciliation: Hub pushes a daily summary of invoiced amounts to match Xero bank feed entries. Reconciliation mismatches flagged on Cash Flow tab.

### 8.6 Automated Payment Chasing (Dunning)

**FR-P01:** Automated dunning sequence (configurable, default):
- Day 1 overdue: email reminder to customer ("Invoice #xxx is now due")
- Day 7: SMS reminder ("Hi [Name], invoice #xxx remains unpaid — please pay now [link]")
- Day 14: email escalation ("This is a second reminder...") + alert to Sarah
- Day 30: account hold flag set (new bookings for this customer blocked) + alert to Mark

**FR-P02:** Sarah review screen — before any automated dunning message sends, Sarah can preview and cancel if there's a known reason (payment arrangement in place, dispute). Override window is 2 hours from scheduled send.

**FR-P03:** Payment link — each dunning message includes a secure payment link (Stripe or Xero payment services — configurable). Customer pays online, webhook updates Xero and Hub.

**FR-P04:** Dunning history: every message sent is logged on the debtor record with timestamp and outcome.

### 8.7 Wages, Rostering & Time Tracking

**FR-W01:** Driver roster: Jake builds the weekly roster by assigning drivers to shifts. Drag-and-drop shift builder showing: available drivers, leave/sick flags, certification requirements.

**FR-W02:** Clock in/out: drivers clock in when they start (app button, GPS-verified), clock out at end of day. Creates time record linked to date and truck.

**FR-W03:** Overtime alerts: when a driver's clocked hours for the week approach the overtime threshold (configurable, default 38 hrs), alert fires to Jake and Mark. Requires Mark approval to proceed.

**FR-W04:** Hours vs roster variance: actual clocked hours compared to rostered hours. Discrepancies flagged for Sarah's payroll review.

**FR-W05:** Weekly wages summary: total hours per driver, regular vs overtime, preliminary wage cost estimate. Exported to Xero-compatible format for payroll processing.

**FR-W06:** Driver certification tracking: each driver has a certifications record (car licence class, heavy vehicle, dangerous goods, asbestos awareness, etc.) with expiry dates. Alert fires to Jake 60 days before any expiry. If certification is expired, driver cannot be assigned to jobs requiring that certification.

### 8.8 AI Business Intelligence

**FR-A01:** Weekly AI pricing intelligence report: AI agent runs every Monday morning. Uses web search (Google/Bing) to look up current: diesel fuel prices (Melbourne), tip facility gate fees at Seaford Tip and alternatives, competitor pricing snippets (if findable). Produces a 1-page briefing: "Diesel up 8 cents/L this week. Your current fuel allowance per job is $X — recommend reviewing pricing for long-haul jobs. Transfer station tip fee increased $12/tonne — affected bin types: asbestos, soil."

**FR-A02:** Pricing recommendation engine: Based on job costing variances + fuel cost changes + tipping fee changes, AI generates specific pricing recommendations. Example: "Based on 6 months of job cost data, your 8m³ general waste bin is returning $18 average profit on a $280 rate. Recommend raising to $310 (11% increase) to achieve target 15% margin. Market median is $295."

**FR-A03:** AI virtual CFO: weekly strategic dashboard (existing AI assistant, extended with operational data). Proactive recommendations without requiring user questions. Pulls data from: job costing, AR aging, cash position, roster costs, recent alerts.

**FR-A04:** Competitor pricing intelligence: weekly automated search for competitor pricing in Melbourne skip bin hire. Updates Competitors tab with any found rates + search date. Where no public pricing found, marks as "POA — [date checked]".

**FR-A05:** Demand forecasting: analyses job booking patterns by week/month, flags upcoming predicted busy periods (based on historical data + construction pipeline if searchable). "December typically slow — consider maintenance windows and holiday rostering."

**FR-A06:** ESG intelligence: tracks total tonnes diverted from landfill each month (from tip docket data). Generates marketing-ready stat: "Binned-IT diverted 23 tonnes from landfill in March 2026." Feeds existing ESG tab.

### 8.9 Bin Inventory Management (Replacing Bin Manager)

**FR-BI01:** Real-time bin inventory dashboard: each bin size shows total owned / on hire / at depot / in transit / in repair. Auto-updates as jobs are scheduled (bin moves to `on hire`) and completed (returns to `at depot`).

**FR-BI02:** Bin serialisation: each physical bin has a unique ID (spray-painted or QR sticker). Jobs reference specific bin IDs. Track location history per bin.

**FR-BI03:** Over-hire alerts: any bin on hire for longer than its booked duration triggers alert to office. Auto-sends extension SMS to customer.

**FR-BI04:** Low inventory alerts: when available count for any size drops below threshold (configurable), alert fires. "Only 2 × 6m³ bins at depot — check if any can be collected today."

**FR-BI05:** Bin condition tracking: on collection, driver notes bin condition (clean/dirty/damaged). Damaged bins flagged for repair. Bins in repair are excluded from available inventory.

### 8.10 Customer Communication Automation

**FR-C01:** Booking confirmation (on booking submit): SMS + email with booking summary, delivery window, what to expect, contact details.

**FR-C02:** Day before delivery: SMS reminder — "Your [size] bin will be delivered tomorrow [date] between [window]. Ensure clear access. - Binned-IT" + email version.

**FR-C03:** Day of delivery, 30 min ETA: SMS — "Your bin is on its way! Driver [name] will arrive within 30 minutes." Triggered when driver marks job `en route` and is within 30 min ETA (distance calculation).

**FR-C04:** Delivery confirmation: automated SMS + email after driver marks `delivered`. Includes photo of bin placement.

**FR-C05:** Hire period reminder: 2 days before hire period expires, SMS — "Your bin hire ends [date]. Need longer? Call us or book a pickup." Prevents over-hire disputes.

**FR-C06:** Collection confirmation: SMS after bin collected. "Your bin has been collected. Invoice [amount] will be sent shortly."

**FR-C07:** All templates configurable in Settings. Templates support variables: {customer_name}, {bin_size}, {delivery_date}, {delivery_window}, {driver_name}, {invoice_amount}, etc.

---

## 9. Phased Delivery Plan

### Phase Overview

| Phase | Sprints | Theme | Outcome |
|-------|---------|-------|---------|
| Phase 1 (Complete) | Sprints 1–7 | Financial reporting platform | Hub v2.2 live — all reporting features delivered |
| Phase 2 | Sprints 8–9 | Operational foundation | Bookings + dispatch board operational — replace Bin Manager |
| Phase 3 | Sprints 10–11 | Driver mobile app | Drivers on digital run sheets, tip docket OCR live |
| Phase 4 | Sprints 12–13 | Automation & invoicing | Auto-invoicing, dunning, job costing complete |
| Phase 5 | Sprints 14–15 | Intelligence layer | AI pricing reports, web search, demand forecasting |
| Phase 6 | Sprint 16+ | Full maturity | Rostering, wages, advanced analytics, customer portal |

---

### Phase 2 — Sprints 8 & 9: Operational Foundation

**Goal:** Replace Bin Manager. Operations team uses Hub as their daily tool.

**Sprint 8: Booking System + Bin Inventory**

_New database tables: `bookings`, `bin_inventory`, `bin_assets`, `customers`, `tipping_facilities`_

- [ ] Public booking form at `/book` — fully functional, live pricing, bin availability check
- [ ] Admin booking entry screen (authenticated)
- [ ] Customer database — create/update on booking
- [ ] Bin inventory management — total/on-hire/at-depot tracking per size
- [ ] Booking auto-routes to dispatch queue on submission
- [ ] Confirmation SMS (Twilio) + email (Resend) on booking
- [ ] Day-before reminder SMS (Supabase Edge Function cron)
- [ ] Booking list view for Sarah — filter by date, status, bin size
- [ ] Settings: pricing rules engine (bin size × duration × waste type, configurable by Mark)

**Sprint 9: Dispatch Board + Driver Assignment**

_New database tables: `jobs`, `job_assignments`, `driver_runsheets`_

- [ ] Dispatch board as home screen (replaces current Snapshot as landing page for ops roles)
- [ ] Kanban columns: Unscheduled → Scheduled → In Progress → Completed
- [ ] Drag-drop job assignment to driver/truck
- [ ] Driver run sheet (read-only on driver's phone — no editing yet)
- [ ] Live job status via Supabase Realtime (card moves column on status update)
- [ ] Calendar view of scheduled jobs (week ahead)
- [ ] Bin inventory auto-updates on scheduling (on-hire / at-depot)
- [ ] Delivery window management and capacity warnings
- [ ] Navigation: update sidebar to new structure (Operations primary, Reports secondary)
- [ ] Role-based routing: drivers land on Run Sheet, ops land on Dispatch, Mark lands on Dispatch

**Sprint 9 Exit Criteria:**
- Mark can start the day on the Dispatch Board and see all jobs for the day
- Jake can assign drivers to jobs by drag-drop
- Drivers can see their run sheet on their phone
- Sarah can enter a booking that flows to the dispatch queue
- Bin Manager can be switched off

---

### Phase 3 — Sprints 10 & 11: Driver Mobile App

**Goal:** Drivers capture all job data digitally. No paper run sheets. No lost tip dockets.

**Sprint 10: Driver Job Controls + Photo Capture**

_New database tables: `job_events`, `job_photos`, `pre_start_checks`_

- [ ] Driver mobile view — dedicated login state for driver role
- [ ] Pre-start vehicle checklist (digital, blocks jobs until complete)
- [ ] Job status controls (large buttons: En Route → Arrived → Delivered)
- [ ] Bin delivery photo capture (mandatory, geo-stamped)
- [ ] Driver notes on any job
- [ ] In-app navigation tap-through to Google Maps
- [ ] Offline job caching (jobs cached on app start, sync on reconnect)
- [ ] "Driver on way" ETA SMS to customer (triggered from En Route status)
- [ ] Delivery confirmation SMS + photo to customer (triggered from Delivered status)

**Sprint 11: OCR, Job Costing, AI Bin Check**

_New database tables: `job_costs`, `tip_dockets`, `fuel_receipts`_

- [ ] Tip docket photo → OCR (Google Vision API) → extract tonnage, cost, facility
- [ ] Driver confirms OCR data, saves to job record
- [ ] Fuel receipt photo → OCR → extract litres, cost, odometer
- [ ] Real-time job cost record: estimated vs actual as data arrives
- [ ] AI bin content check: photo → Claude Vision → hazmat/heavy load flag
- [ ] Job cost summary visible to Mark/Jake on job detail screen
- [ ] Post-job variance analysis (estimated vs actual profit)
- [ ] Tipping facility database (locations, accepted types, gate fees)

**Sprint 11 Exit Criteria:**
- Drivers capture all tip dockets digitally — zero paper dockets
- Mark can see actual job profit within minutes of job completion
- AI has flagged at least 1 hazmat or heavy load warning in testing

---

### Phase 4 — Sprints 12 & 13: Automation & Invoicing

**Goal:** Zero manual invoicing. Overdue accounts chased automatically.

**Sprint 12: Auto-Invoicing**

_Extends: Xero integration (write capability), `invoices` table_

- [ ] Auto-invoice creation on job completion → Xero draft invoice
- [ ] Invoice line items: bin hire + waste surcharges + tipping fee (from tip docket)
- [ ] Tonnage-based billing for regulated waste streams
- [ ] Xero contact auto-create/match
- [ ] Invoice approval queue (Sarah's daily task — batch approve)
- [ ] Toggle: auto-approve all (skip Sarah's review) in Settings
- [ ] Invoice status sync back from Xero (paid/unpaid/overdue)
- [ ] Invoicing section in navigation — pending, approved, overdue counts

**Sprint 13: Dunning + Wages**

_New database tables: `dunning_log`, `roster`, `time_records`, `driver_certifications`_

- [ ] Automated dunning sequence (Day 1 email, Day 7 SMS, Day 14 escalation, Day 30 hold)
- [ ] Sarah review queue — preview/cancel any automated message before send
- [ ] Account hold flag — blocks new bookings for accounts 30+ days overdue
- [ ] Driver roster builder (Jake assigns weekly shifts)
- [ ] Clock in/out via driver app (GPS-verified)
- [ ] Overtime alerts (configurable threshold, Mark approval required)
- [ ] Hours vs roster variance report
- [ ] Driver certification tracking with expiry alerts
- [ ] Weekly wages summary export for Xero payroll

**Sprint 13 Exit Criteria:**
- Last manual invoice entry happens — all new jobs auto-invoice
- First automated dunning message sent without Sarah manually composing it
- Jake has built the first digital roster

---

### Phase 5 — Sprints 14 & 15: Intelligence Layer

**Goal:** Hub actively helps Mark make better pricing and operational decisions using live market data.

**Sprint 14: Pricing Intelligence**

- [ ] Weekly AI pricing intelligence report (web search for fuel prices, tip fees, competitor rates)
- [ ] Pricing recommendation engine (variance-based + market data)
- [ ] Competitor rate auto-search (weekly cron, updates competitor tab)
- [ ] Fuel cost trend on cost drivers chart
- [ ] Price increase calculator enhanced with AI recommendation
- [ ] Settings: target margin per bin type (AI uses this for recommendations)

**Sprint 15: Advanced Intelligence + ESG**

- [ ] AI virtual CFO weekly briefing (proactive, not reactive)
- [ ] Demand forecasting (historical patterns + external signals)
- [ ] Fleet composition recommendations (AI-generated)
- [ ] Recycling revenue optimisation (sort vs tip cost comparison)
- [ ] ESG monthly report (tonnes diverted, carbon offset, marketing copy)
- [ ] Job costing learning model (estimates improve over time from variance data)

---

### Phase 6 — Sprint 16+: Full Maturity

**Defer to Phase 6 — not blocking earlier phases:**

- [ ] Customer self-service portal (view booking history, pay invoices online)
- [ ] Real-time GPS driver tracking (requires hardware: phone GPS is sufficient, optional device tracker)
- [ ] Multi-month comparison dashboard view (side-by-side)
- [ ] Council permit application automation
- [ ] Advanced Creditor Watch credit risk API integration
- [ ] Payroll direct export to Xero (replaces manual CSV)
- [ ] Customer loyalty tier system (rewards frequent customers)
- [ ] White-label customer portal for large account customers

---

## 10. Technical Architecture

### 10.1 Current Stack (unchanged — extend, don't rewrite)

```
CLIENT (Browser / Mobile PWA)
  React 18 + Vite SPA
  React Router v6
  TanStack Query v5
  Recharts
  Inline CSS + src/theme.js tokens
  Supabase JS SDK v2
  SheetJS (file parsing)

EDGE FUNCTIONS (Vercel)
  /api/chat       — Claude AI proxy (existing)
  /api/invite     — Supabase admin invite (existing)
  /api/ocr        — NEW: tip docket / receipt OCR
  /api/ai-check   — NEW: bin content AI check (Claude Vision)
  /api/xero-sync  — NEW: Xero bidirectional sync (extend existing OAuth)
  /api/dunning    — NEW: scheduled dunning sequence runner
  /api/intelligence — NEW: weekly pricing intelligence AI report

SUPABASE
  PostgreSQL (existing schema + new tables)
  Auth + RLS policies
  Realtime subscriptions (new: job status updates)
  Storage (existing: wizard files; new: job photos, tip dockets)
  Edge Functions (cron jobs: day-before reminder SMS, daily Xero sync, weekly AI report)

EXTERNAL SERVICES
  Xero API (existing OAuth — extend to write invoices)
  Anthropic API - claude-sonnet-4-6 (existing — extend with Vision)
  Twilio SMS (new)
  Resend email (new)
  Google Maps API — Places Autocomplete + Distance Matrix (new)
  Google Vision API — OCR for receipts (new)
  Web search API (Bing Search API or similar) — pricing intelligence (new)
```

### 10.2 New Services Required

| Service | Purpose | Estimated Cost |
|---------|---------|----------------|
| Twilio (AU number) | SMS — confirmations, reminders, dunning | ~$1.50/month + $0.08/SMS |
| Resend | Email — all customer communications | Free tier: 3,000/month |
| Google Maps API | Address autocomplete, ETA calculation | Free: $200/month credit |
| Google Vision API | OCR on tip dockets and receipts | ~$1.50/1,000 images |
| Bing Search API | Weekly pricing intelligence searches | Free tier: 1,000/month |
| Stripe (or Xero Payments) | Online invoice payment links | 1.7% + $0.30/transaction |

### 10.3 No New npm Packages Without Approval

Per CLAUDE.md: always check `package.json` before adding a package. Prefer extending existing libraries. All UI uses inline CSS with `B.*` tokens from `src/theme.js`. No Tailwind, no CSS modules, no TypeScript.

### 10.4 Database Migration Strategy

All new tables delivered via numbered migration files in `supabase/migrations/`. All migrations are idempotent. Current state: 6 migrations (001–005 applied). Phase 2 starts at migration 006.

---

## 11. Integration Map

### 11.1 Xero (Bidirectional — Extend Existing OAuth)

**Currently implemented (read):**
- P&L monthly sync → `financials_monthly`
- Balance Sheet sync → `balance_sheet_monthly`
- AR aging sync → `debtors_monthly`

**New (write):**
- Auto-create invoice on job completion
- Auto-create/match customer contact
- Push invoice status updates (approve, void)
- Pull payment status (webhook or polling)
- Reconciliation match push (bank feed matching helper)

**Xero API endpoint additions needed:**
- `POST /invoices` — create invoice
- `GET/POST /contacts` — find or create customer
- `PUT /invoices/{id}` — approve invoice
- `GET /payments` — poll payment status

### 11.2 Twilio SMS

All SMS via Twilio REST API. Templates stored in Supabase `sms_templates` table, configurable in Settings. Australian phone number required (~$1.50/month). Events that trigger SMS:
- Booking confirmation
- Day-before delivery reminder
- Day-of delivery ("on way") notification
- Delivery confirmation
- Hire period expiry warning
- Invoice overdue Day 7
- Invoice overdue Day 14 (escalation)
- Driver pre-start fail alert (to Jake, not customer)
- Hazmat/heavy load flag alert (to Mark)

### 11.3 Resend Email

All transactional email via Resend API. HTML templates for:
- Booking confirmation (with summary table)
- Delivery confirmation (with bin photo)
- Invoice (with payment link)
- Overdue invoice Day 1, Day 14
- Weekly AI intelligence report (to Mark)
- Monthly financial digest (to Mark + Andrew)

### 11.4 Google Maps API

- **Places Autocomplete** — address field on booking form and admin booking entry
- **Geocoding** — convert delivery address to lat/lng on booking save (for route optimisation)
- **Distance Matrix** — estimate drive time for job cost estimation (fuel cost per km)
- **Directions** — driver run sheet navigation tap-through

### 11.5 Google Vision API (OCR)

Used in Vercel Edge Function `/api/ocr`:
- Tip docket photos → extract: facility name, date, tonnage, waste type, net weight, charge per tonne, total fee
- Fuel receipt photos → extract: date, litres, price per litre, total, odometer
- Maintenance receipt photos → extract: date, supplier, description, total
Extracted data returned as JSON, driver confirms on phone before saving.

### 11.6 Anthropic Claude API (Extend Existing)

**Existing:** `/api/chat` Vercel Edge Function for AI assistant.

**Extended:**
- `/api/ai-check` — Claude Vision for bin content analysis. Input: bin photo. Output: JSON with `hazmat_flag` (true/false), `heavy_load_flag` (true/false), `notes` (string description of concern), `confidence` (0–1).
- `/api/intelligence` — Weekly AI intelligence Vercel Edge Function. Runs on cron (Monday 6am AEST). Steps: (1) web search for fuel prices, tip fees, competitor pricing, (2) fetch job variance data from Supabase, (3) build intelligence report prompt, (4) call Claude claude-sonnet-4-6, (5) save report to `intelligence_reports` table, (6) email to Mark via Resend.

### 11.7 Supabase Realtime

New real-time subscriptions (Phase 2+):
- `jobs` table — status changes → dispatch board card movement
- `job_events` table — driver updates → live map/timeline
- `alerts_log` table — new critical alerts → notification badge

---

## 12. Data Model Changes

### 12.1 Existing Tables (unchanged, retained)

`profiles`, `monthly_reports`, `financials_monthly`, `balance_sheet_monthly`, `debtors_monthly`, `bin_type_performance`, `customer_acquisitions`, `compliance_records`, `competitor_rates`, `work_plan_items`, `work_plan_completions`, `alert_thresholds`, `alerts_log`, `ai_chat_sessions`, `file_uploads`, `xero_tokens`

### 12.2 New Tables — Phase 2 (Sprints 8–9)

```sql
-- Customers (one per unique customer)
customers (
  id UUID PK,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company_name TEXT,
  abn TEXT,
  account_type TEXT DEFAULT 'casual', -- 'casual', 'account', 'vip'
  credit_limit DECIMAL(10,2),
  account_hold BOOLEAN DEFAULT false,
  account_hold_reason TEXT,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  last_job_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Bookings (customer-facing order)
bookings (
  id UUID PK,
  customer_id UUID REFERENCES customers,
  booking_ref TEXT UNIQUE, -- e.g. BIN-2026-0042
  status TEXT DEFAULT 'pending', -- pending/scheduled/completed/cancelled

  -- Delivery details
  delivery_address TEXT NOT NULL,
  delivery_lat DECIMAL(10,8),
  delivery_lng DECIMAL(11,8),
  delivery_date DATE NOT NULL,
  delivery_window TEXT NOT NULL, -- '7am-12pm' or '12pm-5pm'

  -- Bin details
  bin_size TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  hire_duration_days INTEGER NOT NULL,

  -- Pricing
  quoted_price DECIMAL(10,2) NOT NULL,

  -- Payment
  payment_type TEXT NOT NULL, -- 'invoice', 'account', 'cash', 'card'
  payment_details JSONB,

  -- Notes
  customer_instructions TEXT,
  internal_notes TEXT,

  -- Xero
  xero_invoice_id TEXT,
  xero_invoice_number TEXT,
  xero_payment_status TEXT,

  -- Comms tracking
  confirmation_sms_at TIMESTAMPTZ,
  confirmation_email_at TIMESTAMPTZ,
  reminder_sms_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Jobs (operational record, linked to booking)
jobs (
  id UUID PK,
  booking_id UUID REFERENCES bookings,
  job_ref TEXT UNIQUE, -- e.g. JOB-2026-0042
  job_type TEXT NOT NULL, -- 'delivery', 'collection', 'swap'
  status TEXT DEFAULT 'unscheduled', -- unscheduled/scheduled/in_progress/completed/cancelled

  -- Scheduling
  scheduled_date DATE,
  scheduled_window TEXT,
  assigned_driver_id UUID REFERENCES profiles,
  assigned_truck_id UUID REFERENCES fleet_assets,
  sequence_number INTEGER, -- order on driver's run sheet

  -- Address (copied from booking, may differ for collection)
  job_address TEXT,
  job_lat DECIMAL(10,8),
  job_lng DECIMAL(11,8),

  -- Bin
  bin_asset_id UUID REFERENCES bin_assets,
  bin_size TEXT NOT NULL,
  waste_type TEXT NOT NULL,

  -- Completion
  driver_notes TEXT,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Bin assets (individual physical bins)
bin_assets (
  id UUID PK,
  bin_code TEXT UNIQUE, -- e.g. BIN-6M-07
  bin_size TEXT NOT NULL,
  status TEXT DEFAULT 'at_depot', -- at_depot/on_hire/in_transit/in_repair/retired
  current_booking_id UUID REFERENCES bookings,
  condition TEXT DEFAULT 'good', -- good/dirty/damaged
  last_service_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Bin inventory summary (auto-maintained by triggers)
bin_inventory (
  bin_size TEXT PK,
  total_owned INTEGER DEFAULT 0,
  at_depot INTEGER DEFAULT 0,
  on_hire INTEGER DEFAULT 0,
  in_transit INTEGER DEFAULT 0,
  in_repair INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Tipping facilities
tipping_facilities (
  id UUID PK,
  name TEXT NOT NULL,
  address TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  accepted_waste_types TEXT[],
  hours_of_operation TEXT,
  gate_fee_per_tonne DECIMAL(10,2),
  minimum_charge DECIMAL(10,2),
  notes TEXT,
  is_preferred BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- SMS templates
sms_templates (
  id UUID PK,
  trigger_event TEXT UNIQUE, -- 'booking_confirmation', 'day_before', 'on_way', etc.
  template_text TEXT NOT NULL, -- supports {variables}
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 12.3 New Tables — Phase 3 (Sprints 10–11)

```sql
-- Job events (audit trail of all driver actions)
job_events (
  id UUID PK,
  job_id UUID REFERENCES jobs,
  driver_id UUID REFERENCES profiles,
  event_type TEXT NOT NULL, -- en_route/arrived/delivered/collected/issue_flagged
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Job photos
job_photos (
  id UUID PK,
  job_id UUID REFERENCES jobs,
  driver_id UUID REFERENCES profiles,
  photo_type TEXT NOT NULL, -- delivery_placement/bin_contents/damage/tip_docket/fuel_receipt
  storage_path TEXT NOT NULL,
  ai_check_result JSONB, -- {hazmat_flag, heavy_load_flag, notes, confidence}
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Pre-start vehicle checks
pre_start_checks (
  id UUID PK,
  driver_id UUID REFERENCES profiles,
  truck_id UUID REFERENCES fleet_assets,
  check_date DATE NOT NULL,
  items JSONB NOT NULL, -- {brakes: true, tyres: true, lights: true, ...}
  overall_pass BOOLEAN NOT NULL,
  failure_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Job costs
job_costs (
  id UUID PK,
  job_id UUID UNIQUE REFERENCES jobs,

  -- Estimated (at booking time)
  est_fuel_cost DECIMAL(10,2),
  est_driver_cost DECIMAL(10,2),
  est_tipping_fee DECIMAL(10,2),
  est_bin_depreciation DECIMAL(10,2),
  est_overhead DECIMAL(10,2),
  est_total_cost DECIMAL(10,2),
  est_profit DECIMAL(10,2),

  -- Actuals (filled in as job executes)
  actual_fuel_cost DECIMAL(10,2),
  actual_driver_time_minutes INTEGER,
  actual_driver_cost DECIMAL(10,2),
  actual_tipping_fee DECIMAL(10,2),
  actual_tipping_weight_tonnes DECIMAL(10,3),
  actual_total_cost DECIMAL(10,2),
  actual_profit DECIMAL(10,2),
  variance DECIMAL(10,2),
  variance_notes TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Tip dockets (from OCR)
tip_dockets (
  id UUID PK,
  job_id UUID REFERENCES jobs,
  driver_id UUID REFERENCES profiles,
  facility_id UUID REFERENCES tipping_facilities,
  photo_storage_path TEXT NOT NULL,

  -- OCR extracted (driver confirms)
  docket_date DATE,
  waste_type TEXT,
  gross_weight_tonnes DECIMAL(10,3),
  tare_weight_tonnes DECIMAL(10,3),
  net_weight_tonnes DECIMAL(10,3),
  charge_per_tonne DECIMAL(10,2),
  total_charge DECIMAL(10,2),

  ocr_raw JSONB, -- raw OCR output for debugging
  driver_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Fuel receipts
fuel_receipts (
  id UUID PK,
  driver_id UUID REFERENCES profiles,
  truck_id UUID REFERENCES fleet_assets,
  receipt_date DATE,
  photo_storage_path TEXT NOT NULL,
  litres DECIMAL(10,2),
  price_per_litre DECIMAL(10,4),
  total_cost DECIMAL(10,2),
  odometer_km INTEGER,
  ocr_raw JSONB,
  driver_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 12.4 New Tables — Phase 4 (Sprints 12–13)

```sql
-- Dunning log
dunning_log (
  id UUID PK,
  customer_id UUID REFERENCES customers,
  booking_id UUID REFERENCES bookings,
  xero_invoice_id TEXT,
  dunning_step INTEGER NOT NULL, -- 1, 2, 3, 4
  channel TEXT NOT NULL, -- email/sms
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES profiles,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Fleet assets (trucks)
fleet_assets (
  id UUID PK,
  vehicle_code TEXT UNIQUE, -- e.g. TRUCK-01
  make TEXT,
  model TEXT,
  year INTEGER,
  registration TEXT,
  rego_expiry DATE,
  last_service_date DATE,
  next_service_km INTEGER,
  next_service_date DATE,
  odometer_km INTEGER,
  status TEXT DEFAULT 'active', -- active/in_repair/retired
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Roster
roster (
  id UUID PK,
  driver_id UUID REFERENCES profiles,
  truck_id UUID REFERENCES fleet_assets,
  shift_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  shift_type TEXT DEFAULT 'standard', -- standard/overtime/leave/sick
  notes TEXT,
  created_by UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Time records (clock in/out)
time_records (
  id UUID PK,
  driver_id UUID REFERENCES profiles,
  truck_id UUID REFERENCES fleet_assets,
  clock_in_at TIMESTAMPTZ,
  clock_in_lat DECIMAL(10,8),
  clock_in_lng DECIMAL(11,8),
  clock_out_at TIMESTAMPTZ,
  clock_out_lat DECIMAL(10,8),
  clock_out_lng DECIMAL(11,8),
  total_minutes INTEGER,
  is_overtime BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Driver certifications
driver_certifications (
  id UUID PK,
  driver_id UUID REFERENCES profiles,
  certification_type TEXT NOT NULL, -- heavy_vehicle/dangerous_goods/asbestos_awareness/forklift/etc
  issued_date DATE,
  expiry_date DATE,
  issuing_body TEXT,
  document_storage_path TEXT,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 12.5 New Tables — Phase 5 (Sprints 14–15)

```sql
-- Intelligence reports (weekly AI briefings)
intelligence_reports (
  id UUID PK,
  report_date DATE NOT NULL,
  report_type TEXT NOT NULL, -- pricing_intelligence/virtual_cfo/demand_forecast
  content_html TEXT,
  content_json JSONB,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Pricing rules (replaces hardcoded pricing)
pricing_rules (
  id UUID PK,
  bin_size TEXT NOT NULL,
  waste_type TEXT NOT NULL,
  hire_duration_days INTEGER NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  created_by UUID REFERENCES profiles,
  updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## 13. Success Metrics

### 13.1 Operational Efficiency

| Metric | Baseline (today) | Target (Phase 4 complete) |
|--------|-----------------|--------------------------|
| Time to process a phone booking | 10 min (manual entry) | < 3 min (guided form) |
| Time to create a Xero invoice | 5–10 min per job | 0 min (fully automated) |
| Paper tip dockets lost or misfiled | Unknown (estimated 20%+) | < 1% (all digital OCR capture) |
| Driver run sheet prep time for Jake | 20 min/morning | < 5 min (auto from dispatch) |
| Time to produce monthly financial snapshot | 2–3 hours | < 20 min (Xero auto-sync) |
| AR overdue % of total | ~18.7% | < 12% |
| Loss-making bin types | 4+ confirmed | 0 (repriced with AI assistance) |

### 13.2 Automation KPIs

| Metric | Target |
|--------|--------|
| % of completed jobs that auto-invoice to Xero | 100% by end of Phase 4 |
| % of overdue invoices that receive automated dunning | 100% |
| % of deliveries with digital proof of delivery photo | 100% by end of Phase 3 |
| % of tip dockets captured digitally (not paper) | 100% by end of Phase 3 |
| AI bin content checks performed per week | 100% of collection jobs |

### 13.3 Revenue & Intelligence

| Metric | Target |
|--------|--------|
| Weeks between pricing reviews | From ad-hoc to every week (AI-prompted) |
| Time to identify a cost increase that requires pricing action | From weeks (monthly close) to days (AI alert) |
| Competitor pricing intelligence updates per month | ≥ 4 (weekly automated search) |
| Mark's daily platform logins | ≥ 5 (via mobile dispatch board) |

### 13.4 Platform Health

| Metric | Target |
|--------|--------|
| Dashboard uptime | ≥ 99.5% |
| Dispatch board real-time latency | < 2 seconds |
| Driver app offline capability | ≥ 8 hours cached operation |
| Build passing (0 errors) | Always, before every deployment |

---

## 14. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Xero write API complexity (rate limits, error handling) | Medium | High | Build with full retry logic; test with real jobs before switching off manual invoicing |
| Twilio SMS delivery failures in AU | Low | Medium | Monitor delivery rates; fallback to email; consider backup provider |
| OCR accuracy on poor-quality tip docket photos | Medium | Medium | Driver always confirms OCR output before saving; anomaly detection if extracted values are out of range |
| Driver adoption of mobile app (change resistance) | Medium | High | Jake champions rollout; start with run sheet only (low friction), add photo/OCR over 2 sprints |
| Google Vision API costs escalate at scale | Low | Low | ~$1.50/1,000 images; at 80 jobs/week = ~$6/month; well within budget |
| Bin Manager data not exported cleanly | Medium | Medium | Extract all historical data to CSV before switching off; import into Hub in Sprint 8 |
| AI bin content check false positives annoy drivers | Medium | Low | Tune confidence threshold; make it advisory not blocking; track false positive rate |
| Supabase free tier limits | Medium | Medium | Current free tier fine for 6 months; upgrade to $25/month Pro plan as needed |
| VAPID push notification keys (placeholder) | High | Low | Generate real keys before Phase 2 launch; ~30 minute task |
| Xero token refresh failures | Low | High | Existing refresh logic in place; add monitoring alert if token refresh fails |

---

## Appendix A: Tech Stack Reference

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend framework | React | 18 | No TypeScript |
| Build tool | Vite | Latest | Chunk warning at 1,368 kB is expected/acceptable |
| Routing | React Router | v6 | Existing |
| Data fetching | TanStack Query | v5 | Existing |
| Charts | Recharts | Latest | Existing |
| UI style | Inline CSS + theme.js | — | No Tailwind, no CSS modules |
| Auth | Supabase Auth | v2 | JWT + RLS |
| Database | Supabase PostgreSQL | Latest | |
| Storage | Supabase Storage | — | Photos, wizard uploads |
| Realtime | Supabase Realtime | — | Job status updates (Phase 2) |
| Hosting | Vercel | — | Auto-deploy from master |
| AI chat | Anthropic Claude claude-sonnet-4-6 | — | Via /api/chat Edge Function |
| AI vision | Anthropic Claude (Vision) | — | Via /api/ai-check Edge Function |
| SMS | Twilio | — | Phase 2+ |
| Email | Resend | — | Phase 2+ |
| Maps | Google Maps API | — | Phase 2+ |
| OCR | Google Vision API | — | Phase 3 |
| Accounting | Xero API | OAuth 2.0 | Existing (extend to write) |

---

## Appendix B: Environment Variables Required (Full List)

```env
# Existing
VITE_SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
VITE_SUPABASE_ANON_KEY=[key]
SUPABASE_SERVICE_ROLE_KEY=[key]
ANTHROPIC_API_KEY=[key]
VERCEL_TOKEN=[key]

# Xero (existing + new)
XERO_CLIENT_ID=[key]
XERO_CLIENT_SECRET=[key]
XERO_REDIRECT_URI=https://binnedit-hub.vercel.app/api/xero/callback
XERO_TENANT_ID=[org ID]

# New Phase 2
TWILIO_ACCOUNT_SID=[key]
TWILIO_AUTH_TOKEN=[key]
TWILIO_FROM_NUMBER=+61[number]
RESEND_API_KEY=[key]
RESEND_FROM_EMAIL=bookings@binnedit.com.au
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=[key]

# New Phase 3
GOOGLE_VISION_API_KEY=[key]

# New Phase 5
BING_SEARCH_API_KEY=[key]   # or GOOGLE_SEARCH_API_KEY

# Push notifications (replace placeholder)
VAPID_PUBLIC_KEY=[generate with npx web-push generate-vapid-keys]
VAPID_PRIVATE_KEY=[generate with npx web-push generate-vapid-keys]
```

---

*End of PRD v5.0*

**Status:** ACTIVE — Single source of truth for all Binned-IT Hub development
**Next Action:** Begin Sprint 8 — booking system + bin inventory (Phase 2 foundation)
**Last Updated:** 3 April 2026
