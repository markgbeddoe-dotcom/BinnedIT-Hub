-- Migration 007: ESG / Waste Diversion Tracking
-- Adds waste diversion fields to financials_monthly
-- Idempotent — safe to re-run

ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS tonnes_landfill  numeric(10,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tonnes_recycled  numeric(10,3) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tonnes_diverted  numeric(10,3) DEFAULT NULL;

COMMENT ON COLUMN public.financials_monthly.tonnes_landfill IS 'Tonnes sent to landfill this month';
COMMENT ON COLUMN public.financials_monthly.tonnes_recycled IS 'Tonnes recycled / processed for reuse this month';
COMMENT ON COLUMN public.financials_monthly.tonnes_diverted IS 'Total tonnes diverted from landfill (recycled + other diversion)';
