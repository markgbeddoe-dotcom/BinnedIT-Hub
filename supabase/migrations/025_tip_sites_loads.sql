-- ============================================================
-- Migration 025: Tip Sites + Truck Loads (WP-E)
-- ============================================================
-- R4 / FR7.4.1-FR7.4.2 / ADR-703 — load-on-truck tracking and the
-- tip-vs-return decision engine's reference data.
--
--   tip_sites   : candidate disposal/transfer facilities with
--                 per-waste-type gate rates and recycling credits.
--                 ALL SEEDED RATES/HOURS ARE PLACEHOLDERS flagged
--                 in the notes column — Mark must verify before
--                 any tip decision is trusted (ADR-708 risk #3).
--   truck_loads : one row per load picked up; closed out by
--                 tipped_at / tip_site_id / recycled.
--
-- Idempotent: safe to re-run. RLS on both tables.
-- ============================================================

-- ─── 1. tip_sites ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tip_sites (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL UNIQUE,
  address                     TEXT,
  lat                         NUMERIC(10,6),
  lng                         NUMERIC(10,6),
  -- jsonb keyed by waste_type, $/tonne, e.g. {"General Waste": 165, "Soil": 95}
  rates_per_tonne             JSONB DEFAULT '{}'::jsonb,
  -- jsonb keyed by waste_type, $/tonne credited back for recyclable streams
  recycling_credit_per_tonne  JSONB DEFAULT '{}'::jsonb,
  accepted_waste_types        TEXT[],
  opening_hours               JSONB,
  is_active                   BOOLEAN DEFAULT TRUE,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tip_sites_active ON tip_sites(is_active);

-- ─── 2. truck_loads ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS truck_loads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id     TEXT,
  driver_id    UUID REFERENCES auth.users(id),
  booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
  bin_size     TEXT,
  waste_type   TEXT,
  est_weight_t NUMERIC(6,2),
  loaded_at    TIMESTAMPTZ DEFAULT NOW(),
  tipped_at    TIMESTAMPTZ,
  tip_site_id  UUID REFERENCES tip_sites(id),
  recycled     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_loads_driver   ON truck_loads(driver_id, loaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_truck_loads_truck    ON truck_loads(truck_id);
CREATE INDEX IF NOT EXISTS idx_truck_loads_booking  ON truck_loads(booking_id);
-- Open loads (not yet tipped) are the hot query for "what's on the truck now"
CREATE INDEX IF NOT EXISTS idx_truck_loads_open     ON truck_loads(driver_id) WHERE tipped_at IS NULL;

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE tip_sites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_loads ENABLE ROW LEVEL SECURITY;

-- tip_sites: everyone authenticated reads; owner/manager manage.
-- No anon policies — ADR-707 rule 2 (nothing v7 on the public surface).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tip_sites' AND policyname='Auth users read tip sites') THEN
    CREATE POLICY "Auth users read tip sites"
      ON tip_sites FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tip_sites' AND policyname='Owner manager manage tip sites') THEN
    CREATE POLICY "Owner manager manage tip sites"
      ON tip_sites FOR ALL TO authenticated
      USING (public.current_user_role() IN ('owner','manager'))
      WITH CHECK (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

-- truck_loads: authenticated read; drivers insert/update their own loads;
-- owner/manager can correct any load.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='truck_loads' AND policyname='Auth users read truck loads') THEN
    CREATE POLICY "Auth users read truck loads"
      ON truck_loads FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='truck_loads' AND policyname='Drivers insert own truck loads') THEN
    CREATE POLICY "Drivers insert own truck loads"
      ON truck_loads FOR INSERT TO authenticated
      WITH CHECK (driver_id = auth.uid() OR public.current_user_role() IN ('owner','manager'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='truck_loads' AND policyname='Drivers update own truck loads') THEN
    CREATE POLICY "Drivers update own truck loads"
      ON truck_loads FOR UPDATE TO authenticated
      USING (driver_id = auth.uid() OR public.current_user_role() IN ('owner','manager'))
      WITH CHECK (driver_id = auth.uid() OR public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

-- ─── 4. Seed: 4 SE-Melbourne tip sites ───────────────────────
-- Coordinates are realistic for each facility's locality; RATES,
-- CREDITS AND HOURS ARE PLACEHOLDERS — flagged in notes for Mark.
-- Waste-type keys follow the canonical categories in src/lib/binTypes.js:
-- 'General Waste' | 'Asbestos' | 'Soil' | 'Green Waste' | 'Concrete'.
-- None of the seeded sites accept Asbestos (licensed-site only) — the
-- decision engine correctly returns "return to base" for those loads.
INSERT INTO tip_sites
  (name, address, lat, lng, rates_per_tonne, recycling_credit_per_tonne, accepted_waste_types, opening_hours, is_active, notes)
VALUES
  (
    'Frankston Regional Recycling & Recovery Centre',
    '20 Harold Rd, Skye VIC 3977',
    -38.116200, 145.174500,
    '{"General Waste": 165, "Soil": 95, "Green Waste": 68, "Concrete": 75}'::jsonb,
    '{"Green Waste": 15, "Concrete": 22}'::jsonb,
    ARRAY['General Waste','Soil','Green Waste','Concrete'],
    '{"mon_fri": "07:30-16:30", "sat": "08:00-16:00", "sun": "08:00-16:00"}'::jsonb,
    TRUE,
    'PLACEHOLDER — Mark to verify: rates, recycling credits and opening hours are estimates, not quoted gate fees.'
  ),
  (
    'Hampton Park Transfer Station (Hallam Rd Hub)',
    '274 Hallam Rd, Hampton Park VIC 3976',
    -38.045500, 145.271000,
    '{"General Waste": 148, "Soil": 88, "Concrete": 70}'::jsonb,
    '{"Concrete": 18}'::jsonb,
    ARRAY['General Waste','Soil','Concrete'],
    '{"mon_fri": "06:30-17:00", "sat": "07:00-16:00", "sun": "08:00-15:00"}'::jsonb,
    TRUE,
    'PLACEHOLDER — Mark to verify: rates, recycling credits and opening hours are estimates, not quoted gate fees.'
  ),
  (
    'Clayton Transfer Station',
    'Deals Rd, Clayton South VIC 3169',
    -37.940800, 145.119800,
    '{"General Waste": 175, "Green Waste": 72, "Concrete": 80}'::jsonb,
    '{"Green Waste": 12, "Concrete": 25}'::jsonb,
    ARRAY['General Waste','Green Waste','Concrete'],
    '{"mon_fri": "06:00-16:00", "sat": "07:00-15:00", "sun": "closed"}'::jsonb,
    TRUE,
    'PLACEHOLDER — Mark to verify: rates, recycling credits and opening hours are estimates, not quoted gate fees.'
  ),
  (
    'Rye Resource Recovery Centre (Mornington Peninsula)',
    'Truemans Rd, Tootgarook VIC 3941',
    -38.378900, 144.842000,
    '{"General Waste": 158, "Soil": 92, "Green Waste": 60}'::jsonb,
    '{"Green Waste": 18}'::jsonb,
    ARRAY['General Waste','Soil','Green Waste'],
    '{"mon_fri": "08:00-16:00", "sat": "08:00-16:00", "sun": "08:00-16:00"}'::jsonb,
    TRUE,
    'PLACEHOLDER — Mark to verify: rates, recycling credits and opening hours are estimates, not quoted gate fees.'
  )
ON CONFLICT (name) DO NOTHING;
