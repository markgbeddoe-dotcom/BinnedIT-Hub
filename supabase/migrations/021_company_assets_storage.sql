-- ─────────────────────────────────────────────────────────────────────────────
-- 021_company_assets_storage.sql — Sprint 18 #L2
--
-- Creates the `company-assets` Supabase Storage bucket used by the Settings →
-- Company Identity → letterhead-logo uploader. Bucket is PUBLIC so the URL
-- saved into platform_settings.company.logo_url can be embedded in the
-- collections-letter HTML without further signing.
--
-- Idempotent — safe to re-run.
--
-- Why a SQL migration rather than the JS createBucket() call alone? The JS
-- path requires the caller to be an authenticated owner — convenient for
-- self-service in the UI, but it bypasses the migration ledger and leaves a
-- gap if a fresh Supabase project is provisioned without anyone clicking
-- "Upload logo". This migration ensures the bucket exists from day one.
--
-- RLS policies on storage.objects keep tenant assets segregated by user-id
-- folder (we use auth.uid() as the tenant proxy until per-tenant identity
-- lands in storage). Public reads are intentionally allowed — the logo is
-- public-by-design, since it ends up in emailed letters.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-assets',
  'company-assets',
  true,                                  -- public read
  2 * 1024 * 1024,                       -- 2 MB max per object (matches UI cap)
  ARRAY['image/png','image/jpeg','image/jpg','image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS policies ────────────────────────────────────────────────────────────
-- storage.objects already has RLS enabled at the Supabase platform level.
-- We layer on:
--   • public read for company-assets
--   • authenticated owners can write to ANY path inside the bucket
--   • authenticated users can write to their own user-id-scoped folder
-- These run independently — the broadest matching policy wins per RLS rules.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Public read company-assets'
  ) THEN
    CREATE POLICY "Public read company-assets"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'company-assets');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Owner can manage company-assets'
  ) THEN
    CREATE POLICY "Owner can manage company-assets"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND public.current_user_role() = 'owner'
      )
      WITH CHECK (
        bucket_id = 'company-assets'
        AND public.current_user_role() = 'owner'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Authenticated user can manage own folder'
  ) THEN
    CREATE POLICY "Authenticated user can manage own folder"
      ON storage.objects FOR ALL TO authenticated
      USING (
        bucket_id = 'company-assets'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'company-assets'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
