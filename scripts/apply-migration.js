/**
 * scripts/apply-migration.js
 *
 * SkipSync migration runner. Applies SQL files from supabase/migrations/
 * to the live Supabase project via the Supabase Management API
 * (https://api.supabase.com/v1/projects/{ref}/database/query) authenticated
 * with a Personal Access Token stored in .env.local as SUPABASE_ACCESS_TOKEN.
 *
 * Idempotency:
 *   - Tracks applied migrations in `public._skipsync_migrations` (filename + sha256
 *     + applied_at + applied_by). Bootstraps that table on first run.
 *   - A migration is skipped if its filename is already in the audit table AND its
 *     sha256 matches the recorded hash. If the file changed since it was last applied,
 *     the runner FLAGS it (refuses to silently re-apply) and asks for an explicit flag.
 *
 * Usage:
 *   node scripts/apply-migration.js                        # apply all pending
 *   node scripts/apply-migration.js 020                    # apply just 020_*
 *   node scripts/apply-migration.js 020_accounting_basis   # explicit name match
 *   node scripts/apply-migration.js --dry-run 020          # print SQL, don't execute
 *   node scripts/apply-migration.js --list                 # show applied/pending status
 *   node scripts/apply-migration.js --force 020            # re-apply even if hash differs
 *
 * Exit codes:
 *   0 — all requested migrations applied (or dry-run completed)
 *   1 — at least one migration failed
 *   2 — config error (missing env, bad args, etc.)
 *
 * Audit log: every successful apply is appended to docs/audits/migration-log.md.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const PROJECT_REF = 'dkjwyzjzdcgrepbgiuei'
const MANAGEMENT_API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`
const MIGRATIONS_DIR = 'supabase/migrations'
const AUDIT_LOG = 'docs/audits/migration-log.md'
const AUDIT_TABLE = 'public._skipsync_migrations'

const PAT = process.env.SUPABASE_ACCESS_TOKEN
if (!PAT) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in .env.local. Run: vercel env pull .env.local')
  process.exit(2)
}
if (!PAT.startsWith('sbp_')) {
  console.error('SUPABASE_ACCESS_TOKEN does not start with sbp_ — is this the correct token type?')
  process.exit(2)
}

// ── Management API helper ───────────────────────────────────────────────

async function runSql(query, { silent = false } = {}) {
  const res = await fetch(MANAGEMENT_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })
  const text = await res.text()
  let parsed
  try { parsed = JSON.parse(text) } catch { parsed = text }
  if (!res.ok) {
    const err = new Error(`Supabase Management API ${res.status}`)
    err.detail = parsed
    throw err
  }
  if (!silent) console.log(`  ✓ executed (${query.length} chars)`)
  return parsed
}

// ── Audit-table bootstrap + queries ─────────────────────────────────────

async function ensureAuditTable() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
      filename     text PRIMARY KEY,
      sha256       text NOT NULL,
      applied_at   timestamptz NOT NULL DEFAULT now(),
      applied_by   text,
      duration_ms  integer,
      notes        text
    );
  `, { silent: true })
}

async function appliedMigrationMap() {
  const rows = await runSql(`SELECT filename, sha256, applied_at FROM ${AUDIT_TABLE} ORDER BY filename;`, { silent: true })
  const map = new Map()
  for (const r of (rows || [])) map.set(r.filename, r)
  return map
}

async function recordApplied(filename, sha256, durationMs, notes) {
  // Use UPSERT so re-applies (with --force) overwrite the prior record
  const sqlSafe = (s) => String(s).replace(/'/g, "''")
  await runSql(`
    INSERT INTO ${AUDIT_TABLE} (filename, sha256, applied_at, applied_by, duration_ms, notes)
    VALUES ('${sqlSafe(filename)}', '${sha256}', now(), 'apply-migration.js', ${durationMs}, '${sqlSafe(notes || '')}')
    ON CONFLICT (filename) DO UPDATE
      SET sha256 = EXCLUDED.sha256, applied_at = EXCLUDED.applied_at,
          applied_by = EXCLUDED.applied_by, duration_ms = EXCLUDED.duration_ms,
          notes = EXCLUDED.notes;
  `, { silent: true })
}

// ── Migration discovery ─────────────────────────────────────────────────

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR)
  return files
    .filter(f => /^\d.*\.sql$/i.test(f))
    .sort()
}

async function loadMigration(filename) {
  const content = await fs.readFile(path.join(MIGRATIONS_DIR, filename), 'utf8')
  return { filename, content, sha256: sha256(content) }
}

// ── Audit-log markdown append ───────────────────────────────────────────

async function appendAuditLog(entries) {
  const exists = await fs.access(AUDIT_LOG).then(() => true).catch(() => false)
  let body = ''
  if (!exists) {
    body += '# SkipSync — migration application log\n\n'
    body += 'Append-only history of every migration applied via `scripts/apply-migration.js`.\n'
    body += 'Sourced from the `_skipsync_migrations` audit table at apply time.\n\n'
  }
  for (const e of entries) {
    body += `## ${e.applied_at} — ${e.filename}\n`
    body += `- sha256: \`${e.sha256}\`\n`
    body += `- duration: ${e.duration_ms} ms\n`
    if (e.notes) body += `- notes: ${e.notes}\n`
    body += '\n'
  }
  await fs.appendFile(AUDIT_LOG, body)
}

// ── Main ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const argv = process.argv.slice(2)
const flags = {
  dryRun: argv.includes('--dry-run'),
  list: argv.includes('--list'),
  force: argv.includes('--force'),
  all: argv.includes('--all-pending') || argv.length === 0 || (argv.length === 1 && argv[0] === '--all-pending'),
}
const targetArg = argv.filter(a => !a.startsWith('--')).pop() || null

async function main() {
  console.log(`SkipSync migration runner — Supabase project ${PROJECT_REF}\n`)
  await ensureAuditTable()
  const applied = await appliedMigrationMap()
  const allFiles = await listMigrationFiles()

  // Resolve target list
  let targets = []
  if (flags.list || (!targetArg && flags.all)) {
    if (flags.list) {
      console.log('All migrations and their status:')
      for (const f of allFiles) {
        const a = applied.get(f)
        const status = a ? `✓ applied ${a.applied_at.slice(0, 19)}` : '○ pending'
        console.log(`  ${f.padEnd(50)} ${status}`)
      }
      console.log('')
      if (flags.list) return
    }
    targets = allFiles.filter(f => !applied.has(f))
    console.log(`${targets.length} pending migration(s) to apply.\n`)
  } else if (targetArg) {
    const matches = allFiles.filter(f => f.includes(targetArg))
    if (matches.length === 0) {
      console.error(`No migration file matches "${targetArg}"`)
      process.exit(2)
    }
    targets = matches
  }

  if (targets.length === 0) {
    console.log('Nothing to apply.')
    return
  }

  const successes = []
  for (const filename of targets) {
    const m = await loadMigration(filename)
    const prior = applied.get(filename)
    if (prior && prior.sha256 === m.sha256 && !flags.force) {
      console.log(`→ ${filename}: SKIP (already applied with matching sha256)`)
      continue
    }
    if (prior && prior.sha256 !== m.sha256 && !flags.force) {
      console.error(`→ ${filename}: REFUSE — file was modified after prior apply.`)
      console.error(`    Prior hash: ${prior.sha256}`)
      console.error(`    Current:    ${m.sha256}`)
      console.error('    Re-apply with --force if intentional.')
      process.exit(1)
    }

    if (flags.dryRun) {
      console.log(`→ ${filename}: DRY-RUN`)
      console.log('--- SQL ---')
      console.log(m.content)
      console.log('--- end ---\n')
      continue
    }

    console.log(`→ ${filename}: applying...`)
    const t0 = Date.now()
    try {
      await runSql(m.content)
      const duration = Date.now() - t0
      const notes = prior ? 'Re-applied (--force)' : ''
      await recordApplied(filename, m.sha256, duration, notes)
      successes.push({
        filename, sha256: m.sha256, duration_ms: duration, notes,
        applied_at: new Date().toISOString(),
      })
      console.log(`  ✓ ${filename} applied in ${duration} ms\n`)
    } catch (e) {
      console.error(`  ✗ ${filename} FAILED:`, e.message)
      if (e.detail) console.error('    Detail:', JSON.stringify(e.detail).slice(0, 500))
      process.exit(1)
    }
  }

  if (successes.length > 0) {
    await appendAuditLog(successes)
    console.log(`\nApplied ${successes.length} migration(s). Audit log: ${AUDIT_LOG}`)
  }
}

main().catch(err => {
  console.error('Fatal:', err.message)
  if (err.detail) console.error(JSON.stringify(err.detail).slice(0, 500))
  process.exit(1)
})
