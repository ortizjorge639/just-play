-- Migration 030: where the player has put their homes (planner mode, H5a).
-- Each resident can have one saved spot: a deck, a cell on a 6 by 6 grid, and a quarter turn.
-- A resident with no row here keeps the automatic spot. Clients can only read their own rows.
-- The only write path is save_layout, which replaces the whole layout in one go.
-- Applying this file again changes nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.settlement_layout (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  deck integer NOT NULL,
  cell integer NOT NULL,
  rotation integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_settlement_layout_resident FOREIGN KEY (user_id, game_id)
    REFERENCES public.residents(user_id, game_id) ON DELETE CASCADE,
  CONSTRAINT settlement_layout_deck_check CHECK (deck >= 0),
  CONSTRAINT settlement_layout_cell_check CHECK (cell BETWEEN 0 AND 35),
  CONSTRAINT settlement_layout_rotation_check CHECK (rotation BETWEEN 0 AND 3),
  CONSTRAINT settlement_layout_one_per_cell UNIQUE (user_id, deck, cell) DEFERRABLE INITIALLY IMMEDIATE
);

ALTER TABLE public.settlement_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlement_layout_select_own ON public.settlement_layout;
CREATE POLICY settlement_layout_select_own ON public.settlement_layout
  FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.settlement_layout FROM PUBLIC, anon, authenticated;

-- save_layout: replace the whole layout. p_cells is a json array of
-- {"game_id": text, "deck": int, "cell": int, "rotation": int}, one entry per resident.
-- Decks must be numbered 0, 1, 2 with none empty, and there can be no more decks than
-- ceil(residents / 6), which is what the automatic layout would use.
-- An empty array clears the layout, which puts everyone back on their automatic spot.
-- Pieces sitting on a deck that no longer exists are taken off. They stay earned.
CREATE OR REPLACE FUNCTION public.save_layout(p_cells jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  resident_count integer;
  entry_count integer;
  distinct_games integer;
  deck_count integer;
  max_deck integer;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_cells IS NULL OR jsonb_typeof(p_cells) <> 'array' THEN RAISE EXCEPTION 'Bad layout'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));

  IF jsonb_array_length(p_cells) = 0 THEN
    DELETE FROM public.settlement_layout WHERE user_id = owner;
    RETURN 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_cells) e
    WHERE jsonb_typeof(e) <> 'object'
       OR jsonb_typeof(e -> 'game_id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(e -> 'deck') IS DISTINCT FROM 'number'
       OR jsonb_typeof(e -> 'cell') IS DISTINCT FROM 'number'
       OR jsonb_typeof(e -> 'rotation') IS DISTINCT FROM 'number'
       OR (e ->> 'deck') !~ '^[0-9]+$'
       OR (e ->> 'cell') !~ '^[0-9]+$'
       OR (e ->> 'rotation') !~ '^[0-9]+$'
  ) THEN RAISE EXCEPTION 'Bad layout'; END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp.layout_in (
    game_id text, deck integer, cell integer, rotation integer
  ) ON COMMIT DROP;
  DELETE FROM pg_temp.layout_in;
  INSERT INTO pg_temp.layout_in
    SELECT e ->> 'game_id', (e ->> 'deck')::integer, (e ->> 'cell')::integer, (e ->> 'rotation')::integer
    FROM jsonb_array_elements(p_cells) e;

  SELECT count(*) INTO resident_count FROM public.residents WHERE user_id = owner;
  SELECT count(*), count(DISTINCT game_id) INTO entry_count, distinct_games FROM pg_temp.layout_in;

  IF entry_count <> resident_count OR distinct_games <> entry_count THEN RAISE EXCEPTION 'Every home once'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp.layout_in l
    WHERE NOT EXISTS (SELECT 1 FROM public.residents r WHERE r.user_id = owner AND r.game_id = l.game_id)
  ) THEN RAISE EXCEPTION 'Resident not found'; END IF;
  IF EXISTS (SELECT 1 FROM pg_temp.layout_in WHERE cell > 35 OR rotation > 3) THEN
    RAISE EXCEPTION 'No such cell';
  END IF;
  IF (SELECT count(*) FROM (SELECT DISTINCT deck, cell FROM pg_temp.layout_in) d) <> entry_count THEN
    RAISE EXCEPTION 'Cell taken';
  END IF;

  SELECT count(DISTINCT deck), max(deck) INTO deck_count, max_deck FROM pg_temp.layout_in;
  IF max_deck + 1 <> deck_count THEN RAISE EXCEPTION 'Empty deck'; END IF;
  IF deck_count > GREATEST(1, (resident_count + 5) / 6) THEN RAISE EXCEPTION 'No such deck'; END IF;

  DELETE FROM public.settlement_layout WHERE user_id = owner;
  INSERT INTO public.settlement_layout (user_id, game_id, deck, cell, rotation)
    SELECT owner, game_id, deck, cell, rotation FROM pg_temp.layout_in;

  DELETE FROM public.settlement_pieces WHERE user_id = owner AND deck >= deck_count;

  RETURN entry_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_layout(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_layout(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
