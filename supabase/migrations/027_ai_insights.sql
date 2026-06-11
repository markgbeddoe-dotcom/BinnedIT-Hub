-- ============================================================
-- Migration 027: AI Cost-Efficiency Insights (WP-G)
-- ============================================================
-- R7 / GAP-016 / FR7.7.2 / ADR-706.
-- Stores structured insights produced by api/efficiency-insights.js
-- (daily 19:00 UTC cron + on-demand owner/manager refresh).
--
-- Lifecycle (ADR-707): AI artefact tier — prune `dismissed` rows
-- after 90 days, keep `actioned` (piggybacks the daily cron later).
-- Tenancy (ADR-707 rule 3): org-level table — Binned-IT's, not
-- per-tenant. Needs tenant_id + RLS rewrite before any second
-- operational tenant goes live.
--
-- Idempotent: safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  category        text        NOT NULL DEFAULT 'general'
                    CHECK (category IN ('tipping','fuel','routing','pricing','recycling','pipeline','general')),
  title           text        NOT NULL,
  detail          text,
  est_saving_aud  numeric(10,2),
  confidence      text        NOT NULL DEFAULT 'low'
                    CHECK (confidence IN ('low','medium','high')),
  status          text        NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','actioned','dismissed')),
  period          text        NOT NULL,         -- Melbourne local date of the run, 'YYYY-MM-DD'
  dedupe_key      text        NOT NULL,         -- stable per-finding key so re-runs don't duplicate
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Dedupe: the same finding may only exist once per period.
-- (ON CONFLICT (dedupe_key, period) DO NOTHING relies on this.)
CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_dedupe_period_uniq
  ON public.ai_insights (dedupe_key, period);

CREATE INDEX IF NOT EXISTS idx_ai_insights_status  ON public.ai_insights (status);
CREATE INDEX IF NOT EXISTS idx_ai_insights_created ON public.ai_insights (created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────
-- Read: any authenticated user (single-org read model, no anon — ADR-707 rule 2).
-- Update (status only in practice): owner/manager.
-- Insert: service role only (api/efficiency-insights.js) — no
-- authenticated INSERT policy on purpose; service role bypasses RLS.
-- Delete: none for end users (pruning runs as service role).

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insights' AND policyname = 'Authenticated can read ai_insights'
  ) THEN
    CREATE POLICY "Authenticated can read ai_insights"
      ON public.ai_insights FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_insights' AND policyname = 'Owner and manager update ai_insights'
  ) THEN
    CREATE POLICY "Owner and manager update ai_insights"
      ON public.ai_insights FOR UPDATE
      TO authenticated
      USING (public.current_user_role() IN ('owner','manager'))
      WITH CHECK (public.current_user_role() IN ('owner','manager'));
  END IF;
END $$;
