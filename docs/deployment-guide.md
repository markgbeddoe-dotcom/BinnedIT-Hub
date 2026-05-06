# Deployment Guide — SkipSync

**Generated:** 2026-05-06
**Production URL:** https://binnedit-hub.vercel.app
**Hosting:** Vercel (frontend + Edge Functions)
**Database:** Supabase (PostgreSQL + Auth)
**GitHub repo:** `https://github.com/markgbeddoe-dotcom/BinnedIT-Hub`

## Deployment model

```
master branch  ──► GitHub  ──► Vercel auto-build  ──► Production
                                       │
                                       └── api/*.js auto-deploys as Edge Functions
```

There is no manual deploy step. Pushing to `master` triggers Vercel's CI:

```bash
npm run build               # MUST be 0 errors before pushing
git add -A
git commit -m "<message>"
git push origin master
```

## Vercel project configuration

`vercel.json` controls runtime behavior:

| Field | Value | Notes |
|---|---|---|
| `framework` | `vite` | |
| `buildCommand` | `npm run build` | |
| `outputDirectory` | `dist` | |
| `rewrites` | `"/(.*)" → "/index.html"` | SPA fallback for client routes |
| `headers` | Security headers (see below) | Applied to all responses |
| `crons` | 3 schedules (see below) | Single canonical array (de-duplicated 2026-05-06) |

### Security headers (all routes)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Cron schedules

| Endpoint | Cron | Time (UTC) |
|---|---|---|
| `/api/reminders` | `0 8 * * *` | 08:00 daily |
| `/api/weekly-digest` | `0 20 * * 0` | 20:00 Sunday |
| `/api/invoice-chase` | `0 9 * * *` | 09:00 daily |

## Required Vercel environment variables

Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Used by | Scope |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Browser | Production, Preview, Development |
| `VITE_APP_ENV` | Browser | Production, Preview, Development |
| `VITE_VAPID_PUBLIC_KEY` | Browser (`SettingsPage` push-subscribe) | Production, Preview, Development |
| `ANTHROPIC_API_KEY` | `/api/chat` | Production, Preview |
| `SUPABASE_URL` | `/api/chat`, `/api/invite`, Xero | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Production, Preview |
| `VAPID_PUBLIC_KEY` | `/api/push-send` | Production, Preview |
| `VAPID_PRIVATE_KEY` | `/api/push-send` | Production, Preview |
| `VAPID_SUBJECT` | `/api/push-send` (default `mailto:mark@binnedit.com.au`) | Production, Preview |

⚠️ Server-only keys must **not** be prefixed `VITE_` — that would expose them to the browser bundle.

## Database deployment (Supabase)

For each environment (production, staging if added), apply migrations in numeric order via Supabase Dashboard → SQL Editor or `supabase db push`. See `development-guide.md` for the ordered file list. All migrations are idempotent so safe to re-run.

## Build artifact

`npm run build` produces `dist/` containing:

- `index.html` (Vite entry)
- Hashed JS chunks split by `vite.config.js` `manualChunks`:
  - `vendor-react` — react, react-dom, react-router-dom
  - `vendor-charts` — recharts
  - `vendor-supabase` — @supabase/supabase-js
  - `vendor-query` — @tanstack/react-query
  - app code chunks
- Static assets from `public/` (manifest, sw.js, icons, logo)

Largest chunk currently ~536kB (acceptable per ADR — chunk size warning is expected).

## Rollback

Vercel keeps deployment history. Rollback is via Vercel Dashboard → Deployments → "Promote to Production" on a prior successful build. No code revert is needed.

For database rollback: there is no automated path. Migrations are idempotent forward only — to undo a schema change, write a new migration that reverses it.

## Post-deploy checklist

1. Visit `https://binnedit-hub.vercel.app` — confirm login screen renders
2. Sign in as `mark@binnedit.com.au` / `BinnedIT2024x`
3. Confirm Snapshot tab loads KPIs (live or fallback)
4. Open ChatPanel — send a message — confirm SSE stream works (validates `ANTHROPIC_API_KEY`)
5. Visit `/settings/team` — attempt an invite to a `@binnedit.com.au` address — confirm `/api/invite` returns success (validates `SUPABASE_SERVICE_ROLE_KEY`)
6. Refresh the page on `/dashboard/snapshot` — confirm route still resolves (validates SPA rewrite in `vercel.json`)
7. Run a Lighthouse PWA audit — installable, works offline (validates `manifest.json` + `sw.js`)

## Pre-launch unfinished items

- Some Xero endpoints (`api/xero-*.js`) are wired but the post-launch invoice round-trip is partial — confirm against `PRD-v5.md` before relying on them in production flows
- Test coverage is minimal (one Vitest unit test, one Playwright smoke). Expand both alongside feature work — the QA protocol now runs `npm test` and `npm run test:e2e` as gates before pushing
