-- ============================================================
-- Migration 006: Xero Integration Tables
-- Idempotent — safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xero_tokens (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     text UNIQUE NOT NULL,
  tenant_name   text,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.xero_sync_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_month   date NOT NULL,
  status       text NOT NULL CHECK (status IN ('success','error','partial')),
  message      text,
  rows_written jsonb,
  synced_by    uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.xero_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_sync_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner read xero tokens"   ON public.xero_tokens;
DROP POLICY IF EXISTS "Owner write xero tokens"  ON public.xero_tokens;
DROP POLICY IF EXISTS "Auth users read sync log" ON public.xero_sync_log;
DROP POLICY IF EXISTS "Owner write sync log"     ON public.xero_sync_log;

CREATE POLICY "Owner read xero tokens"   ON public.xero_tokens FOR SELECT USING (public.current_user_role() = 'owner');
CREATE POLICY "Owner write xero tokens"  ON public.xero_tokens FOR ALL    USING (public.current_user_role() = 'owner');
CREATE POLICY "Auth users read sync log" ON public.xero_sync_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owner write sync log"     ON public.xero_sync_log FOR INSERT WITH CHECK (public.current_user_role() = 'owner');
