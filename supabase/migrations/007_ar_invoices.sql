-- ============================================================
-- Migration 007: AR Invoices table for overdue reminders
-- Idempotent — safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ar_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text NOT NULL,
  customer_name     text NOT NULL,
  customer_email    text,
  amount            numeric(12,2) NOT NULL,
  due_date          date NOT NULL,
  issued_date       date NOT NULL DEFAULT CURRENT_DATE,
  status            text NOT NULL DEFAULT 'outstanding'
                      CHECK (status IN ('outstanding','paid','written_off')),
  reminder_7_sent   timestamptz,
  reminder_14_sent  timestamptz,
  reminder_30_sent  timestamptz,
  xero_invoice_id   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;

-- Owners and managers can manage all invoices; viewers/bookkeepers read-only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='ar_invoices' AND policyname='ar_invoices_select'
  ) THEN
    CREATE POLICY ar_invoices_select ON public.ar_invoices
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='ar_invoices' AND policyname='ar_invoices_write'
  ) THEN
    CREATE POLICY ar_invoices_write ON public.ar_invoices
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('owner','manager','bookkeeper')
        )
      );
  END IF;
END $$;

-- Index for efficient overdue queries
CREATE INDEX IF NOT EXISTS ar_invoices_status_due_date
  ON public.ar_invoices (status, due_date)
  WHERE status = 'outstanding';
