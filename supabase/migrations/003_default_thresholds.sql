-- ============================================================
-- Migration 003: Default Alert Thresholds & Work Plan Items
-- ============================================================

-- ----------------------------------------
-- DEFAULT ALERT THRESHOLDS
-- ----------------------------------------
INSERT INTO public.alert_thresholds (category, metric_key, warning_value, critical_value, description)
VALUES
  ('snapshot',  'net_margin_pct',        5,    0,    'Net profit margin % — warning below 5%, critical at 0%'),
  ('snapshot',  'gross_margin_pct',      60,   50,   'Gross margin % — warning below 60%, critical below 50%'),
  ('debtors',   'overdue_pct',           20,   35,   'AR overdue as % of total — warning 20%, critical 35%'),
  ('debtors',   'concentration_pct',     30,   50,   'Single debtor as % of AR — warning 30%, critical 50%'),
  ('cash_flow', 'cash_balance_weeks',    4,    2,    'Cash runway in weeks — warning 4 weeks, critical 2 weeks'),
  ('cash_flow', 'debt_service_coverage', 1.5,  1.0,  'DSCR — warning below 1.5x, critical below 1.0x'),
  ('margins',   'cos_vs_avg_pct',        20,   40,   'COS deviation from 3-month average % — warning 20%, critical 40%'),
  ('fleet',     'hire_duration_days',    21,   35,   'Bin on-hire days — warning 21 days, critical 35 days'),
  ('revenue',   'concentration_pct',     40,   60,   'Revenue from single category % — warning 40%, critical 60%'),
  ('compliance','days_to_epa_expiry',    60,   14,   'Days until EPA license expiry — warning 60, critical 14'),
  ('compliance','days_to_insurance',     60,   14,   'Days until insurance expiry — warning 60, critical 14')
ON CONFLICT (category, metric_key) DO NOTHING;

-- ----------------------------------------
-- DEFAULT WORK PLAN ITEMS (seeded from Sprint 1 workplan.js)
-- ----------------------------------------
INSERT INTO public.work_plan_items (title, area, horizon, priority, effort_hours, business_impact, owner_role, is_active, is_system)
VALUES
  -- THIS WEEK (High Priority)
  ('Reprice 4m³ General Waste — losing 9.2% on 188 jobs/year',
   'Pricing', 'week', 100, 2,
   'Eliminating negative margin on highest-volume bin type. At 188 jobs/year and -9.2% margin, losing ~$8,400/yr.',
   'owner', true, true),

  ('Confirm ATO payment plan for $540k GST/PAYG liability',
   'Cash Flow', 'week', 95, 1,
   'Outstanding $540k tax liability needs structured payment plan to avoid ATO enforcement action.',
   'owner', true, true),

  ('Chase REMEED SOLUTIONS $20,935 overdue — 60+ days',
   'Debtors', 'week', 90, 1,
   'Largest debtor 60+ days overdue. $20,935 at risk. Phone call + formal demand this week.',
   'owner', true, true),

  ('Review and post missing February COS invoices',
   'Margins', 'week', 88, 3,
   'COS appears 70% below 3-month average — likely unposted invoices distorting margin.',
   'bookkeeper', true, true),

  -- THIS MONTH
  ('Implement WHS incident register',
   'Risk', 'month', 80, 4,
   'No documented WHS incident register exposes business to SafeWork Victoria penalties up to $330k.',
   'manager', true, true),

  ('Review pricing for all loss-making bin types (4 identified)',
   'Pricing', 'month', 78, 4,
   '4 bin types generating negative net margin. Combined losses estimated $22k+ per annum.',
   'owner', true, true),

  ('Set up debtor payment alerts in Xero',
   'Debtors', 'month', 75, 2,
   'Automate overdue alerts at 14, 30, 60 days to prevent recurrence of current aging profile.',
   'bookkeeper', true, true),

  ('Confirm asbestos disposal documentation for Feb jobs',
   'Risk', 'month', 72, 2,
   'All asbestos jobs require EPA-compliant disposal certificates. Missing docs = compliance breach.',
   'manager', true, true),

  ('Create customer win-back campaign for 12 dormant accounts',
   'BDM', 'month', 68, 3,
   '12 customers not active in 90+ days. Re-engaging even 3-4 could add $15k+ annual revenue.',
   'owner', true, true),

  ('Audit vehicle maintenance logs and upcoming service schedule',
   'Risk', 'month', 65, 2,
   'Fleet downtime from deferred maintenance is the #1 operational risk. Audit all service records.',
   'manager', true, true),

  -- THIS QUARTER
  ('Develop formal pricing model with cost-per-job tracking',
   'Pricing', 'quarter', 60, 8,
   'Current pricing is intuitive not systematic. Formal model enables data-driven rate decisions.',
   'owner', true, true),

  ('Implement cash flow 13-week rolling forecast',
   'Cash Flow', 'quarter', 58, 6,
   'With $540k ATO liability and $108k annual debt service, proactive cash forecasting is critical.',
   'owner', true, true),

  ('Build referral program for top 10 commercial customers',
   'BDM', 'quarter', 55, 4,
   'Top 10 customers likely have peer network. Structured referral incentive could add 15-20 new customers.',
   'owner', true, true),

  ('Review and reduce advertising spend efficiency',
   'Margins', 'quarter', 52, 4,
   'Advertising running at 3.2% of revenue. Audit channel ROI — identify waste.',
   'owner', true, true),

  ('Obtain EPA license renewal (due within 12 months)',
   'Risk', 'quarter', 50, 2,
   'EPA license renewal requires advance preparation. Start process now to avoid operational disruption.',
   'owner', true, true),

  ('Establish documented credit policy for new customers',
   'Debtors', 'quarter', 48, 4,
   'No formal credit terms exposes business to repeat bad debts. Implement credit checks + terms.',
   'owner', true, true),

  ('Evaluate soil/green waste category growth potential',
   'Revenue', 'quarter', 45, 6,
   'Soil and green waste are high-margin categories currently underdeveloped vs general waste.',
   'owner', true, true),

  ('Quarterly fleet utilisation review — retire underperforming bin types',
   'Fleet', 'quarter', 42, 3,
   'Low-utilisation bin types tie up capital. Quarterly review to optimise fleet mix.',
   'manager', true, true),

  ('Implement monthly management reporting cadence',
   'Snapshot', 'quarter', 40, 2,
   'Formalise monthly report review meeting to ensure consistent action on insights.',
   'owner', true, true),

  ('Set up Xero bank rules to reduce manual reconciliation time',
   'Margins', 'quarter', 38, 4,
   'Manual bank reconciliation is time-consuming. Bank rules automate categorisation, saving 2-3 hrs/month.',
   'bookkeeper', true, true)
ON CONFLICT DO NOTHING;
