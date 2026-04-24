-- ============================================================
-- Migration 014: CRM Enhancement + Collections Engine
-- Binned-IT Dashboard Hub v2.2
-- Idempotent — safe to re-run
-- ============================================================

-- ── 1. Enhance customers table ────────────────────────────────────────────────

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS abn text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS acn text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'commercial'
  CHECK (account_type IN ('residential','commercial','account','cod'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'active'
  CHECK (account_status IN ('prospect','application','active','suspended','closed'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_status text DEFAULT 'unrated'
  CHECK (credit_status IN ('unrated','approved','review','declined'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_terms_days integer DEFAULT 14;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS creditorwatch_ref text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS creditorwatch_score text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS creditorwatch_checked_at timestamptz;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ppsr_registered boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ppsr_registration_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS director_guarantee_required boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS director_guarantee_received boolean DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS outstanding_balance numeric(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS overdue_balance numeric(12,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS days_overdue integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS on_time_payment_pct numeric(5,2) DEFAULT 100;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_payments integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS late_payments integer DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS state text DEFAULT 'VIC';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS postcode text;

-- Link bookings → customers (CRM-first booking)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_customer_idx ON public.bookings(customer_id);

-- Link invoices → customers + billing contact
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS collections_level integer DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS collections_last_action_at timestamptz;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS interest_accrued numeric(10,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON public.invoices(customer_id);

-- ── 2. Customer contacts (multiple per account) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  role                text        NOT NULL DEFAULT 'general'
                                  CHECK (role IN ('primary','billing','service','bookings','legal','general')),
  name                text        NOT NULL,
  title               text,
  email               text,
  phone               text,
  mobile              text,
  is_primary          boolean     DEFAULT false,
  receives_invoices   boolean     DEFAULT false,
  receives_statements boolean     DEFAULT false,
  receives_bookings   boolean     DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cc_customer_idx ON public.customer_contacts(customer_id);
CREATE INDEX IF NOT EXISTS cc_role_idx     ON public.customer_contacts(customer_id, role);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_contacts' AND policyname='All authenticated can read customer_contacts') THEN
    CREATE POLICY "All authenticated can read customer_contacts" ON public.customer_contacts
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_contacts' AND policyname='Staff can manage customer_contacts') THEN
    CREATE POLICY "Staff can manage customer_contacts" ON public.customer_contacts
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager','bookkeeper'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS cc_updated_at ON public.customer_contacts;
CREATE TRIGGER cc_updated_at BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add billing_contact_id FK to invoices (table now exists)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS billing_contact_id uuid REFERENCES public.customer_contacts(id) ON DELETE SET NULL;

-- ── 3. Customer directors / guarantors ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_directors (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id             uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name                    text        NOT NULL,
  title                   text        DEFAULT 'Director',
  dob                     date,
  address                 text,
  suburb                  text,
  state                   text        DEFAULT 'VIC',
  postcode                text,
  email                   text,
  phone                   text,
  is_guarantor            boolean     DEFAULT false,
  guarantee_signed        boolean     DEFAULT false,
  guarantee_signed_at     timestamptz,
  guarantee_witnessed_by  text,
  guarantee_amount_limit  numeric(12,2),
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cdir_customer_idx ON public.customer_directors(customer_id);

ALTER TABLE public.customer_directors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_directors' AND policyname='All authenticated can read customer_directors') THEN
    CREATE POLICY "All authenticated can read customer_directors" ON public.customer_directors
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_directors' AND policyname='Owner and manager can manage customer_directors') THEN
    CREATE POLICY "Owner and manager can manage customer_directors" ON public.customer_directors
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS cdir_updated_at ON public.customer_directors;
CREATE TRIGGER cdir_updated_at BEFORE UPDATE ON public.customer_directors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Trade references ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_trade_refs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referee_business     text        NOT NULL,
  referee_contact      text,
  referee_phone        text,
  referee_email        text,
  credit_limit_held    numeric(12,2),
  payment_terms_days   integer,
  result               text        DEFAULT 'pending'
                                   CHECK (result IN ('pending','satisfactory','unsatisfactory','no_response')),
  checked_at           timestamptz,
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ctr_customer_idx ON public.customer_trade_refs(customer_id);

ALTER TABLE public.customer_trade_refs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_trade_refs' AND policyname='All authenticated can read customer_trade_refs') THEN
    CREATE POLICY "All authenticated can read customer_trade_refs" ON public.customer_trade_refs
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_trade_refs' AND policyname='Staff can manage customer_trade_refs') THEN
    CREATE POLICY "Staff can manage customer_trade_refs" ON public.customer_trade_refs
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager','bookkeeper'));
  END IF;
END $$;

-- ── 5. Credit applications ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_applications (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status                      text        DEFAULT 'draft'
                                          CHECK (status IN ('draft','submitted','under_review','approved','declined')),
  requested_credit_limit      numeric(12,2),
  requested_terms_days        integer,
  approved_credit_limit       numeric(12,2),
  approved_terms_days         integer,
  abn                         text,
  acn                         text,
  business_type               text        CHECK (business_type IN ('company','sole_trader','trust','partnership')),
  years_in_business           integer,
  annual_turnover_est         numeric(12,2),
  creditorwatch_checked       boolean     DEFAULT false,
  creditorwatch_result        text,
  creditorwatch_score         text,
  trade_refs_count            integer     DEFAULT 0,
  trade_refs_satisfactory     integer     DEFAULT 0,
  director_guarantee_required boolean     DEFAULT false,
  director_guarantee_received boolean     DEFAULT false,
  reviewed_by                 text,
  reviewed_at                 timestamptz,
  submitted_at                timestamptz,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ca_customer_idx ON public.credit_applications(customer_id);
CREATE INDEX IF NOT EXISTS ca_status_idx   ON public.credit_applications(status);

ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_applications' AND policyname='All authenticated can read credit_applications') THEN
    CREATE POLICY "All authenticated can read credit_applications" ON public.credit_applications
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='credit_applications' AND policyname='Owner and manager can manage credit_applications') THEN
    CREATE POLICY "Owner and manager can manage credit_applications" ON public.credit_applications
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

DROP TRIGGER IF EXISTS ca_updated_at ON public.credit_applications;
CREATE TRIGGER ca_updated_at BEFORE UPDATE ON public.credit_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 6. Account contracts (T&C acceptance audit trail) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.account_contracts (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                 uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  version                     text        NOT NULL DEFAULT '1.0',
  signed_by_name              text,
  signed_by_title             text,
  signed_at                   timestamptz,
  signature_method            text        DEFAULT 'digital'
                                          CHECK (signature_method IN ('digital','wet_ink','email')),
  ip_address                  text,
  witnessed_by                text,
  director_guarantee_included boolean     DEFAULT false,
  ppsr_consent_given          boolean     DEFAULT false,
  payment_terms_days          integer,
  credit_limit                numeric(12,2),
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ac_customer_idx ON public.account_contracts(customer_id);

ALTER TABLE public.account_contracts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_contracts' AND policyname='All authenticated can read account_contracts') THEN
    CREATE POLICY "All authenticated can read account_contracts" ON public.account_contracts
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='account_contracts' AND policyname='Owner and manager can manage account_contracts') THEN
    CREATE POLICY "Owner and manager can manage account_contracts" ON public.account_contracts
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

-- ── 7. Customer notes (fixing missing migration) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  note        text        NOT NULL,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cn_customer_idx ON public.customer_notes(customer_id);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_notes' AND policyname='All authenticated can read customer_notes') THEN
    CREATE POLICY "All authenticated can read customer_notes" ON public.customer_notes
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='customer_notes' AND policyname='Staff can manage customer_notes') THEN
    CREATE POLICY "Staff can manage customer_notes" ON public.customer_notes
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','manager','bookkeeper'));
  END IF;
END $$;

-- ── 8. Collections events (escalation audit trail) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.collections_events (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id             uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  level                   integer     NOT NULL DEFAULT 1
                                      CHECK (level IN (1,2,3,4)),
  action_type             text        NOT NULL DEFAULT 'notice'
                                      CHECK (action_type IN (
                                        'notice','formal_notice','letter_of_demand',
                                        'statutory_demand','legal_referral',
                                        'payment_arrangement','written_off','paid'
                                      )),
  amount_at_action        numeric(12,2),
  days_overdue_at_action  integer,
  letter_body             text,
  sent_by                 text,
  sent_at                 timestamptz DEFAULT now(),
  delivery_method         text        DEFAULT 'email'
                                      CHECK (delivery_method IN ('email','post','email_post','hand_delivered')),
  response_received       boolean     DEFAULT false,
  response_notes          text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ce_customer_idx ON public.collections_events(customer_id);
CREATE INDEX IF NOT EXISTS ce_invoice_idx  ON public.collections_events(invoice_id);
CREATE INDEX IF NOT EXISTS ce_level_idx    ON public.collections_events(level);
CREATE INDEX IF NOT EXISTS ce_sent_idx     ON public.collections_events(sent_at DESC);

ALTER TABLE public.collections_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='collections_events' AND policyname='All authenticated can read collections_events') THEN
    CREATE POLICY "All authenticated can read collections_events" ON public.collections_events
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='collections_events' AND policyname='Staff can manage collections_events') THEN
    CREATE POLICY "Staff can manage collections_events" ON public.collections_events
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','bookkeeper','manager'));
  END IF;
END $$;

-- ── 9. Payment history (per-invoice payment conduct) ─────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_history (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid        NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id     uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  invoice_number text,
  amount         numeric(12,2) NOT NULL,
  due_date       date,
  paid_date      date,
  days_late      integer     DEFAULT 0,
  payment_method text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_customer_idx ON public.payment_history(customer_id);
CREATE INDEX IF NOT EXISTS ph_invoice_idx  ON public.payment_history(invoice_id);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_history' AND policyname='All authenticated can read payment_history') THEN
    CREATE POLICY "All authenticated can read payment_history" ON public.payment_history
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='payment_history' AND policyname='Staff can manage payment_history') THEN
    CREATE POLICY "Staff can manage payment_history" ON public.payment_history
      FOR ALL TO authenticated USING (public.current_user_role() IN ('owner','bookkeeper','manager'));
  END IF;
END $$;

-- ── 10. Helper: recalculate customer risk score ───────────────────────────────

CREATE OR REPLACE FUNCTION public.calc_customer_risk_score(
  p_late_payments    integer,
  p_total_payments   integer,
  p_overdue_balance  numeric,
  p_credit_limit     numeric,
  p_days_overdue     integer
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  score integer := 0;
  late_pct numeric;
BEGIN
  IF p_total_payments > 0 THEN
    late_pct := (p_late_payments::numeric / p_total_payments) * 100;
    score := score + LEAST(50, late_pct::integer);
  END IF;
  IF p_credit_limit > 0 AND p_overdue_balance > 0 THEN
    score := score + LEAST(30, ((p_overdue_balance / p_credit_limit) * 30)::integer);
  END IF;
  IF p_days_overdue > 0 THEN
    score := score + LEAST(20, (p_days_overdue / 3)::integer);
  END IF;
  RETURN LEAST(100, score);
END;
$$;
