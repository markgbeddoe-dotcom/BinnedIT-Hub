-- 016_booking_xero_invoice.sql
-- Add Xero invoice tracking columns to the bookings table.
-- Idempotent: ADD COLUMN IF NOT EXISTS is safe to re-run.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS xero_invoice_id     text,
  ADD COLUMN IF NOT EXISTS xero_invoice_status text DEFAULT 'none';
