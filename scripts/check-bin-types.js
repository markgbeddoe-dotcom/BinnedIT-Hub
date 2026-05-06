/**
 * scripts/check-bin-types.js
 *
 * Run with: `node scripts/check-bin-types.js`
 * (Shebang removed because Vite/Rolldown can't parse it when this file is
 * imported by the Vitest suite under jsdom.)
 *
 * Operator pre-check helper for Sprint 14 #14A migration.
 *
 * Reads candidate bin_type values from stdin (one per line) OR — if
 * stdin is a TTY (no piped input) — falls back to a hardcoded array
 * of every Bin Manager / Xero SKU we know about. Prints a table:
 *
 *   input → normalized → status (canonical / unmapped)
 *
 * Use this BEFORE applying supabase/migrations/017_canonical_bin_types.sql
 * to spot any rows that the SQL normalizer cannot map. Any row marked
 * "unmapped" will trip the CHECK constraint after the backfill, so
 * fix or update those rows first.
 *
 * Usage:
 *   node scripts/check-bin-types.js
 *     (uses the built-in known-SKU fixture)
 *
 *   psql $DB -At -c "SELECT DISTINCT bin_type FROM bin_type_performance" \
 *     | node scripts/check-bin-types.js
 *     (pipe live values from your DB)
 *
 * Exit code: 0 if every input is canonical or mappable; 1 if any are
 * unmapped (operator action required).
 */

import { normalizeBinType, CANONICAL_BIN_TYPES } from '../src/lib/binTypes.js'

// Hardcoded fixture: every Bin Manager / Xero SKU pulled from
// src/lib/binTypes.test.js plus anything else we have spotted in
// historical exports. Keep aligned with the test file as it grows.
export const KNOWN_SKUS = [
  // WMF (general waste) — Xero
  'WMF - 4m', 'WMF - 4m Heavy', 'WMF - 4m Light',
  'WMF - 6m Heavy', 'WMF - 6m Light',
  'WMF - 8m', 'WMF - 10m', 'WMF - 10M',
  'WMF - 12M', 'WMF - 12m Light',
  'WMF - 16m', 'WMF - 23m',
  // Bin Manager — W- (general waste with account code)
  'W - 4m Heavy (305)', 'W - 6m Heavy (307)', 'W - 8m Light (308)',
  // ASB (asbestos)
  'ASB - 2M', 'ASB - 4m', 'ASB - 6m', 'ASB - 8m',
  'ASB - 10m', 'ASB - 16m', 'ASB - 23m',
  'ASB - 8m (328)', 'ASBESTOS 2M',
  // SOI / S (soil)
  'SOI - 4m FOR JOBS NOT RECYCLING',
  'SOI - 6m FOR JOBS NOT RECYCLING',
  'SOI - 8m FOR JOBS NOT RECYCLING',
  'S - 4m (344)', 'S - 6m (346)', 'S - 8m (348)',
  // GRW (green waste)
  'GRW - 4m GREEN WASTE', 'GRW - 8m GREEN WASTE',
  'GRW - 10m GREEN WASTE', 'GRW - 16m GREEN WASTE',
  // CON / C (concrete)
  'CON - 4m FOR JOBS NOT RECYCLING',
  'CON - 6m FOR JOBS NOT RECYCLING',
  'CON - 8m FOR JOBS NOT RECYCLING',
  'C - 6m (356)',
]

/**
 * Build a result row for a single input.
 * @param {string} input
 * @returns {{ input: string, normalized: string|null, status: 'canonical'|'unmapped' }}
 */
export function checkBinType(input) {
  const normalized = normalizeBinType(input)
  const status = normalized && CANONICAL_BIN_TYPES.includes(normalized)
    ? 'canonical'
    : 'unmapped'
  return { input, normalized, status }
}

/**
 * Format an array of result rows as a fixed-width table string.
 * Pure function (no I/O) so we can unit-test it.
 * @param {Array<{input:string,normalized:string|null,status:string}>} rows
 * @returns {string}
 */
export function formatTable(rows) {
  if (!rows.length) return '(no input)\n'
  const headers = ['input', 'normalized', 'status']
  const cells = rows.map(r => [
    r.input,
    r.normalized ?? '(null)',
    r.status,
  ])
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...cells.map(row => String(row[i]).length))
  )
  const pad = (s, w) => String(s).padEnd(w)
  const sep = widths.map(w => '─'.repeat(w)).join('─┼─')
  const lines = [
    headers.map((h, i) => pad(h, widths[i])).join(' │ '),
    sep,
    ...cells.map(row => row.map((c, i) => pad(c, widths[i])).join(' │ ')),
  ]
  return lines.join('\n') + '\n'
}

/**
 * Read all stdin into a string. Returns '' if stdin is a TTY (no pipe).
 */
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('')
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}

async function main() {
  const stdin = await readStdin()
  const fromStdin = stdin
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
  const inputs = fromStdin.length ? fromStdin : KNOWN_SKUS
  const rows   = inputs.map(checkBinType)
  process.stdout.write(formatTable(rows))

  const unmapped = rows.filter(r => r.status === 'unmapped')
  if (unmapped.length) {
    process.stderr.write(`\n${unmapped.length} unmapped value(s) — fix before applying migration 017.\n`)
    process.exit(1)
  }
  process.stdout.write(`\nAll ${rows.length} value(s) map to canonical names — safe to apply migration 017.\n`)
}

// Only run main when invoked directly (not when imported by the test).
// Heuristic: argv[1] ends with this filename. Avoids `import 'node:url'`
// which Vite/Rolldown can't resolve when bundling tests for jsdom.
const isDirectRun = typeof process !== 'undefined' &&
  process.argv?.[1] &&
  /[\\/]check-bin-types\.js$/.test(process.argv[1])
if (isDirectRun) {
  main().catch(err => {
    process.stderr.write(`Fatal: ${err.message}\n`)
    process.exit(2)
  })
}
