/**
 * scripts/precheck-live-bintypes.js
 *
 * Queries every distinct bin_type value from the LIVE Supabase project
 * (bin_type_performance + competitor_rates) and runs them through the JS
 * normalizer. If any are unmappable, the operator must fix or remap them
 * BEFORE applying migration 017_canonical_bin_types.sql — otherwise the
 * CHECK constraint would reject those rows and roll back.
 *
 * Usage (env vars must be present in .env.local — pull via `vercel env pull`):
 *   node scripts/precheck-live-bintypes.js
 *
 * Exit code: 0 if all live bin_type values are canonical-mappable, 1 otherwise.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { normalizeBinType, CANONICAL_BIN_TYPES } from '../src/lib/binTypes.js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Run: vercel env pull .env.local')
  process.exit(2)
}

async function distinctBinTypes(table) {
  // PostgREST: use ?select=bin_type to fetch all rows; we'll dedupe in JS
  // (PostgREST doesn't support DISTINCT directly; for small tables this is fine)
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=bin_type&limit=10000`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
  })
  if (!res.ok) throw new Error(`Failed to query ${table}: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  const set = new Set(rows.map(r => r.bin_type).filter(Boolean))
  return [...set].sort()
}

async function main() {
  console.log('Querying LIVE Supabase for distinct bin_type values...\n')

  const tables = ['bin_type_performance', 'competitor_rates']
  const report = []

  for (const table of tables) {
    let values
    try {
      values = await distinctBinTypes(table)
    } catch (e) {
      console.error(`Error querying ${table}: ${e.message}`)
      continue
    }
    console.log(`\n=== ${table} (${values.length} distinct value(s)) ===`)
    if (values.length === 0) {
      console.log('  (table empty — migration 017 will apply trivially)')
      continue
    }
    for (const v of values) {
      const normalized = normalizeBinType(v)
      const canonical = normalized && CANONICAL_BIN_TYPES.includes(normalized)
      const status = canonical ? 'CANONICAL' : 'UNMAPPED ⚠'
      const display = `  ${v.padEnd(40)} → ${(normalized ?? '(null)').padEnd(20)} ${status}`
      console.log(display)
      report.push({ table, value: v, normalized, canonical })
    }
  }

  const unmapped = report.filter(r => !r.canonical)
  console.log(`\n\n${'='.repeat(70)}`)
  if (unmapped.length === 0) {
    console.log(`✓ ALL ${report.length} live bin_type value(s) map to canonical names.`)
    console.log('  Safe to apply supabase/migrations/017_canonical_bin_types.sql.')
    process.exit(0)
  } else {
    console.log(`⚠ ${unmapped.length} of ${report.length} live bin_type value(s) cannot be mapped to canonical.`)
    console.log('  These would trip the CHECK constraint in migration 017. Fix BEFORE applying:')
    for (const r of unmapped) {
      console.log(`    UPDATE ${r.table} SET bin_type = '<canonical>' WHERE bin_type = '${r.value}';`)
    }
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(2)
})
