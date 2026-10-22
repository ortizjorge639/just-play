-- Migration 026: keep display_name behind save_name_card.
-- users_update_own has no column limit, so a signed-in client could write its own display_name
-- directly and skip the 1 to 50 character check. This trigger refuses a direct change from the
-- client roles. save_name_card is SECURITY DEFINER, so it runs as its owner and is not affected.
-- Additive and safe to re-run. It does not touch total_xp or level: the standby RPCs that write
-- them run as the caller, so locking them needs those functions reworked first.
BEGIN;

CREATE OR REPLACE FUNCTION public.lock_display_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.display_name IS DISTINCT FROM OLD.display_name
    AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Change your name from the name card';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_display_name ON public.users;
CREATE TRIGGER lock_display_name
  BEFORE UPDATE OF display_name ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_display_name();

NOTIFY pgrst, 'reload schema';

COMMIT;
