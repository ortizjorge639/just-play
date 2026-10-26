-- Migration 031: "not for me" picks.
-- A player can tell the deck a game is not for them. Those games stop being recommended,
-- and the recommender leans away from their genres. Clients can only read their own rows.
-- The only write paths are mark_not_for_me and clear_not_for_me.
-- Applying this file again changes nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.not_for_me (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_not_for_me_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_not_for_me_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

ALTER TABLE public.not_for_me ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS not_for_me_select_own ON public.not_for_me;
CREATE POLICY not_for_me_select_own ON public.not_for_me
  FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.not_for_me FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_not_for_me(p_game_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id) THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  INSERT INTO public.not_for_me (user_id, game_id) VALUES (owner, p_game_id)
    ON CONFLICT (user_id, game_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_not_for_me()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  removed integer;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.not_for_me WHERE user_id = owner;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_not_for_me(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_not_for_me(text) TO authenticated;
REVOKE ALL ON FUNCTION public.clear_not_for_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_not_for_me() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
