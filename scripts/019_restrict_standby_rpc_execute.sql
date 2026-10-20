-- Correct databases that already applied 018 with explicit anon default grants.
-- Preserves authenticated grants; does not change any role memberships.
-- Check effective anon EXECUTE afterward: inherited grants require separate review.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_standby_session(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transition_standby_session(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_standby_game_progress(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_standby_profile_xp(integer, date) FROM anon;

COMMIT;
