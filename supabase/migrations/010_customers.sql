-- ============================================================
-- Migration 010: Customer CRM Table
-- Binned-IT Dashboard Hub v2.2 — Phase 5
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  address text,
  suburb text,
  total_jobs integer DEFAULT 0,
  total_revenue numeric(12,2) DEFAULT 0,
  last_order_date date,
  churn_risk text DEFAULT 'low' CHECK (churn_risk IN ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_suburb ON public.customers(suburb);
CREATE INDEX IF NOT EXISTS idx_customers_churn_risk ON public.customers(churn_risk);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON public.customers(last_order_date);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read customers" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner and manager can manage customers" ON public.customers
  FOR ALL TO authenticated USING (public.current_user_role() IN ('owner', 'manager'));

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS customers_updated_at ON public.customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed some demo customers based on existing debtors data
INSERT INTO public.customers (name, email, phone, suburb, total_jobs, total_revenue, last_order_date, churn_risk, notes)
VALUES
  ('Remeed Solutions', 'accounts@remeed.com.au', '03 9000 0001', 'Seaford', 48, 89200.00, '2026-02-15', 'low', 'Regular commercial account — demolition & reno'),
  ('Fieldmans Waste', 'billing@fieldmans.com.au', '03 9000 0002', 'Frankston', 42, 72300.00, '2026-02-10', 'low', 'High-volume general waste — monthly billing'),
  ('Roach Demolition', 'office@roachdemo.com.au', '0412 000 003', 'Seaford', 36, 68500.00, '2026-01-28', 'medium', 'Demolition contractor — occasional asbestos jobs'),
  ('Scotty''s Suburban', 'scott@suburbankip.com.au', '0412 000 004', 'Carrum Downs', 22, 29100.00, '2026-01-15', 'medium', 'Residential removals — intermittent'),
  ('Melbourne Grammar School', 'facilities@melgrammar.vic.edu.au', '03 9000 0005', 'South Yarra', 18, 21400.00, '2026-02-01', 'low', 'School maintenance contract'),
  ('TREC Plumbing', 'admin@trecplumbing.com.au', '0413 000 006', 'Frankston', 14, 16200.00, '2025-12-10', 'high', 'Infrequent orders — at risk of churn'),
  ('ServiceStream', 'procurement@servicestream.com.au', '03 9000 0007', 'Richmond', 11, 14800.00, '2025-11-20', 'high', 'Large corp — orders dried up Q4'),
  ('Salt Projects', 'projects@saltgroup.com.au', '0414 000 008', 'Cheltenham', 9, 12100.00, '2026-02-20', 'low', 'New builder account'),
  ('IMEG Nominees', 'property@imeg.com.au', '03 9000 0009', 'Brighton', 8, 10400.00, '2025-10-05', 'high', 'Property developer — no orders 5+ months'),
  ('Shayona Property', 'admin@shayona.com.au', '0415 000 010', 'Dandenong', 7, 9600.00, '2025-11-01', 'high', 'Residential development — project may be complete')
ON CONFLICT DO NOTHING;
