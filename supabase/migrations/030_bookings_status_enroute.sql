-- ============================================================
-- Migration 030: bookings status CHECK — add en_route, arrived (J4)
-- ============================================================
-- P0 found by the Dave-Driver persona on 2026-06-12: the driver
-- job state machine (pending → en_route → arrived → in_progress →
-- completed) shipped in the UI and API, but bookings_status_check
-- still allowed only the original six values — every "Start Drive
-- (En Route)" PATCH 400-ed at the database. The journey could
-- never progress past Scheduled for any driver.
--
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status = ANY (ARRAY[
      'pending'::text, 'confirmed'::text, 'scheduled'::text,
      'en_route'::text, 'arrived'::text,
      'in_progress'::text, 'completed'::text, 'cancelled'::text
    ]));
END $$;
