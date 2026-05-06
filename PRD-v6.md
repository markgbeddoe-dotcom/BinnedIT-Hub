# SkipSync — Product Requirements Document v6.0

*(Written as "Binned-IT Hub". Same product — canonical name is now SkipSync.)*

**Version:** 6.0
**Date:** 27 April 2026
**Status:** ACTIVE — Master PRD, drives all ongoing development
**Author:** Mark Beddoe + Claude Code (Anthropic)
**Supersedes:** PRD v5.0 (3 April 2026), PRD v4.0, WasteManager PRD v1.0

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
15. [Features Built Since PRD v5](#15-features-built-since-prd-v5)

---

## 1. Executive Summary

Binned-IT Hub v6 continues the build-out of the complete end-to-end skip bin hire management platform. Since PRD v5 (3 April 2026), significant operational capability has been added: a full CRM collections and legal enforcement engine, inline customer creation in bookings, runtime AI API key management, UI contrast improvements, Xero sync reliability fixes, a white-label embeddable booking widget, and a suite of mobile navigation improvements.

**The fundamental shift from v4 to v5 (retained in v6):**

v4 was a _financial reporting dashboard_ with operations as an afterthought. v5/v6: **operations is the primary interface**. The home screen is the dispatch board showing today's jobs. Financial reporting is still here — now it's a tab within a broader operational platform rather than the whole product.

**What this platform will do when complete:**

Status legend: ✅ Built (in production) · 🟡 Partial (some pieces live, gap noted) · ⏳ Roadmap (planned, not started)

- ✅ A customer calls or books online → booking created automatically *(CRMBookingsPage + `/book` + `/embed/:slug` — Sprint 8/9, white-label widget Phase 2.5)*
- ✅ Booking triggers availability check, auto-schedules to a truck, confirms to customer via SMS/email *(Twilio SMS Sprint 13 #21; Resend email Sprint 13 #10)*
- ✅ Driver opens their mobile run sheet, sees jobs for the day with navigation *(Driver PWA Sprint 11D + 12A; state-machine v1 Sprint 12 #18)*
- 🟡 Driver photographs bin, captures tip docket via OCR, records weight — **photo capture and bin photos are live (`PhotoCapture.jsx`, photo-gate Sprint 12 #18); OCR for tip dockets / fuel receipts / maintenance records is ⏳ Phase 4 (no Vision API integration yet)**
- ⏳ AI checks bin contents photos for hazardous materials or heavy load risk — **Phase 4 (Roadmap). Manual `HazardReport.jsx` form exists; the photo-upload pipeline matured in Sprint 12 #18 so this is unblocked but not started. No Vision API integration.**
- 🟡 Job completion triggers automatic Xero invoice creation — **`api/xero-invoice.js` and `api/invoice-generate.js` endpoints exist; gated by `XERO_WRITE_ENABLED` env var which defaults to `false`. No UI/cron hook on job-status change yet. Phase 4.**
- ✅ Overdue invoices trigger automated follow-up sequence — with full legal letter generation up to statutory demand *(Phase 2.5; Resend dispatch Sprint 13 #10; postal letter dispatch 🟡 Partial — endpoint + queue table exist, no provider wired)*
- 🟡 Mark sees live job costing per job as it happens — **`JobCostingWidget` wired into Dispatch (Sprint 14 #19); per-bin loss-making detection live (Sprint 14 #15). Live OPEX/wages capture pipeline still pending real cost ingestion at the job level.**
- 🟡 Weekly AI intelligence report surfaces pricing changes needed, cost shifts, competitor intel — **`api/weekly-digest.js` cron runs Mondays; competitor pricing matrix retained from Hub v2.2; web-search competitor intelligence (live Bing/Google scrape) is ⏳ Phase 5 — no `BING_SEARCH_API_KEY` integration in code.**
- ✅ All historical reporting (financial P&L, AR aging, margins, compliance) remains fully intact *(Hub v2.2 dashboard tabs retained; Xero data integrity rewrite Sprints 10, 14, 15)*
- ⏳ Travel optimisation / route planning — **Phase 5 (Roadmap). Needs Mapbox or Google route-engine integration; not started.**
- ⏳ Wages / overtime / rostering — **Phase 4 (Roadmap). No `clock_in`/`timesheet`/`roster` table or component in codebase today.**

This is the single source of truth for running Binned-IT from first customer contact to final payment, with intelligence layered on top to make every decision faster and better. **What's live today (May 2026) is the operations spine — bookings, dispatch, driver mobile app v1, Xero read sync, collections engine, SMS/email confirmations, dashboard reporting. The AI/OCR/route/wages/auto-invoice rails are scoped above as Phase 4–5 roadmap and are not yet shipped.** The PRD is honest about both halves: what users can rely on today vs. what they will be able to rely on at full maturity.

---

## 1.1 Recent Sprint History (Sprints 10–15)

One-line bullet per sprint covering what closed in each. Source: `docs/audits/2026-05-06/FIXES-NEEDED.md` Sprint 10/11 status blocks plus master `git log` Sprints 12–15. Sprints 1–9 are summarised in §6.1 (Hub v2.2) and §15 (Phase 2.5 CRM/Collections).

- **Sprint 10 (Unblock — closed 2026-05-07):** Xero data integrity rewrite (Sprint 10 #1–#4: revenue classifier, sign-flip on credits, cash-balance matcher, AR sync re-enabled with per-debtor write); Investor RBAC sandbox (#12); legal-letter ABN/BSB sourced from `platform_settings` with UI gate (#11); Collections "Send" UX honesty interim (#10); Wizard side-menu entry (#20). 106/106 Vitest passing.
- **Sprint 11 ("Make it usable" — closed 2026-05-07):** Plain-English dashboard tab labels (#22); LoginPage polish; MobileNav Wizard reachable (Load Data tile); Settings → Company Identity editor (Sprint 11; closes Sprint 10 #11 follow-up); Bin-type canonicalization JS layer (#14 — 58 Vitest assertions, SQL CHECK deferred to Sprint 14); Driver PWA separate manifest (#16 — Sprint 11D, separate SW deferred to Sprint 12). 164/164 Vitest passing.
- **Sprint 12 (Driver app v1):** Driver offline write queue library + tests (#17); separate service worker for `/driver` scope (#16 follow-on, Sprint 12A); driver job state machine v1 — Arrived state + photo gate + checklist gate (#18); driver mobile-fit polish — `useBreakpoint`, safe-area-insets, max-width on desktop (#32). Offline queue wiring into all driver components is partial.
- **Sprint 13 (Real customer comms):** Real Twilio SMS booking confirmation send (#21); Resend email dispatch wired into Collections "Send" (#10); postal letter dispatch queue + endpoint stub (#10 follow-up — provider not yet wired).
- **Sprint 14 (Pricing + costing):** Canonical `bin_type` SQL CHECK constraint + normalize backfill migration (#14 — backfill is one operator step away); JobCostingWidget wired into DispatchBoard cards (#19); derived per-bin loss detection + cost-detail schema (#15); money rounding helpers + competitor rate name normalization (#29, #30).
- **Sprint 15 (Xero + mobile UX hardening):** Split `opex_wages`/`opex_super`, harden cash matcher, BS column coverage in `xero-mapper` (#24, #26, #28, #31); mobile dashboard tab picker drawer — all 12 tabs reachable on mobile (#23).

**Sprint 16 (in flight):** Truth-up of PRD-v6 §1 status (this commit, #38), continuing P1/P2 backlog burn-down from `FIXES-NEEDED.md`.

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
7. **Preserve What's Built** — all sprints of existing Hub features retained and integrated

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

| Pain | Impact | Solution in v5/v6 |
|------|--------|------------------|
| Bin Manager is separate from Hub — double handling | 30+ min/day admin overhead | Replace Bin Manager entirely; all ops in Hub |
| No live job costing — profitability unknown until end of month | Cannot reprice quickly | Real-time cost capture per job |
| Manual Xero invoice entry after each job | 5–10 min per job × 80 jobs/week = 6+ hrs/week | Auto-invoice on job completion |
| Paper run sheets for drivers | Lost data, no accountability, no photos | Mobile driver dashboard |
| No automated customer communications | Staff time + missed follow-ups | Automated SMS/email at every stage |
| Tip dockets filed manually or lost | Cannot verify tipping costs | OCR receipt capture on driver phone |
| No overdue invoice automation | Debtors blow out | Automated dunning + legal letter generation (NEW in v6) |
| No pricing intelligence from market | Pricing decisions on gut feel | Web-sourced cost and competitor intelligence |
| Wages/overtime tracked in Xero only | No operational visibility | Rostering + time tracking module |

### 3.3 Strategic Goals

1. **Eliminate Bin Manager** — all operational data in one place
2. **Zero manual invoicing** — every completed job auto-invoices to Xero
3. **Sub-5-minute job costing** — real costs captured as job happens, not end of month
4. **Driver accountability** — photos, weights, signatures, dockets from every job
5. **Cash flow protection** — automated overdue chasing from day 1, legal escalation to statutory demand
6. **Pricing intelligence** — weekly AI-generated pricing review with market data

---

## 4. User Personas

### 4.1 Mark — Owner / Director / Operator

**Age:** 45 | **Device:** 60% mobile, 40% desktop
**Role:** Business owner, primary decision-maker, often in the yard or on the road
**Access:** Full owner access — all features including AI key management, platform settings

**Daily reality:** Mark starts his day in the yard watching trucks leave. He needs to see today's jobs loading correctly, any problems with yesterday's billing, and his cash position — all in 5 minutes on his phone before the day gets chaotic.

**What v6 gives Mark (additions since v5):**
- Collections dashboard showing overdue accounts by escalation level — who needs action today
- AI API key management without needing a redeploy
- Home screen now includes Collections tile for direct access

### 4.2 Sarah — Office Manager / Bookkeeper

**Age:** 38 | **Device:** 90% desktop, 10% tablet
**Role:** Invoicing, AR follow-up, payroll, Xero reconciliation, monthly close
**Access:** Bookkeeper role — all ops + all financial dashboards, no system settings

**What v6 gives Sarah (additions since v5):**
- Collections page with one-click legal letter generation at each escalation level
- Inline customer creation when taking a booking — no more context-switching to CRM
- Payment terms and account type set at booking time
- Formal overdue notices, letters of demand, and statutory demand warnings auto-generated with correct Victorian/Commonwealth legal references

### 4.3 Jake — Fleet / Operations Manager

**Age:** 34 | **Device:** 70% mobile (yard/road), 30% desktop
**Role:** Driver coordination, bin logistics, fleet maintenance, EPA compliance
**Access:** Manager role — all ops + dashboard + compliance entry

*Unchanged from v5 — see PRD v5 section 4.3.*

### 4.4 Drivers (Tom, Dave, and others)

*Unchanged from v5 — see PRD v5 section 4.4.*

### 4.5 Customers (Public Booking)

**Device:** Mix of mobile and desktop
**Role:** Book bins, receive updates, pay invoices

**What v6 adds:**
- White-label embeddable booking widget — can be placed on binned-it.com.au or any third-party site via an iframe. Widget reads branding and bin sizes from Supabase tenant config; bookings are saved directly to the Hub database.

### 4.6 Andrew — Investor / Silent Partner

*Unchanged from v5 — see PRD v5 section 4.6.*

---

## 5. UX/UI Architecture — Navigation Overhaul

*(Retained from PRD v5 — extended below for v6 additions)*

### 5.1 Primary Navigation (Desktop — Left Sidebar)

Collections is now a first-class item in the Operations section:

```
BINNED-IT HUB
─────────────────────
[OPERATIONS]
  Dispatch Board
  Bookings          ← inline customer creation added
  Fleet
  Drivers
  Customers
  Invoices
  Collections       ← NEW: overdue enforcement engine

[REPORTS & INTELLIGENCE]
  Financial Dashboard
  Monthly History

[SYSTEM]
  Settings          ← AI key management, white-label widget
  About
─────────────────────
AI Assistant (floating, all screens — desktop)
```

### 5.2 Mobile Navigation (Bottom Bar)

Updated (v6) to include operational pages:

```
[Home] [Dispatch] [Bookings] [Collections] [Reports] [Chat]
```

Previous v5 nav was: Home, Dashboard, Alerts, Work Plan, Chat — too financial-report-centric for an operations platform.

### 5.3 Home Screen Tiles

Updated tile grid (v6): Dispatch, Bookings, Invoices, Customers, **Collections** (new), Fleet, Financial Reports, Load Data, Settings.

---

## 6. What's Already Built

All of the following is **complete and retained in v6** — nothing is removed:

### 6.1 Hub v2.2 — All Sprints Complete (as at 27 April 2026)

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
| 15 database migrations applied | Complete |
| Vercel deployment with GitHub CI/CD | Complete |
| Error boundaries throughout | Complete |
| CRM Bookings page with inline customer creation | Complete (new in v6) |
| Collections & Legal Enforcement engine | Complete (new in v6) |
| AI API key management (runtime, no redeploy) | Complete (new in v6) |
| White-label embeddable booking widget | Complete (new in v6) |
| Audit log (immutable change trail) | Complete |
| Team & Staff management page | Complete |
| Driver app (mobile run sheet) | ✅ Complete v1 (Sprint 12 #18 — Arrived state + photo gate + checklist gate; offline write queue library Sprint 12 #17, wiring into all components 🟡 Partial) |
| Xero sync — improved 404 handling and JWT verification | Complete (new in v6) |
| UI contrast improvements (bg, borders, text tokens) | Complete (new in v6) |

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

### 6.3 Xero Integration (existing — to be extended)

Currently reads: P&L, Balance Sheet, AR aging → syncs to Supabase.
v5/v6 status: read sync complete, write capability (auto-invoice) planned for Phase 4.

---

## 7. Feature Map by Workflow Stage

*(Unchanged from PRD v5 — see section 7 of v5. Collections enforcement (Stage 6) is now live as documented in Section 15.)*

---

## 8. Complete Feature Requirements

*(Sections 8.1–8.10 unchanged from PRD v5. New feature requirements are in Section 15.)*

---

## 9. Phased Delivery Plan

### Phase Overview

| Phase | Sprints | Theme | Outcome |
|-------|---------|-------|---------|
| Phase 1 (Complete) | Sprints 1–7 | Financial reporting platform | Hub v2.2 live — all reporting features delivered |
| Phase 2 (Complete) | Sprints 8–9 | Operational foundation | Bookings + dispatch + CRM operational |
| Phase 2.5 (Complete) | — | CRM collections & legal | Collections engine, inline customer creation, white-label widget, API key management |
| Phase 3 | Sprints 10–11 | Driver mobile app | Drivers on digital run sheets, tip docket OCR live |
| Phase 4 | Sprints 12–13 | Automation & invoicing | Auto-invoicing, dunning, job costing complete |
| Phase 5 | Sprints 14–15 | Intelligence layer | AI pricing reports, web search, demand forecasting |
| Phase 6 | Sprint 16+ | Full maturity | Rostering, wages, advanced analytics, customer portal |

### Phase 2.5 — Post-Sprint 9 Additions (Complete as at April 2026)

These features were built between PRD v5 and v6 to close operational gaps identified after the Phase 2 build:

- [x] CRM Collections engine with 4-level escalation workflow
- [x] Legal letter generation (overdue notice → formal notice → letter of demand → statutory demand)
- [x] Security Over Assets letter generation
- [x] Customer risk score calculation (PostgreSQL function)
- [x] Credit applications, customer directors/guarantors, trade references
- [x] Inline customer creation in booking modal (with ABN, payment terms, account type)
- [x] White-label embeddable booking widget (`/embed/:slug`)
- [x] Runtime Claude AI API key management in Settings (stored in `platform_settings`, owner only)
- [x] UI contrast improvements — darker background (#D8E5DF), darker card borders (#A8B8B0), darker text tokens
- [x] Xero sync reliability — JWT verification via `SUPABASE_ANON_KEY`, improved 404 error handling
- [x] Collections tile added to home screen
- [x] Mobile nav updated to include Dispatch, Bookings, Collections, Reports, Chat

---

## 10. Technical Architecture

*(Unchanged from PRD v5. Additional environment variables documented in Section 15.5.)*

---

## 11. Integration Map

*(Unchanged from PRD v5.)*

---

## 12. Data Model Changes

### 12.1 Existing Tables (unchanged, retained)

*(Same as PRD v5 section 12.1)*

### 12.2 New Tables Since PRD v5 (Migrations 014–015)

See Section 15 for full details of each new table. Summary:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `customer_contacts` | 014 | Multiple contacts per customer account |
| `customer_directors` | 014 | Directors/guarantors for credit accounts |
| `customer_trade_refs` | 014 | Trade reference checks for credit applications |
| `credit_applications` | 014 | Formal credit application workflow |
| `account_contracts` | 014 | T&C acceptance audit trail |
| `customer_notes` | 014 | Free-text notes per customer |
| `collections_events` | 014 | Immutable log of all collections actions |
| `payment_history` | 014 | Per-invoice payment conduct tracking |
| `platform_settings` | 015 | Runtime config (API keys, etc.) — owner RLS |

### 12.3 Columns Added to Existing Tables (Migration 014)

**customers:** abn, acn, account_type, account_status, credit_status, credit_limit, payment_terms_days, creditorwatch_ref/score/checked_at, ppsr_registered, ppsr_registration_number, risk_score, director_guarantee_required/received, outstanding_balance, overdue_balance, days_overdue, on_time_payment_pct, total_payments, late_payments, state, postcode

**bookings:** customer_id (FK → customers)

**invoices:** customer_id (FK → customers), collections_level, collections_last_action_at, interest_accrued, billing_contact_id (FK → customer_contacts)

---

## 13. Success Metrics

*(Unchanged from PRD v5.)*

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
| Legal letter ABN/ACN placeholders | Medium | Medium | `legalTemplates.js` has placeholder ABN/ACN/phone — must update before first real letter is sent |
| `platform_settings` key exposure | Low | High | RLS restricts to owner role; key stored as plaintext in Supabase — consider encryption at rest |

---

## 15. Features Built Since PRD v5

*All items in this section were built between 3 April 2026 and 27 April 2026.*

---

### 15.1 CRM Collections & Legal Enforcement Engine

**Status:** Live

#### What It Does

A full debt recovery workflow for overdue invoices. Replaces ad-hoc phone calls and manual letters with a structured 4-level escalation system backed by Victorian and Commonwealth law. Every action is logged to an immutable audit trail.

#### How Users Interact With It

Sarah or Mark navigates to **Collections** (home tile or left sidebar). The page shows:

- **KPI summary bar:** Total overdue amount, number of invoices at each escalation level (L1–L4), with clickable level cards to filter the list.
- **Collections Process Banner:** Visual timeline showing the 4 steps, the day triggers, and the relevant legislation at each level.
- **Invoice list:** Each overdue invoice shows customer, invoice number, days overdue, and amount. The invoice row is colour-coded by level and shows "Action Required" when the current calculated level exceeds the last recorded action.
- **Expand row:** Click any invoice to reveal detail cards (amount, due date, days overdue, last action) and action buttons.
- **Generate letter:** Clicking "Generate Level N Letter" opens a letter preview modal. The letter is pre-filled with customer name, address, invoice details, accrued interest calculation (Penalty Interest Rates Act 1983 Vic), and legal references appropriate to the level.
- **Delivery method:** Email / Registered Post / Email + Registered Post.
- **Record & Send:** Records the event in `collections_events`, updates `invoices.collections_level`, closes the modal.
- **Security Over Assets Letter:** For invoices >$5,000, an additional button generates a letter requiring PPSR registration and a Director's Personal Guarantee.

#### Escalation Levels

| Level | Label | Trigger | Law Referenced |
|-------|-------|---------|---------------|
| 1 | Overdue Notice | Day 5 | Friendly reminder |
| 2 | Formal Notice | Day 10 | Penalty Interest Rates Act 1983 (Vic) |
| 3 | Letter of Demand | Day 15 | Magistrates' Court of Victoria (up to $100k) |
| 4 | Statutory Demand | Day 21+ | Corporations Act 2001 s.459E, s.459C, s.459G |

#### Technical Implementation

- **Component:** `src/components/CollectionsPage.jsx`
- **Hooks:** `src/hooks/useCollections.js` — `useCollectionsSummary`, `useOverdueInvoices`, `useCreateCollectionsEvent`, `useEscalateInvoice`
- **API:** `src/api/collections.js`
- **Legal templates:** `src/lib/legalTemplates.js` — exports `generateCollectionsLetter(level, invoice, customer, contact)` and `generateSecurityOverAssetsLetter(customer, creditLimit)`
- **Migration:** `supabase/migrations/014_crm_collections.sql`
- **New tables:** `collections_events`, `customer_contacts`, `customer_directors`, `customer_trade_refs`, `credit_applications`, `account_contracts`, `customer_notes`, `payment_history`
- **New DB function:** `calc_customer_risk_score(p_late_payments, p_total_payments, p_overdue_balance, p_credit_limit, p_days_overdue) RETURNS integer` — scores 0–100, used for future risk dashboard
- **Customer columns added:** `risk_score`, `credit_limit`, `payment_terms_days`, `outstanding_balance`, `overdue_balance`, `days_overdue`, `ppsr_registered`, `director_guarantee_required/received`, and many more (see migration 014)
- **Invoice columns added:** `collections_level`, `collections_last_action_at`, `interest_accrued`
- **Fallback data:** Three hardcoded overdue invoices (Roach Demolition, Scotty's Suburban, TREC Plumbing) displayed when Supabase is unavailable.
- **Route:** `/collections` — wired in `src/App.jsx`

#### Known Limitations / TODOs

- `legalTemplates.js` contains placeholder ABN (`57 123 456 789`), ACN, phone, BSB, and bank account number. **Must be updated with real values before any letter is sent.**
- The "Send" action currently only records the event in Supabase — it does not dispatch an email or post the letter. Email dispatch integration (via Resend) is planned for Phase 4.
- `creditorwatch_ref`, `creditorwatch_score` columns exist but the CreditorWatch API is not yet integrated.

---

### 15.2 Inline Customer Creation in Bookings

**Status:** Live

#### What It Does

When taking a new booking in the CRM Bookings page, staff can create a new customer account without leaving the booking flow. Previously, a new customer had to be created in the Customers section first.

#### How Users Interact With It

1. Sarah opens **Bookings** → clicks **New Booking**.
2. In the Customer step, she types a name and gets no match.
3. She clicks **Create New Customer** — the form expands inline within the booking modal.
4. She fills in: Name (required), Email, Phone, Address, Suburb, Postcode, **ABN**, **Account Type** (Commercial / Residential / Credit Account / COD Only), **Payment Terms** (COD / NET 7 / NET 14 / NET 21 / NET 30).
5. Clicks **Create Customer** → customer record is inserted into Supabase `customers` table and immediately selected for the booking.
6. Flow continues to service selection without leaving the modal.

#### Technical Implementation

- **Component:** `src/components/CRMBookingsPage.jsx` — `NewBookingModal` function, `newCustomerMode` state, `handleCreateCustomer()` async function
- **Supabase insert:** `supabase.from('customers').insert({...}).select().single()`
- **Account type options:** `commercial`, `residential`, `account`, `cod`
- **Payment terms options:** 0 (COD), 7, 14, 21, 30 days
- **ABN capture:** stored as `abn` on the `customers` table (migration 014 column)
- **Credit status:** automatically set to `unrated` for `account` type, `approved` for others
- **Callback:** `onCustomerCreated(data)` prop propagates the new customer up to the parent so it appears in the customer list immediately

---

### 15.3 AI Chat API Key Management

**Status:** Live

#### What It Does

Owners can update the Claude AI API key at runtime through the Settings page, without triggering a Vercel redeploy. The key is stored in the `platform_settings` Supabase table and read by the `/api/chat` Edge Function on every request, taking precedence over the environment variable.

#### How Users Interact With It

1. Mark navigates to **Settings** → **Claude AI Configuration** section (owner-only, not visible to other roles).
2. The current stored key status is displayed (masked as `sk-ant-…XXXXXX` or "None — using environment variable").
3. Mark pastes a new API key into the input field (show/hide toggle available).
4. Clicks **Save Key** — key is upserted to `platform_settings` with key `anthropic_api_key`.
5. **Test Connection** button sends a test prompt to `/api/chat` and shows OK / fail / local-dev warning.
6. **Remove Key** button deletes the stored key, reverting to the environment variable fallback.

#### Technical Implementation

- **Component:** `src/components/SettingsPage.jsx` — `claudeKey`, `claudeKeyShow`, `claudeKeySaving`, `claudeKeyStatus`, `claudeKeyStored` state; inline save/test/delete handlers
- **Migration:** `supabase/migrations/015_platform_settings.sql`
- **Table:** `platform_settings (key TEXT PK, value TEXT, updated_at TIMESTAMPTZ, updated_by UUID)` — RLS restricts all operations to `owner` role
- **Edge Function usage:** `/api/chat.js` reads `platform_settings` via Supabase admin SDK on each request; falls back to `ANTHROPIC_API_KEY` env var if no row found
- **Validation:** Save button disabled unless input starts with `sk-ant-`
- **404 handling:** Test Connection recognises a 404 (local dev without `vercel dev`) and shows a helpful amber warning instead of a false error

---

### 15.4 UI Contrast Improvements

**Status:** Live

#### What Changed

The application-wide colour tokens in `src/theme.js` were updated to improve readability on both desktop and mobile:

| Token | Old Value | New Value | Reason |
|-------|-----------|-----------|--------|
| `B.bg` | `#F2F6F4` | `#D8E5DF` | Deeper background creates stronger contrast with white cards |
| `B.cardBorder` | `#D8DDD9` | `#A8B8B0` | Borders now visible on the darker background |
| `B.textPrimary` | `#000006` | `#0A1610` | Near-black with green tint |
| `B.textSecondary` | `#3D3D4F` | `#1E3028` | Dark green-grey — higher contrast |
| `B.textMuted` | `#6B7280` | `#4A5E56` | Readable muted text on the new background |

These changes affect all pages that use `B.*` tokens. No component-level style changes were required — the token update propagated automatically.

---

### 15.5 Xero Sync Improvements

**Status:** Live

#### What Changed

Two reliability improvements were made to `api/xero-sync.js`:

1. **JWT Verification via `SUPABASE_ANON_KEY`:** The Xero sync Edge Function now properly verifies the user's Supabase JWT using the anon key before processing the request. This closes a security gap where unauthenticated requests could trigger a sync.

2. **404 / Local Dev Error Handling:** If the function receives a 404 (which happens in local `vite dev` without `vercel dev` running), it now returns a clear, actionable error message: "Xero sync requires Vercel Edge Functions — run `vercel dev` locally or use the live app." Previously this produced a confusing generic error.

3. **Improved error messages:** Connection failures to Xero now surface the Xero API status code and response body in the error message, making debugging faster.

#### Environment Variable Added

`SUPABASE_ANON_KEY` must be set in Vercel environment variables for JWT verification to work. This is separate from `VITE_SUPABASE_ANON_KEY` (the client-side variable) — the Vercel Edge Function environment does not have access to `VITE_` prefixed variables.

---

### 15.6 White-Label Booking Widget

**Status:** Live

#### What It Does

An embeddable booking form that can be placed on any external website (e.g. `binned-it.com.au`) via an iframe. The widget reads its branding and available bin sizes from the Supabase `tenants` and `tenant_bin_sizes` tables, supports multiple tenant slugs, and saves submitted bookings directly to the Hub's `bookings` table.

#### How Users Interact With It

**Staff (Settings):**
- Mark navigates to **Settings** → **White-Label Booking Widget** section.
- Selects tenant slug from dropdown (currently only `binned-it` is configured).
- Copies the generated iframe embed code.
- Pastes into the external website's HTML.
- Preview link opens the widget in a new tab at `/embed/[slug]`.

**Public customers (on external website):**
1. **Bin Size** step — grid of available bin sizes with description and price. "Popular" badge shown where configured.
2. **Your Details** step — name, email, phone fields.
3. **Delivery** step — address, suburb, postcode, preferred delivery date, waste type, special instructions.
4. **Review & Confirm** step — full order summary before submission.
5. Submitted booking saved to `bookings` table with `tenant_id` set.

#### Technical Implementation

- **Component:** `src/components/EmbedBookingPage.jsx` — multi-step form with dynamic branding from Supabase tenant config
- **Settings UI:** `src/components/SettingsPage.jsx` — `WhiteLabelWidget` function component
- **Route:** `/embed/:slug` (public, no auth required) — needs to be added to router if not already present
- **Migration:** `supabase/migrations/012_white_label_tenants.sql` — creates `tenants` and `tenant_bin_sizes` tables
- **Palette:** Widget derives text colours dynamically using luminance calculation on the tenant's primary colour hex value
- **Fallback bins:** `FALLBACK_BINS` array in `EmbedBookingPage.jsx` used when Supabase returns empty

---

### 15.7 Routing and Navigation Fixes (v6)

**Status:** Live

The following routing and navigation issues were identified and fixed as part of the v6 update:

#### Collections Tile on Home Screen (Fixed)

Collections was a first-class page reachable from the sidebar and URL, but was missing from the home screen module tiles. A Collections tile (icon: ⚖️, red accent, description: "Overdue account management — escalating demand letters & legal action") has been added to the `tiles` array in `src/App.jsx`.

#### Mobile Navigation Update (Fixed)

The MobileNav was showing financial-report-centric items (Alerts, Work Plan) that did not reflect the operations-first platform. The nav has been updated to:

```
[Home] [Dispatch] [Bookings] [Collections] [Reports] [Chat]
```

This gives mobile users (primarily Mark in the yard) direct access to the most critical operational screens.

---

## Appendix A: Tech Stack Reference

*(Unchanged from PRD v5.)*

---

## Appendix B: Environment Variables Required (Full List)

```env
# Existing
VITE_SUPABASE_URL=https://dkjwyzjzdcgrepbgiuei.supabase.co
VITE_SUPABASE_ANON_KEY=[key]
SUPABASE_SERVICE_ROLE_KEY=[key]
ANTHROPIC_API_KEY=[key]        ← fallback; overridden by platform_settings table
VERCEL_TOKEN=[key]

# NEW (added in v6)
SUPABASE_ANON_KEY=[key]        ← server-side (Edge Function) JWT verification — different from VITE_ prefix

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

## Appendix C: Legal Templates Reference

`src/lib/legalTemplates.js` exports the following functions. **Before first use, update the `COMPANY` constant at the top of the file with real values.**

| Function | Usage |
|----------|-------|
| `generateCollectionsLetter(level, invoice, customer, contact)` | Levels 1–4 escalating demand letters |
| `generateSecurityOverAssetsLetter(customer, creditLimit)` | PPSR/guarantee requirement for high-value accounts |
| `generateAccountContract(customer, guarantor)` | Credit account T&C agreement |
| `generateDirectorGuarantee(customer, guarantor)` | Director's personal guarantee deed |

**IMPORTANT:** These templates are drafted to comply with Victorian and Commonwealth law as at April 2026. They should be reviewed by a solicitor before first operational use. They are not legal advice.

---

*End of PRD v6.0*

**Status:** ACTIVE — Single source of truth for all Binned-IT Hub development
**Next Action:** Phase 3 — Driver mobile app (Sprint 10: job controls + photo capture)
**Last Updated:** 27 April 2026
