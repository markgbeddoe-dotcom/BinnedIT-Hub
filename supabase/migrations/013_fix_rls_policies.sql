-- ============================================================
-- Migration 013: Fix RLS policies — permissive inserts
-- ============================================================
-- Bug 1: Bookings anon insert broken after tenant_id column added
-- Bug 2: Driver tables require driver_id = auth.uid() which fails
--        when owner/manager submits or when prop is missing
-- ============================================================

-- ── BOOKINGS: drop and recreate insert policy ─────────────────
DROP POLICY IF EXISTS "Public can create bookings"       ON public.bookings;
DROP POLICY IF EXISTS "anon can insert bookings"         ON public.bookings;
DROP POLICY IF EXISTS "Anon can insert bookings"         ON public.bookings;
DROP POLICY IF EXISTS "Anyone can insert bookings"       ON public.bookings;
DROP POLICY IF EXISTS "Authenticated can insert bookings" ON public.bookings;

CREATE POLICY "Public can create bookings"
  ON public.bookings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ── VEHICLE_CHECKLISTS: any authenticated user can insert ─────
DROP POLICY IF EXISTS "Drivers insert own checklists"       ON public.vehicle_checklists;
DROP POLICY IF EXISTS "Authenticated users insert checklists" ON public.vehicle_checklists;

CREATE POLICY "Authenticated users insert checklists"
  ON public.vehicle_checklists
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── JOB_EVENTS: any authenticated user can insert ─────────────
DROP POLICY IF EXISTS "Drivers insert own job events"        ON public.job_events;
DROP POLICY IF EXISTS "Authenticated users insert job events" ON public.job_events;

CREATE POLICY "Authenticated users insert job events"
  ON public.job_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── JOB_PHOTOS: any authenticated user can insert ─────────────
DROP POLICY IF EXISTS "Drivers and managers insert job photos"  ON public.job_photos;
DROP POLICY IF EXISTS "Authenticated users insert job photos"   ON public.job_photos;

CREATE POLICY "Authenticated users insert job photos"
  ON public.job_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── HAZARD_REPORTS: any authenticated user can insert ─────────
DROP POLICY IF EXISTS "Drivers insert hazard reports"           ON public.hazard_reports;
DROP POLICY IF EXISTS "Authenticated users insert hazard reports" ON public.hazard_reports;

CREATE POLICY "Authenticated users insert hazard reports"
  ON public.hazard_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
