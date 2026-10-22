-- Migration 027: resident emotes.
-- An emote is a wave at a resident. Only the most recent emote per resident is kept:
-- one row, overwritten each time. No log, no counts. Clients can only read their own rows.
-- All writes go through record_emote below. Applying this file again changes nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.resident_emotes (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  emote text NOT NULL,
  emoted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_resident_emotes_resident FOREIGN KEY (user_id, game_id)
    REFERENCES public.residents(user_id, game_id) ON DELETE CASCADE,
  CONSTRAINT resident_emotes_emote_check CHECK (emote IN ('wave', 'celebrate', 'rest', 'check_in'))
);

ALTER TABLE public.resident_emotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resident_emotes_select_own ON public.resident_emotes;
CREATE POLICY resident_emotes_select_own ON public.resident_emotes
  FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.resident_emotes FROM PUBLIC, anon, authenticated;

-- record_emote: save the latest emote for a resident who has arrived, and return it.
-- It writes resident_emotes and nothing else.
CREATE OR REPLACE FUNCTION public.record_emote(p_game_id text, p_emote text)
RETURNS public.resident_emotes
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  saved public.resident_emotes;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_emote IS NULL OR p_emote NOT IN ('wave', 'celebrate', 'rest', 'check_in') THEN
    RAISE EXCEPTION 'Unknown emote';
  END IF;
  IF p_game_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.residents r WHERE r.user_id = owner AND r.game_id = p_game_id
  ) THEN
    RAISE EXCEPTION 'Resident not found';
  END IF;

  INSERT INTO public.resident_emotes (user_id, game_id, emote)
    VALUES (owner, p_game_id, p_emote)
    ON CONFLICT (user_id, game_id) DO UPDATE
      SET emote = excluded.emote, emoted_at = clock_timestamp()
    RETURNING * INTO saved;

  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.record_emote(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_emote(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
