-- Apply before deploying StandBy actions. Existing sessions keep recording enabled.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS standby_preferences jsonb NOT NULL
  DEFAULT '{"record_time":true,"show_clock":true,"reminders":false,"keep_awake":false}'::jsonb;

ALTER TABLE public.users ADD CONSTRAINT users_standby_preferences_check CHECK (
  jsonb_typeof(standby_preferences) = 'object'
  AND standby_preferences ?& ARRAY['record_time', 'show_clock', 'reminders', 'keep_awake']
  AND jsonb_typeof(standby_preferences->'record_time') = 'boolean'
  AND jsonb_typeof(standby_preferences->'show_clock') = 'boolean'
  AND jsonb_typeof(standby_preferences->'reminders') = 'boolean'
  AND jsonb_typeof(standby_preferences->'keep_awake') = 'boolean'
);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS paused_elapsed_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS record_time boolean NOT NULL DEFAULT true;

UPDATE public.sessions SET paused_elapsed_seconds = 0 WHERE paused_elapsed_seconds IS NULL;
ALTER TABLE public.sessions ALTER COLUMN paused_elapsed_seconds SET DEFAULT 0;
ALTER TABLE public.sessions ALTER COLUMN paused_elapsed_seconds SET NOT NULL;

-- Freeze account recording at INSERT (including clients inserting Playing directly).
-- Timing and the duration-XP ledger commit together; finished details are immutable.
CREATE OR REPLACE FUNCTION public.enforce_standby_session()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  duration_xp integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT coalesce((u.standby_preferences->>'record_time')::boolean, true)
      INTO NEW.record_time FROM public.users u WHERE u.id = NEW.user_id;
    NEW.record_time := coalesce(NEW.record_time, true);
  ELSE
    IF NEW.record_time IS DISTINCT FROM OLD.record_time THEN
      RAISE EXCEPTION 'Session recording preference is immutable';
    END IF;
    IF OLD.status = 'Finished' AND (
      NEW.status IS DISTINCT FROM OLD.status OR
      NEW.active IS DISTINCT FROM OLD.active OR
      NEW.started_at IS DISTINCT FROM OLD.started_at OR
      NEW.ended_at IS DISTINCT FROM OLD.ended_at OR
      NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes OR
      NEW.paused_elapsed_seconds IS DISTINCT FROM OLD.paused_elapsed_seconds OR
      NEW.notes IS DISTINCT FROM OLD.notes OR
      NEW.session_goal IS DISTINCT FROM OLD.session_goal
    ) THEN
      RAISE EXCEPTION 'Finished session timing, notes and goal are immutable';
    END IF;
  END IF;

  IF NOT NEW.record_time OR NEW.status = 'LockedIn' THEN
    NEW.duration_minutes := 0;
    NEW.paused_elapsed_seconds := 0;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'Finished' AND NEW.status = 'Finished' THEN
    IF OLD.status = 'LockedIn' THEN
      NEW.duration_minutes := 0;
      NEW.paused_elapsed_seconds := 0;
    END IF;
    NEW.active := false;
    duration_xp := CASE WHEN NEW.record_time THEN
      greatest(0, coalesce(NEW.duration_minutes, 0)) / 5
      + CASE WHEN NEW.duration_minutes >= 60 THEN 10 ELSE 0 END
      ELSE 0 END;
    NEW.xp_awarded := coalesce(OLD.xp_awarded, 0) + duration_xp;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_standby_session
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_standby_session();

-- The session compare-and-set and profile increment are one database transaction.
-- A concurrent/stale transition updates no row, therefore never fires this trigger.
CREATE OR REPLACE FUNCTION public.award_standby_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  award integer := 0;
  total integer;
  player_level integer := 1;
  needed integer := 100;
BEGIN
  IF current_setting('just_play.atomic_xp', true) IS DISTINCT FROM 'standby_v1' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'sessions' THEN
    IF TG_OP = 'INSERT' THEN
      award := coalesce(NEW.xp_awarded, 0);
    ELSIF OLD.status <> 'Finished' AND NEW.status = 'Finished' THEN
      award := coalesce(NEW.xp_awarded, 0) - coalesce(OLD.xp_awarded, 0);
    END IF;
  ELSIF NEW.status = 'beaten' THEN
    IF TG_OP = 'INSERT' THEN
      award := 50;
    ELSIF OLD.status <> 'beaten' THEN
      award := 50;
    END IF;
  END IF;
  IF award > 0 THEN
    UPDATE public.users SET total_xp = coalesce(total_xp, 0) + award
      WHERE id = NEW.user_id RETURNING total_xp INTO total;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Session user profile not found';
    END IF;
    WHILE total >= needed LOOP
      total := total - needed;
      player_level := player_level + 1;
      needed := needed + 50;
    END LOOP;
    UPDATE public.users SET level = player_level WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER award_standby_session_xp
  AFTER INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.award_standby_xp();

CREATE TRIGGER award_standby_beaten_xp
  AFTER INSERT OR UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.award_standby_xp();

-- Legacy actions update profile XP themselves. Only these new, authenticated
-- mutation paths opt into trigger-based awarding, scoped to their transaction.
CREATE OR REPLACE FUNCTION public.create_standby_session(
  p_game_id text,
  p_start_xp integer DEFAULT 0
)
RETURNS SETOF public.sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_flag text := current_setting('just_play.atomic_xp', true);
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_start_xp IS NULL OR p_start_xp < 0 OR p_start_xp > 35 THEN
    RAISE EXCEPTION 'Invalid session start XP';
  END IF;
  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  RETURN QUERY INSERT INTO public.sessions(user_id, game_id, status, active, xp_awarded)
    VALUES(owner, p_game_id, 'LockedIn', true, p_start_xp) RETURNING *;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_flag, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_standby_session(
  p_session_id uuid,
  p_expected jsonb,
  p_updates jsonb
)
RETURNS SETOF public.sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_flag text := current_setting('just_play.atomic_xp', true);
  next_status text := p_updates->>'status';
  previous_status text := p_expected->>'status';
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    (previous_status = 'LockedIn' AND next_status IN ('Playing', 'Finished')) OR
    (previous_status = 'Playing' AND next_status IN ('Paused', 'Finished')) OR
    (previous_status = 'Paused' AND next_status IN ('Playing', 'Finished'))
  ) OR next_status IS NULL OR previous_status IS NULL THEN
    RAISE EXCEPTION 'Invalid session transition';
  END IF;
  IF NOT (p_expected ?& ARRAY[
    'status','active','started_at','ended_at','paused_elapsed_seconds',
    'duration_minutes','record_time','xp_awarded'
  ]) THEN RAISE EXCEPTION 'Full session snapshot required'; END IF;
  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  RETURN QUERY UPDATE public.sessions s SET
    status = next_status,
    active = CASE WHEN next_status = 'Finished' THEN false ELSE s.active END,
    started_at = CASE WHEN p_updates ? 'started_at' THEN (p_updates->>'started_at')::timestamptz ELSE s.started_at END,
    ended_at = CASE WHEN p_updates ? 'ended_at' THEN (p_updates->>'ended_at')::timestamptz ELSE s.ended_at END,
    duration_minutes = CASE WHEN p_updates ? 'duration_minutes' THEN greatest(0, (p_updates->>'duration_minutes')::integer) ELSE s.duration_minutes END,
    paused_elapsed_seconds = CASE WHEN p_updates ? 'paused_elapsed_seconds' THEN greatest(0, (p_updates->>'paused_elapsed_seconds')::integer) ELSE s.paused_elapsed_seconds END
  WHERE s.id = p_session_id AND s.user_id = owner AND s.active = true
    AND s.status = previous_status
    AND s.active IS NOT DISTINCT FROM (p_expected->>'active')::boolean
    AND s.started_at IS NOT DISTINCT FROM (p_expected->>'started_at')::timestamptz
    AND s.ended_at IS NOT DISTINCT FROM (p_expected->>'ended_at')::timestamptz
    AND s.paused_elapsed_seconds IS NOT DISTINCT FROM (p_expected->>'paused_elapsed_seconds')::integer
    AND s.duration_minutes IS NOT DISTINCT FROM (p_expected->>'duration_minutes')::integer
    AND s.record_time IS NOT DISTINCT FROM (p_expected->>'record_time')::boolean
    AND s.xp_awarded IS NOT DISTINCT FROM (p_expected->>'xp_awarded')::integer
  RETURNING s.*;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_flag, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_standby_game_progress(
  p_game_id text,
  p_status text,
  p_expected_status text DEFAULT NULL
)
RETURNS SETOF public.game_progress
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_flag text := current_setting('just_play.atomic_xp', true);
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('beaten', 'abandoned') THEN
    RAISE EXCEPTION 'Invalid game progress status';
  END IF;
  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  IF p_expected_status IS NULL THEN
    RETURN QUERY INSERT INTO public.game_progress(
      user_id, game_id, status, total_sessions, total_time_minutes, completed_at
    ) VALUES (
      owner, p_game_id, p_status, CASE WHEN p_status = 'beaten' THEN 1 ELSE 0 END,
      0, CASE WHEN p_status = 'beaten' THEN now() ELSE NULL END
    ) RETURNING *;
  ELSE
    RETURN QUERY UPDATE public.game_progress g SET
      status = p_status,
      completed_at = CASE WHEN p_status = 'beaten' THEN now() ELSE g.completed_at END
      WHERE g.user_id = owner AND g.game_id = p_game_id AND g.status = p_expected_status
      RETURNING g.*;
  END IF;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_flag, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_standby_profile_xp(
  p_total_xp integer,
  p_last_session_date date DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_flag text := current_setting('just_play.atomic_xp', true);
  remaining integer := p_total_xp;
  player_level integer := 1;
  needed integer := 100;
  affected integer;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_total_xp IS NULL OR p_total_xp < 0 THEN RAISE EXCEPTION 'Invalid backfill XP'; END IF;
  WHILE remaining >= needed LOOP
    remaining := remaining - needed;
    player_level := player_level + 1;
    needed := needed + 50;
  END LOOP;
  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  UPDATE public.users SET total_xp = p_total_xp, level = player_level,
    last_session_date = p_last_session_date
    WHERE id = owner AND coalesce(total_xp, 0) = 0;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_flag, ''), true);
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.create_standby_session(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_standby_session(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_standby_game_progress(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_standby_profile_xp(integer, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_standby_session(text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.transition_standby_session(uuid, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_standby_game_progress(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.backfill_standby_profile_xp(integer, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_standby_session(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_standby_session(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_standby_game_progress(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_standby_profile_xp(integer, date) TO authenticated;

-- Once an account has any untracked session history, old clients must reload.
-- Legacy writes can arrive after that session finishes or a tracked one starts;
-- an active-only guard would let delayed duration XP leak into the profile.
-- Reject direct increments permanently while that history exists. New atomic
-- RPCs still award permitted non-duration start/beat bonuses and backfill.
CREATE OR REPLACE FUNCTION public.protect_untracked_profile_xp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_xp > coalesce(OLD.total_xp, 0)
    AND current_setting('just_play.atomic_xp', true) IS DISTINCT FROM 'standby_v1'
    AND EXISTS (
      SELECT 1 FROM public.sessions s WHERE s.user_id = NEW.id
        AND s.record_time = false
    ) THEN
    RAISE EXCEPTION 'Untracked session history requires current StandBy actions. Reload the app before changing XP.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_untracked_profile_xp
  BEFORE UPDATE OF total_xp ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_untracked_profile_xp();

NOTIFY pgrst, 'reload schema';

COMMIT;
