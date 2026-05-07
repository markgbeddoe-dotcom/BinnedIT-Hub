/**
 * scripts/resync-xero.js
 *
 * Re-syncs Xero P&L + BS + AR data for a date range across BOTH cash and
 * accrual bases. Uses the SAME `syncMonth` function the live Edge Function
 * uses (imported from api/xero-sync.js), but invoked from Node with the
 * service role key — no Supabase user JWT needed, no Xero OAuth handshake
 * (the existing xero_tokens row is reused via getValidToken).
 *
 * READ-ONLY against Xero. Only fetches reports (paymentsOnly=true|false,
 * BS, AR). Never writes to Xero. The kill-switch in xero-invoice.js is the
 * only path that COULD write, and it's gated behind XERO_WRITE_ENABLED='true'.
 *
 * Usage:
 *   node scripts/resync-xero.js                # all 8 months × both bases
 *   node scripts/resync-xero.js 2026-02        # one month × both bases
 *   node scripts/resync-xero.js 2026-02 cash   # one month × one basis
 *   node scripts/resync-xero.js --range 2025-07 2026-02 --bases cash,accrual
 *
 * After completion: re-run scripts/meg-end-to-end-reconciliation.js to verify
 * the live DB now ties out against the Xero exports.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { syncMonth } from '../api/xero-sync.js'
import { getValidToken } from '../api/lib/xero-token.js'

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Run: vercel env pull .env.local')
  process.exit(2)
}

const DEFAULT_MONTHS = [
  '2025-07', '2025-08', '2025-09', '2025-10',
  '2025-11', '2025-12', '2026-01', '2026-02',
]

const argv = process.argv.slice(2)
let months = DEFAULT_MONTHS
let bases = ['cash', 'accrual']
let userId = null  // null is fine — it's only stamped on the audit log row

if (argv.length === 1 && /^\d{4}-\d{2}$/.test(argv[0])) {
  months = [argv[0]]
} else if (argv.length === 2 && /^\d{4}-\d{2}$/.test(argv[0]) && ['cash', 'accrual'].includes(argv[1])) {
  months = [argv[0]]
  bases = [argv[1]]
} else if (argv[0] === '--range' && argv.length >= 3) {
  // --range FROM TO [--bases cash,accrual]
  const from = argv[1]
  const to = argv[2]
  months = []
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  const bIdx = argv.indexOf('--bases')
  if (bIdx !== -1) bases = argv[bIdx + 1].split(',')
}

console.log(`Re-syncing Xero data for ${months.length} month(s) × ${bases.length} basis/bases.`)
console.log(`Months: ${months.join(', ')}`)
console.log(`Bases:  ${bases.join(', ')}`)
console.log('')

// Fetch a fresh Xero token once; reuse for the whole run
let accessToken, tenantId
try {
  ({ accessToken, tenantId } = await getValidToken(SERVICE_KEY))
  console.log(`✓ Got Xero token for tenant ${tenantId}`)
} catch (e) {
  console.error('Failed to get Xero token:', e.message)
  console.error('Possible causes:')
  console.error('  - xero_tokens table empty or refresh token expired')
  console.error('  - Mark needs to re-do OAuth from Settings → Xero')
  process.exit(1)
}

const results = []
let succeeded = 0
let failed = 0

for (const month of months) {
  for (let i = 0; i < bases.length; i++) {
    const basis = bases[i]
    const reuseReport = i > 0  // first basis pass creates monthly_reports; second reuses
    process.stdout.write(`  ${month} ${basis}...`)
    try {
      const summary = await syncMonth(month, accessToken, tenantId, SERVICE_KEY, userId, basis, reuseReport)
      results.push({ month, basis, ok: true, ...summary })
      succeeded++
      console.log(` ✓ rev=${summary.revenue?.toFixed(2)} np=${summary.netProfit?.toFixed(2)}`)
    } catch (e) {
      results.push({ month, basis, ok: false, error: e.message })
      failed++
      console.log(` ✗ ${e.message}`)
    }
    // Polite throttle between Xero calls
    await new Promise(r => setTimeout(r, 350))
  }
}

console.log('')
console.log(`=== Re-sync complete: ${succeeded} succeeded, ${failed} failed ===`)

if (failed > 0) {
  console.log('\nFailed runs:')
  for (const r of results.filter(r => !r.ok)) console.log(`  ${r.month} ${r.basis}: ${r.error}`)
  process.exit(1)
}

console.log('\nNext: run `node scripts/meg-end-to-end-reconciliation.js` to verify.')
