-- ============================================================
-- Migration 033: seed representative fleet_assets (2026-06-12)
-- ============================================================
-- Assessment P0 (multiple personas): fleet_assets is EMPTY in production,
-- so the dispatch truck dropdown only ever offered "— None —" and the
-- Trucks & Bins / Fleet pages had no real data. PRD G5 declared
-- fleet_assets "a usable truck roster" as a grounding fact — it never was.
--
-- These are PLACEHOLDER assets so the truck-assignment journey (J3/J4) and
-- the Fleet UI work end-to-end. Mark MUST replace identifiers/regos with
-- the real Binned-IT fleet — same convention as the placeholder tip rates.
--
-- Idempotent: ON CONFLICT (identifier) — but the table has no unique on
-- identifier, so guard with NOT EXISTS instead.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.fleet_assets WHERE asset_type='truck') THEN
    INSERT INTO public.fleet_assets (asset_type, identifier, description, registration, is_active, notes) VALUES
      ('truck', 'SS-01', 'Hook-lift truck (8t)',  '1AB2CD', true, 'PLACEHOLDER — Mark to replace with real rego/details'),
      ('truck', 'SS-02', 'Hook-lift truck (10t)', '1EF3GH', true, 'PLACEHOLDER — Mark to replace with real rego/details'),
      ('truck', 'SS-03', 'Tipper truck (6t)',     '1IJ4KL', true, 'PLACEHOLDER — Mark to replace with real rego/details');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fleet_assets WHERE asset_type='bin') THEN
    INSERT INTO public.fleet_assets (asset_type, identifier, description, is_active, notes) VALUES
      ('bin', 'BIN-4M-01',  '4m³ skip bin',  true, 'PLACEHOLDER — seed roster'),
      ('bin', 'BIN-4M-02',  '4m³ skip bin',  true, 'PLACEHOLDER — seed roster'),
      ('bin', 'BIN-6M-01',  '6m³ skip bin',  true, 'PLACEHOLDER — seed roster'),
      ('bin', 'BIN-6M-02',  '6m³ skip bin',  true, 'PLACEHOLDER — seed roster'),
      ('bin', 'BIN-8M-01',  '8m³ skip bin',  true, 'PLACEHOLDER — seed roster'),
      ('bin', 'BIN-10M-01', '10m³ skip bin', true, 'PLACEHOLDER — seed roster');
  END IF;
END $$;
