# Binned-IT Dashboard Hub — Product Requirements Document

**Version:** 3.0
**Date:** 27 March 2026
**Status:** Active — Sprint 3 Roadmap
**Author:** BMAD Autonomous Session — Claude Sonnet 4.6
**Supersedes:** PRD v2.2 (Sprint 2 Architecture Kickoff)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [User Personas](#3-user-personas)
4. [Jobs To Be Done](#4-jobs-to-be-done)
5. [Feature Requirements](#5-feature-requirements)
6. [Functional Specifications](#6-functional-specifications)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Model](#8-data-model)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Sprint Delivery Plan](#10-sprint-delivery-plan)
11. [Risk Register](#11-risk-register)
12. [Open Questions / Decisions Needed](#12-open-questions--decisions-needed)

---

## 1. Executive Summary

Binned-IT Dashboard Hub is a cloud-native Management Intelligence Platform built exclusively for Binned-IT Pty Ltd — a skip bin hire company operating in Seaford, Melbourne. It replaces a fragmented collection of Xero Excel exports, Bin Manager reports, and manual spreadsheets with a single, always-current, multi-user intelligence system.

**Sprint 1** delivered a fully functional React SPA with hardcoded financial data (Jul 2025–Feb 2026), localStorage persistence, a 12-step data entry wizard, 11-tab executive dashboard, 40+ automated alerts, competitor pricing matrix, work plan tracker, and an AI assistant powered by the Anthropic Claude API.

**Sprint 2** (architecture underway) migrates to a proper cloud backend: Supabase PostgreSQL for all data persistence, Supabase Auth for multi-user access control, Vercel for hosting, and GitHub Actions for CI/CD. The database schema and API layer are defined; the Supabase client and auth context are wired; the data API modules (`src/api/*.js`) are written but not yet called by UI components.

**Sprint 3 onwards** (this PRD) defines the full target product: mobile-responsive PWA, complete Supabase data wiring, Fleet and Operations module for Jake, investor-grade read-only view, PDF export, enhanced AI assistant, and push notification alerts.

### Key Numbers (as at Feb 2026 — from hardcoded data)
- **YTD Revenue:** $1,250,479 (8 months, Jul 2025–Feb 2026)
- **YTD Net Profit:** $189,184 (15.1% margin)
- **AR Outstanding:** $151,365 ($28,329 overdue)
- **Tax Liability:** ~$540k (GST + PAYG, ATO payment plan required)
- **Loss-making bin types identified:** 4 (urgently needing repricing)
- **Competitor pricing gaps:** Most competitors show "POA" — intelligence gap

---

## 2. Business Context

### 2.1 Company Background

Binned-IT Pty Ltd is a privately-owned skip bin hire operator based in Seaford, Victoria. The business offers general waste, asbestos, soil, green waste, and contaminated waste removal services across Melbourne's southern suburbs. The company operates a fleet of trucks, a yard of skip bins in multiple sizes (4m³ to 23m³), and holds EPA licences for regulated waste streams.

Key characteristics:
- **FY revenue:** ~$1.5–1.8M annually (based on 8-month YTD run-rate)
- **Staff:** Approximately 6–10 including drivers, administration, and management
- **Bin types:** 18+ product SKUs across general waste, asbestos, soil, green waste
- **Compliance obligations:** EPA (Victoria), WorkSafe (WHS), vehicle roadworthiness, asbestos handler certification, public liability and workers compensation insurance
- **Accounting system:** Xero (accrual basis)
- **Operational system:** Bin Manager (deliveries, bin tracking)
- **Banking:** Westpac

### 2.2 Problem Statement

The business currently manages its performance through:
- Disconnected Excel exports from Xero (P&L, AR aging, balance sheet, cash summary)
- Bin Manager CSV/Excel reports for fleet and delivery data
- Westpac online banking for cash position
- Verbal and ad-hoc knowledge for compliance tracking
- No single operational picture: finance, fleet, compliance, and BDM data live in separate systems with no integration

This results in:
- **Decision lag:** Mark spends 2–3 hours monthly compiling a management snapshot
- **Missed pricing opportunities:** 4 bin types confirmed loss-making; many at below-market rates
- **Compliance risk:** WHS incident register absent; asbestos documentation not systematically tracked; EPA renewal dates not monitored
- **Debtor risk:** AR aging $28k overdue; no automated alerts for escalating accounts
- **Cash flow blind spots:** ATO liability of ~$540k not clearly visualised against cash position
- **No investor visibility:** Silent partner receives stale PDFs quarterly rather than live access

### 2.3 Success Metrics (KPIs for the Product)

| Metric | Baseline | Target (6 months) |
|--------|----------|-------------------|
| Time to produce monthly management report | 2–3 hours | < 20 minutes (wizard + auto-analysis) |
| Overdue AR as % of total | 18.7% | < 12% |
| Loss-making bin types | 4 confirmed | 0 (repriced) |
| Compliance items with tracked due dates | 0 | 100% |
| Mark's weekly logins | 1–2 | 5+ (via mobile) |
| Data latency (latest month vs today) | 4–6 weeks | < 5 business days |
| Dashboard uptime | N/A (local) | 99.5% |
| Wizard completion rate | Ad-hoc | ≥1 per month |

---

## 3. User Personas

### 3.1 Persona 1: Mark — Owner / Director

**Age:** 45
**Role:** Business owner and primary operator
**Technical comfort:** Moderate. Uses smartphone daily, comfortable with online banking and Xero, not a developer
**Access:** Full access — all dashboards, wizard, settings, admin
**Device split:** 60% mobile (mornings, on the road), 40% desktop (office)

**Background:**
Mark founded Binned-IT and runs the business day-to-day. He manages customer relationships, approves pricing, makes capital decisions, and reviews financials monthly. He currently spends Monday mornings compiling figures from Xero and Bin Manager into a personal spreadsheet to understand where the business stands. He is the primary decision-maker for all strategic actions.

**A day in Mark's life:**
7:00am — checks phone for overnight emails and any urgent customer issues.
8:00am — in the yard as trucks leave, checking job schedules.
9:00am — in the office reviewing quotes and following up on large debtors.
End of month — 2–3 hours manually building a financial snapshot; often frustrated that by the time it's ready, the data is already old.

**Goals:**
- Know where the business stands financially at any time, without building a spreadsheet
- Identify unprofitable jobs before they erode margins further
- Stay ahead of compliance due dates so nothing gets missed
- Understand how Binned-IT's pricing compares to competitors
- Have something useful to show a bank manager or investor without preparation time

**Pain Points (discovered):**
1. The monthly financial snapshot takes 2–3 hours to produce and is immediately out of date
2. He cannot easily see which bin types are profitable vs losing money — pricing decisions are made on gut feel
3. Compliance due dates (EPA renewal, insurance, vehicle rego) are tracked in a paper diary and nearly get missed
4. He has no confidence that all Feb COS invoices have been posted — the margin figures look wrong but he can't tell why
5. When the silent investor calls, Mark has to scramble to find recent figures

**JTBD (Jobs To Be Done):**
1. When I start my work week, I want to see a one-screen financial health summary so I can prioritise where to focus
2. When I review pricing, I want to see exactly which bin types are losing money and by how much, so I can raise rates with confidence
3. When a compliance due date approaches, I want to be alerted on my phone so nothing is missed
4. When my investor calls, I want to share a live dashboard link so I don't have to email PDFs
5. When I'm in the office, I want to ask the AI "what's my biggest risk this month" and get a grounded, data-based answer

**Mobile Must-Haves:** Snapshot KPIs, alert notifications, quick debtor list, cash balance

**Nice-to-Haves:** Voice note to AI assistant, Xero direct OAuth so he never has to upload files manually

### 3.2 Persona 2: Sarah — Office Manager / Bookkeeper

**Age:** 38
**Role:** Office administration and bookkeeping (may be external contractor)
**Technical comfort:** High — Xero power user, comfortable with Excel
**Access:** Bookkeeper role — wizard/data entry + read access to all dashboards
**Device split:** 90% desktop, 10% tablet

**Background:**
Sarah manages invoicing, bank reconciliation, payroll processing, AR follow-up, and monthly financial close in Xero. She currently exports Xero reports to Excel, formats them manually, and emails them to Mark. She also chases overdue debtors by phone and email. Her biggest frustration is doing the same data entry in multiple places: Xero, then a spreadsheet, then a summary email.

**Goals:**
- Enter data once, have it appear everywhere it needs to be
- Not be responsible for formatting management reports — just provide the raw data
- See who owes money and how overdue they are without digging through Xero AR
- Track that all asbestos jobs have proper documentation to avoid compliance failures

**Pain Points (discovered):**
1. She exports Xero reports, reformats in Excel, and emails to Mark — the whole process takes 45–60 minutes each month close
2. The AR aging from Xero is a flat spreadsheet; she cannot easily see trend or set a follow-up date
3. She occasionally worries that a month's reconciliation has missing transactions — she wants a data quality score to validate completeness before submitting
4. She tracks asbestos jobs in a separate spreadsheet that nobody else looks at — risk of the data dying with her

**JTBD:**
1. When I close the month in Xero, I want to upload the exports directly into Dashboard Hub so Mark sees the figures automatically
2. When I review AR, I want to see each debtor's aging trend across 3 months so I can prioritise collection calls
3. When I submit a monthly report, I want a data quality score that flags missing or suspicious entries before I publish
4. When I update an asbestos job's compliance status, I want it to appear on the Risk/EPA tab immediately
5. When there are unreconciled transactions, I want the system to flag them automatically so I don't have to manually cross-check

**Mobile Must-Haves:** None (desktop-primary)
**Nice-to-Haves:** Direct Xero OAuth pull (eliminate manual export), automated overdue debtor email from the platform

### 3.3 Persona 3: Jake — Operations / Fleet Manager

**Age:** 34
**Role:** Fleet manager, driver coordinator, bin logistics
**Technical comfort:** Moderate. Uses Bin Manager daily, comfortable with smartphones
**Access:** Manager role — dashboard read + work plan + compliance entry
**Device split:** 70% mobile (yard, on road), 30% desktop (office)

**Background:**
Jake coordinates the truck drivers each morning, manages bin inventory, oversees fleet maintenance schedules, and ensures EPA compliance for each regulated waste job. He currently uses Bin Manager for delivery tracking, a whiteboard for driver assignments, and a folder of paper records for vehicle maintenance. EPA compliance records for asbestos and soil jobs are kept in a folder that Mark and Sarah occasionally check.

**Goals:**
- Know which bins are out on hire and for how long, without calling drivers
- See upcoming maintenance due dates across the fleet so nothing gets missed
- Confirm that every regulated waste job (asbestos, contaminated soil) has a disposal receipt on file
- Have a simple way to log a compliance check from his phone rather than filling in a paper form

**Pain Points (discovered):**
1. He has no single view of all bins currently on hire and their duration — he has to call drivers or check Bin Manager one job at a time
2. Vehicle maintenance records are in a folder that nobody systematically reviews — a service interval was nearly missed last quarter
3. When asbestos jobs come back, he relies on drivers to file the paperwork — sometimes it's incomplete or missing
4. He cannot see from the dashboard whether the EPA licence is current or when it expires — he found out it was due for renewal by accident

**JTBD:**
1. When I start the day, I want to see which bins have been on-hire for 14+ days so I can prioritise collections
2. When a truck is due for a service, I want to see it flagged in the dashboard 4 weeks before it's due
3. When a regulated waste job is completed, I want to log the disposal receipt reference number directly from my phone
4. When the EPA licence is within 60 days of expiry, I want an alert pushed to my phone automatically
5. When Mark reviews fleet performance, I want the bin utilisation data to be accurate and current, not estimated from last month

**Mobile Must-Haves:** Bin on-hire list, compliance alerts, maintenance due dates, quick-log disposal receipt
**Nice-to-Haves:** Driver assignment board, bin GPS tracking (future), photo upload for compliance docs

### 3.4 Persona 4: Investor / Silent Partner (Viewer)

**Age:** 55
**Role:** Financial investor with equity stake, non-operational
**Technical comfort:** Low-moderate. Uses email, can navigate a website, not comfortable with complex tools
**Access:** Viewer role — read-only dashboard, no editing rights
**Device split:** 50% desktop (home office), 50% tablet

**Background:**
The investor has a financial stake in the business and checks in quarterly via phone with Mark. Currently receives a PDF summary emailed by Mark — which by the time it arrives is already 4–6 weeks stale. He is interested in high-level performance: is the business growing, is it profitable, is there any material risk he should know about? He does not need operational detail.

**Goals:**
- See a single-screen high-level view of business health whenever he wants
- Understand revenue trend, profitability, and debtor exposure without needing to understand the details
- Not have to call Mark for updates — be able to check himself
- Have confidence the data is live and accurate, not a manually prepared PDF

**Pain Points (discovered):**
1. The quarterly PDF he receives is often out of date before he reads it — decisions based on stale data
2. He has to call Mark for clarification on financial figures, which wastes Mark's time
3. He cannot tell at a glance if there are any material risks he should be aware of
4. There is no single number that tells him "the business is doing well" — he has to interpret multiple metrics

**JTBD:**
1. When I want to check on my investment, I want to log in and see a one-page health summary in under 60 seconds
2. When the business has a strong month, I want to see it reflected immediately, not in next quarter's email
3. When there is a material risk (large debtor, compliance issue, cash squeeze), I want to be alerted rather than learn about it on a call
4. When I want the key financial trend, I want to see 12 months of revenue and profit in a simple chart
5. When I share with my accountant, I want to send a link not a PDF

**Mobile Must-Haves:** Snapshot KPIs, revenue trend chart, alert summary
**Nice-to-Haves:** Downloadable PDF snapshot, email digest option

---

## 4. Jobs To Be Done

### 4.1 JTBD Master Table

| JTBD ID | Persona | Job Statement | Current Workaround | Value |
|---------|---------|--------------|-------------------|-------|
| J01 | Mark | See weekly financial health at a glance | Manual spreadsheet, 2–3 hrs | Very High |
| J02 | Mark | Identify loss-making bin types instantly | Manual cost analysis | Very High |
| J03 | Mark | Get compliance due date alerts on phone | Paper diary | High |
| J04 | Mark | Answer investor questions from live data | Email PDFs | High |
| J05 | Mark | Ask AI "what's my biggest risk" | None | Medium |
| J06 | Sarah | Upload Xero exports, data appears automatically | Manual reformat + email | Very High |
| J07 | Sarah | See AR aging trend across 3 months | Xero flat export | High |
| J08 | Sarah | Get a data quality score before publishing | Manual cross-check | High |
| J09 | Sarah | Update compliance status from one place | Separate spreadsheet | Medium |
| J10 | Jake | See bins on hire 14+ days at a glance | Call drivers / Bin Manager | High |
| J11 | Jake | See fleet maintenance due dates | Paper folder | High |
| J12 | Jake | Log disposal receipt from phone | Paper form | Medium |
| J13 | Jake | Know EPA licence expiry | Discovered by accident | Critical |
| J14 | Investor | See one-page health summary in 60 seconds | Quarterly PDF | High |
| J15 | Investor | See 12-month revenue/profit trend | Quarterly PDF | High |
| J16 | Investor | Be alerted to material risks | Phone call with Mark | Medium |

---

## 5. Feature Requirements

### 5.1 Must Have — P0 (Product fails without these)

| ID | Feature | Rationale |
|----|---------|-----------|
| F01 | Supabase auth gate (login/logout) | No value without data security |
| F02 | Wizard fully writes to Supabase | Currently saves to localStorage only |
| F03 | All 11 dashboard tabs read live data from Supabase | Core product value |
| F04 | Work plan completions synced to Supabase | Multi-user shared state |
| F05 | Competitor rates persisted to Supabase | Currently localStorage only |
| F06 | Mobile-responsive layout (380px+) | Mark uses phone 60% of the time |
| F07 | Snapshot tab as mobile home screen | Primary daily driver |
| F08 | Compliance records persisted to Supabase | Currently not stored anywhere |
| F09 | Alert thresholds configurable via Settings | Currently hardcoded |
| F10 | Period selector (month dropdown) loads real data | Currently hardcoded months |

### 5.2 Should Have — P1 (Significant value loss without these)

| ID | Feature | Rationale |
|----|---------|-----------|
| F11 | PDF export of any dashboard tab | Investor sharing, accountant reports |
| F12 | AI assistant wired through Vercel Edge Function | API key must not be client-side |
| F13 | AI assistant chat history saved to Supabase | Continuity across sessions |
| F14 | Debtor trend view (3-month per debtor) | Sarah's top pain point |
| F15 | Data quality score in wizard before submit | Prevent bad data entering system |
| F16 | Fleet maintenance records table | Jake's top pain point |
| F17 | Bin on-hire duration view | Jake's J10 |
| F18 | EPA/compliance expiry tracking with countdown | Jake's J13, Mark's J03 |
| F19 | Investor view (read-only, simplified) | Mark's J04 |
| F20 | PWA manifest + installable on iOS/Android | Mobile app feel without app store |

### 5.3 Could Have — P2 (Valuable but deferrable)

| ID | Feature | Rationale |
|----|---------|-----------|
| F21 | Push notifications for compliance due dates | Jake's J13 enhanced |
| F22 | Pull-to-refresh on mobile | Standard mobile UX pattern |
| F23 | 13-week rolling cash flow forecast | Mark's strategic planning |
| F24 | Westpac PDF bank statement parsing | Reduces Sarah's manual work |
| F25 | Xero OAuth direct integration | Eliminates file upload entirely |
| F26 | Customer win-back campaign tracker | BDM tab enhancement |
| F27 | Driver assignment board | Jake's operational tool |
| F28 | Monthly summary email digest | Investor + management |
| F29 | Multi-month comparison view (side-by-side) | Already designed in Sprint 1 |
| F30 | Photo upload for compliance documents | Jake's disposal receipt photos |
| F31 | Referral source tracking in BDM | Revenue attribution |
| F32 | Seasonal forecasting model | Strategic planning |

### 5.4 Won't Have (This Version — Sprint 3–6)

| ID | Feature | Reason |
|----|---------|--------|
| W01 | React Native mobile app | PWA covers 90% of need; app store adds friction |
| W02 | Multi-tenant SaaS (multiple businesses) | Architecture supports it; not activating yet |
| W03 | Customer portal (book a bin online) | Out of scope — separate product |
| W04 | Xero write-back (posting invoices) | Too complex; read-only integration first |
| W05 | Machine learning forecasting | Requires 24+ months of data; start with rules-based |
| W06 | Payroll integration | Xero handles payroll; out of scope |
| W07 | Real-time GPS bin tracking | Hardware integration required |
| W08 | Voice interface | Not a current need |

---

## 6. Functional Specifications

### 6.1 Authentication & Authorisation

**Description:** Users authenticate with email/password via Supabase Auth. A `profiles` table extends `auth.users` with a role field. Role-based access controls what each user can see and do.

**User Story:** As any user, I want to log in with my email and password so that I can access the dashboard securely from any device.

**Acceptance Criteria:**
- AC1: Login page displays Binned-IT logo, email field, password field, and "Sign In" button
- AC2: Successful login redirects to the Home screen and persists session (JWT in localStorage via Supabase SDK)
- AC3: Failed login displays error message without revealing whether the email exists
- AC4: Logged-out users attempting to access any route are redirected to Login
- AC5: "Sign Out" link in the navigation menu terminates the session
- AC6: Session persists across browser refresh and tab close (Supabase persistent session)
- AC7: Role is loaded from `profiles` table on login and available throughout app via `AuthContext`
- AC8: Owner role sees all tabs including Settings and User Management
- AC9: Viewer role does not see Wizard, Settings, or Work Plan edit controls
- AC10: Bookkeeper role sees Wizard and dashboards but not Settings > User Management
- AC11: Manager role sees all dashboards and Work Plan but not Wizard file upload or Settings

**Role Permissions Matrix:**

| Feature | Owner | Manager | Bookkeeper | Viewer |
|---------|-------|---------|------------|--------|
| View all 11 dashboard tabs | Yes | Yes | Yes | Yes |
| Run wizard / upload files | Yes | No | Yes | No |
| Mark work plan items complete | Yes | Yes | Yes | No |
| Add/edit work plan items | Yes | No | No | No |
| Update competitor rates | Yes | Yes | No | No |
| Acknowledge alerts | Yes | No | No | No |
| Configure thresholds | Yes | No | No | No |
| User management | Yes | No | No | No |
| View Settings | Yes | No | No | No |
| Log compliance records | Yes | Yes | Yes | No |

**Edge Cases:**
- New user signing up is automatically assigned `viewer` role; owner must promote via Settings > User Management
- If profile record does not exist (e.g. trigger failed), create it on first load with default `viewer` role
- Supabase `anon` key must not allow access to any data table; all selects require `auth.uid() IS NOT NULL`

---

### 6.2 Monthly Report Wizard (Data Entry)

**Description:** A guided 12-step wizard allowing the bookkeeper or owner to upload Xero exports, Bin Manager reports, and enter compliance, market, and quality data for a given month. On completion, all data is written to Supabase.

**User Story:** As Sarah (bookkeeper), I want to upload the month's Xero exports and have the system extract and store all financial figures automatically, so that I don't have to reformat them manually.

**Current State (Sprint 1/2):** Wizard exists with 12 steps, file parsing via SheetJS, and all state managed in React component. On completion, data is saved to `dataStore.js` (localStorage). Supabase write is not yet wired.

**Wizard Steps:**

| Step | Name | Type | Data Captured |
|------|------|------|--------------|
| 1 | Month Selection | Dropdown | `report_month` |
| 2 | Xero Cash Summary | File upload | Cash income, expenses, net movement, closing balance |
| 3 | Xero P&L Monthly | File upload | Revenue by category, COS breakdown, opex breakdown, net profit |
| 4 | Xero Balance Sheet | File upload | Assets, liabilities, equity snapshot |
| 5 | Xero Aged AR | File upload | Debtor list with aging buckets |
| 6 | Bin Manager Report | File upload | Bin type deliveries, hire days, revenue per type |
| 7 | Bank Balance Confirmation | Manual number entry | Confirmed Westpac closing balance |
| 8 | Data Quality Check | Auto-scored + manual flags | Reconciliation status, unposted items |
| 9 | Compliance — WHS | Toggle/text | Incidents, near-misses, training currency |
| 10 | Compliance — Asbestos & EPA | Toggle/date | Jobs count, docs complete, EPA expiry |
| 11 | Compliance — Fleet & Insurance | Toggle/date | Vehicle inspections, rego, insurance expiry |
| 12 | Market & Outlook | Text/toggles | Business outlook, key wins/risks, referral sources |

**Acceptance Criteria:**
- AC1: Step 1 shows a list of months from Jul 2025 onwards; selecting a month that already has a complete report shows a warning ("This month has already been submitted. Do you want to update it?")
- AC2: File upload steps accept `.xlsx` and `.xls` files only; display an error for unsupported formats
- AC3: On file upload, SheetJS parses the file client-side and extracts structured data; parsed preview is shown to user before proceeding
- AC4: Step 8 (Data Quality) auto-calculates: (a) whether COS is >30% below 3-month average (flags as "likely missing invoices"), (b) whether any opex line is $0 that should not be, (c) whether AR total reconciles to balance sheet AR figure
- AC5: On "Submit Report", all data is written to Supabase in a single transaction: `monthly_reports`, `financials_monthly`, `balance_sheet_monthly`, `debtors_monthly`, `bin_type_performance`, `customer_acquisitions`, `compliance_records` — all with the same `report_id`
- AC6: File uploads (raw Xero files) are stored in Supabase Storage under `reports/{report_month}/` and logged in `file_uploads`
- AC7: On successful submission, user is redirected to Dashboard (Snapshot tab) for the submitted month
- AC8: Wizard can be exited and resumed (draft state saved to Supabase as `status = 'draft'`)
- AC9: Progress indicator shows current step (e.g. "Step 3 of 12")
- AC10: On mobile, each wizard step is full-screen with large touch targets for all buttons

**Edge Cases:**
- Xero report structure changes: parser should log a warning if expected columns are not found rather than silently failing
- Multiple months submitted: each must maintain its own `report_id` and all child records must cascade correctly on delete
- Network failure mid-submission: show error state with retry; do not partially write (use Supabase transactions or write parent record last)

---

### 6.3 Dashboard — All 11 Tabs

**Description:** The executive dashboard displays financial, operational, and strategic data from Supabase for the selected month, with YTD aggregations. Data is fetched on period change.

**Current State:** All 11 tabs are rendered and functional using hardcoded data from `src/data/financials.js`. The UI is complete; the data wiring to Supabase is the primary Sprint 3 task.

**Data Loading Pattern:**
```
useEffect(() => {
  const month = selectedMonth  // e.g. '2026-02'
  fetchFinancials(month)        // calls src/api/reports.js
  fetchBalanceSheet(month)
  fetchDebtors(month)
  fetchBinPerformance(month)
  fetchCompliance(month)
  fetchAcquisitions(month)
}, [selectedMonth])
```

#### 6.3.1 Snapshot Tab

**Data required:** `financials_monthly` (YTD aggregated), `balance_sheet_monthly` (latest)
**KPIs displayed:** YTD Revenue, YTD Net Profit, YTD Gross Margin %, Current Month Revenue (with MoM trend)
**Charts:** Monthly Revenue vs Net Profit (bar + line), Gross Margin % trend (line)
**Balance Sheet Highlights:** Total Assets, Total Liabilities, Net Equity, Bank Balance, GST Liability, PAYG Withholding, Director Loans, Total Loans, Fixed Assets

**Acceptance Criteria:**
- AC1: All KPI tiles display data from Supabase for the selected month and YTD period
- AC2: YTD is always calculated as Jul 1 (FY start) to selected month inclusive
- AC3: MoM trend arrow shows % change vs prior month for current-month revenue
- AC4: Balance sheet figures reflect the most recently submitted month's snapshot (not necessarily the selected month)
- AC5: On mobile, KPI tiles stack to 2-across (not 4-across)
- AC6: Alert summary shows top 5 cross-tab alerts at the bottom of the Snapshot tab

#### 6.3.2 Revenue Tab

**Data required:** `financials_monthly` (all months YTD)
**KPIs:** YTD revenue by category, current month total, MoM change
**Charts:** Revenue by category stacked bar (monthly), Revenue mix pie (YTD), Concentration risk gauge

**Acceptance Criteria:**
- AC1: Revenue is segmented into General Waste, Asbestos, Soil, Green Waste, Other — matching `financials_monthly` column names
- AC2: Concentration risk flag appears if any single category exceeds 60% of YTD revenue
- AC3: Chart data populates for all months with submitted reports up to selected month

#### 6.3.3 Margins Tab

**Data required:** `financials_monthly` (all months YTD), cost breakdown
**KPIs:** COS for selected month (with anomaly flag if >30% below average), Opex, Fuel (with anomaly flag if >90% below average), Gross Margin %
**Charts:** Monthly COS vs Opex (bar), Cost Drivers trend (line — wages, fuel, repairs, rent, advertising)

**Acceptance Criteria:**
- AC1: COS anomaly flag fires when COS < 70% of 3-month prior average and displays "Likely missing invoices" warning
- AC2: Fuel anomaly flag fires when fuel < 10% of prior average
- AC3: Opex line items are read from individual columns in `financials_monthly`: `opex_rent`, `opex_admin`, `opex_advertising`, `opex_insurance`, `opex_other`

**Note:** The current schema has `opex_wages` missing from `financials_monthly` — wages are in COS in Xero. The schema needs `cos_wages` properly mapped. The UI currently shows wages separately; confirm with Sarah which line wages fall under in the Xero P&L.

#### 6.3.4 Benchmarking / Pricing Tab

**Data required:** `bin_type_performance` (selected month + YTD), `alert_thresholds`
**Display:** Per-bin-type profitability table: revenue, jobs, avg rate, COS/job, gross margin %, net margin %, market position
**Expandable rows:** Cost breakdown bar chart per bin type (fuel allocation, wages, tolls, repairs, rent, advertising, opex overhead, profit/loss)

**Acceptance Criteria:**
- AC1: Sort by any column (profit, revenue, jobs, margin)
- AC2: Loss-making bin types (net margin < 0) are highlighted in red
- AC3: Market range comparison shown alongside Binned-IT rate (from `competitor_rates` table median)
- AC4: "Price increase calculator": user can drag a price slider and see the net margin impact
- AC5: Bin type table is driven by `bin_type_performance` rows from Supabase, not hardcoded

#### 6.3.5 Competitors Tab

**Data required:** `competitor_rates` (all, persistent)
**Display:** Matrix table — competitors as columns, bin types as rows, Binned-IT rates as first column, comparison cells colour-coded
**Editable:** Any cell can be clicked to enter/edit a rate; saves immediately to Supabase

**Acceptance Criteria:**
- AC1: All competitor rate changes save to Supabase immediately (not localStorage as current)
- AC2: Adding a new competitor creates a new `competitor_rates` row set
- AC3: Rate cells show "POA" if null, competitor rate if known, colour-coded vs Binned-IT (green = Binned-IT lower, red = Binned-IT higher)
- AC4: "Last updated" timestamp shown per competitor row
- AC5: Manager and Owner roles can edit; Bookkeeper and Viewer are read-only

#### 6.3.6 BDM Tab

**Data required:** `customer_acquisitions` (selected month), `customers` (dormant query)
**KPIs:** New customers this month, dormant accounts (90+ days since last job), net movement
**Charts:** New customers by revenue (horizontal bar), Dormant customers by value at risk

**Acceptance Criteria:**
- AC1: New customer list is populated from `customer_acquisitions` for the selected `report_month`
- AC2: Dormant customers are those with `last_job_date` > 90 days ago in the `customers` table
- AC3: Customer type (Commercial/Builder/Domestic/Industrial) is shown per acquisition record
- AC4: Clicking a customer name shows their full job history (Sprint 4 feature — placeholder for now)

#### 6.3.7 Fleet Tab

**Data required:** `bin_type_performance` (selected month), `fleet_assets` (new table, Sprint 4)
**Display:** Bin utilisation table — type, deliveries, avg hire days, revenue, yield per delivery
**Hire duration flags:** Any bin type with avg hire days > 21 flagged as warning; > 35 as critical

**Acceptance Criteria:**
- AC1: Bin utilisation data is from `bin_type_performance` table
- AC2: Hire duration flags use configurable thresholds from `alert_thresholds`
- AC3: Fleet assets panel (Sprint 4) will show each physical vehicle/truck with next service date

**Note:** Fleet tab currently shows aggregate statistics from `binTypesData` (hardcoded). Full fleet asset tracking (individual trucks, maintenance logs) is a Sprint 4 feature requiring new tables.

#### 6.3.8 Debtors Tab

**Data required:** `debtors_monthly` (selected month + prior 2 months), `balance_sheet_monthly`
**KPIs:** Total AR, overdue AR, overdue %, top debtor concentration
**Charts:** AR aging pie, Top debtors horizontal bar (with aging colour bands), AR trend line (3-month)

**Acceptance Criteria:**
- AC1: AR aging buckets match: Current, <1 Month, 1 Month, 2 Months, 3 Months, Older
- AC2: Top debtor concentration alert fires if any single debtor > 15% of total AR
- AC3: 3-month trend: for each top debtor, show their total outstanding across the last 3 months as a small sparkline
- AC4: Overdue % compared to configurable threshold from `alert_thresholds`

#### 6.3.9 Cash Flow Tab

**Data required:** `financials_monthly` (all YTD), `balance_sheet_monthly`
**KPIs:** Last month cash income, cash expenses, net movement, closing bank balance
**Charts:** Monthly cash income vs expenses bar, cumulative cash balance line, 6-month forward projection (rules-based)
**Tax Liability panel:** GST balance, PAYG balance, ATO clearing account, net tax position

**Acceptance Criteria:**
- AC1: Cash balance data is from `balance_sheet_monthly.cash_balance` per month
- AC2: 6-month projection assumes average of last 3 months' net cash movement
- AC3: Tax liability section reads from latest `balance_sheet_monthly`: `gst_liability`, `payg_liability`
- AC4: Debt service coverage ratio calculated: operating cash / annual loan repayments; alert if < 1.5x
- AC5: "Weeks of cash runway" calculated from current balance / average weekly cash expenses

#### 6.3.10 Risk / EPA Tab

**Data required:** `compliance_records` (selected month), `alert_thresholds`
**Display:** Traffic light status for: WHS (incidents, register, training), Asbestos (jobs, docs), EPA (licence status + expiry countdown), Fleet (vehicle inspections, rego), Insurance (current + expiry countdown)
**Compliance history:** Last 3 months' status per category

**Acceptance Criteria:**
- AC1: EPA expiry countdown: green if > 60 days, amber if 30–60 days, red if < 30 days
- AC2: Insurance expiry countdown: same thresholds as EPA
- AC3: WHS: red if whs_incidents > 0 (with details), amber if whs_register_current = false
- AC4: Asbestos: red if asbestos_docs_complete = false and asbestos_jobs > 0
- AC5: Each compliance category shows history (last 3 months) as coloured dots
- AC6: "Log compliance update" button opens a form to update the current month's compliance record

#### 6.3.11 Work Plan Tab

**Data required:** `work_plan_items`, `work_plan_completions` (joined)
**Display:** Prioritised list of actions grouped by horizon (This Week / This Month / This Quarter)
**Interactive:** Mark item as done/undone; show who completed it and when; add notes

**Acceptance Criteria:**
- AC1: Work plan items are loaded from Supabase on mount (not localStorage as currently)
- AC2: Toggling an item done writes to `work_plan_completions`; untoggling deletes the completion record
- AC3: Completed items show "Completed by [name] on [date]" with optional note
- AC4: Owner can add new custom work plan items via inline form
- AC5: Items generated from alert rules (auto-generated) are marked with a robot icon and cannot be deleted by non-owner
- AC6: On mobile, each item is a card with a large checkbox; swipe right to complete (P2 gesture)
- AC7: Work plan state is shared across all logged-in users (e.g. Jake marking item complete is visible to Mark immediately)

---

### 6.4 Alert System & Thresholds

**Description:** The analysis engine generates categorised alerts from financial and compliance data. Alerts are stored in `alerts_log` and displayed throughout the dashboard.

**User Story:** As Mark, I want to see colour-coded alerts that tell me what needs my attention, so that I can act quickly without reviewing every number myself.

**Alert Categories and Rules:**

| Category | Rule | Severity |
|----------|------|---------|
| snapshot | Net margin < 0% | Critical |
| snapshot | Gross margin < 50% | Critical |
| snapshot | Gross margin > 85% (abnormal — missing COS) | Critical |
| snapshot | Net profit improving 3 months running | Positive |
| revenue | Any category > 60% of total YTD | Warning |
| margins | COS < 30% of 3-month average | Critical |
| margins | Fuel < 10% of average (unposted) | Critical |
| margins | Rent = $0 (unposted) | Critical |
| pricing | Any bin type net margin < -15% | Critical |
| pricing | Any bin type net margin < 0% | Warning |
| debtors | Overdue AR > 20% of total | Critical |
| debtors | Single debtor > 15% of AR | Warning |
| debtors | "Older" bucket > $5,000 | Critical |
| cashflow | Cash gap (revenue vs cash income) > $50,000 | Critical |
| cashflow | Tax liability > $100,000 | Critical |
| cashflow | Net equity negative | Warning |
| compliance | EPA expiry < 30 days | Critical |
| compliance | EPA expiry < 60 days | Warning |
| compliance | Insurance expiry < 30 days | Critical |
| compliance | WHS incidents > 0 | Critical |
| compliance | Asbestos docs incomplete with jobs > 0 | Critical |
| fleet | Any bin type avg hire days > 35 | Critical |
| fleet | Any bin type avg hire days > 21 | Warning |
| bdm | Dormant count > new customer count | Critical |

**Acceptance Criteria:**
- AC1: Alert rules are evaluated server-side (or in a Vercel Edge Function) against latest month's data whenever a new report is submitted
- AC2: Generated alerts are written to `alerts_log` with `report_id`, `category`, `severity`, `message`
- AC3: Critical alerts appear in a banner at the top of any tab they relate to
- AC4: Owner can acknowledge an alert with a note; acknowledged alerts still appear in history but are de-emphasised
- AC5: Alert count badges shown on tab labels (e.g. "MARGINS (3)")
- AC6: Home screen shows top 5 cross-category alerts from the latest report
- AC7: Threshold values for all numeric rules are configurable via Settings > Thresholds (read from `alert_thresholds` table)

---

### 6.5 AI Assistant

**Description:** A chat interface powered by the Anthropic Claude API, providing conversational BI queries against the current month's data.

**User Story:** As Mark, I want to ask the AI "what's my biggest risk this month" and get a grounded, data-based answer, so I can make decisions quickly without reading every chart.

**Current State:** AI assistant is wired in `App.jsx` calling the Anthropic API directly from the browser with hardcoded financial context. The API key is exposed in browser network requests — MUST be moved to a Vercel Edge Function.

**Target Architecture:**
```
Client → POST /api/chat (Vercel Edge Function)
           → Fetch live data from Supabase (server-side)
           → Build system prompt with real data
           → Call Anthropic API (key on server)
           → Stream response back to client
```

**System Prompt Context (injected per query):**
- Selected month label and FY period
- YTD Revenue, Net Profit, Gross Margin %
- AR total and overdue
- Current bank balance
- Active alerts (critical and warning)
- Top 3 debtors
- Loss-making bin types
- Compliance status flags

**Acceptance Criteria:**
- AC1: Anthropic API key is never sent to the browser; all API calls go through `/api/chat` Vercel Edge Function
- AC2: Chat interface is a collapsible panel accessible from all screens (floating button)
- AC3: Chat history is persisted to `ai_chat_sessions` per user, retrievable on next login
- AC4: System prompt is built server-side using live Supabase data for the user's selected month
- AC5: AI responses are streamed (not single response) to reduce perceived latency
- AC6: "Suggested questions" shown when chat is first opened: "What's my biggest risk this month?", "Which bin types should I reprice?", "How is my cash position vs last quarter?"
- AC7: On mobile, chat panel is full-screen with a back button
- AC8: Rate limiting: max 20 messages per user per day (configurable); shows friendly message if exceeded
- AC9: Model: `claude-sonnet-4-6` (current); configurable via env var `ANTHROPIC_MODEL`

**Edge Cases:**
- Anthropic API timeout: show "AI is taking a moment — please try again" rather than blank response
- No financial data for selected month: AI acknowledges data gap rather than fabricating context

---

### 6.6 PDF Export

**Description:** Any dashboard tab or the full dashboard summary can be exported to a branded PDF.

**User Story:** As Mark, I want to export the Snapshot tab to PDF so I can share it with my accountant or investor via email.

**Acceptance Criteria:**
- AC1: "Export PDF" button appears on the dashboard toolbar and on each tab
- AC2: PDF captures the visible charts and data (using `react-to-print` or `html2pdf.js`)
- AC3: PDF includes Binned-IT logo, report period, generation timestamp, and user name
- AC4: Full dashboard PDF includes all 11 tabs sequentially
- AC5: Mobile: PDF export is available via the share button (triggers browser print/share sheet)

---

### 6.7 Settings

**Description:** Owner-only configuration panel for thresholds, user management, bin types, and competitor list.

**Tabs within Settings:**

**6.7.1 Alert Thresholds**
- Table of all configurable thresholds (from `alert_thresholds`)
- Owner can edit warning and critical values inline
- Changes save immediately to Supabase

**6.7.2 User Management**
- Table of all users in `profiles`
- Owner can change any user's role
- Owner can invite a new user (triggers Supabase magic link invite)
- Owner can deactivate a user (does not delete — sets `is_active = false`)

**6.7.3 Bin Type Configuration**
- List of all bin types that appear in the pricing/benchmarking tab
- Owner can add new bin type, rename, or mark inactive
- Stored in new `bin_types` table (Sprint 3)

**6.7.4 Branding**
- Upload company logo (stored in Supabase Storage)
- Shown in header and on PDF exports

**Acceptance Criteria:**
- AC1: Settings is only accessible to Owner role; other roles see a "You do not have permission" message
- AC2: Threshold changes are reflected in the next alert evaluation
- AC3: New user invite sends a Supabase magic link email
- AC4: Role changes take effect on the next page load for the affected user

---

### 6.8 Mobile PWA

**Description:** The application should be installable as a Progressive Web App on iOS and Android, providing an app-like experience without going through app stores.

**User Story:** As Mark, I want to install the Dashboard Hub on my iPhone home screen so I can check my KPIs from the yard without opening a browser.

**Acceptance Criteria:**
- AC1: `manifest.json` configured with app name "Binned-IT Hub", short name "BinnedIT", icons in 192px and 512px, theme colour #F5C518 (Binned-IT yellow)
- AC2: Service worker registered with Workbox for caching of app shell and static assets
- AC3: Offline state: show cached data from last successful load with "Offline — showing cached data" banner
- AC4: iOS Safari: shows "Add to Home Screen" prompt behaviour (meta tags configured correctly)
- AC5: Android Chrome: Web App Install Prompt fires after 2+ visits
- AC6: Mobile breakpoints: 380px (small phone), 640px (large phone), 768px (tablet), 1024px (desktop)
- AC7: Bottom navigation bar on mobile (Home, Dashboard, Alerts, Work Plan, Chat) instead of hamburger menu
- AC8: Pull-to-refresh on Snapshot tab refreshes data from Supabase
- AC9: Swipeable tabs on mobile (left/right swipe between dashboard tabs)

**Mobile-First Screen Decisions:**

| Screen | Mobile | Desktop |
|--------|--------|---------|
| Login | Full-screen, centred | Full-screen, centred card |
| Home | Bottom nav + 2-col tiles | Sidebar nav + 5-col tiles |
| Snapshot | Stacked KPI tiles, scrollable | 4-col KPI grid + side-by-side charts |
| Revenue | Single chart, swipeable | 2-col charts |
| Margins | Single chart, swipeable | 2-col charts |
| Benchmarking | Card list (no table) | Full table with expandable rows |
| Competitors | Horizontal scroll table | Full matrix |
| BDM | Card list | Split panel |
| Fleet | Card list | Table |
| Debtors | Top 5 cards + aging donut | Full table + charts |
| Cash Flow | KPI cards + simple chart | Full multi-chart view |
| Risk/EPA | Traffic light cards | Traffic light cards + history |
| Work Plan | Card list with large checkbox | Table with inline completion |
| Wizard | Full-screen each step | Centred card each step |
| Settings | List view | Tabbed panel |
| AI Chat | Full-screen panel | Slide-in panel (right) |

**Desktop-Only Features (acceptable):**
- Competitor pricing matrix full edit (complex table — mobile is read-only)
- Pricing tab cost breakdown bar (too dense for mobile — mobile shows summary only)
- Side-by-side month comparison view

---

## 7. Technical Architecture

### 7.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser / PWA)                     │
│  React 18 + Vite SPA                                                │
│                                                                     │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Auth   │  │ Dashboard  │  │  Wizard  │  │   AI Chat Panel  │  │
│  │ Context │  │ (11 tabs)  │  │(12 steps)│  │                  │  │
│  └────┬────┘  └─────┬──────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │              │                  │            │
│  ┌────▼─────────────▼──────────────▼──────────────────▼──────────┐ │
│  │              Supabase JS SDK v2                                │ │
│  │  supabase.auth | supabase.from() | supabase.storage           │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
│                             │              │                        │
│                             │     fetch('/api/chat')                │
└─────────────────────────────┼──────────────┼────────────────────────┘
                              │ HTTPS        │ HTTPS
┌─────────────────────────────▼──────────────▼────────────────────────┐
│                          VERCEL                                      │
│                                                                     │
│  ┌──────────────────────┐       ┌──────────────────────────────┐   │
│  │   Static SPA Build   │       │   Edge Function: /api/chat   │   │
│  │   (React/Vite)       │       │   - Fetch Supabase data      │   │
│  │   CDN-distributed    │       │   - Build Claude system prompt│  │
│  └──────────────────────┘       │   - Call Anthropic API       │   │
│                                  │   - Stream response          │   │
│                                  └──────────────┬───────────────┘   │
└─────────────────────────────────────────────────┼────────────────────┘
                                                  │ HTTPS
┌─────────────────────────────┐   ┌───────────────▼────────────────────┐
│         SUPABASE            │   │         ANTHROPIC                   │
│                             │   │   Claude API (claude-sonnet-4-6)    │
│ ┌──────────┐ ┌───────────┐  │   │   Streaming messages endpoint       │
│ │   Auth   │ │PostgreSQL │  │   └────────────────────────────────────┘
│ │ (JWT/RLS)│ │  Database │  │
│ └──────────┘ └─────┬─────┘  │
│               ┌────▼─────┐  │
│               │ Storage  │  │
│               │(Excel    │  │
│               │ uploads) │  │
│               └──────────┘  │
└─────────────────────────────┘
```

### 7.2 Frontend Architecture

**Framework:** React 18 + Vite (existing)
**UI:** Inline CSS with brand tokens from `src/theme.js` (no CSS framework — existing pattern preserved)
**Charts:** Recharts (existing)
**File parsing:** SheetJS / xlsx (existing)
**State management:** React Context + useState (sufficient for single-org SPA; see note below)
**Routing:** No React Router currently; single-page with `screen` state. Add React Router v6 in Sprint 3 for proper URL-based navigation (required for PWA deep links and investor view sharing)
**Data fetching:** Migrate from direct API calls in `useEffect` to React Query (TanStack Query) in Sprint 3. This provides: automatic caching, background refresh, stale-while-revalidate, and offline-first behaviour for PWA

**File Structure (target):**
```
src/
  api/           ← Supabase API functions (existing: reports.js, workplan.js, alerts.js, competitors.js)
  components/    ← Reusable UI components
    UIComponents.jsx     ← KPITile, SectionHeader, etc. (existing)
    Wizard.jsx           ← 12-step wizard (existing)
    PricingTab.jsx       ← Benchmarking tab (existing)
    CompetitorPage.jsx   ← Competitor matrix (existing)
    LoginPage.jsx        ← Auth screen (existing)
    MobileNav.jsx        ← Bottom nav for mobile (new Sprint 3)
    AlertBadge.jsx       ← Alert count badge (new)
    ChatPanel.jsx        ← AI chat (extract from App.jsx)
  context/
    AuthContext.jsx      ← Supabase auth wrapper (existing)
    DataContext.jsx      ← Selected month + loaded data (new Sprint 3)
  data/
    analysisEngine.js    ← Alert rule evaluation (existing — refactor to use live data)
    dataStore.js         ← localStorage store (retain for offline cache layer)
    financials.js        ← SEED DATA ONLY after migration (not primary data source)
    workplan.js          ← Work plan seed (deprecated after Supabase seed)
  hooks/
    useMonthData.js      ← React Query hook for all month data (new Sprint 3)
    useWorkPlan.js       ← React Query hook for work plan (new Sprint 3)
    useAlerts.js         ← React Query hook for alerts (new Sprint 3)
  lib/
    supabase.js          ← Supabase client (existing)
  pages/           ← Route-level components (new Sprint 3 with React Router)
    HomePage.jsx
    DashboardPage.jsx
    WizardPage.jsx
    SettingsPage.jsx
    InvestorView.jsx
  theme.js               ← Brand tokens (existing)
  App.jsx                ← Root component + routes (refactor Sprint 3)
  main.jsx               ← Entry point (existing)
```

**State Management Recommendation:**
Retain React Context for auth state. Use React Query (TanStack Query v5) for all Supabase data fetching. This replaces ad-hoc `useState` + `useEffect` patterns currently used for data loading. React Query provides the caching and offline behaviour needed for the PWA without the complexity of Zustand or Redux.

### 7.3 Database Schema — Full SQL

```sql
-- ============================================================
-- MIGRATION 001: Initial Schema (already deployed)
-- ============================================================

-- profiles — extends auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name   text,
  role        text NOT NULL DEFAULT 'viewer'
                   CHECK (role IN ('owner','manager','bookkeeper','viewer')),
  is_active   boolean NOT NULL DEFAULT true,
  avatar_url  text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- monthly_reports
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month    date NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','complete')),
  uploaded_by     uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_month)
);

-- financials_monthly — P&L per month
CREATE TABLE IF NOT EXISTS public.financials_monthly (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month     date NOT NULL,
  -- Revenue categories
  rev_general      numeric(12,2) DEFAULT 0,
  rev_asbestos     numeric(12,2) DEFAULT 0,
  rev_soil         numeric(12,2) DEFAULT 0,
  rev_green        numeric(12,2) DEFAULT 0,
  rev_other        numeric(12,2) DEFAULT 0,
  rev_total        numeric(12,2) DEFAULT 0,
  -- Cost of Sales
  cos_fuel         numeric(12,2) DEFAULT 0,
  cos_disposal     numeric(12,2) DEFAULT 0,
  cos_wages        numeric(12,2) DEFAULT 0,
  cos_tolls        numeric(12,2) DEFAULT 0,
  cos_repairs      numeric(12,2) DEFAULT 0,
  cos_other        numeric(12,2) DEFAULT 0,
  cos_total        numeric(12,2) DEFAULT 0,
  gross_profit     numeric(12,2) DEFAULT 0,
  gross_margin_pct numeric(6,2)  DEFAULT 0,
  -- Operating Expenses
  opex_rent        numeric(12,2) DEFAULT 0,
  opex_admin       numeric(12,2) DEFAULT 0,
  opex_advertising numeric(12,2) DEFAULT 0,
  opex_insurance   numeric(12,2) DEFAULT 0,
  opex_depreciation numeric(12,2) DEFAULT 0,
  opex_other       numeric(12,2) DEFAULT 0,
  opex_total       numeric(12,2) DEFAULT 0,
  net_profit       numeric(12,2) DEFAULT 0,
  net_margin_pct   numeric(6,2)  DEFAULT 0,
  -- Cash flow (from cash summary report)
  cash_income      numeric(12,2) DEFAULT 0,
  cash_expenses    numeric(12,2) DEFAULT 0,
  cash_net_movement numeric(12,2) DEFAULT 0
);

-- balance_sheet_monthly — snapshot per month
CREATE TABLE IF NOT EXISTS public.balance_sheet_monthly (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month          date NOT NULL,
  -- Current assets
  cash_balance          numeric(12,2) DEFAULT 0,
  accounts_receivable   numeric(12,2) DEFAULT 0,
  other_current_assets  numeric(12,2) DEFAULT 0,
  -- Fixed assets
  fixed_assets          numeric(12,2) DEFAULT 0,
  -- Non-current assets
  non_current_assets    numeric(12,2) DEFAULT 0,
  total_assets          numeric(12,2) DEFAULT 0,
  -- Current liabilities
  accounts_payable      numeric(12,2) DEFAULT 0,
  gst_liability         numeric(12,2) DEFAULT 0,
  payg_liability        numeric(12,2) DEFAULT 0,
  ato_clearing          numeric(12,2) DEFAULT 0,
  superannuation_payable numeric(12,2) DEFAULT 0,
  loan_current          numeric(12,2) DEFAULT 0,
  -- Non-current liabilities
  loan_noncurrent       numeric(12,2) DEFAULT 0,
  director_loans        numeric(12,2) DEFAULT 0,
  total_loans           numeric(12,2) DEFAULT 0,
  total_liabilities     numeric(12,2) DEFAULT 0,
  -- Equity
  retained_earnings     numeric(12,2) DEFAULT 0,
  current_year_earnings numeric(12,2) DEFAULT 0,
  net_equity            numeric(12,2) DEFAULT 0
);

-- debtors_monthly — AR aging per month
CREATE TABLE IF NOT EXISTS public.debtors_monthly (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month      date NOT NULL,
  debtor_name       text NOT NULL,
  customer_type     text,
  current_amount    numeric(12,2) DEFAULT 0,
  overdue_30        numeric(12,2) DEFAULT 0,
  overdue_60        numeric(12,2) DEFAULT 0,
  overdue_90plus    numeric(12,2) DEFAULT 0,
  older_bucket      numeric(12,2) DEFAULT 0,
  total_outstanding numeric(12,2) DEFAULT 0
);

-- bin_type_performance — fleet/pricing data per month
CREATE TABLE IF NOT EXISTS public.bin_type_performance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  bin_type        text NOT NULL,
  deliveries      integer DEFAULT 0,
  avg_hire_days   numeric(6,1) DEFAULT 0,
  revenue         numeric(12,2) DEFAULT 0,
  avg_price       numeric(10,2) DEFAULT 0,
  cos_per_job     numeric(10,2) DEFAULT 0,
  gross_per_job   numeric(10,2) DEFAULT 0,
  net_margin_pct  numeric(6,2) DEFAULT 0
);

-- customers — customer master
CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  customer_type   text CHECK (customer_type IN ('Domestic','Builder','Commercial','Industrial','Demolition','Trades','Other')),
  is_active       boolean DEFAULT true,
  first_job_date  date,
  last_job_date   date,
  total_jobs      integer DEFAULT 0,
  total_ytd_value numeric(12,2) DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- customer_acquisitions — new customers per month
CREATE TABLE IF NOT EXISTS public.customer_acquisitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  customer_name   text NOT NULL,
  customer_type   text,
  first_job_date  date,
  jobs_in_month   integer DEFAULT 0,
  revenue_in_month numeric(12,2) DEFAULT 0
);

-- competitor_rates — persistent pricing matrix
CREATE TABLE IF NOT EXISTS public.competitor_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  competitor_source text,
  bin_type        text NOT NULL,
  rate            numeric(10,2),
  rate_type       text DEFAULT 'inc_gst' CHECK (rate_type IN ('inc_gst','ex_gst','poa')),
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.profiles(id),
  UNIQUE(competitor_name, bin_type)
);

-- compliance_records — per-month compliance snapshot
CREATE TABLE IF NOT EXISTS public.compliance_records (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                     uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month                  date NOT NULL,
  -- WHS
  whs_incidents                 integer DEFAULT 0,
  whs_incident_details          text,
  whs_near_miss                 boolean DEFAULT false,
  whs_near_miss_details         text,
  whs_register_current          boolean DEFAULT false,
  whs_last_toolbox_talk         date,
  whs_training_current          boolean DEFAULT false,
  -- Asbestos
  asbestos_jobs                 integer DEFAULT 0,
  asbestos_docs_complete        boolean DEFAULT false,
  asbestos_clearance_certs      boolean DEFAULT false,
  asbestos_complaints           boolean DEFAULT false,
  asbestos_complaint_details    text,
  -- EPA
  epa_license_current           boolean DEFAULT true,
  epa_expiry_date               date,
  epa_renewal_status            text DEFAULT 'not_started'
                                CHECK (epa_renewal_status IN ('not_started','in_progress','submitted','current')),
  -- Fleet
  vehicles_off_road             boolean DEFAULT false,
  vehicles_off_road_reason      text,
  vehicle_rego_dates            jsonb,
  fleet_inspections_current     boolean DEFAULT true,
  -- Insurance
  public_liability_current      boolean DEFAULT true,
  public_liability_expiry       date,
  workers_comp_current          boolean DEFAULT true,
  workers_comp_expiry           date,
  -- Notes
  compliance_notes              text
);

-- work_plan_items — action library
CREATE TABLE IF NOT EXISTS public.work_plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  area            text,
  horizon         text CHECK (horizon IN ('week','month','quarter')),
  priority        integer DEFAULT 50,
  effort_hours    numeric(4,1),
  business_impact text,
  owner_role      text CHECK (owner_role IN ('owner','manager','bookkeeper')),
  is_active       boolean DEFAULT true,
  is_system       boolean DEFAULT false,
  source_alert_id uuid REFERENCES public.alerts_log(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.profiles(id)
);

-- work_plan_completions — completion tracking
CREATE TABLE IF NOT EXISTS public.work_plan_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES public.work_plan_items(id) ON DELETE CASCADE,
  completed_by    uuid REFERENCES public.profiles(id),
  completed_at    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  UNIQUE(item_id)
);

-- alerts_log — generated and historical alerts
CREATE TABLE IF NOT EXISTS public.alerts_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  category          text,
  severity          text NOT NULL CHECK (severity IN ('critical','warning','info','positive')),
  message           text NOT NULL,
  acknowledged_by   uuid REFERENCES public.profiles(id),
  acknowledged_at   timestamptz,
  acknowledge_notes text,
  is_suppressed     boolean DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- file_uploads — audit trail of uploaded files
CREATE TABLE IF NOT EXISTS public.file_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  file_type       text NOT NULL
                  CHECK (file_type IN ('pl_monthly','cash_summary','aged_ar','balance_sheet','bin_manager','other')),
  original_name   text NOT NULL,
  storage_path    text,
  file_size_bytes integer,
  uploaded_by     uuid REFERENCES public.profiles(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  parse_status    text DEFAULT 'pending'
                       CHECK (parse_status IN ('pending','success','failed')),
  parse_error     text,
  parsed_rows     integer
);

-- ai_chat_sessions — per-user chat history
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_month    date,
  messages        jsonb NOT NULL DEFAULT '[]',
  message_count   integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- alert_thresholds — configurable thresholds
CREATE TABLE IF NOT EXISTS public.alert_thresholds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  metric_key      text NOT NULL,
  warning_value   numeric,
  critical_value  numeric,
  unit            text,
  description     text,
  updated_by      uuid REFERENCES public.profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, metric_key)
);

-- ============================================================
-- NEW TABLES — Sprint 3+ (not yet in migrations)
-- ============================================================

-- bin_types — configurable product catalog
CREATE TABLE IF NOT EXISTS public.bin_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL UNIQUE,
  category        text NOT NULL CHECK (category IN ('general_waste','asbestos','soil','green_waste','contaminated','other')),
  size_m3         numeric(6,1),
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- fleet_assets — individual trucks and vehicles
CREATE TABLE IF NOT EXISTS public.fleet_assets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_name          text NOT NULL,
  asset_type          text NOT NULL CHECK (asset_type IN ('truck','trailer','excavator','other')),
  registration        text,
  rego_expiry_date    date,
  make                text,
  model               text,
  year                integer,
  odometer_km         integer,
  last_service_date   date,
  next_service_date   date,
  service_interval_km integer,
  is_active           boolean DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- fleet_maintenance_records — service log per vehicle
CREATE TABLE IF NOT EXISTS public.fleet_maintenance_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        uuid NOT NULL REFERENCES public.fleet_assets(id) ON DELETE CASCADE,
  service_date    date NOT NULL,
  service_type    text NOT NULL CHECK (service_type IN ('scheduled','repair','rego','inspection','other')),
  description     text,
  odometer_km     integer,
  cost            numeric(10,2),
  provider        text,
  next_service_date date,
  logged_by       uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- disposal_receipts — EPA compliance per job
CREATE TABLE IF NOT EXISTS public.disposal_receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month      date NOT NULL,
  job_reference     text,
  waste_type        text NOT NULL CHECK (waste_type IN ('asbestos','soil','contaminated','other')),
  disposal_site     text,
  receipt_number    text,
  disposal_date     date,
  quantity_tonnes   numeric(8,2),
  storage_path      text,
  logged_by         uuid REFERENCES public.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- push_subscriptions — Web Push for PWA notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE,
  p256dh          text NOT NULL,
  auth_key        text NOT NULL,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz
);

-- notification_log — track sent push notifications
CREATE TABLE IF NOT EXISTS public.notification_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.profiles(id),
  subscription_id uuid REFERENCES public.push_subscriptions(id),
  title           text NOT NULL,
  body            text,
  alert_id        uuid REFERENCES public.alerts_log(id),
  sent_at         timestamptz NOT NULL DEFAULT now(),
  delivered       boolean,
  error           text
);

-- ============================================================
-- INDEXES (add to existing migration 001)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_financials_report_month     ON public.financials_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_balance_report_month        ON public.balance_sheet_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_debtors_report_month        ON public.debtors_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_debtors_debtor_name         ON public.debtors_monthly(debtor_name);
CREATE INDEX IF NOT EXISTS idx_bin_perf_report_month       ON public.bin_type_performance(report_month);
CREATE INDEX IF NOT EXISTS idx_alerts_report_id            ON public.alerts_log(report_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity             ON public.alerts_log(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category             ON public.alerts_log(category);
CREATE INDEX IF NOT EXISTS idx_chat_user_id                ON public.ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_report         ON public.file_uploads(report_id);
CREATE INDEX IF NOT EXISTS idx_customers_last_job          ON public.customers(last_job_date);
CREATE INDEX IF NOT EXISTS idx_compliance_report_month     ON public.compliance_records(report_month);
CREATE INDEX IF NOT EXISTS idx_fleet_assets_next_service   ON public.fleet_assets(next_service_date);
CREATE INDEX IF NOT EXISTS idx_disposal_receipts_month     ON public.disposal_receipts(report_month);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user     ON public.push_subscriptions(user_id);
```

### 7.4 API Layer Design

**Pattern:** All Supabase calls are encapsulated in `src/api/*.js` modules (existing pattern). Components call these functions via React Query hooks in `src/hooks/*.js`.

**Current API modules:**
- `src/api/reports.js` — monthly reports, financials, balance sheet, debtors, bin performance, compliance
- `src/api/workplan.js` — work plan items, completions
- `src/api/alerts.js` — alerts log, acknowledgement
- `src/api/competitors.js` — competitor rates (to be created)

**New API modules (Sprint 3):**
- `src/api/fleet.js` — fleet assets, maintenance records
- `src/api/compliance.js` — disposal receipts
- `src/api/settings.js` — thresholds, user management, bin types
- `src/api/push.js` — push subscription management

**Vercel Edge Functions (Sprint 5–6):**
- `api/chat.js` — AI assistant proxy (Anthropic API call server-side)
- `api/push-send.js` — Web Push notification sender
- `api/generate-pdf.js` — Server-side PDF generation (optional, if client-side insufficient)

**React Query Hook Pattern:**
```javascript
// src/hooks/useMonthData.js
export function useFinancials(reportMonth) {
  return useQuery({
    queryKey: ['financials', reportMonth],
    queryFn: () => getFinancialsForMonth(reportMonth),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    enabled: !!reportMonth,
  })
}

export function useYTDFinancials(upToMonth) {
  return useQuery({
    queryKey: ['financials-ytd', upToMonth],
    queryFn: () => getFinancialsRange('2025-07-01', upToMonth),
    staleTime: 5 * 60 * 1000,
    enabled: !!upToMonth,
  })
}
```

### 7.5 Auth & Permissions Matrix (Complete)

| Feature / Route | Owner | Manager | Bookkeeper | Viewer |
|----------------|-------|---------|------------|--------|
| Login/Logout | All | All | All | All |
| Home screen | Full | Full | Full | Full |
| Snapshot tab | Read | Read | Read | Read |
| Revenue tab | Read | Read | Read | Read |
| Margins tab | Read | Read | Read | Read |
| Benchmarking tab | Read | Read | Read | Read |
| Competitors tab | Read + Edit | Read + Edit | Read | Read |
| BDM tab | Read | Read | Read | Read |
| Fleet tab | Read | Read + Compliance | Read | Read |
| Debtors tab | Read | Read | Read | Read |
| Cash Flow tab | Read | Read | Read | Read |
| Risk/EPA tab | Read + Edit | Read + Edit | Read + Edit | Read |
| Work Plan tab | Read + Edit + Add | Read + Edit | Read | Read |
| Wizard | Full | No | Full | No |
| AI Chat | Full | Full | Full | Read-only |
| PDF Export | All | All | All | All |
| Settings > Thresholds | Edit | No | No | No |
| Settings > Users | Full CRUD | No | No | No |
| Settings > Bin Types | Full CRUD | No | No | No |
| Settings > Branding | Edit | No | No | No |
| Acknowledge alerts | Yes | No | No | No |
| Delete work plan items | Own items | No | No | No |
| Fleet > Add maintenance record | Yes | Yes | No | No |
| Log disposal receipt | Yes | Yes | No | No |

### 7.6 Mobile Strategy

**Approach:** Progressive Web App (PWA) — NOT React Native.

**Justification:**
- The user base is small (4 roles, ~6–10 users total)
- All users already on web; no app store friction
- PWA provides home screen install, offline caching, push notifications — covers 90% of native app functionality
- Development velocity: no second codebase to maintain
- Mark's primary mobile need (morning KPI check, alerts) is well served by PWA
- Jake's compliance logging from phone is well served by PWA with camera access (photo upload)

**Breakpoints:**
```css
/* Mobile first approach */
/* Default: 320px–639px (small phone) */
/* sm: 640px+ (large phone / phablet) */
/* md: 768px+ (tablet) */
/* lg: 1024px+ (desktop) */
/* xl: 1280px+ (wide desktop) */
```

**PWA Configuration:**
```json
// public/manifest.json
{
  "name": "Binned-IT Dashboard Hub",
  "short_name": "BinnedIT Hub",
  "description": "Management Intelligence Platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#F5C518",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "orientation": "portrait-primary"
}
```

**Service Worker Strategy (Workbox):**
- Cache-first: static assets, app shell
- Network-first: all Supabase API calls (with stale-while-revalidate fallback)
- Background sync: work plan completions queued offline, synced on reconnect
- Push notifications: subscribe on first login (prompt after 3rd visit)

**Mobile Navigation:**
```
Bottom Tab Bar (mobile only):
[ Home ] [ Dashboard ] [ Alerts ] [ Work Plan ] [ Chat ]
```

**Touch Interactions:**
- Swipe left/right to navigate between dashboard tabs
- Pull-to-refresh on Snapshot and Work Plan
- Long-press on alert to acknowledge (mobile gesture)
- Swipe right on work plan item to mark complete

**Push Notification Triggers:**
- EPA licence expiry within 60 days (daily check, morning 8am)
- Insurance expiry within 60 days (daily check)
- Critical alert generated after wizard submission
- Large debtor overdue escalation (7 days overdue from last action)

### 7.7 Real-time & Offline Strategy

**Real-time (Supabase Realtime subscriptions):**
- `work_plan_completions` — real-time subscription so Mark and Jake see each other's completions without refresh
- `alerts_log` — subscription triggers notification badge update when new alerts arrive
- `competitor_rates` — real-time if two users are editing simultaneously (prevent overwrite)

**Offline (Service Worker + React Query):**
- React Query cache persisted to IndexedDB (using `@tanstack/query-sync-storage-persister`)
- Last-loaded data visible offline with "Offline mode — data from [date]" banner
- Work plan completions queued in `localStorage` when offline; flushed on reconnect
- Wizard: online-only (file parsing and upload require connectivity)

**Supabase Realtime Channel Setup:**
```javascript
supabase
  .channel('work-plan-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'work_plan_completions'
  }, payload => {
    queryClient.invalidateQueries({ queryKey: ['workplan'] })
  })
  .subscribe()
```

### 7.8 AI Integration

**Model:** `claude-sonnet-4-6` (current production model; configurable via `ANTHROPIC_MODEL` env var)
**Endpoint:** `POST /api/chat` (Vercel Edge Function — NEVER call Anthropic API from client)
**Mode:** Streaming (`stream: true`) using Server-Sent Events (SSE)

**System Prompt Template (server-side, populated from Supabase):**
```
You are the Binned-IT Dashboard Hub AI assistant for {user_name}.

BUSINESS CONTEXT:
Binned-IT Pty Ltd — skip bin hire, Seaford Melbourne. FY runs Jul–Jun.
Current period: {selected_month_label}. YTD: {fy_start} to {selected_month_label} ({month_count} months).

FINANCIAL SUMMARY (YTD):
Revenue: ${ytd_revenue} | Net Profit: ${ytd_net_profit} ({ytd_np_pct}%) | Gross Margin: {ytd_gm_pct}%

CURRENT MONTH ({selected_month_label}):
Revenue: ${current_revenue} | Net Profit: ${current_net_profit} | GM: {current_gm_pct}%

BALANCE SHEET (latest):
Bank Balance: ${cash_balance} | AR Total: ${ar_total} | AR Overdue: ${ar_overdue} ({overdue_pct}%)
GST Liability: ${gst_liability} | PAYG: ${payg_liability} | Net Equity: ${net_equity}

ACTIVE ALERTS (Critical):
{critical_alerts_list}

ACTIVE ALERTS (Warning):
{warning_alerts_list}

TOP DEBTORS:
{top_debtors_list}

LOSS-MAKING BIN TYPES:
{unprofitable_bins_list}

INSTRUCTIONS:
- Answer in plain English. Be specific with dollar amounts. Reference the actual numbers above.
- If asked about something not in your context, say so rather than speculating.
- Keep responses concise and actionable (under 200 words unless asked for detail).
- Always end financial observations with a specific recommended action.
```

**Edge Function Implementation:**
```javascript
// api/chat.js (Vercel Edge Function)
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'edge' }

export default async function handler(req) {
  const { messages, reportMonth, userId } = await req.json()

  // Fetch live context from Supabase
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const context = await buildContext(supabase, reportMonth, userId)

  // Call Anthropic with streaming
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const stream = await anthropic.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(context),
    messages,
  })

  // Return SSE stream
  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' }
  })
}
```

### 7.9 Infrastructure & DevOps

**Hosting:** Vercel (React SPA + Edge Functions)
**Database:** Supabase (managed PostgreSQL 15, Supabase auth, storage)
**CDN:** Vercel Edge Network (automatic)
**CI/CD:** GitHub Actions + Vercel GitHub Integration

**Branch Strategy:**
```
main          → Production (auto-deploy via Vercel)
develop       → Staging (preview URL)
feature/*     → Feature branches (Vercel preview per PR)
fix/*         → Bug fixes
```

**Environment Variables:**

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Vercel (client) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel (client) | Supabase anonymous key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | Service role key for Edge Functions |
| `ANTHROPIC_API_KEY` | Vercel (server only) | Anthropic Claude API key |
| `ANTHROPIC_MODEL` | Vercel (server only) | Default: claude-sonnet-4-6 |
| `VAPID_PUBLIC_KEY` | Vercel (client) | Web Push public key |
| `VAPID_PRIVATE_KEY` | Vercel (server only) | Web Push private key |
| `VITE_APP_ENV` | Vercel | production / staging |
| `VITE_APP_VERSION` | Vercel | Injected at build time |

**Database Migration Strategy:**
- Sprint 1–2: Manual `psql` apply via Supabase dashboard
- Sprint 3: GitHub Actions workflow to apply migrations on merge to `main`
- Migration file naming: `NNN_description.sql` (sequential integer)
- Never modify existing migrations; always add new files

**Monitoring:**
- Vercel Analytics: page views, Core Web Vitals
- Supabase Dashboard: query performance, connection count, storage usage
- Sentry (Sprint 4): error tracking for production React errors and Edge Function failures

**Backup:**
- Supabase: daily automated backup, 7-day retention (free tier), 30-day on Pro tier
- Additional: weekly Supabase database export to Vercel Blob storage (scheduled Edge Function)

---

## 8. Data Model

### 8.1 Entity Relationship Overview

```
auth.users (Supabase managed)
    │
    └── profiles [1:1]
              │
              ├── monthly_reports [1:N] (uploaded_by)
              │         │
              │         ├── financials_monthly [1:1]
              │         ├── balance_sheet_monthly [1:1]
              │         ├── debtors_monthly [1:N]
              │         ├── bin_type_performance [1:N]
              │         ├── customer_acquisitions [1:N]
              │         ├── compliance_records [1:1]
              │         ├── file_uploads [1:N]
              │         └── alerts_log [1:N]
              │
              ├── work_plan_items [N:N via work_plan_completions]
              │         │
              │         └── work_plan_completions [1:1 per item]
              │
              ├── competitor_rates [N] (updated_by)
              ├── ai_chat_sessions [1:N]
              ├── push_subscriptions [1:N]
              └── notification_log [1:N]

customers [standalone]
    └── customer_acquisitions (denormalised customer_name)

fleet_assets [standalone]
    └── fleet_maintenance_records [1:N]

disposal_receipts [standalone, by report_month]

bin_types [lookup table]
alert_thresholds [config table]
```

### 8.2 Key Relationships

- **monthly_reports → financials_monthly**: One report per month generates one financials row. Child row cascades on report delete.
- **monthly_reports → debtors_monthly**: One report can have many debtor rows (one per debtor name). Delete-insert pattern used on re-submission.
- **work_plan_items → work_plan_completions**: Each item can have at most one active completion (UNIQUE constraint on item_id). Deleting the completion "unchecks" the item.
- **profiles → work_plan_completions**: Records who completed each item, providing accountability.
- **alerts_log → work_plan_items**: Future: auto-generated work plan items can reference the alert that triggered them via `source_alert_id`.

### 8.3 RLS Policy Summary

**General principle:** All authenticated users can read all business data (single-organisation model). Write access is role-restricted as follows:

| Table | Read | Insert | Update | Delete |
|-------|------|--------|--------|--------|
| profiles | Own + Owner sees all | Trigger only | Own profile | No |
| monthly_reports | Any auth | Owner/Bookkeeper | Owner | Owner |
| financials_monthly | Any auth | Owner/Bookkeeper | Owner/Bookkeeper | No |
| balance_sheet_monthly | Any auth | Owner/Bookkeeper | Owner/Bookkeeper | No |
| debtors_monthly | Any auth | Owner/Bookkeeper | No (delete+insert) | Owner/Bookkeeper |
| bin_type_performance | Any auth | Owner/Bookkeeper | No (delete+insert) | Owner/Bookkeeper |
| customers | Any auth | Owner/Manager | Owner/Manager | No |
| customer_acquisitions | Any auth | Owner/Bookkeeper | No | Owner/Bookkeeper |
| competitor_rates | Any auth | Owner/Manager | Owner/Manager | Owner |
| compliance_records | Any auth | Owner/Bookkeeper/Manager | Owner/Bookkeeper/Manager | No |
| work_plan_items | Any auth | Owner | Owner | Owner |
| work_plan_completions | Any auth | Any auth | No | Own or Owner |
| alerts_log | Any auth | Owner/Bookkeeper | Owner (acknowledge) | No |
| file_uploads | Any auth | Owner/Bookkeeper | No | No |
| ai_chat_sessions | Own only | Own | Own | Own |
| alert_thresholds | Any auth | Owner | Owner | No |
| fleet_assets | Any auth | Owner/Manager | Owner/Manager | Owner |
| fleet_maintenance_records | Any auth | Owner/Manager | Owner/Manager | Owner |
| disposal_receipts | Any auth | Owner/Manager | Owner/Manager | Owner |
| push_subscriptions | Own only | Own | Own | Own |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| Requirement | Target | Measurement |
|------------|--------|-------------|
| Dashboard initial load (cold) | < 3 seconds on 4G | Lighthouse / WebPageTest |
| Dashboard tab switch | < 500ms | React profiler |
| Wizard step transition | < 200ms | Visual observation |
| Supabase query response | < 300ms avg | Supabase dashboard |
| PWA offline load (cached) | < 1 second | Lighthouse PWA audit |
| AI chat first token | < 2 seconds | Custom timing |
| PDF generation | < 5 seconds | Custom timing |

**Optimisation strategies:**
- React Query stale-while-revalidate for all Supabase data
- Lazy-load dashboard tab content (code splitting per tab)
- Recharts: avoid re-renders by memoising chart data with `useMemo`
- Images: use WebP format for logo and icons
- Vite build: tree-shaking + minification (default)

### 9.2 Security

| Requirement | Implementation |
|------------|---------------|
| Authentication | Supabase Auth (JWT, Supabase-managed) |
| Authorisation | RLS on all tables; role checked server-side |
| API key protection | Anthropic key in Vercel server env only; never in client bundle |
| HTTPS | Vercel enforces HTTPS on all routes |
| Supabase anon key | Public but limited; all data requires authenticated JWT |
| Service role key | Server-side Edge Functions only; never in client |
| File uploads | Validated by type (xlsx/xls only); stored in Supabase Storage with RLS |
| XSS | React escapes all rendered content; no `dangerouslySetInnerHTML` |
| CSRF | Not applicable (no cookies; JWT bearer token pattern) |
| Secrets in git | Zero secrets in repository; all in Vercel environment settings |
| Audit trail | All writes include `uploaded_by`/`completed_by`/`updated_by` user ID |

### 9.3 Accessibility

| Requirement | Target |
|------------|--------|
| WCAG level | 2.1 AA (best effort given existing inline CSS pattern) |
| Colour contrast | All text/background combinations must meet 4.5:1 ratio |
| Keyboard navigation | All interactive elements reachable via Tab; Enter/Space activates |
| Screen reader | Key KPI values and alerts have `aria-label` attributes |
| Focus indicators | Visible focus ring on all interactive elements |
| Touch targets | Minimum 44×44px on mobile (WCAG 2.5.5) |
| Font size | Base 14px body; 12px minimum for labels |

### 9.4 Browser & Device Support

| Browser | Support Level |
|---------|-------------|
| Chrome (last 2 versions) | Full |
| Safari iOS 16+ | Full (PWA install) |
| Firefox (last 2 versions) | Full |
| Edge (last 2 versions) | Full |
| Safari macOS (last 2 versions) | Full |
| Samsung Internet | Partial (best effort) |
| IE 11 | Not supported |

**Device targets:**
- iPhone 12 and later (380px+)
- Samsung Galaxy S21 and later
- iPad (768px+)
- MacBook / Windows PC (1024px+)

### 9.5 Data Integrity

- All `report_month` dates stored as `date` type using first-of-month (e.g. `2026-02-01`), not string keys
- All monetary values stored as `numeric(12,2)` — exact precision, no floating point
- All percentage values stored as `numeric(6,2)` representing absolute percentage (e.g. `63.8` not `0.638`)
- Duplicate month prevention: `UNIQUE(report_month)` on `monthly_reports`
- Cascade delete: all child records delete when parent `monthly_reports` row is deleted

### 9.6 Availability & Backup

| Item | Target |
|------|--------|
| Uptime | 99.5% (Vercel + Supabase SLAs) |
| Backup frequency | Daily automated (Supabase) |
| Backup retention | 30 days (Supabase Pro) |
| RTO (recovery time) | < 4 hours for full restore |
| RPO (recovery point) | < 24 hours (daily backup) |
| Maintenance window | Sunday 2–4am AEST (announce 48hrs in advance) |

---

## 10. Sprint Delivery Plan

### Sprint 1 (COMPLETE) — SPA Foundation
**Branch:** `feature/sprint1-complete` → merged
**Delivered:**
- React 18 + Vite SPA with all 11 dashboard tabs
- Hardcoded FY2026 data (Jul 2025–Feb 2026) from `financials.js`
- 12-step data entry wizard with SheetJS file parsing
- localStorage persistence via `dataStore.js`
- 40+ alert rules in `analysisEngine.js`
- AI chat panel (direct browser → Anthropic API — API key exposed, fix Sprint 3)
- Competitor pricing matrix with localStorage persistence
- Work plan with localStorage completion tracking
- Pricing tab with cost allocation engine
- Login page UI (Supabase auth wired in `AuthContext.jsx`)
- Supabase migrations written (001, 002, 003)
- API layer written (`src/api/*.js`) but not called by UI

---

### Sprint 2 (IN PROGRESS) — Supabase Foundation
**Duration:** 2 weeks
**Branch:** `develop` ← `feature/supabase-backend`
**Goal:** Authentication gate live; all wizard data writes to Supabase; dashboard reads live data

**Features:**

| Feature | Branch | Status | Priority |
|---------|--------|--------|----------|
| Supabase project setup + env vars | `feature/supabase-setup` | Done | P0 |
| Auth gate (login redirects, session persistence) | `feature/auth` | Done | P0 |
| Run all 3 migrations on Supabase | `feature/database-schema` | Done | P0 |
| Wizard writes to Supabase on complete | `feature/wizard-backend` | In progress | P0 |
| Dashboard reads from Supabase (month selector live) | `feature/dashboard-backend` | In progress | P1 |
| Seed historical data (Jul 2025–Feb 2026) | `feature/data-migration` | Pending | P1 |
| Work plan completions sync to Supabase | `feature/work-plan-sync` | Pending | P2 |
| Competitor rates read/write Supabase | `feature/competitor-sync` | Pending | P2 |
| Compliance records persist | `feature/compliance-backend` | Pending | P2 |

**Acceptance Criteria (Sprint 2 DoD):**
- [ ] User logs in with email/password; session persists on refresh
- [ ] Wizard submission writes all data to Supabase; data visible on fresh device login
- [ ] Month selector shows months from Supabase `monthly_reports` (not hardcoded array)
- [ ] All 11 tabs display data from Supabase for the selected month
- [ ] Work plan completions visible to all logged-in users
- [ ] Competitor rate changes saved to Supabase
- [ ] No secrets in git repository

---

### Sprint 3 — Mobile Responsive + React Router
**Duration:** 2 weeks
**Branch:** `feature/mobile-responsive`
**Goal:** PWA installable on iPhone; React Router v6 routing; bottom nav for mobile; React Query data layer

**Features:**

| Feature | Priority |
|---------|----------|
| React Router v6 — URL-based routing | P0 |
| Mobile breakpoints — responsive layout for all tabs | P0 |
| Bottom navigation bar (mobile) | P0 |
| PWA manifest.json + service worker (Workbox) | P0 |
| React Query (TanStack Query) replacing useEffect patterns | P0 |
| Snapshot tab mobile-optimised layout (2-col KPI tiles) | P0 |
| Work plan mobile card layout | P1 |
| Benchmarking tab mobile card list | P1 |
| Pull-to-refresh on Snapshot | P1 |
| AI chat moved to Vercel Edge Function (fix API key exposure) | P0 |
| Chat panel UI extracted to `ChatPanel.jsx` | P1 |
| Offline banner when service worker detects no connection | P1 |
| Swipeable tabs gesture | P2 |

**Acceptance Criteria:**
- [ ] App installs to iPhone home screen via Safari "Add to Home Screen"
- [ ] All 11 tabs render correctly at 380px width without horizontal scroll
- [ ] Bottom nav appears on screens < 768px; hamburger menu disappears
- [ ] Anthropic API key is NEVER sent to browser; all AI calls through `/api/chat`
- [ ] Pull-to-refresh on Snapshot tab works on iOS Safari
- [ ] Month selector URL is shareable (e.g. `/dashboard/2026-02/snapshot`)

---

### Sprint 4 — Operations Module (Jake's Features)
**Duration:** 2 weeks
**Branch:** `feature/operations-module`
**Goal:** Fleet asset tracking, maintenance records, disposal receipts — Jake's core features

**Features:**

| Feature | Priority |
|---------|----------|
| Fleet assets table (add/edit trucks, equipment) | P0 |
| Maintenance records per vehicle | P0 |
| Next service date alerts on Risk/EPA tab | P0 |
| Vehicle rego expiry tracking + countdown | P0 |
| Disposal receipts log (per job, waste type, receipt number) | P0 |
| Mobile: compliance log form (Jake's quick-log from phone) | P0 |
| Fleet tab driven from `fleet_assets` data | P1 |
| Bin utilisation real-time vs Bin Manager data | P1 |
| Photo upload for compliance documents (Supabase Storage) | P2 |
| Driver assignment whiteboard (digital) | P2 |

**Acceptance Criteria:**
- [ ] Jake can log a new maintenance record from his phone in < 2 minutes
- [ ] Fleet tab shows next service due dates for all active vehicles
- [ ] Vehicle rego expiry within 30 days generates a critical alert
- [ ] Disposal receipt log is accessible from the Risk/EPA tab
- [ ] Photo can be attached to a disposal receipt from mobile camera

---

### Sprint 5 — Data Quality + Enhanced AI
**Duration:** 2 weeks
**Branch:** `feature/ai-enhanced`
**Goal:** AI assistant fully wired with live data, streaming, chat history; data quality scoring enhanced; PDF export

**Features:**

| Feature | Priority |
|---------|----------|
| AI streaming response (SSE) | P0 |
| AI system prompt built from live Supabase data | P0 |
| Chat history persisted to `ai_chat_sessions` | P0 |
| Suggested starter questions in AI chat | P1 |
| Rate limiting for AI chat (20 messages/user/day) | P1 |
| Enhanced wizard data quality scoring | P0 |
| AR reconciliation check (AR total vs balance sheet) | P1 |
| PDF export — single tab (react-to-print) | P0 |
| PDF export — full dashboard summary | P1 |
| Investor view (/investor) — simplified read-only | P1 |
| Settings — Alert Threshold configuration UI | P0 |
| Settings — User Management (invite, role change) | P0 |

**Acceptance Criteria:**
- [ ] AI responses stream word-by-word (no loading spinner)
- [ ] AI system prompt includes real financial data from Supabase
- [ ] Chat history persists across browser sessions
- [ ] PDF export generates a clean, branded PDF in < 5 seconds
- [ ] Investor can access `/investor` route with viewer credentials
- [ ] Owner can change threshold values in Settings; alerts re-evaluate against new values

---

### Sprint 6 — Push Notifications + Polish
**Duration:** 2 weeks
**Branch:** `feature/notifications-polish`
**Goal:** Web Push notifications; month comparison view; Westpac bank statement parser; final UX polish

**Features:**

| Feature | Priority |
|---------|----------|
| Web Push notification subscription | P0 |
| Push alert: EPA expiry < 60 days | P0 |
| Push alert: Insurance expiry < 60 days | P0 |
| Push alert: New critical alert after wizard submission | P0 |
| Scheduled notification check (Vercel Cron Job, daily 8am) | P0 |
| Month comparison view (side-by-side) | P1 |
| Westpac PDF statement parser (basic) | P2 |
| Bin type configuration in Settings | P1 |
| Monthly email digest (Supabase Edge Function + Resend) | P2 |
| Error tracking (Sentry integration) | P1 |
| Performance audit and Lighthouse optimisation | P1 |
| Full QA pass — all 11 tabs, all roles, mobile + desktop | P0 |

**Acceptance Criteria:**
- [ ] Mark receives a push notification on his iPhone when EPA licence is within 60 days
- [ ] Push notification tapped opens the app to the Risk/EPA tab
- [ ] Month comparison shows two months side-by-side on desktop
- [ ] Sentry captures and reports all production JavaScript errors
- [ ] Lighthouse PWA score: > 90
- [ ] All 4 user roles tested on production against all features

---

## 11. Risk Register

### Risk 1: Supabase RLS Misconfiguration — Data Leak

**Likelihood:** Medium | **Impact:** Critical
**Description:** Incorrect RLS policies could allow authenticated users (e.g. Viewer role) to access or modify data they should not see. In a single-organisation model this is primarily an insider access concern, but if multi-tenant is ever activated, this becomes a critical cross-tenant data leak risk.

**Mitigation:**
- Write explicit test queries for each role (owner, manager, bookkeeper, viewer) against every table
- Use Supabase's built-in RLS testing tool (or `psql` with `SET ROLE`)
- Code review all new migrations for RLS before merging to main
- Never use `supabase_admin` credentials in application code

**Residual Risk:** Low after mitigations applied

---

### Risk 2: Anthropic API Key Exposed in Browser

**Likelihood:** Currently Certain (Sprint 1 state) | **Impact:** High
**Description:** The current `App.jsx` calls the Anthropic API directly from the browser, sending the API key in every request (visible in browser DevTools network tab). This allows anyone with access to the browser to extract the key and use it at Binned-IT's expense.

**Mitigation:** Sprint 3 P0 item — move all Anthropic calls to a Vercel Edge Function. The API key must never be in the client bundle or in any VITE_ prefixed environment variable.

**Residual Risk:** None after Sprint 3

---

### Risk 3: Xero Report Structure Changes Break File Parser

**Likelihood:** Medium | **Impact:** Medium
**Description:** The wizard file parser (`src/data/fileParser.js`) expects specific column names and structures from Xero exports. If Xero changes its export format, the parser silently returns empty/wrong data which flows into Supabase.

**Mitigation:**
- Parser should log explicit warnings to the console and data quality score when expected columns are missing
- Data quality check (wizard step 8) should flag if parsed revenue is $0 or unrealistically low
- Add parse schema version tracking to `file_uploads.parse_status`
- Maintain a test suite of sample Xero export files (one per known format version)

**Residual Risk:** Medium — Xero export format is outside our control

---

### Risk 4: Mobile Performance on Low-End Devices

**Likelihood:** Low | **Impact:** Medium
**Description:** The dashboard renders 40+ charts using Recharts across 11 tabs. On low-end Android devices (< 3GB RAM), heavy Recharts rendering may cause jank or out-of-memory errors. Mark may use an older iPhone.

**Mitigation:**
- Lazy-load each dashboard tab's content (code-split per tab using React lazy/Suspense)
- Only mount the chart components for the active tab (unmount inactive tabs)
- Implement virtual scrolling for long lists (debtors, work plan, competitors)
- Test on iPhone 12 (minimum supported) and Samsung Galaxy A52 (mid-range Android)
- Lighthouse Mobile score target > 75

**Residual Risk:** Low-Medium — Recharts is known to be heavy; test early

---

### Risk 5: Business Dependency on Single Developer

**Likelihood:** High | **Impact:** High
**Description:** This product is being developed by a single developer/team. If the primary developer is unavailable, development stops. The codebase is currently poorly documented for handover.

**Mitigation:**
- This PRD is the primary handover document — keep it current
- All code must have inline JSDoc comments for non-obvious logic
- README.md must document: environment setup, Supabase configuration, Vercel deployment, migration process
- Use conventional git commit messages (feat:, fix:, chore:) for readable history
- No magic — avoid clever abstractions that require deep context to understand
- Target: a competent React developer unfamiliar with the project can run it locally within 30 minutes

**Residual Risk:** Medium — acceptable for current scale; revisit if team grows

---

## 12. Open Questions / Decisions Needed

### Technical Decisions

**OQ-01: Wizard Data Transaction Strategy**
When the wizard submits 6+ child records to Supabase, a network failure mid-way leaves orphaned records. Options: (a) use Supabase's `rpc()` to call a server-side function that writes everything atomically, or (b) accept partial writes and detect/clean-up on re-submission. Recommendation: option (a) for data integrity. Requires writing a PostgreSQL function. **Decision needed before Sprint 2 wizard backend merge.**

**OQ-02: Chart Library for Mobile**
Recharts renders SVG, which is not always performant on mobile. Consider migrating to Victory Native (lightweight) or using `react-chartjs-2` (Canvas-based, better mobile performance). This is a significant refactor — either commit to Recharts with lazy-loading optimisation, or plan a migration in Sprint 3. **Decision needed before Sprint 3 mobile work starts.**

**OQ-03: React Router vs File-Based Routing**
React Router v6 requires manual route definition. Alternatively, Vite has file-based routing plugins (TanStack Router, vite-plugin-pages). Given the small number of routes and the team's existing familiarity, React Router v6 is recommended. **Decision: React Router v6 — proceed unless team prefers otherwise.**

**OQ-04: PDF Generation — Client vs Server**
`react-to-print` is simple but can't reliably capture Recharts SVG animations. `html2pdf.js` (puppeteer-based server-side) produces better quality but requires a server. Consider: client-side for now (Sprint 5), upgrade to server-side Puppeteer in Sprint 6 if quality is insufficient. **Decision: start client-side, review at Sprint 5.**

**OQ-05: Supabase Realtime — Enable or Defer?**
Real-time subscriptions add WebSocket connections and complexity. For the current user count (< 10), polling (React Query refetch interval) may be sufficient. Recommendation: implement real-time for `work_plan_completions` only (high-value, shared state); use polling for everything else. **Decision needed Sprint 3.**

### Business / Product Decisions

**OQ-06: Investor View — Separate Login or Shared Login?**
Option (a): Investor has their own Supabase auth account with `viewer` role — they log in normally, see a simplified view. Option (b): A public-facing URL with a token (no login) — easier for the investor but less secure. Recommendation: option (a) for security. **Decision needed before Sprint 5.**

**OQ-07: Month FY Start Date**
The current app assumes FY starts July 1. Is this correct and consistent across all reports? Confirm with Mark/Sarah whether Xero is configured for Jul–Jun FY. **Assumption: Yes, Jul–Jun. Confirm.**

**OQ-08: Wages in COS vs Opex**
The Xero P&L categorises driver wages under Cost of Sales (field: `cos_wages`). The analysis engine and dashboard display wages under OpEx. This inconsistency must be resolved: the `financials_monthly` table has both `cos_wages` and implicit opex wages. Clarify with Sarah exactly which Xero line items are in COS vs OpEx. **Decision needed before wizard backend is finalised.**

**OQ-09: Multi-Currency?**
All figures appear to be AUD. Is there any need to track GST-inclusive vs GST-exclusive figures in the database? Currently, Bin Manager data is stored GST-inclusive and the app converts to ex-GST at display time. This conversion should happen at parse time (in the wizard) so the database always stores ex-GST figures. **Decision: Store ex-GST in all monetary columns. Convert at wizard parse step. Confirm.**

**OQ-10: Xero OAuth — Timeline**
Xero OAuth integration (eliminating manual file upload) would save Sarah significant time and reduce data entry errors. This was deferred from Sprint 2. Should this be in Sprint 6 or pushed to a future roadmap? Xero's API requires OAuth 2.0 app registration and is moderately complex. **Decision: Defer to post-Sprint 6 roadmap unless team estimates < 3 days effort.**

---

## Appendix A: Persona Discovery Session Summaries

### Session 1: Mark (Owner)

**Simulated Q&A:**

Q: What do you look at first every Monday morning?
A: Revenue for last week, then AR — who owes me money and how long it's been sitting. If the bank balance is below $80k I start worrying.

Q: What report do you dread building?
A: The monthly financial summary I send to myself and Andrew (investor). I pull up Xero, export the P&L, export the cash summary, export the AR report, then manually type the key numbers into a spreadsheet. Takes me 2 hours minimum. Half the time I realize I forgot something and have to go back.

Q: What would make you say "this saved me 2 hours a week"?
A: If I could pull up one screen on my phone and see: revenue this month, profit, bank balance, who owes me money, and whether there's anything I need to deal with today. Like a morning briefing. And if that screen was already built from what Sarah uploaded.

Q: What decisions can't you currently make confidently?
A: Pricing. I know some jobs make money and some don't, but I can't tell you exactly which ones are bad deals without sitting down with the data for an hour. I've been meaning to look at the asbestos pricing for 6 months. Also cash flow — the ATO situation is hanging over us and I can't quickly tell you how many weeks of runway we have.

Q: What do you want on your phone?
A: Financial snapshot, alerts about anything urgent, and the ability to send Andrew a link rather than a PDF.

**Key Discoveries:**
- 2-hour monthly report is the #1 time sink
- Mobile morning briefing is a must-have
- Pricing confidence is a major gap — the benchmarking tab is high-value
- Cash runway / ATO visibility is urgent
- Investor link-sharing is valued over PDF emails

---

### Session 2: Sarah (Bookkeeper)

**Simulated Q&A:**

Q: What data do you enter most often?
A: The monthly Xero reports — I export 4 different reports (P&L, cash summary, AR, balance sheet), then I have to manually type the headline numbers into a summary template Mark uses. I also chase debtors by phone and track who I've called in a separate spreadsheet.

Q: What do you copy-paste that should be automatic?
A: The AR aging — I get a 40-row spreadsheet from Xero, I then copy the relevant rows into a summary email to Mark. It's the same data every time. The system should just take the Xero export and show it automatically.

Q: What's your biggest fear about data accuracy?
A: That I submit a month's data and there are missing invoices — supplier bills that haven't been posted yet. It makes the profit look better than it is. In February, fuel invoices weren't posted, so the P&L showed 93% gross margin which is obviously wrong. Mark was confused. I want the system to flag that automatically.

Q: How long does your monthly close process take?
A: Probably 45 minutes to an hour. Exporting, reformatting, then the summary email. If the wizard just takes my Xero files and fills in the dashboard, that's basically done in 5 minutes.

Q: What compliance item do you worry about?
A: Asbestos documentation. Every asbestos job needs specific paperwork. I keep a spreadsheet but nobody else looks at it. If there was ever an EPA audit and something was missing, that's on me.

**Key Discoveries:**
- Excel upload wizard is the highest-value feature for Sarah
- Data quality scoring (COS anomaly detection) addresses her #1 fear
- AR aging trend across months is a top request
- Asbestos documentation tracking needs to flow from wizard to Risk/EPA tab
- Monthly close should drop from 45–60 min to < 10 min

---

### Session 3: Jake (Fleet Manager)

**Simulated Q&A:**

Q: What do you check before drivers leave in the morning?
A: Which jobs are scheduled today, which trucks are available, and whether any bins have been out too long — if a bin's been sitting on a site for 3 weeks, I need to follow that up. I currently check Bin Manager but it's not easy to see the duration at a glance.

Q: What EPA compliance item nearly got missed last year?
A: The EPA licence renewal. I found out it was coming up because I happened to look at the folder. Mark didn't know. We scrambled to get the application in. It should have been on the radar 90 days out.

Q: If you could see one thing on your phone every morning, what would it be?
A: Which bins have been on-hire for more than 2 weeks. Those are the ones I need to call about or send someone to collect. Right now I have to look at Bin Manager one by one.

Q: How do you currently log asbestos disposal receipts?
A: The driver brings back the tip receipt, I put it in a folder. Sometimes it doesn't come back and I have to chase it up. I'd like to be able to take a photo of it from my phone and have it attached to the job.

Q: What data would you want in the dashboard that isn't there now?
A: Truck maintenance — when is each truck due for its next service? What's the rego expiry? Right now that's all in a folder and a whiteboard. And I'd like to see the current hire status of bins by type, not just last month's average.

**Key Discoveries:**
- Bin on-hire duration view (14+ day filter) is Jake's #1 request
- EPA licence expiry tracking with early alert is critical — nearly a compliance failure
- Fleet maintenance schedule in the dashboard is high-value
- Mobile-first compliance logging (photo upload) is a strong differentiator
- Jake's device is primarily mobile (yard and road)

---

### Session 4: Investor / Andrew (Viewer)

**Simulated Q&A:**

Q: What one number tells you if the business is healthy?
A: Revenue trend — is it going up? And net profit margin. If revenue is growing and margin is holding, the business is healthy. If revenue is flat and margin is dropping, something's wrong.

Q: What would make you log in weekly instead of quarterly?
A: If the dashboard was simple enough that I could understand it in 30 seconds. The PDF Mark sends me has a lot of detail I don't need. Just give me 4 numbers: revenue this month, profit, bank balance, and what I need to know about.

Q: What do you currently do when you get the PDF?
A: Skim the summary, check the revenue number, look at whether there's a risk I should know about. Then I either call Mark if I have questions, or file it. Half the time I've forgotten the numbers by our next call.

Q: Would you be comfortable with a dashboard login rather than a PDF?
A: Yes, if it's simple. I don't want to learn a complex system. One screen, the numbers that matter, and maybe a trend chart. That's all.

Q: What risk would you want to be alerted about?
A: Any month where profit drops more than 20% vs the prior month, or if there's a cash position issue. And if there's a big debtor going bad — I've seen businesses get into trouble because of one customer not paying.

**Key Discoveries:**
- Needs extreme simplicity — one screen, 4 key numbers
- Revenue trend chart (12 months) is the primary visualisation
- Alert-on-major-event is preferred over weekly check-ins
- Link is preferred over PDF (but PDF export is valued for accountant sharing)
- Low technical literacy means the investor view must require zero learning

---

## Appendix B: Technology Decisions Log

| Decision | Options Considered | Chosen | Rationale | Date |
|---------|-------------------|--------|-----------|------|
| Mobile approach | React Native, PWA | PWA | Small user base; no app store friction; covers all use cases | Mar 2026 |
| State management | Context, Zustand, Redux | React Context + React Query | Context for auth; Query for server state; no Redux complexity needed | Mar 2026 |
| AI model | claude-3-haiku, claude-sonnet-4-6 | claude-sonnet-4-6 | Better reasoning for financial analysis; cost acceptable | Mar 2026 |
| Routing | No routing, React Router v6 | React Router v6 | Required for PWA deep links and investor URL sharing | Mar 2026 |
| Charts | Recharts, Victory, Chart.js | Recharts (retain) | Already implemented; refactor cost not justified | Mar 2026 |
| CSS approach | Tailwind, inline CSS, CSS Modules | Inline CSS (retain) | Existing pattern; brand consistency; avoid refactor | Mar 2026 |
| PDF generation | react-to-print, html2pdf, Puppeteer | react-to-print (Sprint 5) | Simplest implementation; revisit if quality insufficient | Mar 2026 |
| Push notifications | Firebase FCM, Web Push API | Web Push API | No Firebase dependency; standard browser API; Supabase stores subscriptions | Mar 2026 |
| Email (notifications) | SendGrid, Resend, SES | Resend | Modern developer-first API; simple integration with Next.js/Vercel | Mar 2026 |

---

## Appendix C: Data Migration Plan (Legacy → Supabase)

The 8 months of hardcoded data in `src/data/financials.js` must be seeded into Supabase as the authoritative historical record.

**Migration steps:**

1. Create a one-time seed script (`scripts/seed-historical.js`) that:
   - Creates `monthly_reports` records for Jul 2025 – Feb 2026 with `status = 'complete'`
   - Creates `financials_monthly` records from the hardcoded arrays in `financials.js`
   - Creates `balance_sheet_monthly` record from `balanceSheet` object (for the most recent month)
   - Creates `debtors_monthly` records from `topDebtors` array (tagged to Feb 2026 report)
   - Creates `bin_type_performance` records from `binTypesData` array (Feb 2026)
   - Creates `customer_acquisitions` records from `newCustomersFeb` array
   - Creates seed `competitor_rates` records from `seedCompetitors` in `CompetitorPage.jsx`
   - Creates `work_plan_items` (already handled by migration 003)

2. Script is run once against production Supabase using the service role key

3. After seeding, `src/data/financials.js` is retained as a reference/fallback but no longer the primary data source

4. The `importLegacyData()` function in `dataStore.js` can be repurposed to call the seed script

**Data quality notes for the seed:**
- Feb 2026 COS figures are known to be incomplete (missing invoices) — seed as-is with a note in `compliance_notes`
- Balance sheet is from Xero as at Jun 2025 (end of FY); not per-month snapshots for earlier months
- Bin type performance data is only available for Feb 2026 (from real Bin Manager data); prior months use estimated proportions

---

*End of PRD v3.0*

*Document generated by BMAD autonomous session — 27 March 2026*
*All persona sessions conducted autonomously based on role descriptions and codebase analysis*
*Next review: Sprint 3 kickoff*
