-- ============================================================
-- Migration 004: Schema Additions
-- Binned-IT Dashboard Hub v2.2 — Sprint 2A
-- DO NOT apply automatically — run manually in Supabase SQL editor
-- ============================================================

-- ----------------------------------------
-- profiles table additions
-- ----------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS organisation_id uuid DEFAULT NULL;

-- ----------------------------------------
-- financials_monthly table additions
-- ----------------------------------------
ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS opex_depreciation numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_income numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_expenses numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_net_movement numeric(12,2) DEFAULT 0;

-- Add missing columns that the seed data expects
-- (these may already exist from 001 as rev_total etc; add aliases if needed)
ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS revenue_total numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ebitda numeric(12,2) DEFAULT 0;

-- ----------------------------------------
-- balance_sheet_monthly table additions
-- ----------------------------------------
ALTER TABLE public.balance_sheet_monthly
  ADD COLUMN IF NOT EXISTS non_current_assets numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ato_clearing numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS superannuation_payable numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS director_loans numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retained_earnings numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_year_earnings numeric(12,2) DEFAULT 0;

-- ----------------------------------------
-- debtors_monthly table additions
-- ----------------------------------------
ALTER TABLE public.debtors_monthly
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS older_bucket numeric(12,2) DEFAULT 0;

-- ----------------------------------------
-- customer_acquisitions table additions
-- ----------------------------------------
ALTER TABLE public.customer_acquisitions
  ADD COLUMN IF NOT EXISTS customer_type text,
  ADD COLUMN IF NOT EXISTS first_job_date date,
  ADD COLUMN IF NOT EXISTS revenue_in_month numeric(12,2) DEFAULT 0;

-- ----------------------------------------
-- competitor_rates table additions
-- ----------------------------------------
ALTER TABLE public.competitor_rates
  ADD COLUMN IF NOT EXISTS competitor_source text,
  ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'standard';

-- ----------------------------------------
-- compliance_records table additions
-- ----------------------------------------
ALTER TABLE public.compliance_records
  ADD COLUMN IF NOT EXISTS whs_incident_details text,
  ADD COLUMN IF NOT EXISTS whs_near_miss boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whs_near_miss_details text,
  ADD COLUMN IF NOT EXISTS whs_last_toolbox_talk date,
  ADD COLUMN IF NOT EXISTS asbestos_clearance_certs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asbestos_complaints integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asbestos_complaint_details text,
  ADD COLUMN IF NOT EXISTS epa_renewal_status text DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS vehicles_off_road integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vehicles_off_road_reason text,
  ADD COLUMN IF NOT EXISTS vehicle_rego_dates jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fleet_inspections_current boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_liability_current boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_liability_expiry date,
  ADD COLUMN IF NOT EXISTS workers_comp_current boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS workers_comp_expiry date;

-- ----------------------------------------
-- alerts_log table additions
-- ----------------------------------------
ALTER TABLE public.alerts_log
  ADD COLUMN IF NOT EXISTS acknowledge_notes text,
  ADD COLUMN IF NOT EXISTS is_suppressed boolean DEFAULT false;

-- ----------------------------------------
-- file_uploads table additions
-- ----------------------------------------
ALTER TABLE public.file_uploads
  ADD COLUMN IF NOT EXISTS parsed_rows integer;

-- ----------------------------------------
-- ai_chat_sessions table additions
-- ----------------------------------------
ALTER TABLE public.ai_chat_sessions
  ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0;

-- ----------------------------------------
-- alert_thresholds table additions
-- ----------------------------------------
ALTER TABLE public.alert_thresholds
  ADD COLUMN IF NOT EXISTS unit text;

-- ----------------------------------------
-- work_plan_items table additions
-- ----------------------------------------
ALTER TABLE public.work_plan_items
  ADD COLUMN IF NOT EXISTS source_alert_id uuid REFERENCES public.alerts_log(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Also add missing column referenced in reports API
ALTER TABLE public.monthly_reports
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ----------------------------------------
-- submit_monthly_report function
-- ----------------------------------------
CREATE OR REPLACE FUNCTION public.submit_monthly_report(
  p_month_key text,
  p_report_data jsonb,
  p_financials jsonb,
  p_balance_sheet jsonb,
  p_debtors jsonb,
  p_bin_performance jsonb,
  p_acquisitions jsonb,
  p_compliance jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id uuid;
  v_report_month date;
BEGIN
  v_report_month := (p_month_key || '-01')::date;

  -- Upsert monthly_reports
  INSERT INTO public.monthly_reports (report_month, status, created_by, updated_at)
  VALUES (v_report_month, 'complete', auth.uid(), now())
  ON CONFLICT (report_month) DO UPDATE SET status = 'complete', updated_at = now()
  RETURNING id INTO v_report_id;

  -- Upsert financials
  INSERT INTO public.financials_monthly (
    report_id, report_month,
    rev_total, cos_total, gross_profit, opex_total, net_profit,
    gross_margin_pct, net_margin_pct,
    revenue_total, ebitda
  )
  SELECT
    v_report_id, v_report_month,
    (p_financials->>'revenue_total')::numeric,
    (p_financials->>'cos_total')::numeric,
    (p_financials->>'gross_profit')::numeric,
    (p_financials->>'opex_total')::numeric,
    (p_financials->>'net_profit')::numeric,
    (p_financials->>'gross_margin_pct')::numeric,
    (p_financials->>'net_margin_pct')::numeric,
    (p_financials->>'revenue_total')::numeric,
    (p_financials->>'ebitda')::numeric
  ON CONFLICT (report_id) DO UPDATE SET
    rev_total = EXCLUDED.rev_total,
    cos_total = EXCLUDED.cos_total,
    gross_profit = EXCLUDED.gross_profit,
    opex_total = EXCLUDED.opex_total,
    net_profit = EXCLUDED.net_profit,
    gross_margin_pct = EXCLUDED.gross_margin_pct,
    net_margin_pct = EXCLUDED.net_margin_pct,
    revenue_total = EXCLUDED.revenue_total,
    ebitda = EXCLUDED.ebitda,
    updated_at = now();

  RETURN jsonb_build_object('report_id', v_report_id, 'status', 'success');
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Note: financials_monthly may not have a unique constraint on report_id by default.
-- If the upsert fails, add: ALTER TABLE public.financials_monthly ADD UNIQUE (report_id);
