-- ============================================================
-- Migration 007: Operational Features
-- Binned-IT Dashboard Hub v2.2 — Phase 1
-- Adds: reminder tracking, ESG fields, customer order history
-- ============================================================

-- ----------------------------------------
-- EMAIL REMINDERS LOG
-- Tracks which payment reminders have been sent to prevent duplicates
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_reminders_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name   text NOT NULL,
  customer_email  text,
  reminder_type   text NOT NULL CHECK (reminder_type IN ('7day', '14day', '30day')),
  amount_overdue  numeric(12,2) DEFAULT 0,
  report_month    date,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  resend_id       text,                   -- Resend API message ID
  status          text DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_email_reminders_customer
  ON public.email_reminders_log (customer_name, reminder_type, report_month);

-- ----------------------------------------
-- ESG TRACKING — add columns to financials_monthly
-- ----------------------------------------
ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS esg_tonnes_diverted  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esg_recycling_rate   numeric(5,2)  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esg_landfill_tonnes  numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS esg_co2_offset_est   numeric(10,2) DEFAULT 0;

COMMENT ON COLUMN public.financials_monthly.esg_tonnes_diverted IS 'Tonnes diverted from landfill (recycled/recovered)';
COMMENT ON COLUMN public.financials_monthly.esg_recycling_rate IS 'Recycling rate as a percentage of total waste processed';
COMMENT ON COLUMN public.financials_monthly.esg_landfill_tonnes IS 'Tonnes sent to landfill';
COMMENT ON COLUMN public.financials_monthly.esg_co2_offset_est IS 'Estimated CO2 offset in kg from diversion (0.5 kg CO2e per tonne diverted estimate)';

-- ----------------------------------------
-- CUSTOMER ORDER HISTORY
-- Populated by Xero sync; used for churn detection
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_order_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name   text NOT NULL,
  report_month    date NOT NULL,
  order_count     integer DEFAULT 0,
  revenue         numeric(12,2) DEFAULT 0,
  last_order_date date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_name, report_month)
);

CREATE INDEX IF NOT EXISTS idx_customer_order_history_month
  ON public.customer_order_history (report_month DESC);
CREATE INDEX IF NOT EXISTS idx_customer_order_history_customer
  ON public.customer_order_history (customer_name);

-- ----------------------------------------
-- RLS for new tables (owner/manager only)
-- ----------------------------------------
ALTER TABLE public.email_reminders_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_manager_email_reminders" ON public.email_reminders_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner','manager')
    )
  );

CREATE POLICY "owner_manager_customer_history" ON public.customer_order_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner','manager','bookkeeper')
    )
  );
