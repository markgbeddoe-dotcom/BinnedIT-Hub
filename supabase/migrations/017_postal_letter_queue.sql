-- ============================================================
-- Migration 017: Postal Letter Queue (Sprint 13 — Collections §1.2)
-- SkipSync Collections demand letters: Email + Registered Post.
--
-- This table is the queue that backs POST /api/postal-send. The endpoint
-- inserts rows here with status='queued'; a Phase-3 dispatcher (PostGrid /
-- Sendle / AusPost Click & Send) will read 'queued' rows, dispatch, and
-- update status to 'dispatched' or 'failed'.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.postal_letter_queue (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status                text        NOT NULL DEFAULT 'queued'
                                    CHECK (status IN ('queued','dispatched','failed','cancelled')),
  letter_title          text,
  letter_text           text        NOT NULL,
  recipient_name        text,
  recipient_company     text,
  recipient_address1    text,
  recipient_address2    text,
  recipient_suburb      text,
  recipient_state       text,
  recipient_postcode    text,
  recipient_country     text        DEFAULT 'AU',
  registered_post       boolean     DEFAULT false,
  context               jsonb       DEFAULT '{}',
  requested_by          uuid        REFERENCES public.profiles(id),
  requested_at          timestamptz NOT NULL DEFAULT now(),
  dispatched_at         timestamptz,
  dispatch_provider     text,
  dispatch_tracking_ref text,
  dispatch_error        text
);

CREATE INDEX IF NOT EXISTS idx_postal_queue_status
  ON public.postal_letter_queue(status, requested_at);

ALTER TABLE public.postal_letter_queue ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ──────────────────────────────────────────────────────────────
-- Owner: full read/insert/update/delete.
-- Bookkeeper: read + insert (queue letters from the Collections workflow);
--             cannot mutate dispatch state — that's owner / dispatcher only.
-- Manager: read + insert (treated like bookkeeper for collections workflow).
-- Other roles: no access.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can read postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can read postal_letter_queue" ON public.postal_letter_queue
      FOR SELECT TO authenticated
      USING (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can update postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can update postal_letter_queue" ON public.postal_letter_queue
      FOR UPDATE TO authenticated
      USING (public.current_user_role() = 'owner')
      WITH CHECK (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Owner can delete postal_letter_queue'
  ) THEN
    CREATE POLICY "Owner can delete postal_letter_queue" ON public.postal_letter_queue
      FOR DELETE TO authenticated
      USING (public.current_user_role() = 'owner');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Bookkeeper can read postal_letter_queue'
  ) THEN
    CREATE POLICY "Bookkeeper can read postal_letter_queue" ON public.postal_letter_queue
      FOR SELECT TO authenticated
      USING (public.current_user_role() IN ('bookkeeper','manager'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='postal_letter_queue'
      AND policyname='Bookkeeper can insert postal_letter_queue'
  ) THEN
    CREATE POLICY "Bookkeeper can insert postal_letter_queue" ON public.postal_letter_queue
      FOR INSERT TO authenticated
      WITH CHECK (public.current_user_role() IN ('owner','bookkeeper','manager'));
  END IF;
END $$;
