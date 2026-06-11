# SkipSync E2E suite (Playwright)

## Quick start (local)

```bash
npm run test:e2e:install   # one-time: download browsers
npm run test:e2e           # starts vite dev on :3000 automatically (webServer)
```

No env setup is needed for a default local run — the auth fixture falls back to
the known local test login from CLAUDE.md (`mark@binnedit.com.au`).

## Auth fixture (GAP-072)

The suite uses Playwright's **storageState** pattern:

1. The `setup` project (`e2e/auth.setup.js`) runs first. It logs in through the
   real LoginPage UI and saves the browser storage — including the Supabase
   session token (`sb-<ref>-auth-token` in localStorage) — to
   `e2e/.auth/user.json` (gitignored).
2. The `desktop` (1440x900) and `mobile` (iPhone 14, 390x844) projects declare
   `dependencies: ['setup']` and `storageState: e2e/.auth/user.json`, so every
   spec starts **already authenticated** as the office test user.
3. Specs that test the *unauthenticated* path (e.g. `login.spec.js`) opt out
   with `test.use({ storageState: NO_AUTH_STATE })` from `e2e/auth-helpers.js`.

### Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `TEST_USER_EMAIL` | `mark@binnedit.com.au` | Login for the auth fixture (owner role) |
| `TEST_USER_PASSWORD` | `BinnedIT2024x` | Password for the auth fixture |
| `E2E_REQUIRE_AUTH` | unset | `1` = fail the run hard if login fails. Default: write an empty storage state, warn, and let authed specs self-skip via `hasAuthState()` so the suite still starts. |
| `E2E_LIVE_DATA` | unset | `1` = also assert exact Feb-2026 dollar values (needs the live synced Supabase; brittle against re-sync, see GAP-076) |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | from `.env.local` | The dev server needs a reachable Supabase project for login to succeed |

`playwright.config.js` loads `.env.local` via dotenv, so locally you normally
set nothing. In CI, set them as repo secrets (the `e2e` job in
`.github/workflows/ci.yml` is opt-in via the `RUN_E2E=true` repository
variable, because it needs a live Supabase to log in against).

### Adding a spec that needs auth

```js
import { test, expect } from '@playwright/test'
import { hasAuthState } from './auth-helpers.js'

test.skip(!hasAuthState(), 'needs authenticated session')

test('my authed flow', async ({ page }) => {
  await page.goto('/dispatch')   // already logged in
  ...
})
```

### Adding a second role fixture (e.g. investor)

Add another setup test in `auth.setup.js` that logs in with
`TEST_INVESTOR_EMAIL`/`TEST_INVESTOR_PASSWORD` and saves to
`e2e/.auth/investor.json`, then `test.use({ storageState: ... })` in the spec.
The skipped investor tests in `cash-accrual-toggle.spec.js` are waiting on this
(see the TODO there — the once-promised `?role=` query-param escape hatch was
never built, and AuthGate redirects investors off `/dashboard/*`).

## Known limitations

- `e2e/.auth/user.json` expires with the Supabase session — the setup project
  re-creates it on every run, so this only matters if you hand-run a single
  project with `--no-deps`.
- Exact dollar-value assertions are gated behind `E2E_LIVE_DATA=1`
  (GAP-076: they break on every Xero re-sync).
- Investor role lock tests are `test.skip` pending an investor test account
  (see above).
