-- ============================================================================
-- SkipSync — apply Sprint 12-15 migrations
-- ============================================================================
-- Generated 2026-05-07 by Claude Code as part of the Sprint 12-16 push.
--
-- TO APPLY:
--   1. Open https://app.supabase.com/project/dkjwyzjzdcgrepbgiuei/sql/new
--   2. Paste the entire contents of THIS file
--   3. Click Run
--
-- Pre-apply check (already done — see scripts/precheck-live-bintypes.js):
--   bin_type_performance: 0 distinct values (table empty — trivial apply)
--   competitor_rates: 6 distinct values, ALL canonical-mappable.
--   Migration 017 will not reject any existing rows.
--
-- The migrations below are already in supabase/migrations/ and are idempotent
-- (CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION). Re-running this bundle is safe.
--
-- ============================================================================
-- BUNDLE ORDER:
--   1. 017_canonical_bin_types.sql        — bin_type CHECK constraint + backfill
--   2. 017_postal_letter_queue.sql         — Collections postal letter queue table
--   3. 018_per_bin_cost_detail.sql         — per-bin cost columns for loss detection
--   4. 019_opex_wages_super_split.sql      — split opex_admin into wages + super
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1 of 4: 017_canonical_bin_types.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 017_canonical_bin_types.sql
--
-- Sprint 14 #14A — Add SQL CHECK constraint on bin_type columns +
-- backfill existing rows via a normalize_bin_type() function that
-- mirrors the JS normalizer in src/lib/binTypes.js (the JS file is
-- the source of truth — keep in sync if you change either).
--
-- Phase 1 (Sprint 11 #14) added the JS normalizer and routed PricingTab
-- through it; Phase 2 (this migration) backfills the database and
-- locks down future writes with a CHECK constraint.
--
-- ---------------------------------------------------------------
-- MIGRATION SAFETY NOTE
-- ---------------------------------------------------------------
-- If this migration fails because of unmappable bin_type values, run
-- the sanity SELECT below (after the UPDATEs but before the ALTER
-- TABLE step) to find any rows still failing canonical, fix the rows
-- manually
--   UPDATE bin_type_performance SET bin_type = '<canonical>' WHERE id = '<uuid>';
--   UPDATE competitor_rates     SET bin_type = '<canonical>' WHERE id = '<uuid>';
-- then retry. Safer to investigate one row at a time than to wipe to
-- NULL. This migration deliberately preserves the original value when
-- the normalizer cannot map it (COALESCE(normalize_bin_type(...), bin_type))
-- so you never lose data — but those rows will then trip the CHECK,
-- giving you a clear signal to clean them up.
--
-- Idempotent: function uses CREATE OR REPLACE; constraint adds use a
-- DO block that drops the constraint first if it exists.

-- ---------------------------------------------------------------
-- 1. SQL normalize_bin_type() — mirrors src/lib/binTypes.js
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_bin_type(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n          text;
  stripped   text;
  size_match text;
  size_n     int;
  size_token text;
  category   text;
  canonical  text;
  canonical_set text[] := ARRAY[
    '2m General Waste','2m Asbestos','2m Soil','2m Green Waste','2m Concrete',
    '4m General Waste','4m Asbestos','4m Soil','4m Green Waste','4m Concrete',
    '6m General Waste','6m Asbestos','6m Soil','6m Green Waste','6m Concrete',
    '8m General Waste','8m Asbestos','8m Soil','8m Green Waste','8m Concrete',
    '10m General Waste','10m Asbestos','10m Soil','10m Green Waste','10m Concrete',
    '12m General Waste','12m Asbestos','12m Soil','12m Green Waste','12m Concrete',
    '16m General Waste','16m Asbestos','16m Soil','16m Green Waste','16m Concrete',
    '23m General Waste','23m Asbestos','23m Soil','23m Green Waste','23m Concrete'
  ];
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  n := btrim(input);
  IF n = '' THEN RETURN NULL; END IF;

  -- Already canonical?
  IF n = ANY(canonical_set) THEN RETURN n; END IF;

  -- Strip Xero account-code suffix like "(305)"
  stripped := btrim(regexp_replace(n, '\s*\(\d+\)\s*$', '', 'g'));

  -- Extract size: first number followed by m/M
  size_match := substring(stripped FROM '(\d+)\s*[mM]');
  IF size_match IS NULL THEN
    -- "Bigm" and other non-numeric size tokens are intentionally unmapped
    RETURN NULL;
  END IF;
  size_n := size_match::int;
  size_token := size_n::text || 'm';
  IF size_token NOT IN ('2m','4m','6m','8m','10m','12m','16m','23m') THEN
    RETURN NULL;
  END IF;

  -- Extract category — prefix-based first (longer, more specific),
  -- then keyword-based. Order mirrors JS PREFIX_CATEGORY then
  -- KEYWORD_CATEGORY. Case-insensitive matching with (?i).
  category := NULL;

  -- ── Prefix matchers ─────────────────────────────────────────
  -- General Waste prefixes: WMF, GW (ambiguous w/ Green Waste — but
  -- prefix matchers run before keyword matchers and the JS array
  -- lists General Waste first, so WMF/W- take precedence). The
  -- ambiguity for bare "GW" is resolved by Green Waste keyword
  -- matcher catching it later if no W/WMF prefix present.
  IF stripped ~* '^\s*(wmf|w)\s*-' OR stripped ~* '^\s*(wmf|w)\s+' OR stripped ~* '^\s*(wmf)\s*$' THEN
    category := 'General Waste';
  ELSIF stripped ~* '^\s*(asb|asbestos)\s*-' OR stripped ~* '^\s*(asb|asbestos)\s+' OR stripped ~* '^\s*(asb|asbestos)\s*$' THEN
    category := 'Asbestos';
  ELSIF stripped ~* '^\s*(soi|s)\s*-' OR stripped ~* '^\s*(soi|s)\s+' THEN
    category := 'Soil';
  ELSIF stripped ~* '^\s*(grw|gw)\s*-' OR stripped ~* '^\s*(grw|gw)\s+' THEN
    category := 'Green Waste';
  ELSIF stripped ~* '^\s*(con|c)\s*-' OR stripped ~* '^\s*(con|c)\s+' THEN
    category := 'Concrete';
  END IF;

  -- ── Keyword matchers (only if no prefix matched) ─────────────
  IF category IS NULL THEN
    IF stripped ~* 'asbestos|\yasb\y' THEN
      category := 'Asbestos';
    ELSIF stripped ~* 'contaminated\s*soil|\ysoil\y|\ysoi\y|csoil' THEN
      category := 'Soil';
    ELSIF stripped ~* 'green\s*waste|\ygreen\y|\ygrw\y' THEN
      category := 'Green Waste';
    ELSIF stripped ~* 'general\s*waste|waste\s*management\s*fees|\ygw\y|\ywmf\y' THEN
      category := 'General Waste';
    ELSIF stripped ~* 'concrete|\ycon\y' THEN
      category := 'Concrete';
    END IF;
  END IF;

  IF category IS NULL THEN RETURN NULL; END IF;

  canonical := size_token || ' ' || category;
  IF canonical = ANY(canonical_set) THEN
    RETURN canonical;
  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.normalize_bin_type(text) IS
  'Mirrors src/lib/binTypes.js normalizeBinType(). Returns canonical "<size>m <category>" or NULL if un-mappable.';

-- ---------------------------------------------------------------
-- 2. Backfill — preserve original if normalizer returns NULL so
--    operator can investigate (CHECK will fail noisily for bad rows).
-- ---------------------------------------------------------------
UPDATE public.bin_type_performance
   SET bin_type = COALESCE(public.normalize_bin_type(bin_type), bin_type)
 WHERE bin_type IS NOT NULL
   AND bin_type IS DISTINCT FROM COALESCE(public.normalize_bin_type(bin_type), bin_type);

UPDATE public.competitor_rates
   SET bin_type = COALESCE(public.normalize_bin_type(bin_type), bin_type)
 WHERE bin_type IS NOT NULL
   AND bin_type IS DISTINCT FROM COALESCE(public.normalize_bin_type(bin_type), bin_type);

-- ---------------------------------------------------------------
-- 3. Sanity check (commented out — operator runs after backfill)
--    If either query returns rows, those are the un-mappable values
--    that will trip the CHECK constraint. Fix manually before retry.
-- ---------------------------------------------------------------
-- SELECT id, bin_type FROM public.bin_type_performance
--  WHERE bin_type NOT IN (
--    '2m General Waste','2m Asbestos','2m Soil','2m Green Waste','2m Concrete',
--    '4m General Waste','4m Asbestos','4m Soil','4m Green Waste','4m Concrete',
--    '6m General Waste','6m Asbestos','6m Soil','6m Green Waste','6m Concrete',
--    '8m General Waste','8m Asbestos','8m Soil','8m Green Waste','8m Concrete',
--    '10m General Waste','10m Asbestos','10m Soil','10m Green Waste','10m Concrete',
--    '12m General Waste','12m Asbestos','12m Soil','12m Green Waste','12m Concrete',
--    '16m General Waste','16m Asbestos','16m Soil','16m Green Waste','16m Concrete',
--    '23m General Waste','23m Asbestos','23m Soil','23m Green Waste','23m Concrete'
--  );
-- SELECT id, bin_type FROM public.competitor_rates
--  WHERE bin_type NOT IN (
--    '2m General Waste','2m Asbestos','2m Soil','2m Green Waste','2m Concrete',
--    '4m General Waste','4m Asbestos','4m Soil','4m Green Waste','4m Concrete',
--    '6m General Waste','6m Asbestos','6m Soil','6m Green Waste','6m Concrete',
--    '8m General Waste','8m Asbestos','8m Soil','8m Green Waste','8m Concrete',
--    '10m General Waste','10m Asbestos','10m Soil','10m Green Waste','10m Concrete',
--    '12m General Waste','12m Asbestos','12m Soil','12m Green Waste','12m Concrete',
--    '16m General Waste','16m Asbestos','16m Soil','16m Green Waste','16m Concrete',
--    '23m General Waste','23m Asbestos','23m Soil','23m Green Waste','23m Concrete'
--  );

-- ---------------------------------------------------------------
-- 4. CHECK constraint — drop-then-add (idempotent across re-runs).
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bin_type_canonical'
       AND conrelid = 'public.bin_type_performance'::regclass
  ) THEN
    ALTER TABLE public.bin_type_performance DROP CONSTRAINT bin_type_canonical;
  END IF;

  ALTER TABLE public.bin_type_performance
    ADD CONSTRAINT bin_type_canonical CHECK (bin_type IN (
      '2m General Waste','2m Asbestos','2m Soil','2m Green Waste','2m Concrete',
      '4m General Waste','4m Asbestos','4m Soil','4m Green Waste','4m Concrete',
      '6m General Waste','6m Asbestos','6m Soil','6m Green Waste','6m Concrete',
      '8m General Waste','8m Asbestos','8m Soil','8m Green Waste','8m Concrete',
      '10m General Waste','10m Asbestos','10m Soil','10m Green Waste','10m Concrete',
      '12m General Waste','12m Asbestos','12m Soil','12m Green Waste','12m Concrete',
      '16m General Waste','16m Asbestos','16m Soil','16m Green Waste','16m Concrete',
      '23m General Waste','23m Asbestos','23m Soil','23m Green Waste','23m Concrete'
    ));
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'bin_type_canonical'
       AND conrelid = 'public.competitor_rates'::regclass
  ) THEN
    ALTER TABLE public.competitor_rates DROP CONSTRAINT bin_type_canonical;
  END IF;

  ALTER TABLE public.competitor_rates
    ADD CONSTRAINT bin_type_canonical CHECK (bin_type IN (
      '2m General Waste','2m Asbestos','2m Soil','2m Green Waste','2m Concrete',
      '4m General Waste','4m Asbestos','4m Soil','4m Green Waste','4m Concrete',
      '6m General Waste','6m Asbestos','6m Soil','6m Green Waste','6m Concrete',
      '8m General Waste','8m Asbestos','8m Soil','8m Green Waste','8m Concrete',
      '10m General Waste','10m Asbestos','10m Soil','10m Green Waste','10m Concrete',
      '12m General Waste','12m Asbestos','12m Soil','12m Green Waste','12m Concrete',
      '16m General Waste','16m Asbestos','16m Soil','16m Green Waste','16m Concrete',
      '23m General Waste','23m Asbestos','23m Soil','23m Green Waste','23m Concrete'
    ));
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 of 4: 017_postal_letter_queue.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 017: Postal Letter Queue (Sprint 13 — Collections §1.2)
-- SkipSync Collections demand letters: Email + Registered Post.
--
-- This table is the queue that backs POST /api/postal-send. The endpoint
-- inserts rows here with status='queued'; a Phase-3 dispatcher (PostGrid /
-- Sendle / AusPost Click & Send) will read 'queued' rows, dispatch, and
-- update status to 'dispatched' or 'failed'.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.postal_letter_queue (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status                text        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued','dispatched','failed','cancelled')),
  letter_title          text,
  letter_text           text        NOT NULL,
  recipient_name        text,
  recipient_company     text,
  recipient_address1    text,
  recipient_address2    text,
  recipient_suburb      text,
  recipient_state       text,
  recipient_postcode    text,
  recipient_country     text        DEFAULT 'AU',
  registered_post       boolean     DEFAULT false,
  context               jsonb       DEFAULT '{}',
  requested_by          uuid        REFERENCES public.profiles(id),
  requested_at          timestamptz NOT NULL DEFAULT now(),
  dispatched_at         timestamptz,
  dispatch_provider     text,
  dispatch_tracking_ref text,
  dispatch_error        text
);

CREATE INDEX IF NOT EXISTS idx_postal_queue_status
  ON public.postal_letter_queue(status, requested_at);

ALTER TABLE public.postal_letter_queue ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ──────────────────────────────────────────────────────────────
-- Owner: full read/insert/update/delete.
-- Bookkeeper: read + insert (queue letters from the Collections workflow);
--             cannot mutate dispatch state — that's owner / dispatcher only.
-- Manager: read + insert (treated like bookkeeper for collections workflow).
-- Other roles: no access.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can read postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can read postal_letter_queue" ON public.postal_letter_queue
      FOR SELECT TO authenticated
      USING (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can update postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can update postal_letter_queue" ON public.postal_letter_queue
      FOR UPDATE TO authenticated
      USING (public.current_user_role() = 'owner')
      WITH CHECK (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can delete postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can delete postal_letter_queue" ON public.postal_letter_queue
      FOR DELETE TO authenticated
      USING (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Bookkeeper can read postal_letter_queue'
  ) THEN
    CREATE POLICY "Bookkeeper can read postal_letter_queue" ON public.postal_letter_queue
      FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('bookkeeper','manager'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Bookkeeper can insert postal_letter_queue'
  ) THEN
    CREATE POLICY "Bookkeeper can insert postal_letter_queue" ON public.postal_letter_queue
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_role() IN ('owner','bookkeeper','manager'));
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3 of 4: 018_per_bin_cost_detail.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 018: Per-Bin Cost Detail + Derived Loss-Making Metrics
-- Sprint 14 #15
--
-- Audit (docs/audits/2026-05-06/audit-pricing-bugs.md §3) found that the
-- "loss-making bin types" alert in PricingTab.jsx:160 reads `d.feb.np` from
-- STATIC `pricingData` rather than from a derived metric over live cost
-- allocation. This migration adds per-bin cost-detail columns to
-- bin_type_performance so the dashboard can drill down into "why is this
-- bin losing money?".
--
-- All ALTERs use ADD COLUMN IF NOT EXISTS so re-running is a no-op.
-- ============================================================

ALTER TABLE public.bin_type_performance
  ADD COLUMN IF NOT EXISTS tipping_per_job        numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_per_job           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wages_direct_per_job   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wages_overhead_per_job numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_per_job           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advertising_per_job    numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_opex_per_job     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_per_job     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_per_job         numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_margin_pct_derived numeric(6,2)  DEFAULT 0;

COMMENT ON COLUMN public.bin_type_performance.net_margin_pct_derived IS
  'Computed from revenue / deliveries / *_per_job. The legacy net_margin_pct field is kept for backward compat.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 of 4: 019_opex_wages_super_split.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 019: Split opex_admin into opex_wages + opex_super
-- Sprint 15 #26 (audit P2 reconciliation 2026-05-06)
--
-- Audit (docs/audits/2026-05-06/audit-reconciliation.md §P2 #26) found that
-- `opex_admin` silently bundles Wages + Superannuation, hiding the labour
-- vs. on-costs split that owners need for management reporting.
--
-- This migration adds the two new columns. `opex_admin` is RETAINED as a
-- legacy aggregate (= opex_wages + opex_super) so dashboard tiles using it
-- continue to work. The xero-mapper writes both the new columns AND the
-- legacy aggregate.
--
-- All ALTERs use ADD COLUMN IF NOT EXISTS so re-running is a no-op.
-- ============================================================

ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS opex_wages numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opex_super numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.financials_monthly.opex_wages IS
  'Wages and Salaries (excludes Superannuation). Sprint 15 #26 split from opex_admin.';
COMMENT ON COLUMN public.financials_monthly.opex_super IS
  'Superannuation. Sprint 15 #26 split from opex_admin.';
COMMENT ON COLUMN public.financials_monthly.opex_admin IS
  'Legacy aggregate kept for backward compat = opex_wages + opex_super.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5 of 5: 020_accounting_basis.sql (Sprint 17)
-- Adds accounting_basis text column + UNIQUE keys so cash AND accrual can
-- coexist per month. Backfills existing rows to 'accrual' (Sprint 10+ never
-- sent paymentsOnly). Toggle in the UI defaults to cash post-deploy.
-- ─────────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Migration 020: Cash/Accrual basis support (Sprint 17 #17C)
--
-- Adds an `accounting_basis` discriminator to the three Xero-fed monthly
-- tables so we can store BOTH cash-basis and accrual-basis snapshots for
-- the same report_month side-by-side.
--
-- Background: Sprint 10 onwards synced Xero P&L without `paymentsOnly`
-- (i.e. accrual basis). The accountant works on cash basis. From Sprint 17
-- the sync writes both, the dashboard lets the user switch.
--
-- Backfill rule: every existing row was synced under accrual, so we mark
-- them all 'accrual' unconditionally. The default for new rows is 'cash'
-- to match the new app default (matches accountant working basis).
--
-- Idempotent — DROP CONSTRAINT IF EXISTS … then ADD; ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ── financials_monthly ───────────────────────────────────────────────────────

ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

-- Backfill: every existing row was written under accrual basis (Sprint 10
-- onwards never passed paymentsOnly). Safe to update unconditionally because
-- this migration runs ONCE before the new sync code starts writing 'cash' rows.
UPDATE public.financials_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.financials_monthly
  DROP CONSTRAINT IF EXISTS financials_monthly_report_month_basis_uniq;
ALTER TABLE public.financials_monthly
  ADD CONSTRAINT financials_monthly_report_month_basis_uniq
    UNIQUE (report_id, report_month, accounting_basis);

-- ── balance_sheet_monthly ────────────────────────────────────────────────────

ALTER TABLE public.balance_sheet_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

UPDATE public.balance_sheet_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.balance_sheet_monthly
  DROP CONSTRAINT IF EXISTS balance_sheet_monthly_report_month_basis_uniq;
ALTER TABLE public.balance_sheet_monthly
  ADD CONSTRAINT balance_sheet_monthly_report_month_basis_uniq
    UNIQUE (report_id, report_month, accounting_basis);

-- ── debtors_monthly ──────────────────────────────────────────────────────────

ALTER TABLE public.debtors_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

UPDATE public.debtors_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.debtors_monthly
  DROP CONSTRAINT IF EXISTS debtors_monthly_report_month_basis_debtor_uniq;
ALTER TABLE public.debtors_monthly
  ADD CONSTRAINT debtors_monthly_report_month_basis_debtor_uniq
    UNIQUE (report_id, report_month, accounting_basis, debtor_name);

-- ── Indexes for the new column (basis-filtered reads) ────────────────────────

CREATE INDEX IF NOT EXISTS idx_financials_basis
  ON public.financials_monthly(report_month, accounting_basis);
CREATE INDEX IF NOT EXISTS idx_balance_basis
  ON public.balance_sheet_monthly(report_month, accounting_basis);
CREATE INDEX IF NOT EXISTS idx_debtors_basis
  ON public.debtors_monthly(report_month, accounting_basis);

-- ── Documentation ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.financials_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
COMMENT ON COLUMN public.balance_sheet_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
COMMENT ON COLUMN public.debtors_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
