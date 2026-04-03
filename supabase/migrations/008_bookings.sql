-- 008_bookings.sql
-- Bookings table — Customer Booking Form + Dispatch Board
-- Sprint 8: merged from booking-form branch and dispatch board branch

CREATE TABLE IF NOT EXISTS public.bookings (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name        text        NOT NULL,
  customer_email       text,
  customer_phone       text,
  address              text,
  suburb               text,
  postcode             text,
  bin_size             text,
  waste_type           text,
  delivery_date        date,
  collection_date      date,
  special_instructions text,
  price                numeric(10,2),
  -- Dispatch fields
  driver_name          text,
  truck_id             text,
  scheduled_date       date,
  estimated_cost       numeric(10,2),
  margin_pct           numeric(5,2),
  notes                text,
  status               text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','confirmed','scheduled','in_progress','completed','cancelled')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS bookings_status_idx        ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_delivery_idx      ON public.bookings (delivery_date);
CREATE INDEX IF NOT EXISTS bookings_scheduled_date_idx ON public.bookings (scheduled_date);
CREATE INDEX IF NOT EXISTS bookings_created_idx       ON public.bookings (created_at DESC);

-- Row Level Security
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Public can create bookings') THEN
    CREATE POLICY "Public can create bookings"
      ON public.bookings FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Authenticated users can view bookings') THEN
    CREATE POLICY "Authenticated users can view bookings"
      ON public.bookings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Authenticated users can update bookings') THEN
    CREATE POLICY "Authenticated users can update bookings"
      ON public.bookings FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_bookings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_updated_at ON public.bookings;
CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_bookings_updated_at();
