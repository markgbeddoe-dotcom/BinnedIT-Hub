# Binned-IT Dashboard Hub

Management Intelligence Platform for Binned-IT Pty Ltd.

## Quick Start

### 1. Install Node.js (if you don't have it)
Download from: https://nodejs.org/
Choose the "LTS" version. Install with all defaults.

### 2. Open Terminal
- **Mac**: Open "Terminal" from Applications → Utilities
- **Windows**: Open "Command Prompt" or "PowerShell"
- **Linux**: Open your terminal app

### 3. Navigate to this folder
```
cd path/to/binnedit-hub
```
(Replace `path/to/` with wherever you extracted the zip)

### 4. Install dependencies (first time only)
```
npm install
```
This takes about 30 seconds. You only need to do this once.

### 5. Run the app
```
npm run dev
```
Your browser will open automatically to http://localhost:3000

### 6. Stop the app
Press `Ctrl + C` in the terminal.

---

## What's Included

### Landing Page
- 5 navigation tiles: View Dashboard, Generate New, Update Existing, Compare, Settings
- Quick alerts panel showing top issues

### Dashboard (11 Tabs)
1. **SNAPSHOT** — YTD financial overview with charts
2. **REVENUE** — Revenue by category (stacked bars + pie)
3. **MARGINS** — COS, opex, cost drivers with anomaly detection
4. **PRICING** — All 18 bin types ranked by net margin
5. **COMPETITORS** — Market pricing comparison table
6. **BDM** — New vs dormant customers
7. **FLEET** — Bin type usage and utilisation
8. **DEBTORS** — AR aging, top debtors, overdue alerts
9. **CASH FLOW** — Cash in/out, running balance, 6-month projection
10. **RISK / EPA** — Asbestos, contaminated soil, WHS compliance
11. **WORK PLAN** — Prioritised to-do list with done tracking

### Wizard (12 Steps)
Steps 1-6: Excel file uploads (simulated in prototype)
Step 7: Westpac bank statement upload
Step 8: Data quality check
Step 9: Operational & compliance review
Step 10: Market, business & cash context
Step 11: Review & generate
Step 12: Generate report

### Analysis Engine
Every dashboard tab has auto-generated "Recommended Actions" at the bottom.
40+ rules check the data and generate alerts ranked by severity.

### Work Plan
Intelligently prioritised to-do list. Click checkboxes to mark items done.
Completion status saved in your browser between sessions.

---

## Current Status
This is the **Sprint 1 build** with all 11 dashboard tabs showing real FY2026 data.
The wizard steps show the correct layout and fields but file upload parsing
is simulated (clicking the upload zone marks it as loaded).

### What Works Now
- ✅ Landing page navigation
- ✅ Full dashboard with 11 tabs and real data
- ✅ All charts (Recharts)
- ✅ Analysis engine generating alerts per tab
- ✅ Work Plan with done tracking (saves to localStorage)
- ✅ 12-step wizard flow with navigation
- ✅ **Real Excel file reading** — upload Xero Cash Summary or Balance Sheet and see parsed data
- ✅ **Working toggle buttons** — Data Quality step has proper Yes/No/Option selectors
- ✅ **Validated compliance inputs** — Date pickers, numeric fields, Y/N toggles, structured text areas
- ✅ **Competitor pricing matrix** — Full page with add/remove competitors, editable rate cells, auto-saves
- ✅ **Pricing drill-down** — Click any bin type to see per-job cost breakdown, break-even analysis, top jobs
- ✅ **Fleet sorted by profit** not revenue, with utilisation cards
- ✅ **Debtor aging detail** — Each debtor shows Current / <1 Month / 1-2-3 Months / Older breakdown
- ✅ Stacked bar chart showing aging composition per debtor

### Coming Next
- Excel file parsing (SheetJS integration)
- Westpac PDF parsing
- Data confidence scoring
- Compare Months view
- Settings page (configurable thresholds)
- Report generation (PDF)
- Email integration
- Netlify deployment

---

## Tech Stack
- React 18
- Recharts (charts)
- Vite (build tool)
- SheetJS (Excel parsing — wired up, not yet connected)
- localStorage (data persistence)
