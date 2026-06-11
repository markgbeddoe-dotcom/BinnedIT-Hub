-- ============================================================
-- Migration 024: AI Waste Audits + Billing Adjustments (WP-D, R5)
-- ============================================================
-- waste_audits        — one row per AI bin-photo classification
--                       (written server-side by api/analyze-bin-photo.js)
-- billing_adjustments — internal adjustment ledger derived from audits.
--
-- IMPORTANT: NO Xero columns, NO Xero write path. `applied` is an
-- internal ledger state only — Sarah actions the real invoice by hand
-- (XERO_WRITE_ENABLED kill-switch doctrine, ADR-705 / FR7.5.6).
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ─── 1. waste_audits ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waste_audits (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  photo_id             UUID REFERENCES public.job_photos(id) ON DELETE SET NULL,
  declared_waste_type  TEXT,
  detected_waste_types JSONB,                -- e.g. ["Soil","Concrete","Brick"]
  dominant_type        TEXT,
  est_density_class    TEXT CHECK (est_density_class IS NULL OR est_density_class IN ('light','medium','heavy','very_heavy')),
  matches_declared     BOOLEAN,
  confidence           NUMERIC(4,3),         -- 0.000 – 1.000
  rationale            TEXT,
  status               TEXT NOT NULL DEFAULT 'pending_review'
                         CHECK (status IN ('pending_review','confirmed','dismissed')),
  driver_flagged       BOOLEAN DEFAULT FALSE,  -- driver disputed / added context
  driver_note          TEXT,
  created_by           UUID REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columns added defensively in case an earlier partial version of the
-- table exists (idempotency guard).
ALTER TABLE public.waste_audits
  ADD COLUMN IF NOT EXISTS driver_flagged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS driver_note    TEXT;

CREATE INDEX IF NOT EXISTS idx_waste_audits_booking    ON public.waste_audits(booking_id);
CREATE INDEX IF NOT EXISTS idx_waste_audits_status     ON public.waste_audits(status);
CREATE INDEX IF NOT EXISTS idx_waste_audits_created_by ON public.waste_audits(created_by, created_at DESC); -- daily rate-cap query

-- ─── 2. billing_adjustments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_adjustments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  waste_audit_id UUID REFERENCES public.waste_audits(id) ON DELETE SET NULL,
  amount         NUMERIC(10,2),              -- NULL while draft pending office input
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','approved','rejected','applied')),
  created_by     UUID REFERENCES auth.users(id),
  approved_by    UUID REFERENCES auth.users(id),
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_adj_booking ON public.billing_adjustments(booking_id);
CREATE INDEX IF NOT EXISTS idx_billing_adj_audit   ON public.billing_adjustments(waste_audit_id);
CREATE INDEX IF NOT EXISTS idx_billing_adj_status  ON public.billing_adjustments(status);

-- ─── 3. RLS ──────────────────────────────────────────────────
ALTER TABLE public.waste_audits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;

-- waste_audits: authenticated read; insert own rows; driver may update
-- their own audit (flag/note); owner/manager may update any (review).
DROP POLICY IF EXISTS "Auth users read waste audits"     ON public.waste_audits;
CREATE POLICY "Auth users read waste audits"
  ON public.waste_audits FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users insert own waste audits"    ON public.waste_audits;
CREATE POLICY "Users insert own waste audits"
  ON public.waste_audits FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owner or managers update waste audits" ON public.waste_audits;
CREATE POLICY "Owner or managers update waste audits"
  ON public.waste_audits FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.current_user_role() IN ('owner','manager'))
  WITH CHECK (created_by = auth.uid() OR public.current_user_role() IN ('owner','manager'));

-- billing_adjustments: authenticated read; ONLY owner/manager may
-- create/update/approve (drafts from the AI path are written by the
-- service role in api/analyze-bin-photo.js, which bypasses RLS).
DROP POLICY IF EXISTS "Auth users read billing adjustments" ON public.billing_adjustments;
CREATE POLICY "Auth users read billing adjustments"
  ON public.billing_adjustments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Managers insert billing adjustments" ON public.billing_adjustments;
CREATE POLICY "Managers insert billing adjustments"
  ON public.billing_adjustments FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('owner','manager') AND created_by = auth.uid());

DROP POLICY IF EXISTS "Managers update billing adjustments" ON public.billing_adjustments;
CREATE POLICY "Managers update billing adjustments"
  ON public.billing_adjustments FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('owner','manager'))
  WITH CHECK (public.current_user_role() IN ('owner','manager'));

-- No DELETE policies — financially material records (ADR-707: 7-year retention).
