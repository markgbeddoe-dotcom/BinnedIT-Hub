-- ============================================================
-- Migration 008: Dispatch Board — Bookings Table
-- Binned-IT Dashboard Hub v2.2 — Phase 2 Sprint 8
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name   text NOT NULL,
  bin_size        text,
  waste_type      text,
  address         text,
  suburb          text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed')),
  driver_name     text,
  truck_id        text,
  scheduled_date  date,
  estimated_cost  numeric(10,2),
  margin_pct      numeric(5,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for status-based queries (Kanban column filtering)
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_scheduled_date_idx ON public.bookings (scheduled_date);

-- Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'bookings_select') THEN
    CREATE POLICY bookings_select ON public.bookings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'bookings_insert') THEN
    CREATE POLICY bookings_insert ON public.bookings FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'bookings_update') THEN
    CREATE POLICY bookings_update ON public.bookings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
