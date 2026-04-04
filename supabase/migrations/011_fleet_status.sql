-- ============================================================
-- Migration 011: Fleet Status & Location Enhancements
-- Binned-IT Dashboard Hub v2.2 — Phase 5
-- ============================================================

-- Add status and operational columns to fleet_assets
ALTER TABLE public.fleet_assets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'available'
    CHECK (status IN ('available', 'in-use', 'maintenance', 'retired')),
  ADD COLUMN IF NOT EXISTS current_location text DEFAULT 'depot'
    CHECK (current_location IN ('depot', 'on-site', 'in-transit', 'workshop')),
  ADD COLUMN IF NOT EXISTS assigned_job_id uuid,
  ADD COLUMN IF NOT EXISTS next_service_due date,
  ADD COLUMN IF NOT EXISTS odometer_km integer;

-- Create customer_notes table for CRM note history
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON public.customer_notes(customer_id);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read customer_notes" ON public.customer_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner and manager can manage customer_notes" ON public.customer_notes
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'manager'));

-- Seed fleet status data (update existing fallback records if they exist)
-- Set trucks as 'available' at depot by default (safe to run multiple times)
UPDATE public.fleet_assets
  SET status = 'available', current_location = 'depot'
  WHERE asset_type = 'truck' AND status IS NULL;

UPDATE public.fleet_assets
  SET status = 'available', current_location = 'depot'
  WHERE asset_type = 'bin' AND status IS NULL;
