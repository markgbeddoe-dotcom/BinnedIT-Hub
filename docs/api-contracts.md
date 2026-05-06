# API Contracts — SkipSync

**Generated:** 2026-05-06

This document covers two layers:

1. **Vercel Edge Functions** (`api/*.js`) — the server-side HTTP API
2. **Supabase data-access layer** (`src/api/*.js`) — client functions hitting PostgREST/Supabase JS

## Vercel Edge Functions

All Edge Functions run on `runtime: 'edge'`. Auto-detected by Vercel from any `.js` file under `api/`.

### POST `/api/chat`
File: `api/chat.js`
Purpose: Streaming proxy to Anthropic Claude (`claude-sonnet-4-6`, max 2048 tokens).

| | |
|---|---|
| Method | `POST` (also `OPTIONS` for CORS preflight) |
| Auth | None enforced at HTTP layer — function checks rate limit by `userId` if Supabase env vars present |
| Body | `{ messages: ChatMessage[], reportMonth: string, userId: string, financialSummary?: object, marketResearch?: boolean }` |
| Response | SSE stream of Anthropic deltas, OR JSON `{ error }` on 4xx/5xx |
| Rate limit | 50 messages/user/day (counted in `ai_chat_sessions`) |
| Server env | `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

Client streaming pattern:
```js
const r = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(payload) })
const reader = r.body.getReader()
const decoder = new TextDecoder()
// parse SSE events; append delta text to message state
```

### POST `/api/invite`
File: `api/invite.js`
Purpose: Send Supabase magic-link invitation; create/update `profiles` row with assigned role.

| | |
|---|---|
| Method | `POST` |
| Auth | `Authorization: Bearer <Supabase JWT>` — caller must have `role='owner'` in `profiles` |
| Body | `{ email: string, role: 'owner'|'manager'|'bookkeeper'|'viewer' }` |
| Domain restriction | Email **must end with `@binnedit.com.au`** (else 400) |
| Response | `{ success: true, userId }` or `{ error }` |
| Server env | `SUPABASE_SERVICE_ROLE_KEY` (URL is hardcoded to `https://dkjwyzjzdcgrepbgiuei.supabase.co`) |

### POST `/api/book-confirm`
Confirms a booking — likely sends customer-facing confirmation (SMS/email). See file for canonical contract.

### `/api/invoice-generate`, `/api/invoice-chase`
Invoice creation + dunning. `invoice-chase` runs on cron `0 9 * * *` (09:00 daily) per `vercel.json`.

### `/api/reminders`, `/api/weekly-digest`
Cron-driven endpoints:
- `reminders` — `0 8 * * *` daily
- `weekly-digest` — `0 20 * * 0` Sunday 20:00

### `/api/push-send`
Web Push notification dispatch. Uses VAPID keys (currently placeholder — regenerate via `npx web-push generate-vapid-keys` before going live).

### Xero integration suite

| Endpoint | Role |
|---|---|
| `/api/xero-auth` | Initiate OAuth 2.0 flow with Xero |
| `/api/xero-callback` | OAuth callback — persists tokens to `xero_tokens` |
| `/api/xero-sync` | Push invoices / contacts to Xero |
| `/api/xero-payment-sync` | Pull payment events from Xero, log to `xero_sync_log` |

All Xero endpoints require an authenticated session and use the service-role key server-side.

## Supabase data-access layer (`src/api/*.js`)

These are JS functions, not HTTP endpoints — they wrap `supabase.from(...).select/insert/update/upsert/delete()`. Called from React Query hooks (`src/hooks/use*.js`) and from `App.handleWizardComplete()`.

### `src/api/reports.js`
Touches: `monthly_reports`, `financials_monthly`, `balance_sheet_monthly`, `compliance_records`.
Key functions: `createReport(reportMonth)`, `upsertFinancials(reportId, reportMonth, payload)`, `upsertCompliance(reportId, reportMonth, payload)`, plus list/get readers used by `useMonthData.js`.

### `src/api/alerts.js`
Touches: `alerts_log`. Reads alerts for a report; acknowledges alerts (sets `acknowledged_by`, `acknowledged_at`).

### `src/api/audit.js`
Touches: `audit_log`. Append-only — writes user actions; readers paginate for `AuditLogPage`.

### `src/api/bookings.js`
Touches: `bookings`. CRUD for booking lifecycle (pending → scheduled → in-progress → complete).

### `src/api/competitors.js`
Touches: `competitor_rates`. Read all + upsert by `(competitor_name, bin_type)` unique pair.

### `src/api/customers.js`
Touches: `customers`, `customer_acquisitions`, `customer_notes`, `customer_order_history`.

### `src/api/driver.js`
Touches: `job_photos`, `job_events`, `vehicle_checklists`, `hazard_reports`. Used by driver portal.

### `src/api/fleet.js`
Touches: `bin_types`, `fleet_assets`, `fleet_maintenance_records`, `disposal_receipts`.

### `src/api/invoices.js`
Touches: `invoices`, `ar_invoices`, `email_reminders_log`. Reads outstanding invoices, marks paid, triggers dunning.

### `src/api/notifications.js`
Touches: `notifications` + push subscription rows. Backed by `/api/push-send` Edge Function for delivery.

### `src/api/settings.js`
Touches: `alert_thresholds`. Read + upsert `(category, metric_key)` rows.

### `src/api/team.js`
Touches: `profiles`, `staff_certificates`, `insurance_policies`. Calls `/api/invite` for new users.

### `src/api/workplan.js`
Touches: `work_plan_items`, `work_plan_completions`. CRUD + completion toggling.

### `src/api/xero.js`
Touches: `xero_tokens`, `xero_sync_log`. Client-side helpers; actual sync happens in Edge Functions.

## Query key conventions (TanStack Query)

```
['available-months']                    # useAvailableMonths
['financials', reportMonth]
['financials-ytd', fyStart, toMonth]
['balance-sheet', reportMonth]
['debtors', reportMonth]
['bin-performance', reportMonth]
['compliance', reportMonth]
['acquisitions', reportMonth]
['work-plan']
['alerts', reportId]
['competitors']
```

Default `staleTime`: 5 minutes for report data, 30 seconds for shared/work-plan data, `Infinity` for competitor rates (refetch only on mutation).

## Authentication & RLS

- Browser holds Supabase session in `localStorage` (`persistSession: true`).
- All client `src/api/*.js` calls use the **anon key** + the user's JWT — RLS policies in migration `002_rls_policies.sql` enforce role-based access.
- Service-role key is **only** used inside Edge Functions and never exposed to the browser.
- `/api/invite` additionally enforces `@binnedit.com.au` domain at the application layer.
