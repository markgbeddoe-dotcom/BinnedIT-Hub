-- ============================================================
-- Migration 032: Security RLS lockdown + dead-table policies (2026-06-12)
-- ============================================================
-- Full-system assessment (7-agent fleet) found:
--  SEC-1 (P0): permissive qual=true/check=true policies let an investor/
--    viewer/bookkeeper JWT WRITE bookings + operational tables via REST.
--    Andrew (investor persona) proved it at the API layer.
--  SEC-3 (P1): leftover permissive hazard_reports UPDATE ORs over the
--    manager-only policy → anyone updates hazard status.
--  SEC-4 (P1): fleet_manager excluded from ~10 owner/manager policies the
--    isManager UI flag exposes to Jake (fleet, waste audits, rules, etc.).
--  DEAD-1/2/3: staff_certificates, insurance_policies, notifications,
--    audit_log have RLS ENABLED with ZERO policies → silently dead.
--
-- Design invariant: the driver journey (J4, proven 2026-06-12) must keep
-- working — an assigned driver updates their own booking's status and
-- inserts their own job_events/job_photos/vehicle_checklists/hazard rows.
--
-- Role model (from AuthContext): office = owner|manager|fleet_manager;
-- bookkeeper reads finance; driver operates own jobs; viewer|investor are
-- read-only dashboards and must never write operational data.
--
-- Idempotent. Public/anon booking INSERT policies are left untouched.
-- ============================================================

-- ─── bookings ────────────────────────────────────────────────
-- Drop the four permissive authenticated policies (keep anon INSERT).
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "auth_update_bookings"                    ON public.bookings;
DROP POLICY IF EXISTS "Authenticated users can view bookings"   ON public.bookings;
DROP POLICY IF EXISTS "auth_select_bookings"                    ON public.bookings;

-- Read: office + bookkeeper (invoicing) see all; a driver sees their own.
CREATE POLICY "Office and own-driver read bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper')
    OR driver_id = auth.uid()
  );

-- Update: office reassigns/cancels; the assigned driver progresses status.
CREATE POLICY "Office and own-driver update bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN ('owner','manager','fleet_manager')
    OR driver_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() IN ('owner','manager','fleet_manager')
    OR driver_id = auth.uid()
  );

-- Authenticated insert (office "+ New Job"); anon public-booking insert
-- policies remain in place for the /book + /embed funnels.
DROP POLICY IF EXISTS "auth_insert_bookings" ON public.bookings;
CREATE POLICY "Office insert bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

-- ─── job_events / job_photos: operational roles only (no investor/viewer) ──
DROP POLICY IF EXISTS "Authenticated users insert job events" ON public.job_events;
DROP POLICY IF EXISTS "auth_insert_job_events"                ON public.job_events;
CREATE POLICY "Operational roles insert job events"
  ON public.job_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager','driver'));

DROP POLICY IF EXISTS "Authenticated users insert job photos" ON public.job_photos;
DROP POLICY IF EXISTS "auth_insert_job_photos"                ON public.job_photos;
CREATE POLICY "Operational roles insert job photos"
  ON public.job_photos FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager','driver'));

-- ─── vehicle_checklists: a driver submits their OWN; office may backfill ──
DROP POLICY IF EXISTS "Authenticated users insert checklists" ON public.vehicle_checklists;
DROP POLICY IF EXISTS "auth_insert_checklists"                ON public.vehicle_checklists;
CREATE POLICY "Own driver or office insert checklists"
  ON public.vehicle_checklists FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    OR public.current_user_role() IN ('owner','manager','fleet_manager')
  );

-- ─── hazard_reports: drop permissive update; insert by operational roles ──
DROP POLICY IF EXISTS "auth_update_hazard_reports"             ON public.hazard_reports;
DROP POLICY IF EXISTS "Managers update hazard status"          ON public.hazard_reports;
CREATE POLICY "Office update hazard status"
  ON public.hazard_reports FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Authenticated users insert hazard reports" ON public.hazard_reports;
DROP POLICY IF EXISTS "auth_insert_hazard_reports"                ON public.hazard_reports;
CREATE POLICY "Operational roles insert hazard reports"
  ON public.hazard_reports FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager','driver'));

-- ─── customers: PII — office + bookkeeper read; no driver/viewer/investor ──
DROP POLICY IF EXISTS "All authenticated can read customers" ON public.customers;
DROP POLICY IF EXISTS "Auth users read customers"            ON public.customers;
CREATE POLICY "Office read customers"
  ON public.customers FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper'));

-- ─── SEC-4: extend owner/manager write policies to fleet_manager ─────────
-- Helper pattern: drop + recreate each with the 3-role office array.
DROP POLICY IF EXISTS "Owner and manager can manage fleet_assets" ON public.fleet_assets;
CREATE POLICY "Office can manage fleet_assets"
  ON public.fleet_assets FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner and manager can manage maintenance" ON public.fleet_maintenance_records;
CREATE POLICY "Office can manage maintenance"
  ON public.fleet_maintenance_records FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner manager write business rules" ON public.business_rules;
CREATE POLICY "Office write business rules"
  ON public.business_rules FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner or managers update waste audits" ON public.waste_audits;
CREATE POLICY "Office update waste audits"
  ON public.waste_audits FOR UPDATE TO authenticated
  USING ((created_by = auth.uid()) OR public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK ((created_by = auth.uid()) OR public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Managers insert billing adjustments" ON public.billing_adjustments;
CREATE POLICY "Office insert billing adjustments"
  ON public.billing_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Managers update billing adjustments" ON public.billing_adjustments;
CREATE POLICY "Office update billing adjustments"
  ON public.billing_adjustments FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner and manager update ai_insights" ON public.ai_insights;
CREATE POLICY "Office update ai_insights"
  ON public.ai_insights FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner and manager can manage bin_types" ON public.bin_types;
CREATE POLICY "Office can manage bin_types"
  ON public.bin_types FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Owner manager manage tip sites" ON public.tip_sites;
CREATE POLICY "Office manage tip sites"
  ON public.tip_sites FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

-- ─── DEAD-1: staff_certificates + insurance_policies — schema + policies ──
-- Reconcile to the UI contract (additive; existing columns retained).
ALTER TABLE public.staff_certificates
  ADD COLUMN IF NOT EXISTS staff_name text,
  ADD COLUMN IF NOT EXISTS cert_name  text,
  ADD COLUMN IF NOT EXISTS issuer     text,
  ADD COLUMN IF NOT EXISTS is_active  boolean DEFAULT true;

ALTER TABLE public.insurance_policies
  ADD COLUMN IF NOT EXISTS insured_amount  numeric(14,2),
  ADD COLUMN IF NOT EXISTS annual_premium  numeric(12,2),
  ADD COLUMN IF NOT EXISTS start_date      date,
  ADD COLUMN IF NOT EXISTS is_active       boolean DEFAULT true;

DROP POLICY IF EXISTS "Office read staff certificates" ON public.staff_certificates;
CREATE POLICY "Office read staff certificates"
  ON public.staff_certificates FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper'));
DROP POLICY IF EXISTS "Office manage staff certificates" ON public.staff_certificates;
CREATE POLICY "Office manage staff certificates"
  ON public.staff_certificates FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

DROP POLICY IF EXISTS "Office read insurance policies" ON public.insurance_policies;
CREATE POLICY "Office read insurance policies"
  ON public.insurance_policies FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper'));
DROP POLICY IF EXISTS "Office manage insurance policies" ON public.insurance_policies;
CREATE POLICY "Office manage insurance policies"
  ON public.insurance_policies FOR ALL TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager','fleet_manager'));

-- ─── DEAD-2: notifications — user-scoped policies (bell + dismiss) ───────
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── DEAD-3: audit_log — office read (write stays service-role) ─────────
DROP POLICY IF EXISTS "Office read audit log" ON public.audit_log;
CREATE POLICY "Office read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper'));
