-- ============================================================
-- Migration 022: Roles expansion + driver assignment support
-- (merged WP-A "driver_role_assignment" + WP-H "roles_expansion")
-- FR7.1.1 / GAP-001 / GAP-028 / R1
--
-- 1. Extends the profiles.role CHECK constraint. 001_initial_schema.sql
--    only allowed 4 roles (owner|manager|bookkeeper|viewer) while the
--    app uses more:
--      - TeamPage.jsx offers 6 assignable roles (adds driver,
--        fleet_manager); inserting those previously violated the CHECK.
--      - AuthContext.jsx additionally treats 'investor' as a valid
--        role value (isViewer = viewer|investor; /investor route),
--        so it must be storable too.
--    Final allowed set:
--      owner | manager | bookkeeper | viewer | investor | driver | fleet_manager
-- 2. Adds composite index on bookings(driver_id, scheduled_date)
--    for dispatch assignment views (driver filter) and the driver
--    "today's jobs" query (getTodayJobs).
--
-- handle_new_user() (001_initial_schema.sql) is deliberately
-- UNCHANGED — new signups still default to role 'viewer';
-- driver / fleet_manager / investor roles are assigned by an owner.
--
-- No new tables — no new RLS needed; existing profiles RLS
-- (002_rls_policies.sql) is unaffected by a CHECK change.
--
-- Idempotent: safe to re-run (defensive drop loop + IF NOT EXISTS).
-- ============================================================

DO $$
DECLARE
  c record;
BEGIN
  -- Drop any existing CHECK constraint on profiles that governs role.
  -- Postgres auto-named the inline column CHECK from 001_initial_schema.sql
  -- as profiles_role_check, but match defensively in case the name differs.
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner', 'manager', 'bookkeeper', 'viewer', 'investor', 'driver', 'fleet_manager'));
END $$;

-- Dispatch + driver-app query support: bookings by driver and date.
-- "my jobs for today" (driver app) and per-driver day planning
-- (dispatch board filter).
CREATE INDEX IF NOT EXISTS idx_bookings_driver_scheduled
  ON public.bookings (driver_id, scheduled_date);
