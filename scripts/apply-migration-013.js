#!/usr/bin/env node
/**
 * Apply migration 013 — fix RLS policies
 *
 * Runs the SQL via Supabase Management API.
 * Requires a Supabase personal access token (PAT) — NOT the service role key.
 * The service role key is loaded from .env.local to identify the project ref.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration-013.js
 *
 * Get your PAT from: https://supabase.com/dashboard/account/tokens
 *
 * If you don't have a PAT, paste the SQL manually in the Dashboard SQL Editor:
 *   https://supabase.com/dashboard/project/dkjwyzjzdcgrepbgiuei/sql/new
 * SQL file: supabase/migrations/013_fix_rls_policies.sql
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ── Load .env.local (search up from script location) ─────────
function loadEnv() {
  const candidates = [
    path.resolve(__dirname, '..', '.env.local'),
    path.resolve(__dirname, '..', '..', '..', '..', '.env.local'),
    path.resolve(process.cwd(), '.env.local'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return parseEnv(fs.readFileSync(p, 'utf8'), p)
    }
  }
  throw new Error('.env.local not found. Searched:\n  ' + candidates.join('\n  '))
}

function parseEnv(content, filePath) {
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  console.log(`Loaded env from: ${filePath}`)
  return env
}

function projectRef(supabaseUrl) {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!match) throw new Error('Cannot parse project ref from: ' + supabaseUrl)
  return match[1]
}

async function runSql(ref, accessToken, sql) {
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { body: json })
  return json
}

async function main() {
  const env = loadEnv()
  const supabaseUrl    = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const accessToken    = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN

  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL not set in .env.local')

  const ref = projectRef(supabaseUrl)
  console.log(`Project ref: ${ref}`)

  if (!accessToken) {
    console.error('\nSUPABASE_ACCESS_TOKEN not set.')
    console.error('The Supabase Management API requires a personal access token (PAT) —')
    console.error('the project service_role key cannot execute DDL via the REST API.\n')
    console.error('Option 1 — Set your PAT and re-run:')
    console.error('  Get it from: https://supabase.com/dashboard/account/tokens')
    console.error('  SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/apply-migration-013.js\n')
    console.error('Option 2 — Apply via Supabase CLI:')
    console.error('  supabase db push\n')
    console.error('Option 3 — Paste SQL in Dashboard SQL Editor:')
    console.error(`  https://supabase.com/dashboard/project/${ref}/sql/new`)
    console.error('  File: supabase/migrations/013_fix_rls_policies.sql\n')
    process.exit(1)
  }

  const sqlPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '013_fix_rls_policies.sql')
  const sql     = fs.readFileSync(sqlPath, 'utf8')
  console.log(`Loaded SQL: ${sqlPath}`)
  console.log('Applying migration 013_fix_rls_policies...')

  try {
    const result = await runSql(ref, accessToken, sql)
    console.log('Migration applied successfully.')
    if (result && Object.keys(result).length > 0) console.log(JSON.stringify(result, null, 2))
  } catch (err) {
    console.error('\nFailed:', err.message)
    if (err.body) console.error('Response:', JSON.stringify(err.body, null, 2))
    process.exit(1)
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
