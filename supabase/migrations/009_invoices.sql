-- ============================================================
-- Migration 009: Invoices — Auto-generation & Payment Tracking
-- Idempotent — safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid        REFERENCES public.bookings(id) ON DELETE SET NULL,
  invoice_number   text        UNIQUE NOT NULL,
  customer_name    text        NOT NULL,
  customer_email   text,
  amount           numeric(10,2) NOT NULL DEFAULT 0,   -- ex-GST
  gst              numeric(10,2) NOT NULL DEFAULT 0,
  total            numeric(10,2) NOT NULL DEFAULT 0,   -- inc-GST
  status           text        NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  xero_invoice_id  text,
  xero_sync_status text        DEFAULT 'pending'
                               CHECK (xero_sync_status IN ('pending','synced','error')),
  sent_at          timestamptz,
  paid_at          timestamptz,
  due_date         date,
  reminder_7_sent  boolean     NOT NULL DEFAULT false,
  reminder_14_sent boolean     NOT NULL DEFAULT false,
  reminder_30_sent boolean     NOT NULL DEFAULT false,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS invoices_status_idx     ON public.invoices (status);
CREATE INDEX IF NOT EXISTS invoices_booking_idx    ON public.invoices (booking_id);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx   ON public.invoices (due_date);
CREATE INDEX IF NOT EXISTS invoices_created_idx    ON public.invoices (created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_xero_idx       ON public.invoices (xero_invoice_id);

-- Row Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Authenticated users can view invoices'
  ) THEN
    CREATE POLICY "Authenticated users can view invoices"
      ON public.invoices FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Owner and bookkeeper can manage invoices'
  ) THEN
    CREATE POLICY "Owner and bookkeeper can manage invoices"
      ON public.invoices FOR ALL
      TO authenticated
      USING  (public.current_user_role() IN ('owner', 'bookkeeper'))
      WITH CHECK (public.current_user_role() IN ('owner', 'bookkeeper'));
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_invoices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_invoices_updated_at();
