// Shared constants/helpers for the Playwright auth fixture (GAP-072).
// Used by playwright.config.js, auth.setup.js and any spec that needs to
// know whether a real authenticated session was captured.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const E2E_DIR = path.dirname(fileURLToPath(import.meta.url))

/** Where the logged-in browser state (Supabase session in localStorage) is saved. */
export const STORAGE_STATE = path.join(E2E_DIR, '.auth', 'user.json')

/** A storageState value that explicitly means "not logged in" (for specs that
 *  test the unauthenticated boot path, e.g. login.spec.js). */
export const NO_AUTH_STATE = { cookies: [], origins: [] }

/**
 * True when auth.setup.js captured a real Supabase session (supabase-js v2
 * stores it in localStorage under `sb-<project-ref>-auth-token`).
 * Specs that REQUIRE auth should `test.skip(!hasAuthState(), …)` so the suite
 * still starts (and reports clearly) when login wasn't possible.
 */
export function hasAuthState() {
  try {
    const raw = fs.readFileSync(STORAGE_STATE, 'utf8')
    const state = JSON.parse(raw)
    return (state.origins || []).some(o =>
      (o.localStorage || []).some(item => item.name.startsWith('sb-') && item.name.includes('auth-token'))
    )
  } catch {
    return false
  }
}
