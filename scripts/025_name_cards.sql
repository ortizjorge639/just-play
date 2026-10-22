-- Migration 025: name cards.
-- A name card is the player's own card: a name, an optional tagline, an optional play style,
-- and up to three favorite games. The name stays in users.display_name; the rest lives here.
-- Clients can only read their own card. All writes go through save_name_card below.
-- Applying this file again changes nothing.

BEGIN;

-- name_cards: one row per player, made on first save. No row means an empty card.
CREATE TABLE IF NOT EXISTS public.name_cards (
  user_id uuid PRIMARY KEY,
  tagline text,
  play_style text,
  favorite_game_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_name_cards_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT name_cards_tagline_check CHECK (tagline IS NULL OR char_length(tagline) <= 200),
  CONSTRAINT name_cards_play_style_check CHECK (play_style IS NULL OR char_length(play_style) <= 80),
  CONSTRAINT name_cards_favorites_check CHECK (cardinality(favorite_game_ids) <= 3)
);

ALTER TABLE public.name_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS name_cards_select_own ON public.name_cards;
CREATE POLICY name_cards_select_own ON public.name_cards
  FOR SELECT USING (user_id = auth.uid());

-- No policy allows client writes; also take the table privileges away.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.name_cards FROM PUBLIC, anon, authenticated;

-- save_name_card: save the name and the card together, then return the saved card.
-- Any failed check raises, so nothing is saved, including the name.
-- It writes users.display_name and the card row, and nothing else.
CREATE OR REPLACE FUNCTION public.save_name_card(
  p_display_name text,
  p_tagline text DEFAULT NULL,
  p_play_style text DEFAULT NULL,
  p_favorite_game_ids text[] DEFAULT NULL
)
RETURNS public.name_cards
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  clean_name text := btrim(p_display_name);
  clean_tagline text := nullif(btrim(p_tagline), '');
  clean_style text := nullif(btrim(p_play_style), '');
  favorites text[] := coalesce(p_favorite_game_ids, '{}');
  saved public.name_cards%ROWTYPE;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Name card writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  -- Same per-account lock the finish and stamp paths take, so writes for one account run one at a time.
  PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));

  IF clean_name IS NULL OR clean_name = '' THEN RAISE EXCEPTION 'A name is required'; END IF;
  IF char_length(clean_name) > 50 THEN RAISE EXCEPTION 'A name can be at most 50 characters'; END IF;
  IF char_length(clean_tagline) > 200 THEN RAISE EXCEPTION 'A tagline can be at most 200 characters'; END IF;
  IF char_length(clean_style) > 80 THEN RAISE EXCEPTION 'A play style can be at most 80 characters'; END IF;

  IF cardinality(favorites) > 3 THEN RAISE EXCEPTION 'Pick at most 3 favorite games'; END IF;
  IF array_position(favorites, NULL) IS NOT NULL THEN RAISE EXCEPTION 'A favorite game is missing its id'; END IF;
  IF cardinality(favorites) <> (SELECT count(DISTINCT f) FROM unnest(favorites) AS f) THEN
    RAISE EXCEPTION 'Each favorite game can be picked once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(favorites) AS f
    WHERE NOT EXISTS (SELECT 1 FROM public.games g WHERE g.id = f)
  ) THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  UPDATE public.users SET display_name = clean_name WHERE id = owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  INSERT INTO public.name_cards (user_id, tagline, play_style, favorite_game_ids)
    VALUES (owner, clean_tagline, clean_style, favorites)
    ON CONFLICT (user_id) DO UPDATE
      SET tagline = excluded.tagline,
          play_style = excluded.play_style,
          favorite_game_ids = excluded.favorite_game_ids,
          updated_at = clock_timestamp()
    RETURNING * INTO saved;

  RETURN saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_name_card(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_name_card(text, text, text, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
