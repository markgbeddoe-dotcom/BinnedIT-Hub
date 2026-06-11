-- ============================================================
-- Migration 031: storage policies for the job-photos bucket (J4)
-- ============================================================
-- P0 found by the Dave-Driver persona on 2026-06-12: the
-- job-photos bucket existed but storage.objects had policies for
-- company-assets ONLY — every photo upload (delivery, collection,
-- tip docket) violated RLS for every user, so the delivery-photo
-- gate could never be satisfied and no job could ever complete.
--
--   INSERT  : any authenticated user (drivers shoot the photos;
--             path is job-photos/<booking_id>/<type>_<ts>.<ext>)
--   SELECT  : any authenticated user (office review, audits)
--   UPDATE/DELETE : owner/manager housekeeping only
--
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated upload job photos') THEN
    CREATE POLICY "Authenticated upload job photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'job-photos');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Authenticated read job photos') THEN
    CREATE POLICY "Authenticated read job photos"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'job-photos');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Managers manage job photos') THEN
    CREATE POLICY "Managers manage job photos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'job-photos' AND public.current_user_role() IN ('owner','manager','fleet_manager'))
      WITH CHECK (bucket_id = 'job-photos' AND public.current_user_role() IN ('owner','manager','fleet_manager'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Managers delete job photos') THEN
    CREATE POLICY "Managers delete job photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'job-photos' AND public.current_user_role() IN ('owner','manager','fleet_manager'));
  END IF;
END $$;
