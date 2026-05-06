# Supabase Migrations

Schema lives in numbered SQL files in this folder. Apply them in numeric (then alphabetical, where prefixes collide) order via Supabase Dashboard → SQL Editor or `supabase db push`.

## Conventions

- **Filename:** `<NNN>_<short_name>.sql` (e.g. `012_invoice_status.sql`).
- **Numeric prefix MUST be unique** — every new migration takes the next free 3-digit prefix.
- **Idempotent only** — every migration must be safe to re-apply. Use `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ADD COLUMN IF NOT EXISTS`, drop-then-create for triggers, etc.
- **No destructive operations without an explicit reversal note** — if you must drop/rename, document why at the top of the file.
- **Update the matching `src/api/<domain>.js` reader/writer** in the same change set so the data layer and schema move together.

## Existing prefix collisions

Three files share `007_*` (`ar_invoices`, `esg_columns`, `operational_features`) and two each share `009_*` and `010_*`. These are legacy and won't be renamed (renaming a file already applied via Supabase CLI would re-apply it under the new name and confuse the migration tracker). **Do not repeat the pattern** — pick a fresh unique prefix for every new migration.

## Next available prefix

**`012_*`** — files 001 through 011 are taken. Use 012 for the next migration; advance from there.

## Order of application

```
001_initial_schema.sql
002_rls_policies.sql
003_default_thresholds.sql
004_schema_additions.sql
004b_seed_historical_data.sql
005_fleet_tables.sql
006_xero_integration.sql
007_ar_invoices.sql
007_esg_columns.sql
007_operational_features.sql
008_bookings.sql
009_driver_jobcosting.sql
009_invoices.sql
010_customers.sql
010_phase6_audit_team_compliance.sql
011_fleet_status.sql
```

(Within a shared prefix, alphabetical filename order is the application order.)

## Quick checks before committing a new migration

- [ ] Prefix is unique and one greater than the last migration
- [ ] File is idempotent — runs cleanly on a fresh DB AND a DB where it has already been applied
- [ ] Referenced tables exist (or are created in this same file)
- [ ] RLS policies updated if a new table needs them
- [ ] `src/api/<domain>.js` updated to read/write any new columns or tables
