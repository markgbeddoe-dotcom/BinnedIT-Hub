-- ============================================================
-- Migration 004b: Seed Historical Data — Jul 2025 to Feb 2026
-- Binned-IT Dashboard Hub v2.2 — Sprint 2A
-- DO NOT apply automatically — run manually in Supabase SQL editor
-- Safe to re-run (INSERT ... ON CONFLICT DO NOTHING)
-- ============================================================

-- Data sourced from src/data/financials.js
-- All monetary values are ex-GST (as per Xero P&L)
-- Month index: 0=Jul 2025, 1=Aug 2025, 2=Sep 2025, 3=Oct 2025
--              4=Nov 2025, 5=Dec 2025, 6=Jan 2026, 7=Feb 2026

-- ----------------------------------------
-- monthly_reports — one row per month
-- ----------------------------------------
INSERT INTO public.monthly_reports (id, report_month, status, created_by, created_at, updated_at)
SELECT id, report_month, status, created_by, now(), now()
FROM (VALUES
  ('11111111-0001-0001-0001-000000000001'::uuid, '2025-07-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000002'::uuid, '2025-08-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000003'::uuid, '2025-09-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000004'::uuid, '2025-10-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000005'::uuid, '2025-11-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000006'::uuid, '2025-12-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000007'::uuid, '2026-01-01'::date, 'complete', NULL::uuid),
  ('11111111-0001-0001-0001-000000000008'::uuid, '2026-02-01'::date, 'complete', NULL::uuid)
) AS t(id, report_month, status, created_by)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monthly_reports r WHERE r.id = t.id
);

-- ----------------------------------------
-- financials_monthly
-- totalRevenue  = [142181.52, 145489.94, 179927.15, 182342.48, 170092.54, 144221.87, 128951.28, 157271.73]
-- totalCOS      = [52705.04,  55704.15,  65060.33,  62071.78,  61627.98,  53325.84,  31393.91,  10756.54]
-- grossProfit   = [89476.48,  89785.79,  114866.82, 120270.70, 108464.56, 90896.03,  97557.37,  146515.19]
-- totalOpex     = [93817.77,  87486.88,  90784.25,  104685.12, 80247.93,  74639.08,  74617.96,  62369.70]
-- netProfit     = [-4341.29,  2298.91,   24082.57,  15585.58,  28216.63,  16256.95,  22939.41,  84145.49]
-- gmPct         = [62.9,      61.7,      63.8,      66.0,      63.8,      63.0,      75.7,      93.2]
-- cashIncome    = [158454,    142127,    160003,    214201,    152954,    159310,    128207,    93546]
-- cashExpenses  = [154104,    133449,    148490,    185051,    134838,    139251,    107943,    80315]
-- cashNetMove   = [4350,      8677,      11513,     29150,     18116,     20059,     20265,     13232]
-- rev_general   = revByCategory.generalWaste
-- rev_asbestos  = revByCategory.asbestos
-- rev_soil      = revByCategory.soil
-- rev_green     = revByCategory.greenWaste
-- rev_other     = revByCategory.other
-- opex_rent     = rent
-- opex_advertising = advertising
-- cos_fuel      = fuelCosts
-- cos_wages     = wages (COS portion)
-- cos_tolls     = tolls
-- cos_repairs   = repairs
-- ----------------------------------------
INSERT INTO public.financials_monthly (
  id, report_id, report_month,
  rev_general, rev_asbestos, rev_soil, rev_green, rev_other, rev_total, revenue_total,
  cos_fuel, cos_wages, cos_tolls, cos_repairs, cos_total,
  gross_profit, gross_margin_pct,
  opex_rent, opex_advertising, opex_total,
  net_profit, net_margin_pct,
  cash_income, cash_expenses, cash_net_movement
)
SELECT id, report_id, report_month,
  rev_general, rev_asbestos, rev_soil, rev_green, rev_other, rev_total, revenue_total,
  cos_fuel, cos_wages, cos_tolls, cos_repairs, cos_total,
  gross_profit, gross_margin_pct,
  opex_rent, opex_advertising, opex_total,
  net_profit, net_margin_pct,
  cash_income, cash_expenses, cash_net_movement
FROM (VALUES
  ('22222222-0001-0001-0001-000000000001'::uuid, '11111111-0001-0001-0001-000000000001'::uuid, '2025-07-01'::date,
   75705.52, 40348.88, 15796.40, 2214.00, 8116.72, 142181.52, 142181.52,
   10108.80, 58942.57, 4000.04, 1371.74, 52705.04,
   89476.48, 62.9, 4666.67, 1311.94, 93817.77, -4341.29, -3.1,
   158454, 154104, 4350),
  ('22222222-0001-0001-0001-000000000002'::uuid, '11111111-0001-0001-0001-000000000002'::uuid, '2025-08-01'::date,
   61781.29, 24789.80, 31507.20, 3828.50, 23583.15, 145489.94, 145489.94,
   9414.99, 48076.34, 2909.12, 3317.92, 55704.15,
   89785.79, 61.7, 4666.67, 3613.23, 87486.88, 2298.91, 1.6,
   142127, 133449, 8677),
  ('22222222-0001-0001-0001-000000000003'::uuid, '11111111-0001-0001-0001-000000000003'::uuid, '2025-09-01'::date,
   97922.63, 44150.10, 32995.30, 933.88, 3925.24, 179927.15, 179927.15,
   10494.10, 48160.73, 3638.25, 6600.37, 65060.33,
   114866.82, 63.8, 5133.34, 3131.42, 90784.25, 24082.57, 13.4,
   160003, 148490, 11513),
  ('22222222-0001-0001-0001-000000000004'::uuid, '11111111-0001-0001-0001-000000000004'::uuid, '2025-10-01'::date,
   101277.82, 34510.91, 39320.58, 4300.00, 2933.17, 182342.48, 182342.48,
   11208.51, 59353.84, 3274.61, 4961.58, 62071.78,
   120270.70, 66.0, 4666.67, 3893.19, 104685.12, 15585.58, 8.5,
   214201, 185051, 29150),
  ('22222222-0001-0001-0001-000000000005'::uuid, '11111111-0001-0001-0001-000000000005'::uuid, '2025-11-01'::date,
   110533.61, 30486.33, 12338.18, 7558.26, 9176.16, 170092.54, 170092.54,
   7873.86, 44462.81, 2937.85, 4248.36, 61627.98,
   108464.56, 63.8, 4666.67, 3441.67, 80247.93, 28216.63, 16.6,
   152954, 134838, 18116),
  ('22222222-0001-0001-0001-000000000006'::uuid, '11111111-0001-0001-0001-000000000006'::uuid, '2025-12-01'::date,
   94929.45, 27959.99, 9950.00, 5116.12, 6266.31, 144221.87, 144221.87,
   8383.04, 45212.71, 2910.51, 984.59, 53325.84,
   90896.03, 63.0, 4666.67, 3470.92, 74639.08, 16256.95, 11.3,
   159310, 139251, 20059),
  ('22222222-0001-0001-0001-000000000007'::uuid, '11111111-0001-0001-0001-000000000007'::uuid, '2026-01-01'::date,
   84438.27, 21513.63, 15573.20, 4527.27, 2898.91, 128951.28, 128951.28,
   650.96, 53116.46, 2850.93, 187.57, 31393.91,
   97557.37, 75.7, 4666.67, 3453.91, 74617.96, 22939.41, 17.8,
   128207, 107943, 20265),
  ('22222222-0001-0001-0001-000000000008'::uuid, '11111111-0001-0001-0001-000000000008'::uuid, '2026-02-01'::date,
   80944.80, 26318.18, 42385.10, 3550.00, 4073.65, 157271.73, 157271.73,
   164.57, 46737.59, 1454.56, 3277.79, 10756.54,
   146515.19, 93.2, 0, 1647.42, 62369.70, 84145.49, 53.5,
   93546, 80315, 13232)
) AS t(id, report_id, report_month,
  rev_general, rev_asbestos, rev_soil, rev_green, rev_other, rev_total, revenue_total,
  cos_fuel, cos_wages, cos_tolls, cos_repairs, cos_total,
  gross_profit, gross_margin_pct, opex_rent, opex_advertising, opex_total,
  net_profit, net_margin_pct, cash_income, cash_expenses, cash_net_movement)
WHERE NOT EXISTS (
  SELECT 1 FROM public.financials_monthly f WHERE f.id = t.id
);

-- ----------------------------------------
-- balance_sheet_monthly — from financials.js balanceSheet object
-- This is a point-in-time balance sheet (as at Jun 2025 base, used for all months for now)
-- cashBalance from cashBalance array
-- ----------------------------------------
INSERT INTO public.balance_sheet_monthly (
  id, report_id, report_month,
  cash_balance, accounts_receivable, fixed_assets,
  total_assets, gst_liability, payg_liability,
  total_loans, total_liabilities, net_equity,
  non_current_assets, ato_clearing, director_loans,
  retained_earnings, current_year_earnings
)
SELECT id, report_id, report_month,
  cash_balance, accounts_receivable, fixed_assets,
  total_assets, gst_liability, payg_liability,
  total_loans, total_liabilities, net_equity,
  non_current_assets, ato_clearing, director_loans,
  retained_earnings, current_year_earnings
FROM (VALUES
  ('33333333-0001-0001-0001-000000000001'::uuid, '11111111-0001-0001-0001-000000000001'::uuid, '2025-07-01'::date,
   4350, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000002'::uuid, '11111111-0001-0001-0001-000000000002'::uuid, '2025-08-01'::date,
   13027, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000003'::uuid, '11111111-0001-0001-0001-000000000003'::uuid, '2025-09-01'::date,
   24541, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000004'::uuid, '11111111-0001-0001-0001-000000000004'::uuid, '2025-10-01'::date,
   53690, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000005'::uuid, '11111111-0001-0001-0001-000000000005'::uuid, '2025-11-01'::date,
   71807, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000006'::uuid, '11111111-0001-0001-0001-000000000006'::uuid, '2025-12-01'::date,
   91866, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000007'::uuid, '11111111-0001-0001-0001-000000000007'::uuid, '2026-01-01'::date,
   112131, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856),
  ('33333333-0001-0001-0001-000000000008'::uuid, '11111111-0001-0001-0001-000000000008'::uuid, '2026-02-01'::date,
   99334, 151365.07, 515212, 550980, 152015.92, 388576, 383949, 589726, -38745,
   3695, -385469, 161603, -94601, 54856)
) AS t(id, report_id, report_month,
  cash_balance, accounts_receivable, fixed_assets,
  total_assets, gst_liability, payg_liability,
  total_loans, total_liabilities, net_equity,
  non_current_assets, ato_clearing, director_loans,
  retained_earnings, current_year_earnings)
WHERE NOT EXISTS (
  SELECT 1 FROM public.balance_sheet_monthly b WHERE b.id = t.id
);

-- ----------------------------------------
-- debtors_monthly — Feb 2026 top debtors from financials.js
-- ----------------------------------------
INSERT INTO public.debtors_monthly (
  report_id, report_month,
  debtor_name, current_amount, overdue_30, overdue_60, overdue_90plus, total_outstanding, older_bucket
)
SELECT
  '11111111-0001-0001-0001-000000000008', '2026-02-01',
  name, current_amount, overdue_30, overdue_60, overdue_90plus, total_outstanding, older_bucket
FROM (VALUES
  ('REMEED SOLUTIONS',    8200.00, 6735.00, 3000.00, 3000.00, 20935.20,  0.00),
  ('FIELDMANS WASTE',    12100.00, 4154.84, 1500.00, 1500.00, 19254.84,  0.00),
  ('ROACH DEMOLITION',    9500.00, 5346.08, 2000.00, 1500.00, 18846.08,  500.00),
  ('SCOTTY''S SUBURBAN',  4200.00, 2541.80,  500.00,  500.00,  7741.80,  0.00),
  ('MELB GRAMMAR',        3612.20, 1000.00,  500.00,  500.00,  5612.20,  0.00),
  ('TREC PLUMBING',       2334.00, 1000.00,  500.00,    0.00,  4334.00,  500.00),
  ('SERVICESTREAM',       1940.92, 1000.00,  500.00,    0.00,  3940.92,  500.00),
  ('SALT PROJECTS',       3751.00,    0.00,    0.00,    0.00,  3751.00,  0.00),
  ('IMEG NOMINEES',        857.80,    0.00,    0.00, 1000.00,  2857.80, 1000.00),
  ('SHAYONA PROPERTY',     805.00,    0.00, 1000.00,  500.00,  2805.00,  500.00)
) AS t(name, current_amount, overdue_30, overdue_60, overdue_90plus, total_outstanding, older_bucket)
WHERE NOT EXISTS (
  SELECT 1 FROM public.debtors_monthly d
  WHERE d.report_id = '11111111-0001-0001-0001-000000000008'
  AND d.debtor_name = t.name
);

-- ----------------------------------------
-- bin_type_performance — Feb 2026 data from financials.js binTypesData
-- income values are already ex-GST (exGST function applied in financials.js)
-- exGST(v) = Math.round(v / 1.1 * 100) / 100
-- ----------------------------------------
INSERT INTO public.bin_type_performance (
  report_id, report_month, bin_type, deliveries, avg_hire_days, revenue, avg_price, net_margin_pct
)
SELECT
  '11111111-0001-0001-0001-000000000008', '2026-02-01',
  bin_type, deliveries, avg_hire_days, revenue, avg_price, 0
FROM (VALUES
  ('ASB - 8m',      14, 0,  29228.18, 2088.44),
  ('WMF - 6m',      30, 12, 25358.18,  845.27),
  ('6M CONT SOIL',   7,  0, 18104.55, 2586.36),
  ('WMF - 4m',      29, 10, 17817.27,  614.39),
  ('WMF - 16m',      9,  4, 13720.00, 1524.44),
  ('WMF - 12m',      9,  9, 10790.00, 1198.89),
  ('WMF - 8m',      10, 13,  9250.00,  925.00),
  ('WMF - 10m',      8,  4,  9040.00, 1130.00),
  ('ASB - 6m',       6, 16,  7563.64, 1260.61),
  ('ASB - 4m',       7, 16,  5805.45,  829.36)
) AS t(bin_type, deliveries, avg_hire_days, revenue, avg_price)
WHERE NOT EXISTS (
  SELECT 1 FROM public.bin_type_performance b
  WHERE b.report_id = '11111111-0001-0001-0001-000000000008'
  AND b.bin_type = t.bin_type
);

-- ----------------------------------------
-- customer_acquisitions — Feb 2026 new customers
-- ----------------------------------------
INSERT INTO public.customer_acquisitions (
  report_id, report_month, customer_name, jobs_in_month, customer_type, revenue_in_month
)
SELECT
  '11111111-0001-0001-0001-000000000008', '2026-02-01',
  customer_name, jobs_in_month, customer_type, revenue_in_month
FROM (VALUES
  ('SALT PROJECTS',              4, 'Commercial', 3751.00),
  ('PROCESS WASTE WATER',        1, 'Industrial',  895.00),
  ('PYPER PROJECTS PTY LTD',     1, 'Builder',     895.00),
  ('SAMUEL KELLY CROMIE',        1, 'Domestic',    275.00),
  ('TAMIKA KERR',                1, 'Domestic',    572.00),
  ('14 ELMHURST PTY LTD',        1, 'Builder',     895.00),
  ('ADIO DESK PTY LTD',          1, 'Commercial',  100.00),
  ('MY PRO HANDYMAN SERVICES',   1, 'Trades',      353.00),
  ('OMNIQUE PTY LTD',            1, 'Commercial',  517.00)
) AS t(customer_name, jobs_in_month, customer_type, revenue_in_month)
WHERE NOT EXISTS (
  SELECT 1 FROM public.customer_acquisitions c
  WHERE c.report_id = '11111111-0001-0001-0001-000000000008'
  AND c.customer_name = t.customer_name
);

-- ----------------------------------------
-- competitor_rates — initial seed from CompetitorPage.jsx seedCompetitors
-- ----------------------------------------
INSERT INTO public.competitor_rates (competitor_name, bin_type, rate, competitor_source, updated_at)
SELECT competitor_name, bin_type, rate, competitor_source, now()
FROM (VALUES
  ('Kwik Bins',       '4m3 GW',   430, 'kwikbins.com.au'),
  ('Kwik Bins',       '6m3 GW',   590, 'kwikbins.com.au'),
  ('Kwik Bins',       '8m3 GW',   670, 'kwikbins.com.au'),
  ('Kwik Bins',       '12m3 GW',  865, 'kwikbins.com.au'),
  ('Need A Skip Now', '6m3 GW',   547, 'needaskipnow.com.au'),
  ('Need A Skip Now', '4m3 Soil', 347, 'needaskipnow.com.au'),
  ('Big Bin Hire',    '6m3 Soil', 530, 'bigbinhire.com.au')
) AS t(competitor_name, bin_type, rate, competitor_source)
WHERE NOT EXISTS (
  SELECT 1 FROM public.competitor_rates c
  WHERE c.competitor_name = t.competitor_name AND c.bin_type = t.bin_type
);
