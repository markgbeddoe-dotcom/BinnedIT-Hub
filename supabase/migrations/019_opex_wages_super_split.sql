-- ============================================================
-- Migration 019: Split opex_admin into opex_wages + opex_super
-- Sprint 15 #26 (audit P2 reconciliation 2026-05-06)
--
-- Audit (docs/audits/2026-05-06/audit-reconciliation.md §P2 #26) found that
-- `opex_admin` silently bundles Wages + Superannuation, hiding the labour
-- vs. on-costs split that owners need for management reporting.
--
-- This migration adds the two new columns. `opex_admin` is RETAINED as a
-- legacy aggregate (= opex_wages + opex_super) so dashboard tiles using it
-- continue to work. The xero-mapper writes both the new columns AND the
-- legacy aggregate.
--
-- All ALTERs use ADD COLUMN IF NOT EXISTS so re-running is a no-op.
-- ============================================================

ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS opex_wages numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opex_super numeric(12,2) DEFAULT 0;

COMMENT ON COLUMN public.financials_monthly.opex_wages IS
  'Wages and Salaries (excludes Superannuation). Sprint 15 #26 split from opex_admin.';
COMMENT ON COLUMN public.financials_monthly.opex_super IS
  'Superannuation. Sprint 15 #26 split from opex_admin.';
COMMENT ON COLUMN public.financials_monthly.opex_admin IS
  'Legacy aggregate kept for backward compat = opex_wages + opex_super.';
