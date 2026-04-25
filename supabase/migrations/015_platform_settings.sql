-- Platform settings table for runtime configuration (API keys, etc.)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key         text        PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings' AND policyname='Owner can manage platform settings') THEN
    CREATE POLICY "Owner can manage platform settings" ON public.platform_settings
      FOR ALL TO authenticated USING (public.current_user_role() = 'owner');
  END IF;
END $$;
