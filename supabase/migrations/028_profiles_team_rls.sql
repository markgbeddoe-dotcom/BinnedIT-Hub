-- ============================================================
-- Migration 028: profiles RLS — fix team management (J2)
-- ============================================================
-- Root cause of "can't manage team members in the Team tab"
-- (Mark, 2026-06-11): profiles UPDATE policy was self-row only,
-- so every owner edit of another member silently no-opped; and
-- SELECT was owner+self only, so managers saw an empty team list
-- and an EMPTY DRIVER ROSTER in dispatch.
--
-- Also closes a privilege-escalation hole: the old self-update
-- policy let any user change their OWN role via PostgREST.
--
--   SELECT : office roles (owner/manager/fleet_manager/bookkeeper)
--            read all profiles; everyone reads their own.
--   UPDATE : owner updates any profile; manager/fleet_manager
--            update non-owner profiles; self-update remains for
--            non-privileged fields (role guarded by trigger).
--   Trigger: role changes only by owner/manager/fleet_manager;
--            granting 'owner' only by an owner. Service-role
--            writes (auth.uid() IS NULL, e.g. api/invite.js)
--            bypass the guard.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ─── 1. SELECT ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Office staff read all profiles" ON public.profiles;
CREATE POLICY "Office staff read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('owner','manager','fleet_manager','bookkeeper'));

-- (existing "Users can read own profile" and "Owners can read all
--  profiles" remain valid; the new policy supersets the latter.)

-- ─── 2. UPDATE ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner updates any profile" ON public.profiles;
CREATE POLICY "Owner updates any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

DROP POLICY IF EXISTS "Managers update non-owner profiles" ON public.profiles;
CREATE POLICY "Managers update non-owner profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('manager','fleet_manager') AND role <> 'owner')
  WITH CHECK (public.current_user_role() IN ('manager','fleet_manager') AND role <> 'owner');

-- (existing "Users can update own profile" remains — role changes
--  through it are blocked by the trigger below.)

-- ─── 3. Role-escalation guard ───────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role / backend writes carry no JWT user — allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF public.current_user_role() NOT IN ('owner','manager','fleet_manager') THEN
      RAISE EXCEPTION 'Only owners and managers may change roles';
    END IF;
    IF NEW.role = 'owner' AND public.current_user_role() <> 'owner' THEN
      RAISE EXCEPTION 'Only an owner may grant the owner role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
