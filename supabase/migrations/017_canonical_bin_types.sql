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
