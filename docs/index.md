# SkipSync — Documentation Index

**Generated:** 2026-05-06 by `bmad-document-project` (deep scan)
**Project root:** `C:/Local Dev/SkipSync` (application code in `BinnedIT-Hub/`)
**Scan level:** deep
**Repository type:** monolith
**Live URL:** https://binnedit-hub.vercel.app

This index is the primary entry point for AI-assisted development. Point any BMad workflow that needs project context here first.

## Project overview

- **Type:** Monolith web project (project_type_id: `web`)
- **Primary language:** JavaScript (JSX) — no TypeScript by ADR-001
- **Architecture pattern:** React 18 SPA + Supabase PostgreSQL + Vercel Edge Functions
- **Tech stack:** React 18 / Vite 5 / TanStack Query 5 / React Router 7 / Supabase JS / Recharts / Anthropic Claude Sonnet 4.6

## Quick reference

- **Entry point (browser):** `BinnedIT-Hub/src/main.jsx`
- **Top-level app shell:** `BinnedIT-Hub/src/App.jsx`
- **Auth provider:** `BinnedIT-Hub/src/context/AuthContext.jsx`
- **Supabase client:** `BinnedIT-Hub/src/lib/supabase.js`
- **Database schema (start here):** `BinnedIT-Hub/supabase/migrations/001_initial_schema.sql`
- **AI proxy:** `BinnedIT-Hub/api/chat.js`
- **Vercel runtime config:** `BinnedIT-Hub/vercel.json`

## Generated documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [API Contracts](./api-contracts.md)
- [Data Models](./data-models.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [Project Scan Report](./project-scan-report.json) (state file)

## Existing in-repo documentation

These pre-existed in `BinnedIT-Hub/` and remain authoritative for the *why* behind decisions:

- `BinnedIT-Hub/README.md` — quick start + tech stack summary
- `BinnedIT-Hub/CLAUDE.md` — Claude Code instructions / autonomous-action allowlist
- `BinnedIT-Hub/ARCHITECTURE.md` — full ADR log (ADR-001 through ADR-018)
- `BinnedIT-Hub/PRD.md` — v4.0 (delivered, March 2026)
- `BinnedIT-Hub/PRD-v5.md` — v5.0 (active — drives current operations-first roadmap)

## Getting started

Local development:
```bash
cd BinnedIT-Hub
npm install
# UI-only:
npm run dev
# Full stack incl. Edge Functions (AI chat, invite):
vercel dev
```

For environment variables, database setup, and conventions see [`development-guide.md`](./development-guide.md).

## Brownfield PRD entry point

When running `bmad-create-prd` against this project, point it at this `index.md`. The PRD workflow can navigate from here to whichever specific docs it needs (architecture, data models, API contracts).

## Top-level features map (where features live)

| Feature | Component / file |
|---|---|
| Dispatch board | `src/components/DispatchBoard.jsx` |
| Bookings (ops + public) | `src/components/BookingPage.jsx`, `api/book-confirm.js` |
| Customers / CRM | `src/components/CustomersPage.jsx` |
| Invoices + dunning | `src/components/InvoicesPage.jsx`, `api/invoice-*.js` |
| Fleet management | `src/components/FleetManagementPage.jsx`, `tabs/FleetAssetsTab.jsx` |
| Dashboard (12 tabs) | `src/components/tabs/*.jsx` |
| AI chat | `src/components/ChatPanel.jsx` ↔ `api/chat.js` |
| AI per-tab insights | `src/components/AIInsightsPanel.jsx` ↔ `api/chat.js` |
| Wizard (monthly load) | `src/components/Wizard.jsx`, `src/data/wizardSteps.js` |
| Driver portal | `src/components/driver/DriverApp.jsx`, `api/driver.js` |
| Settings & team | `src/components/SettingsPage.jsx`, `TeamPage.jsx`, `api/invite.js` |
| Investor view | `src/components/InvestorView.jsx` |
| PDF export | `src/components/PDFExport.jsx` |
| Xero integration | `api/xero-*.js`, `src/api/xero.js` |
| Cron jobs | `vercel.json` `crons` → `api/reminders.js`, `api/weekly-digest.js`, `api/invoice-chase.js` |
| Push notifications | `api/push-send.js`, `public/sw.js` |
| Alerts engine | `src/data/analysisEngine.js`, `src/api/alerts.js` |
