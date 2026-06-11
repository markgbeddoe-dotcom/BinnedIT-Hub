-- ─────────────────────────────────────────────────────────────────────────────
-- 026_business_rules.sql — WP-F (R6, GAP-015, FR7.6.1/FR7.6.2, ADR-704)
--
-- Management-editable business rules engine: jsonb key-value with categories
-- + trigger-populated audit history. NOT a DSL — rules are parameters
-- (numbers, booleans, small lookup tables), interpreted by code that owns
-- each rule_key.
--
-- Consumers (tipDecision.js, checklist gate, waste-audit flow, dispatch) read
-- through src/api/rules.js / src/hooks/useRules.js, which carry hardcoded
-- defaults mirroring the seeds below — an empty or missing table never breaks
-- the app. Convention (ADR-704): safety-category rules fail CLOSED (default
-- true / most restrictive); economic rules fail to fallback defaults.
--
-- RLS: all authenticated read; owner+manager write; history rows are written
-- by the trigger only (SECURITY DEFINER) — no client insert path.
--
-- Idempotent — safe to re-run. Seeds use ON CONFLICT DO NOTHING so values
-- edited by Mark are never clobbered by a re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.business_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key    text NOT NULL UNIQUE,
  category    text NOT NULL CHECK (category IN ('routing','tipping','billing','safety','pricing','dispatch')),
  name        text NOT NULL,
  description text,
  value       jsonb NOT NULL,
  value_type  text NOT NULL CHECK (value_type IN ('number','boolean','string','json')),
  enabled     boolean NOT NULL DEFAULT true,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_rule_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key   text NOT NULL,
  old_value  jsonb,
  new_value  jsonb,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_rules_category
  ON public.business_rules (category);

CREATE INDEX IF NOT EXISTS idx_business_rule_history_key_time
  ON public.business_rule_history (rule_key, changed_at DESC);

-- ── History trigger ──────────────────────────────────────────────────────────
-- BEFORE UPDATE: writes an audit row for value changes and for enable/disable
-- flips (the latter stored as {"enabled": bool} objects so the history drawer
-- can render both kinds), and stamps updated_at. SECURITY DEFINER so the
-- insert bypasses RLS on the history table (no client insert policy exists).

CREATE OR REPLACE FUNCTION public.fn_business_rule_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.business_rule_history (rule_key, old_value, new_value, changed_by)
    VALUES (OLD.rule_key, OLD.value, NEW.value, COALESCE(NEW.updated_by, auth.uid()));
  END IF;

  IF NEW.enabled IS DISTINCT FROM OLD.enabled THEN
    INSERT INTO public.business_rule_history (rule_key, old_value, new_value, changed_by)
    VALUES (
      OLD.rule_key,
      jsonb_build_object('enabled', OLD.enabled),
      jsonb_build_object('enabled', NEW.enabled),
      COALESCE(NEW.updated_by, auth.uid())
    );
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_rule_history ON public.business_rules;
CREATE TRIGGER trg_business_rule_history
  BEFORE UPDATE ON public.business_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_business_rule_history();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.business_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rule_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='business_rules'
      AND policyname='Authenticated read business rules'
  ) THEN
    CREATE POLICY "Authenticated read business rules"
      ON public.business_rules FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='business_rules'
      AND policyname='Owner manager write business rules'
  ) THEN
    CREATE POLICY "Owner manager write business rules"
      ON public.business_rules FOR ALL TO authenticated
      USING (public.current_user_role() IN ('owner','manager'))
      WITH CHECK (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='business_rule_history'
      AND policyname='Authenticated read rule history'
  ) THEN
    CREATE POLICY "Authenticated read rule history"
      ON public.business_rule_history FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;
-- Deliberately NO insert/update/delete policies on business_rule_history:
-- rows are written only by the SECURITY DEFINER trigger. Reverts in the UI
-- write a new business_rules UPDATE (which the trigger logs) — history is
-- append-only by construction.

-- ── Seeds (FR7.6.2 + WP-F extras) ────────────────────────────────────────────
-- ON CONFLICT DO NOTHING: management edits survive re-runs. Defaults here MUST
-- stay mirrored in src/api/rules.js RULE_DEFAULTS.

INSERT INTO public.business_rules (rule_key, category, name, description, value, value_type) VALUES
  ('fuel_cost_per_km', 'routing', 'Fuel cost per km',
   'Cost of fuel per kilometre. Used in tip-decision ranking and route costing.',
   '0.68'::jsonb, 'number'),
  ('driver_cost_per_hour', 'routing', 'Driver cost per hour',
   'Fully-loaded driver labour cost per hour. Used in tip-decision ranking.',
   '45'::jsonb, 'number'),
  ('tip_search_radius_km', 'tipping', 'Tip search radius',
   'Maximum radius (km) to search for candidate tip sites after a pickup.',
   '25'::jsonb, 'number'),
  ('redeploy_bin_savings_min', 'tipping', 'Redeploy savings minimum',
   'Minimum dollar saving before suggesting tip-and-redeploy over return-to-base.',
   '25'::jsonb, 'number'),
  ('checklist_block_shift', 'safety', 'Checklist blocks shift',
   'Drivers cannot see or start jobs until today''s pre-start checklist passes. Safety rule — fails closed when unreadable.',
   'true'::jsonb, 'boolean'),
  ('weight_overage_threshold_pct', 'billing', 'Weight overage threshold',
   'Flag a load for billing review when estimated weight exceeds declared weight by this percentage.',
   '15'::jsonb, 'number'),
  ('weight_overage_rate_per_tonne', 'billing', 'Weight overage rate per tonne',
   'Rate per tonne used to draft weight-overage billing adjustments (internal record only — never pushed to Xero).',
   '95'::jsonb, 'number'),
  ('adjustment_requires_approval', 'billing', 'Adjustment requires approval',
   'Billing adjustments need owner/manager approval before being marked applied. Applied is an internal ledger state — Xero is never written.',
   'true'::jsonb, 'boolean'),
  ('max_jobs_per_truck_day', 'dispatch', 'Max jobs per truck per day',
   'Soft cap on jobs assigned to one truck in a day. Dispatch shows a warning chip beyond this.',
   '8'::jsonb, 'number'),
  ('ai_confidence_floor', 'billing', 'AI confidence floor',
   'Minimum AI confidence (0–1) for a waste-audit result to auto-draft a billing adjustment. Below this, audits are stored for human review only.',
   '0.5'::jsonb, 'number')
ON CONFLICT (rule_key) DO NOTHING;
