-- ============================================================
-- Migration 002: Row Level Security Policies
-- All data is scoped to authenticated users only.
-- For now: single-org model — all authenticated users share data.
-- Owner role has write access; others are read-only except where noted.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financials_monthly     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_sheet_monthly  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debtors_monthly        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_type_performance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_acquisitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_rates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_plan_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_plan_completions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_uploads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_thresholds       ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- ----------------------------------------
-- PROFILES
-- ----------------------------------------
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Owners can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.current_user_role() = 'owner');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ----------------------------------------
-- MONTHLY REPORTS — all auth users read; owner/bookkeeper write
-- ----------------------------------------
CREATE POLICY "Authenticated users can read reports"
  ON public.monthly_reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner and bookkeeper can insert reports"
  ON public.monthly_reports FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

CREATE POLICY "Owner can update reports"
  ON public.monthly_reports FOR UPDATE
  USING (public.current_user_role() = 'owner');

-- ----------------------------------------
-- FINANCIAL DATA — read all auth; write owner/bookkeeper
-- ----------------------------------------
CREATE POLICY "Auth users read financials"
  ON public.financials_monthly FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write financials"
  ON public.financials_monthly FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

CREATE POLICY "Auth users read balance sheet"
  ON public.balance_sheet_monthly FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write balance sheet"
  ON public.balance_sheet_monthly FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

CREATE POLICY "Auth users read debtors"
  ON public.debtors_monthly FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write debtors"
  ON public.debtors_monthly FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

CREATE POLICY "Auth users read bin performance"
  ON public.bin_type_performance FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write bin performance"
  ON public.bin_type_performance FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

-- ----------------------------------------
-- CUSTOMERS
-- ----------------------------------------
CREATE POLICY "Auth users read customers"
  ON public.customers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/manager write customers"
  ON public.customers FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','manager'));

CREATE POLICY "Auth users read acquisitions"
  ON public.customer_acquisitions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write acquisitions"
  ON public.customer_acquisitions FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

-- ----------------------------------------
-- COMPETITOR RATES — all read; owner/manager write
-- ----------------------------------------
CREATE POLICY "Auth users read competitor rates"
  ON public.competitor_rates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/manager insert competitor rates"
  ON public.competitor_rates FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','manager'));

CREATE POLICY "Owner/manager update competitor rates"
  ON public.competitor_rates FOR UPDATE
  USING (public.current_user_role() IN ('owner','manager'));

-- ----------------------------------------
-- COMPLIANCE RECORDS
-- ----------------------------------------
CREATE POLICY "Auth users read compliance"
  ON public.compliance_records FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper write compliance"
  ON public.compliance_records FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

-- ----------------------------------------
-- WORK PLAN ITEMS — all read; owner manages library
-- ----------------------------------------
CREATE POLICY "Auth users read work plan items"
  ON public.work_plan_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner writes work plan items"
  ON public.work_plan_items FOR INSERT
  WITH CHECK (public.current_user_role() = 'owner');

CREATE POLICY "Owner updates work plan items"
  ON public.work_plan_items FOR UPDATE
  USING (public.current_user_role() = 'owner');

-- ----------------------------------------
-- WORK PLAN COMPLETIONS — all auth can mark complete
-- ----------------------------------------
CREATE POLICY "Auth users read completions"
  ON public.work_plan_completions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert completions"
  ON public.work_plan_completions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users delete own completions"
  ON public.work_plan_completions FOR DELETE
  USING (completed_by = auth.uid() OR public.current_user_role() = 'owner');

-- ----------------------------------------
-- ALERTS LOG — all read; system/owner write
-- ----------------------------------------
CREATE POLICY "Auth users read alerts"
  ON public.alerts_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper insert alerts"
  ON public.alerts_log FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

CREATE POLICY "Owner can acknowledge alerts"
  ON public.alerts_log FOR UPDATE
  USING (public.current_user_role() = 'owner');

-- ----------------------------------------
-- FILE UPLOADS
-- ----------------------------------------
CREATE POLICY "Auth users read uploads"
  ON public.file_uploads FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner/bookkeeper insert uploads"
  ON public.file_uploads FOR INSERT
  WITH CHECK (public.current_user_role() IN ('owner','bookkeeper'));

-- ----------------------------------------
-- AI CHAT SESSIONS — users own their sessions
-- ----------------------------------------
CREATE POLICY "Users read own chat sessions"
  ON public.ai_chat_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own chat sessions"
  ON public.ai_chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own chat sessions"
  ON public.ai_chat_sessions FOR UPDATE
  USING (user_id = auth.uid());

-- ----------------------------------------
-- ALERT THRESHOLDS — all read; owner writes
-- ----------------------------------------
CREATE POLICY "Auth users read thresholds"
  ON public.alert_thresholds FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owner write thresholds"
  ON public.alert_thresholds FOR INSERT
  WITH CHECK (public.current_user_role() = 'owner');

CREATE POLICY "Owner update thresholds"
  ON public.alert_thresholds FOR UPDATE
  USING (public.current_user_role() = 'owner');
