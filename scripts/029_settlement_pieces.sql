-- Migration 029: player-placed settlement pieces.
-- A game that has reached 3000 minutes of play (the Elder tier) earns one piece, a loft.
-- The player puts it on one of three rim spots of one deck, and can move or take it back at will.
-- Earning is derived from game_progress, so nothing is stored for it. Only the placement is.
-- Clients can only read their own rows. All writes go through the two functions below.
-- Applying this file again changes nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS public.settlement_pieces (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  piece text NOT NULL,
  deck integer NOT NULL,
  anchor integer NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_settlement_pieces_resident FOREIGN KEY (user_id, game_id)
    REFERENCES public.residents(user_id, game_id) ON DELETE CASCADE,
  CONSTRAINT settlement_pieces_piece_check CHECK (piece IN ('loft')),
  CONSTRAINT settlement_pieces_deck_check CHECK (deck >= 0),
  CONSTRAINT settlement_pieces_anchor_check CHECK (anchor BETWEEN 0 AND 2),
  CONSTRAINT settlement_pieces_one_per_anchor UNIQUE (user_id, deck, anchor)
);

ALTER TABLE public.settlement_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlement_pieces_select_own ON public.settlement_pieces;
CREATE POLICY settlement_pieces_select_own ON public.settlement_pieces
  FOR SELECT USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.settlement_pieces FROM PUBLIC, anon, authenticated;

-- place_piece: put the loft a game has earned on a deck spot, or move it there.
-- The 3000 minutes and the deck size of 6 mirror lib/settlement/tiers.ts and layout.ts.
CREATE OR REPLACE FUNCTION public.place_piece(p_game_id text, p_deck integer, p_anchor integer)
RETURNS public.settlement_pieces
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  residents_count integer;
  saved public.settlement_pieces;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_game_id IS NULL OR p_deck IS NULL OR p_anchor IS NULL THEN RAISE EXCEPTION 'Missing place'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.residents r WHERE r.user_id = owner AND r.game_id = p_game_id
  ) THEN
    RAISE EXCEPTION 'Resident not found';
  END IF;

  IF COALESCE((
    SELECT g.total_time_minutes FROM public.game_progress g
    WHERE g.user_id = owner AND g.game_id = p_game_id
  ), 0) < 3000 THEN
    RAISE EXCEPTION 'Not earned yet';
  END IF;

  SELECT count(*) INTO residents_count FROM public.residents WHERE user_id = owner;
  IF p_deck < 0 OR p_deck >= GREATEST(1, (residents_count + 5) / 6) THEN
    RAISE EXCEPTION 'No such deck';
  END IF;
  IF p_anchor < 0 OR p_anchor > 2 THEN RAISE EXCEPTION 'No such spot'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.settlement_pieces s
    WHERE s.user_id = owner AND s.deck = p_deck AND s.anchor = p_anchor AND s.game_id <> p_game_id
  ) THEN
    RAISE EXCEPTION 'Spot taken';
  END IF;

  INSERT INTO public.settlement_pieces (user_id, game_id, piece, deck, anchor)
    VALUES (owner, p_game_id, 'loft', p_deck, p_anchor)
    ON CONFLICT (user_id, game_id) DO UPDATE
      SET deck = excluded.deck, anchor = excluded.anchor, updated_at = clock_timestamp()
    RETURNING * INTO saved;

  RETURN saved;
END;
$$;

-- remove_piece: take the piece back off the deck. It stays earned and can be placed again.
CREATE OR REPLACE FUNCTION public.remove_piece(p_game_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));
  DELETE FROM public.settlement_pieces WHERE user_id = owner AND game_id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_piece(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_piece(text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_piece(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_piece(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
