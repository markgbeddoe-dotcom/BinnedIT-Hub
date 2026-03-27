-- ============================================================
-- Migration 001: Initial Schema
-- Binned-IT Dashboard Hub v2.2
-- ============================================================

-- ----------------------------------------
-- PROFILES (extends Supabase auth.users)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name   text,
  role        text NOT NULL DEFAULT 'viewer'
                   CHECK (role IN ('owner','manager','bookkeeper','viewer')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ----------------------------------------
-- MONTHLY REPORTS (one per wizard submission)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month    date NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','complete')),
  uploaded_by     uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_month)
);

-- ----------------------------------------
-- FINANCIALS MONTHLY (P&L data)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.financials_monthly (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month     date NOT NULL,
  -- Revenue
  rev_general      numeric(12,2) DEFAULT 0,
  rev_asbestos     numeric(12,2) DEFAULT 0,
  rev_soil         numeric(12,2) DEFAULT 0,
  rev_green        numeric(12,2) DEFAULT 0,
  rev_other        numeric(12,2) DEFAULT 0,
  rev_total        numeric(12,2) DEFAULT 0,
  -- Cost of Sales
  cos_fuel         numeric(12,2) DEFAULT 0,
  cos_disposal     numeric(12,2) DEFAULT 0,
  cos_wages        numeric(12,2) DEFAULT 0,
  cos_tolls        numeric(12,2) DEFAULT 0,
  cos_repairs      numeric(12,2) DEFAULT 0,
  cos_other        numeric(12,2) DEFAULT 0,
  cos_total        numeric(12,2) DEFAULT 0,
  gross_profit     numeric(12,2) DEFAULT 0,
  gross_margin_pct numeric(6,2)  DEFAULT 0,
  -- Operating Expenses
  opex_rent        numeric(12,2) DEFAULT 0,
  opex_admin       numeric(12,2) DEFAULT 0,
  opex_advertising numeric(12,2) DEFAULT 0,
  opex_insurance   numeric(12,2) DEFAULT 0,
  opex_other       numeric(12,2) DEFAULT 0,
  opex_total       numeric(12,2) DEFAULT 0,
  net_profit       numeric(12,2) DEFAULT 0,
  net_margin_pct   numeric(6,2)  DEFAULT 0
);

-- ----------------------------------------
-- BALANCE SHEET MONTHLY
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.balance_sheet_monthly (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month        date NOT NULL,
  cash_balance        numeric(12,2) DEFAULT 0,
  accounts_receivable numeric(12,2) DEFAULT 0,
  other_current_assets numeric(12,2) DEFAULT 0,
  fixed_assets        numeric(12,2) DEFAULT 0,
  total_assets        numeric(12,2) DEFAULT 0,
  accounts_payable    numeric(12,2) DEFAULT 0,
  gst_liability       numeric(12,2) DEFAULT 0,
  payg_liability      numeric(12,2) DEFAULT 0,
  loan_current        numeric(12,2) DEFAULT 0,
  loan_noncurrent     numeric(12,2) DEFAULT 0,
  total_loans         numeric(12,2) DEFAULT 0,
  total_liabilities   numeric(12,2) DEFAULT 0,
  net_equity          numeric(12,2) DEFAULT 0
);

-- ----------------------------------------
-- DEBTORS MONTHLY (AR aging)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.debtors_monthly (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month      date NOT NULL,
  debtor_name       text NOT NULL,
  current_amount    numeric(12,2) DEFAULT 0,
  overdue_30        numeric(12,2) DEFAULT 0,
  overdue_60        numeric(12,2) DEFAULT 0,
  overdue_90plus    numeric(12,2) DEFAULT 0,
  total_outstanding numeric(12,2) DEFAULT 0
);

-- ----------------------------------------
-- BIN TYPE PERFORMANCE
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.bin_type_performance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  bin_type        text NOT NULL,
  deliveries      integer DEFAULT 0,
  avg_hire_days   numeric(6,1) DEFAULT 0,
  revenue         numeric(12,2) DEFAULT 0,
  avg_price       numeric(10,2) DEFAULT 0,
  cos_per_job     numeric(10,2) DEFAULT 0,
  gross_per_job   numeric(10,2) DEFAULT 0,
  net_margin_pct  numeric(6,2) DEFAULT 0
);

-- ----------------------------------------
-- CUSTOMERS
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  email           text,
  phone           text,
  is_active       boolean DEFAULT true,
  first_job_date  date,
  last_job_date   date,
  total_jobs      integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- CUSTOMER ACQUISITIONS (new customers per month)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_acquisitions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month    date NOT NULL,
  customer_name   text NOT NULL,
  jobs_in_month   integer DEFAULT 0
);

-- ----------------------------------------
-- COMPETITOR RATES (persistent, editable)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.competitor_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name text NOT NULL,
  bin_type        text NOT NULL,
  rate            numeric(10,2),
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES public.profiles(id),
  UNIQUE(competitor_name, bin_type)
);

-- ----------------------------------------
-- COMPLIANCE RECORDS
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_records (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id                     uuid NOT NULL REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  report_month                  date NOT NULL,
  whs_incidents                 integer DEFAULT 0,
  whs_register_current          boolean DEFAULT false,
  whs_training_current          boolean DEFAULT false,
  asbestos_jobs                 integer DEFAULT 0,
  asbestos_docs_complete        boolean DEFAULT false,
  asbestos_contractor_licensed  boolean DEFAULT false,
  epa_license_current           boolean DEFAULT false,
  epa_expiry_date               date,
  vehicle_inspections_current   boolean DEFAULT false,
  vehicle_rego_current          boolean DEFAULT false,
  insurance_current             boolean DEFAULT false,
  insurance_expiry_date         date,
  public_liability_current      boolean DEFAULT false,
  compliance_notes              text
);

-- ----------------------------------------
-- WORK PLAN ITEMS (persistent library)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.work_plan_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  area            text,
  horizon         text CHECK (horizon IN ('week','month','quarter')),
  priority        integer DEFAULT 50,
  effort_hours    numeric(4,1),
  business_impact text,
  owner_role      text,
  is_active       boolean DEFAULT true,
  is_system       boolean DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- WORK PLAN COMPLETIONS
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.work_plan_completions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         uuid NOT NULL REFERENCES public.work_plan_items(id) ON DELETE CASCADE,
  completed_by    uuid REFERENCES public.profiles(id),
  completed_at    timestamptz NOT NULL DEFAULT now(),
  notes           text,
  UNIQUE(item_id)
);

-- ----------------------------------------
-- ALERTS LOG
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         uuid REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  category          text,
  severity          text CHECK (severity IN ('critical','warning','info','positive')),
  message           text NOT NULL,
  acknowledged_by   uuid REFERENCES public.profiles(id),
  acknowledged_at   timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- FILE UPLOADS (audit trail)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.file_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id       uuid REFERENCES public.monthly_reports(id) ON DELETE CASCADE,
  file_type       text NOT NULL,
  original_name   text NOT NULL,
  storage_path    text,
  file_size_bytes integer,
  uploaded_by     uuid REFERENCES public.profiles(id),
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  parse_status    text DEFAULT 'pending'
                       CHECK (parse_status IN ('pending','success','failed')),
  parse_error     text
);

-- ----------------------------------------
-- AI CHAT SESSIONS
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_month    date,
  messages        jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------
-- ALERT THRESHOLDS (configurable settings)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.alert_thresholds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text NOT NULL,
  metric_key      text NOT NULL,
  warning_value   numeric,
  critical_value  numeric,
  description     text,
  updated_by      uuid REFERENCES public.profiles(id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category, metric_key)
);

-- ----------------------------------------
-- INDEXES for performance
-- ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_financials_report_month ON public.financials_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_balance_report_month ON public.balance_sheet_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_debtors_report_month ON public.debtors_monthly(report_month);
CREATE INDEX IF NOT EXISTS idx_bin_perf_report_month ON public.bin_type_performance(report_month);
CREATE INDEX IF NOT EXISTS idx_alerts_report_id ON public.alerts_log(report_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts_log(severity);
CREATE INDEX IF NOT EXISTS idx_chat_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_report ON public.file_uploads(report_id);
