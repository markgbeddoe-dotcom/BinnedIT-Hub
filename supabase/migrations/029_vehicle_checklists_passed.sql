-- ============================================================
-- Migration 029: vehicle_checklists.passed generated column (J4)
-- ============================================================
-- P0 found by the Dave-Driver persona on 2026-06-12: the driver
-- app hard-gates jobs behind `todayChecklist.passed === true`,
-- but the live table never had a `passed` column — the overnight
-- WP-B build asserted it existed (claimed "generated column from
-- migration 009") without verifying the live schema. Result: the
-- pre-start gate could NEVER unlock for any driver.
--
-- A checklist passes when all ten items are OK and a truck ID was
-- recorded — same rule the UI enforces client-side.
--
-- Idempotent: safe to re-run. STORED → computes for existing rows.
-- ============================================================

ALTER TABLE public.vehicle_checklists
  ADD COLUMN IF NOT EXISTS passed boolean GENERATED ALWAYS AS (
    coalesce(tyres_ok, false)
    AND coalesce(lights_ok, false)
    AND coalesce(hydraulics_ok, false)
    AND coalesce(brakes_ok, false)
    AND coalesce(mirrors_ok, false)
    AND coalesce(seatbelt_ok, false)
    AND coalesce(fire_extinguisher_ok, false)
    AND coalesce(first_aid_ok, false)
    AND coalesce(water_fuel_ok, false)
    AND coalesce(load_restraints_ok, false)
    AND truck_id IS NOT NULL
    AND length(trim(truck_id)) > 0
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_vehicle_checklists_driver_date
  ON public.vehicle_checklists (driver_id, check_date DESC);
