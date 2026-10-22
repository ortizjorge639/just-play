-- Migration 028: keep total_xp and level behind the standby RPCs.
-- users_update_own has no column limit, so a signed-in client could write its own XP or level
-- directly. The standby RPCs (018, 020, 022) already wrap every XP write in a transaction-local
-- flag, just_play.atomic_xp = 'standby_v1'. A client cannot set that flag, because set_config is
-- not exposed through the API. This trigger refuses a changed value from the client roles unless
-- the flag is set. A write that keeps the same value still passes.
-- Do not set the flag in any new function unless that function is meant to change XP.
-- Additive and safe to re-run. It does not edit the RPCs or any policy.
BEGIN;

CREATE OR REPLACE FUNCTION public.lock_xp_and_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.total_xp IS DISTINCT FROM OLD.total_xp OR NEW.level IS DISTINCT FROM OLD.level)
    AND current_user IN ('anon', 'authenticated')
    AND current_setting('just_play.atomic_xp', true) IS DISTINCT FROM 'standby_v1' THEN
    RAISE EXCEPTION 'XP and level are set by the app, not edited directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_xp_and_level ON public.users;
CREATE TRIGGER lock_xp_and_level
  BEFORE UPDATE OF total_xp, level ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_xp_and_level();

NOTIFY pgrst, 'reload schema';

COMMIT;
