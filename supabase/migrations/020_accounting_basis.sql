-- ============================================================
-- Migration 020: Cash/Accrual basis support (Sprint 17 #17C)
--
-- Adds an `accounting_basis` discriminator to the three Xero-fed monthly
-- tables so we can store BOTH cash-basis and accrual-basis snapshots for
-- the same report_month side-by-side.
--
-- Background: Sprint 10 onwards synced Xero P&L without `paymentsOnly`
-- (i.e. accrual basis). The accountant works on cash basis. From Sprint 17
-- the sync writes both, the dashboard lets the user switch.
--
-- Backfill rule: every existing row was synced under accrual, so we mark
-- them all 'accrual' unconditionally. The default for new rows is 'cash'
-- to match the new app default (matches accountant working basis).
--
-- Idempotent — DROP CONSTRAINT IF EXISTS … then ADD; ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ── financials_monthly ───────────────────────────────────────────────────────

ALTER TABLE public.financials_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

-- Backfill: every existing row was written under accrual basis (Sprint 10
-- onwards never passed paymentsOnly). Safe to update unconditionally because
-- this migration runs ONCE before the new sync code starts writing 'cash' rows.
UPDATE public.financials_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.financials_monthly
  DROP CONSTRAINT IF EXISTS financials_monthly_report_month_basis_uniq;
ALTER TABLE public.financials_monthly
  ADD CONSTRAINT financials_monthly_report_month_basis_uniq
    UNIQUE (report_id, report_month, accounting_basis);

-- ── balance_sheet_monthly ────────────────────────────────────────────────────

ALTER TABLE public.balance_sheet_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

UPDATE public.balance_sheet_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.balance_sheet_monthly
  DROP CONSTRAINT IF EXISTS balance_sheet_monthly_report_month_basis_uniq;
ALTER TABLE public.balance_sheet_monthly
  ADD CONSTRAINT balance_sheet_monthly_report_month_basis_uniq
    UNIQUE (report_id, report_month, accounting_basis);

-- ── debtors_monthly ──────────────────────────────────────────────────────────

ALTER TABLE public.debtors_monthly
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash'
    CHECK (accounting_basis IN ('cash','accrual'));

UPDATE public.debtors_monthly
   SET accounting_basis = 'accrual'
 WHERE accounting_basis = 'cash';

ALTER TABLE public.debtors_monthly
  DROP CONSTRAINT IF EXISTS debtors_monthly_report_month_basis_debtor_uniq;
ALTER TABLE public.debtors_monthly
  ADD CONSTRAINT debtors_monthly_report_month_basis_debtor_uniq
    UNIQUE (report_id, report_month, accounting_basis, debtor_name);

-- ── Indexes for the new column (basis-filtered reads) ────────────────────────

CREATE INDEX IF NOT EXISTS idx_financials_basis
  ON public.financials_monthly(report_month, accounting_basis);
CREATE INDEX IF NOT EXISTS idx_balance_basis
  ON public.balance_sheet_monthly(report_month, accounting_basis);
CREATE INDEX IF NOT EXISTS idx_debtors_basis
  ON public.debtors_monthly(report_month, accounting_basis);

-- ── Documentation ────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.financials_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
COMMENT ON COLUMN public.balance_sheet_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
COMMENT ON COLUMN public.debtors_monthly.accounting_basis IS
  'cash | accrual — Sprint 17 #17C. cash=Xero paymentsOnly=true. Default cash.';
