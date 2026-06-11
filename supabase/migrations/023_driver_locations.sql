-- ============================================================
-- Migration 023: Live driver GPS — driver_locations + geocode cache
-- WP-C (R3): GAP-006/007/008 · FR7.3.1 · ADR-701/702
-- Idempotent — safe to re-run.
-- ============================================================

-- ─── 1. driver_locations (telemetry — 7-day retention per ADR-701; the
--        prune job runs as service role from a daily cron, integrator-owned) ───
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  truck_id    text,
  lat         numeric(10,6) NOT NULL,
  lng         numeric(10,6) NOT NULL,
  heading     numeric(5,1),
  speed_kmh   numeric(6,1),
  accuracy_m  numeric(8,2),
  booking_id  uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Serves both the latest-position view and the retention pruner (ADR-701).
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time
  ON public.driver_locations (driver_id, recorded_at DESC);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_locations'
      AND policyname = 'Drivers insert own locations'
  ) THEN
    CREATE POLICY "Drivers insert own locations"
      ON public.driver_locations FOR INSERT TO authenticated
      WITH CHECK (driver_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'driver_locations'
      AND policyname = 'Authenticated read driver locations'
  ) THEN
    CREATE POLICY "Authenticated read driver locations"
      ON public.driver_locations FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
-- Deliberately NO UPDATE/DELETE policies for end users — telemetry is
-- append-only; pruning runs as service role (bypasses RLS). No anon policy
-- ever (ADR-707 rule 2).

-- ─── 2. latest_driver_locations view ─────────────────────────
-- NOTE on security model: this view is a default (definer-rights) view on
-- purpose. profiles RLS (002) only lets a user read their OWN profile (or
-- owner read all) — but dispatch/managers need driver full_name on the map.
-- The only profiles field exposed here is full_name, and the grants below
-- restrict the view to authenticated users. driver_locations SELECT is
-- already authenticated-wide, so nothing extra is leaked.
-- Window is 12 hours (not ADR-701's 15 min) so the map's "Offline >30 min"
-- side list can still show drivers from earlier in the shift (ux-spec §2.2).
CREATE OR REPLACE VIEW public.latest_driver_locations AS
SELECT DISTINCT ON (dl.driver_id)
  dl.id,
  dl.driver_id,
  p.full_name,
  dl.truck_id,
  dl.lat,
  dl.lng,
  dl.heading,
  dl.speed_kmh,
  dl.accuracy_m,
  dl.booking_id,
  dl.recorded_at
FROM public.driver_locations dl
LEFT JOIN public.profiles p ON p.id = dl.driver_id
WHERE dl.recorded_at > now() - interval '12 hours'
ORDER BY dl.driver_id, dl.recorded_at DESC;

REVOKE ALL ON public.latest_driver_locations FROM anon;
GRANT SELECT ON public.latest_driver_locations TO authenticated;

-- ─── 3. Geocode cache on bookings (ADR-702: geocode once, ever) ───
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS lat         numeric(10,6),
  ADD COLUMN IF NOT EXISTS lng         numeric(10,6),
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

-- ─── 4. Driver location-tracking consent (ADR-701 consent gate) ───
-- Null = consent never given; publisher refuses to publish until set.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location_consent_at timestamptz;
