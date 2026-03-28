-- ============================================================
-- Migration 005: Fleet Tables
-- Binned-IT Dashboard Hub v2.2 — Sprint 4
-- DO NOT apply automatically — run manually in Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bin_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  size_cubic_metres numeric(5,1),
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL CHECK (asset_type IN ('truck', 'bin', 'trailer', 'equipment')),
  identifier text NOT NULL,
  description text,
  registration text,
  rego_expiry date,
  year_of_manufacture integer,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fleet_maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.fleet_assets(id) ON DELETE CASCADE,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('service', 'repair', 'inspection', 'registration', 'other')),
  description text,
  performed_date date NOT NULL,
  next_due_date date,
  cost numeric(10,2),
  odometer_km integer,
  performed_by text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.disposal_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  disposal_date date NOT NULL,
  tip_site text NOT NULL,
  bin_type text,
  weight_tonnes numeric(8,2),
  disposal_type text CHECK (disposal_type IN ('general', 'asbestos', 'ewaste', 'concrete', 'green')),
  receipt_number text,
  cost numeric(10,2),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fleet_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposal_receipts ENABLE ROW LEVEL SECURITY;

-- bin_types: all authenticated users can read; owner/manager can write
CREATE POLICY "All authenticated can read bin_types" ON public.bin_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage bin_types" ON public.bin_types
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'manager'));

-- fleet_assets: all authenticated read; owner/manager write
CREATE POLICY "All authenticated can read fleet_assets" ON public.fleet_assets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage fleet_assets" ON public.fleet_assets
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'manager'));

-- fleet_maintenance_records: all authenticated read; owner/manager write
CREATE POLICY "All authenticated can read maintenance" ON public.fleet_maintenance_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and manager can manage maintenance" ON public.fleet_maintenance_records
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'manager'));

-- disposal_receipts: all authenticated read; owner/bookkeeper write
CREATE POLICY "All authenticated can read disposal_receipts" ON public.disposal_receipts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner and bookkeeper can manage disposal_receipts" ON public.disposal_receipts
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'bookkeeper'));

CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_asset_id ON public.fleet_maintenance_records(asset_id);
CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_performed_date ON public.fleet_maintenance_records(performed_date);
CREATE INDEX IF NOT EXISTS idx_disposal_receipts_report_id ON public.disposal_receipts(report_id);
