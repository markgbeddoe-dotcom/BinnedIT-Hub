-- ============================================================
-- Migration 009: Driver Mobile Dashboard + Job Costing
-- ============================================================
-- Adds job costing columns to bookings, job_photos, job_events,
-- vehicle_checklists, and hazard_reports tables.
-- Also sets up Supabase Storage bucket for job photos.
-- ============================================================

-- ─── 1. Job costing columns on bookings ──────────────────────
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS estimated_fuel         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estimated_tip_fee      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS estimated_driver_time  NUMERIC(5,2),   -- hours
  ADD COLUMN IF NOT EXISTS actual_fuel            NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_tip_fee         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_driver_time     NUMERIC(5,2),   -- hours
  ADD COLUMN IF NOT EXISTS actual_total_cost      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS driver_id              UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS driver_name_assigned   TEXT;

-- ─── 2. job_photos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id) ON DELETE CASCADE,
  photo_type   TEXT NOT NULL CHECK (photo_type IN ('delivery','collection','tip_docket','hazard','other')),
  storage_path TEXT NOT NULL,
  photo_url    TEXT,
  uploaded_by  UUID REFERENCES auth.users(id),
  uploaded_at  TIMESTAMPTZ DEFAULT NOW(),
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_photos_booking ON job_photos(booking_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_type    ON job_photos(photo_type);

-- ─── 3. job_events (GPS + timestamp stamps) ──────────────────
CREATE TABLE IF NOT EXISTS job_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID REFERENCES bookings(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('start','complete','arrived','departed','photo_taken')),
  driver_id   UUID REFERENCES auth.users(id),
  lat         NUMERIC(10,6),
  lng         NUMERIC(10,6),
  accuracy_m  NUMERIC(8,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_booking ON job_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_job_events_driver  ON job_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_job_events_type    ON job_events(event_type);

-- ─── 4. vehicle_checklists ───────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_checklists (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id             UUID REFERENCES auth.users(id),
  truck_id              TEXT,
  check_date            DATE DEFAULT CURRENT_DATE,
  tyres_ok              BOOLEAN DEFAULT FALSE,
  lights_ok             BOOLEAN DEFAULT FALSE,
  hydraulics_ok         BOOLEAN DEFAULT FALSE,
  brakes_ok             BOOLEAN DEFAULT FALSE,
  mirrors_ok            BOOLEAN DEFAULT FALSE,
  seatbelt_ok           BOOLEAN DEFAULT FALSE,
  fire_extinguisher_ok  BOOLEAN DEFAULT FALSE,
  first_aid_ok          BOOLEAN DEFAULT FALSE,
  water_fuel_ok         BOOLEAN DEFAULT FALSE,
  load_restraints_ok    BOOLEAN DEFAULT FALSE,
  notes                 TEXT,
  passed                BOOLEAN GENERATED ALWAYS AS (
    tyres_ok AND lights_ok AND hydraulics_ok AND brakes_ok AND
    mirrors_ok AND seatbelt_ok AND fire_extinguisher_ok AND
    first_aid_ok AND water_fuel_ok AND load_restraints_ok
  ) STORED,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_driver ON vehicle_checklists(driver_id);
CREATE INDEX IF NOT EXISTS idx_checklists_date   ON vehicle_checklists(check_date);

-- ─── 5. hazard_reports ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS hazard_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID REFERENCES bookings(id),
  reported_by  UUID REFERENCES auth.users(id),
  hazard_type  TEXT NOT NULL CHECK (hazard_type IN ('asbestos','electrical','structural','access','spill','animal','other')),
  description  TEXT NOT NULL,
  lat          NUMERIC(10,6),
  lng          NUMERIC(10,6),
  address      TEXT,
  photo_url    TEXT,
  status       TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  resolved_by  UUID REFERENCES auth.users(id),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazards_booking ON hazard_reports(booking_id);
CREATE INDEX IF NOT EXISTS idx_hazards_status  ON hazard_reports(status);

-- ─── 6. RLS policies ─────────────────────────────────────────

-- job_photos
ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read job photos"
  ON job_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers and managers insert job photos"
  ON job_photos FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "Owners can delete job photos"
  ON job_photos FOR DELETE TO authenticated
  USING (current_user_role() IN ('owner','manager'));

-- job_events
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read job events"
  ON job_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers insert own job events"
  ON job_events FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- vehicle_checklists
ALTER TABLE vehicle_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read checklists"
  ON vehicle_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers insert own checklists"
  ON vehicle_checklists FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

-- hazard_reports
ALTER TABLE hazard_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users read hazards"
  ON hazard_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers insert hazard reports"
  ON hazard_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Managers update hazard status"
  ON hazard_reports FOR UPDATE TO authenticated
  USING (current_user_role() IN ('owner','manager'));

-- ─── 7. Storage bucket for job photos ────────────────────────
-- Run in Supabase dashboard SQL editor or via CLI after applying migration:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('job-photos', 'job-photos', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
-- ON CONFLICT (id) DO NOTHING;
--
-- Storage RLS (in Supabase dashboard):
-- Authenticated users can upload to job-photos/{booking_id}/*
-- Authenticated users can read from job-photos/*
