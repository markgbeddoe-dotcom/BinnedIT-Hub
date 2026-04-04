-- ============================================================
-- Migration 010: Phase 6 — Audit Trail, Notifications,
--                Staff Certificates, Insurance Policies
-- Idempotent — safe to re-run
-- ============================================================

-- ── profiles: add phone column if missing ────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- ── Audit Log (immutable — only DB triggers can insert) ──────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   text        NOT NULL,
  record_id    text,
  action       text        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  old_values   jsonb,
  new_values   jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_table_idx   ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS audit_log_by_idx      ON public.audit_log (changed_by);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx  ON public.audit_log (action);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log'
      AND policyname = 'Owners and managers can read audit log'
  ) THEN
    CREATE POLICY "Owners and managers can read audit log"
      ON public.audit_log FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('owner', 'manager'));
  END IF;
END $$;

-- ── Audit trigger function (SECURITY DEFINER to bypass RLS) ──
CREATE OR REPLACE FUNCTION public.audit_log_fn()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_record_id text;
  v_old_vals  jsonb;
  v_new_vals  jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := (OLD.id)::text;
    v_old_vals  := to_jsonb(OLD);
    v_new_vals  := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := (NEW.id)::text;
    v_old_vals  := NULL;
    v_new_vals  := to_jsonb(NEW);
  ELSE
    v_record_id := (NEW.id)::text;
    v_old_vals  := to_jsonb(OLD);
    v_new_vals  := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old_vals, v_new_vals);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_bookings_trg ON public.bookings;
CREATE TRIGGER audit_bookings_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_fn();

DROP TRIGGER IF EXISTS audit_invoices_trg ON public.invoices;
CREATE TRIGGER audit_invoices_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_fn();

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text        NOT NULL DEFAULT 'general'
                            CHECK (type IN (
                              'booking_received','job_completed','invoice_paid',
                              'compliance_expiry','hazard_report','general'
                            )),
  title         text        NOT NULL,
  body          text,
  related_id    uuid,
  related_table text,
  is_read       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx    ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx    ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications (created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users can view their own notifications'
  ) THEN
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users can update their own notifications'
  ) THEN
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications FOR UPDATE TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Authenticated can insert notifications'
  ) THEN
    CREATE POLICY "Authenticated can insert notifications"
      ON public.notifications FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'Users can delete their own notifications'
  ) THEN
    CREATE POLICY "Users can delete their own notifications"
      ON public.notifications FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ── Insurance Policies ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.insurance_policies (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number  text,
  provider       text        NOT NULL,
  policy_type    text        NOT NULL DEFAULT 'other'
                             CHECK (policy_type IN (
                               'public_liability','workers_comp','vehicle','property','other'
                             )),
  insured_amount numeric(12,2),
  annual_premium numeric(10,2),
  start_date     date,
  expiry_date    date        NOT NULL,
  notes          text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS insurance_expiry_idx ON public.insurance_policies (expiry_date);

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_policies'
      AND policyname = 'Authenticated can view insurance'
  ) THEN
    CREATE POLICY "Authenticated can view insurance"
      ON public.insurance_policies FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'insurance_policies'
      AND policyname = 'Owner can manage insurance'
  ) THEN
    CREATE POLICY "Owner can manage insurance"
      ON public.insurance_policies FOR ALL TO authenticated
      USING  (public.current_user_role() IN ('owner', 'manager'))
      WITH CHECK (public.current_user_role() IN ('owner', 'manager'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_insurance_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS insurance_updated_at ON public.insurance_policies;
CREATE TRIGGER insurance_updated_at
  BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.handle_insurance_updated_at();

-- ── Staff Certificates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_certificates (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  staff_name    text        NOT NULL,
  cert_name     text        NOT NULL,
  cert_type     text        NOT NULL DEFAULT 'other'
                            CHECK (cert_type IN (
                              'asbestos_supervisor','asbestos_worker','whs',
                              'drivers_licence','heavy_vehicle','first_aid','other'
                            )),
  cert_number   text,
  issuer        text,
  issued_date   date,
  expiry_date   date,
  notes         text,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_certs_profile_idx ON public.staff_certificates (profile_id);
CREATE INDEX IF NOT EXISTS staff_certs_expiry_idx  ON public.staff_certificates (expiry_date);

ALTER TABLE public.staff_certificates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_certificates'
      AND policyname = 'Authenticated can view staff certs'
  ) THEN
    CREATE POLICY "Authenticated can view staff certs"
      ON public.staff_certificates FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'staff_certificates'
      AND policyname = 'Owner and manager can manage staff certs'
  ) THEN
    CREATE POLICY "Owner and manager can manage staff certs"
      ON public.staff_certificates FOR ALL TO authenticated
      USING  (public.current_user_role() IN ('owner', 'manager'))
      WITH CHECK (public.current_user_role() IN ('owner', 'manager'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_staff_certs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS staff_certs_updated_at ON public.staff_certificates;
CREATE TRIGGER staff_certs_updated_at
  BEFORE UPDATE ON public.staff_certificates
  FOR EACH ROW EXECUTE FUNCTION public.handle_staff_certs_updated_at();

-- ── Seed: insurance policies ──────────────────────────────────
INSERT INTO public.insurance_policies (provider, policy_type, policy_number, insured_amount, expiry_date, notes)
VALUES
  ('QBE Australia',  'public_liability', 'QBE-2024-8872',  20000000, '2026-11-30', 'Public & Product Liability $20M'),
  ('Allianz',        'workers_comp',     'ALZ-WC-2025-001', NULL,     '2026-06-30', 'Workers Compensation — mandatory renewal'),
  ('AAMI',           'vehicle',          'AAMI-VEH-0093',  500000,   '2026-08-15', 'Fleet — TRK-001, TRK-002 & trailer')
ON CONFLICT DO NOTHING;

-- ── Seed: staff certificates ──────────────────────────────────
INSERT INTO public.staff_certificates (staff_name, cert_name, cert_type, issuer, expiry_date)
VALUES
  ('Mark Beddoe', 'Asbestos Removal Supervisor',  'asbestos_supervisor', 'SafeWork VIC', '2026-08-15'),
  ('Driver 1',    'Asbestos Removal Worker',       'asbestos_worker',     'SafeWork VIC', '2026-11-30'),
  ('Driver 2',    'Asbestos Removal Worker',       'asbestos_worker',     'SafeWork VIC', '2025-12-31'),
  ('All Staff',   'WHS Induction',                 'whs',                 'Binned-IT',    '2026-06-30'),
  ('Mark Beddoe', 'Heavy Vehicle Licence (HC)',    'heavy_vehicle',       'VicRoads',     '2027-03-15')
ON CONFLICT DO NOTHING;

-- ── Seed: sample notifications for owner ─────────────────────
-- (These are examples; real notifications will be created by app events)
