-- ============================================================
-- Migration 018: Per-Bin Cost Detail + Derived Loss-Making Metrics
-- Sprint 14 #15
--
-- Audit (docs/audits/2026-05-06/audit-pricing-bugs.md §3) found that the
-- "loss-making bin types" alert in PricingTab.jsx:160 reads `d.feb.np` from
-- STATIC `pricingData` rather than from a derived metric over live cost
-- allocation. This migration adds per-bin cost-detail columns to
-- bin_type_performance so the dashboard can drill down into "why is this
-- bin losing money?".
--
-- All ALTERs use ADD COLUMN IF NOT EXISTS so re-running is a no-op.
-- ============================================================

ALTER TABLE public.bin_type_performance
  ADD COLUMN IF NOT EXISTS tipping_per_job        numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_per_job           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wages_direct_per_job   numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wages_overhead_per_job numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rent_per_job           numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advertising_per_job    numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_opex_per_job     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost_per_job     numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_per_job         numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_margin_pct_derived numeric(6,2)  DEFAULT 0;

COMMENT ON COLUMN public.bin_type_performance.net_margin_pct_derived IS
  'Computed from revenue / deliveries / *_per_job. The legacy net_margin_pct field is kept for backward compat.';
