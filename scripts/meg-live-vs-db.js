/**
 * scripts/meg-live-vs-db.js
 *
 * Independent verification: query the live Xero API RIGHT NOW and compare to
 * what's currently in the live SkipSync DB. Immune to data-evolution drift —
 * any variance here is a real bug in the sync pipeline.
 *
 * Two indirect Xero fetches (cash + accrual) per requested month, then
 * compares to financials_monthly rows. If the row was synced moments ago,
 * deltas should be 0.00 to the cent.
 *
 * Usage:
 *   node scripts/meg-live-vs-db.js                # Feb 2026 default
 *   node scripts/meg-live-vs-db.js 2025-12        # one month
 *   node scripts/meg-live-vs-db.js --range 2025-07 2026-02
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { fetchProfitAndLoss } from '../api/xero-sync.js'
import { parsePLSections, mapPLToFinancials } from '../api/lib/xero-mapper.js'
import { getValidToken } from '../api/lib/xero-token.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run vercel env pull .env.local.')
  process.exit(2)
}

const argv = process.argv.slice(2)
let months = ['2026-02']
if (argv[0] === '--range') {
  months = []
  const [fy, fm] = argv[1].split('-').map(Number)
  const [ty, tm] = argv[2].split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
} else if (argv[0]) {
  months = [argv[0]]
}

const { accessToken, tenantId } = await getValidToken(SERVICE_KEY)
console.log(`Live Xero ↔ Live DB spot-check across ${months.length} month(s) × cash+accrual`)
console.log(`Tolerance: 0.00 (any variance = real bug, not data drift)\n`)

let pairs = 0
let cleanPairs = 0
const failures = []

for (const month of months) {
  const [y, mo] = month.split('-').map(Number)
  const fromDate = `${month}-01`
  const lastDay = new Date(y, mo, 0).getDate()
  const toDate = `${month}-${String(lastDay).padStart(2, '0')}`

  for (const basis of ['cash', 'accrual']) {
    pairs++
    process.stdout.write(`  ${month} ${basis}...`)

    // Fetch live Xero P&L → run through mapper
    const plReport = await fetchProfitAndLoss(accessToken, tenantId, fromDate, toDate, basis)
    const sections = parsePLSections(plReport)
    const liveMapped = mapPLToFinancials(sections, month)

    // Fetch live DB row
    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/financials_monthly?report_month=eq.${fromDate}&accounting_basis=eq.${basis}&select=*`,
      { headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY } }
    )
    const dbRows = await dbRes.json()
    const dbRow = dbRows[0]

    if (!dbRow) {
      console.log(' ✗ no DB row — re-sync needed')
      failures.push({ month, basis, error: 'no DB row' })
      continue
    }

    const revLive = Number(liveMapped.rev_total.toFixed(2))
    const revDb = Number(parseFloat(dbRow.rev_total).toFixed(2))
    const npLive = Number(liveMapped.net_profit.toFixed(2))
    const npDb = Number(parseFloat(dbRow.net_profit).toFixed(2))
    const revDelta = Math.abs(revLive - revDb)
    const npDelta = Math.abs(npLive - npDb)

    if (revDelta < 0.01 && npDelta < 0.01) {
      console.log(` ✓ rev=$${revLive.toFixed(2)} np=$${npLive.toFixed(2)} (matches DB to the cent)`)
      cleanPairs++
    } else {
      console.log(` ✗ live rev=$${revLive.toFixed(2)} db=$${revDb.toFixed(2)} (Δ$${revDelta.toFixed(2)}); live np=$${npLive.toFixed(2)} db=$${npDb.toFixed(2)} (Δ$${npDelta.toFixed(2)})`)
      failures.push({ month, basis, revLive, revDb, npLive, npDb })
    }
    await new Promise(r => setTimeout(r, 350))
  }
}

console.log(`\n=== ${cleanPairs} of ${pairs} pairs tied to the cent ===`)
if (failures.length === 0) {
  console.log('🟢 SIGN — live Xero ↔ live SkipSync DB reconciles 100% across all queried month-basis pairs.')
  console.log('    The sync pipeline is working correctly today.')
  process.exit(0)
} else {
  console.log('🔴 REFUSE — variances above 1 cent. Real bug, not data drift.')
  for (const f of failures) console.log(`  ${f.month} ${f.basis}: ${JSON.stringify(f)}`)
  process.exit(1)
}
