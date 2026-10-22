-- Migration 024: stamps.
-- A stamp is the player's own answer to "what counts as done enough?" for a game.
-- Rules say when a game may move in; proofs record each confirmation.
-- Clients can only read their own rows. All writes go through the two functions below.
-- Applying this file again changes nothing.

BEGIN;

-- stamp_rules: game_id NULL is the player's default rule; a row with a game_id overrides it.
CREATE TABLE IF NOT EXISTS public.stamp_rules (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  game_id text,
  kind text NOT NULL,
  target_minutes integer,
  label text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT fk_stamp_rules_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_stamp_rules_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT stamp_rules_kind_check CHECK (kind IN ('hours', 'milestone')),
  CONSTRAINT stamp_rules_shape_check CHECK (
    (kind = 'hours' AND target_minutes IS NOT NULL AND target_minutes > 0 AND label IS NULL)
    OR (kind = 'milestone' AND target_minutes IS NULL AND label IS NOT NULL
        AND char_length(label) BETWEEN 1 AND 60)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS stamp_rules_one_default
  ON public.stamp_rules (user_id) WHERE game_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stamp_rules_one_per_game
  ON public.stamp_rules (user_id, game_id) WHERE game_id IS NOT NULL;

-- stamp_proofs: written once by confirm_stamp. The snapshot is what the rule said at that moment.
CREATE TABLE IF NOT EXISTS public.stamp_proofs (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  rule_snapshot jsonb NOT NULL,
  minutes_at_confirm integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_stamp_proofs_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_stamp_proofs_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

-- Residents may now arrive by stamp.
ALTER TABLE public.residents DROP CONSTRAINT IF EXISTS residents_arrival_source_check;
ALTER TABLE public.residents ADD CONSTRAINT residents_arrival_source_check
  CHECK (arrival_source IN ('beaten', 'imported', 'stamp'));

ALTER TABLE public.stamp_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_proofs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stamp_rules_select_own ON public.stamp_rules;
CREATE POLICY stamp_rules_select_own ON public.stamp_rules
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS stamp_proofs_select_own ON public.stamp_proofs;
CREATE POLICY stamp_proofs_select_own ON public.stamp_proofs
  FOR SELECT USING (user_id = auth.uid());

-- No policy allows client writes; also take the table privileges away.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stamp_rules FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stamp_proofs FROM PUBLIC, anon, authenticated;

-- set_stamp_rule: save or clear a rule. A NULL kind clears it.
-- A NULL game is the default rule. Clearing never touches residents or proofs.
CREATE OR REPLACE FUNCTION public.set_stamp_rule(
  p_game_id text,
  p_kind text DEFAULT NULL,
  p_target_minutes integer DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  clean_label text := nullif(btrim(p_label), '');
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Stamp writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  -- Same per-account lock the finish path takes, so stamps cannot race "Mark beaten".
  PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));

  IF p_game_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id) THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF p_kind IS NULL THEN
    DELETE FROM public.stamp_rules
      WHERE user_id = owner AND game_id IS NOT DISTINCT FROM p_game_id;
    RETURN;
  END IF;

  IF p_kind = 'hours' THEN
    IF p_target_minutes IS NULL OR p_target_minutes <= 0 THEN
      RAISE EXCEPTION 'An hours stamp needs a target above zero';
    END IF;
    IF clean_label IS NOT NULL THEN
      RAISE EXCEPTION 'An hours stamp has no label';
    END IF;
  ELSIF p_kind = 'milestone' THEN
    IF clean_label IS NULL OR char_length(clean_label) > 60 THEN
      RAISE EXCEPTION 'A milestone needs a label of 1 to 60 characters';
    END IF;
    IF p_target_minutes IS NOT NULL THEN
      RAISE EXCEPTION 'A milestone has no hours target';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown stamp kind';
  END IF;

  UPDATE public.stamp_rules
    SET kind = p_kind, target_minutes = p_target_minutes, label = clean_label,
        updated_at = clock_timestamp()
    WHERE user_id = owner AND game_id IS NOT DISTINCT FROM p_game_id;
  IF NOT FOUND THEN
    INSERT INTO public.stamp_rules (user_id, game_id, kind, target_minutes, label)
      VALUES (owner, p_game_id, p_kind, p_target_minutes, clean_label);
  END IF;
END;
$$;

-- confirm_stamp: the player says a game has reached its stamp.
-- Returns true when the resident newly arrived, false when nothing changed.
-- Adds no XP and changes no counters.
CREATE OR REPLACE FUNCTION public.confirm_stamp(p_game_id text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
SECURITY DEFINER
AS $$
DECLARE
  owner uuid := auth.uid();
  rule public.stamp_rules%ROWTYPE;
  progress public.game_progress%ROWTYPE;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Stamp writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));

  -- The game's own rule wins over the default.
  SELECT * INTO rule FROM public.stamp_rules
    WHERE user_id = owner AND game_id = p_game_id;
  IF NOT FOUND THEN
    SELECT * INTO rule FROM public.stamp_rules
      WHERE user_id = owner AND game_id IS NULL;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stamp rule for this game';
  END IF;

  IF EXISTS (SELECT 1 FROM public.residents WHERE user_id = owner AND game_id = p_game_id) THEN
    RETURN false;
  END IF;

  SELECT * INTO progress FROM public.game_progress
    WHERE user_id = owner AND game_id = p_game_id;
  IF NOT FOUND OR progress.status <> 'playing' THEN
    RAISE EXCEPTION 'This game is not invited yet';
  END IF;
  IF rule.kind = 'hours' AND coalesce(progress.total_time_minutes, 0) < rule.target_minutes THEN
    RAISE EXCEPTION 'Not enough time played yet';
  END IF;

  INSERT INTO public.stamp_proofs (user_id, game_id, rule_snapshot, minutes_at_confirm)
    VALUES (
      owner, p_game_id,
      jsonb_build_object(
        'kind', rule.kind,
        'target_minutes', rule.target_minutes,
        'label', rule.label,
        'scope', CASE WHEN rule.game_id IS NULL THEN 'default' ELSE 'game' END
      ),
      coalesce(progress.total_time_minutes, 0)
    )
    ON CONFLICT (user_id, game_id) DO NOTHING;

  PERFORM public.grant_resident_arrival(owner, p_game_id, 'stamp');
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_stamp_rule(text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_stamp(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_stamp_rule(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stamp(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
