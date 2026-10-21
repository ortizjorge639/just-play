-- Migration 023: residents and postcards feature.
-- Residents track when a user beats a game (for achievements/leaderboards).
-- Postcards track abandoned games (for recommendation feedback).
-- Trigger on game_progress: insert resident on 'beaten', insert postcard on 'abandoned'.
-- RLS: users can only SELECT their own rows; no direct INSERT/UPDATE/DELETE from clients.
-- Grant-resident RPC: SECURITY DEFINER, ON CONFLICT DO NOTHING.
-- Delete-postcard RPC: SECURITY DEFINER, caller-only, EXECUTE revoked from PUBLIC/anon.

BEGIN;

-- residents: user_id, game_id, arrived_at (timestamptz), arrival_source (default 'beaten')
CREATE TABLE public.residents (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  arrived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  arrival_source text NOT NULL DEFAULT 'beaten',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_residents_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_residents_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE,
  CONSTRAINT residents_arrival_source_check CHECK (arrival_source IN ('beaten', 'imported'))
);

-- postcards: user_id, game_id, created_at (timestamptz)
CREATE TABLE public.postcards (
  user_id uuid NOT NULL,
  game_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, game_id),
  CONSTRAINT fk_postcards_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_postcards_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE
);

-- Enable RLS on both tables
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.postcards ENABLE ROW LEVEL SECURITY;

-- RLS policies: SELECT-own only (no INSERT/UPDATE/DELETE for clients)
CREATE POLICY residents_select_own ON public.residents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY postcards_select_own ON public.postcards
  FOR SELECT USING (user_id = auth.uid());

-- SECURITY DEFINER function to grant resident arrival
-- Called by trigger when game_progress.status becomes 'beaten'.
-- Uses ON CONFLICT DO NOTHING for idempotency.
CREATE OR REPLACE FUNCTION public.grant_resident_arrival(
  p_user_id uuid,
  p_game_id text,
  p_arrival_source text DEFAULT 'beaten'
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.residents (user_id, game_id, arrival_source, arrived_at)
    VALUES (p_user_id, p_game_id, p_arrival_source, clock_timestamp())
    ON CONFLICT (user_id, game_id) DO NOTHING;
  
  DELETE FROM public.postcards
    WHERE user_id = p_user_id AND game_id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_resident_arrival(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_resident_arrival(uuid, text, text) TO authenticated;

-- Trigger on game_progress: when status becomes 'beaten', insert resident.
CREATE OR REPLACE FUNCTION public.trigger_game_progress_residents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'beaten' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'beaten') THEN
      PERFORM public.grant_resident_arrival(NEW.user_id, NEW.game_id, 'beaten');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_progress_residents_on_beaten
  AFTER INSERT OR UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_game_progress_residents();

-- Trigger on game_progress: when status becomes 'abandoned' and no resident exists, insert postcard.
CREATE OR REPLACE FUNCTION public.trigger_game_progress_postcards()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status = 'abandoned' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'abandoned') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.residents
        WHERE user_id = NEW.user_id AND game_id = NEW.game_id
      ) THEN
        INSERT INTO public.postcards (user_id, game_id, created_at)
          VALUES (NEW.user_id, NEW.game_id, clock_timestamp())
          ON CONFLICT (user_id, game_id) DO NOTHING;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_progress_postcards_on_abandoned
  AFTER INSERT OR UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.trigger_game_progress_postcards();

-- SECURITY DEFINER RPC: delete postcard (caller-only)
-- Used by client to remove postcards after abandonment feedback.
CREATE OR REPLACE FUNCTION public.delete_postcard(p_game_id text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.postcards
    WHERE user_id = caller AND game_id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_postcard(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_postcard(text) TO authenticated;

-- Idempotent backfill: process completed_at and abandoned statuses
-- Rule 1: If game_progress.completed_at IS NOT NULL, create resident with arrived_at = completed_at
-- Rule 2: If game_progress.status = 'abandoned' AND completed_at IS NULL AND no resident exists, create postcard
-- Uses ON CONFLICT DO NOTHING so it's safe to run multiple times
DO $$
DECLARE
  gp_row RECORD;
BEGIN
  FOR gp_row IN
    SELECT id, user_id, game_id, status, completed_at
    FROM public.game_progress
    WHERE completed_at IS NOT NULL OR status = 'abandoned'
  LOOP
    -- Insert resident if completed_at is not null
    IF gp_row.completed_at IS NOT NULL THEN
      INSERT INTO public.residents (user_id, game_id, arrived_at, arrival_source)
        VALUES (gp_row.user_id, gp_row.game_id, gp_row.completed_at, 'beaten')
        ON CONFLICT (user_id, game_id) DO NOTHING;
    END IF;
    
    -- Insert postcard if abandoned and no completed_at and no resident
    IF gp_row.status = 'abandoned' AND gp_row.completed_at IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.residents
        WHERE user_id = gp_row.user_id AND game_id = gp_row.game_id
      ) THEN
        INSERT INTO public.postcards (user_id, game_id, created_at)
          VALUES (gp_row.user_id, gp_row.game_id, clock_timestamp())
          ON CONFLICT (user_id, game_id) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
