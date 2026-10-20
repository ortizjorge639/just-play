-- Fix game_progress counters corrupted by migration 020.
-- Problem: create_standby_session_with_progress increments total_sessions at session START (wrong),
-- and complete_standby_game inserts/updates without recalculating from finished sessions.
-- Solution: Replace both functions to NEVER manually update counters.
-- Instead, derive total_sessions and total_time_minutes from finished sessions (status='Finished', active=false).
-- This migration does NOT modify migration files 018, 019, or 020 themselves.
BEGIN;

-- Backfill: recalculate all counters from finished sessions only
UPDATE public.game_progress gp SET
  total_sessions = (
    SELECT COUNT(*)
    FROM public.sessions s
    WHERE s.user_id = gp.user_id
      AND s.game_id = gp.game_id
      AND s.status = 'Finished'
      AND s.active = false
  ),
  total_time_minutes = (
    SELECT COALESCE(SUM(s.duration_minutes), 0)
    FROM public.sessions s
    WHERE s.user_id = gp.user_id
      AND s.game_id = gp.game_id
      AND s.status = 'Finished'
      AND s.active = false
  );

-- CREATE OR REPLACE create_standby_session_with_progress to NOT increment total_sessions at start
CREATE OR REPLACE FUNCTION public.create_standby_session_with_progress(
  p_game_id text,
  p_start_xp integer DEFAULT 0
)
RETURNS SETOF public.sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_xp text := current_setting('just_play.atomic_xp', true);
  created public.sessions%ROWTYPE;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'StandBy writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  IF p_start_xp IS NULL OR p_start_xp < 0 OR p_start_xp > 35 THEN
    RAISE EXCEPTION 'Invalid session start XP';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));
  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  SELECT * INTO created FROM public.create_standby_session(p_game_id, p_start_xp);
  IF p_start_xp > 0 THEN
    -- Initialize game_progress only if it doesn't exist; do NOT increment counters
    INSERT INTO public.game_progress(user_id, game_id, status, total_sessions, total_time_minutes)
      VALUES(owner, p_game_id, 'playing', 0, 0)
      ON CONFLICT (user_id, game_id) DO NOTHING;
    UPDATE public.users SET last_session_date = (clock_timestamp() AT TIME ZONE 'UTC')::date
      WHERE id = owner;
  END IF;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_xp, ''), true);
  RETURN NEXT created;
END;
$$;

-- CREATE OR REPLACE complete_standby_game to derive counters from finished sessions
CREATE OR REPLACE FUNCTION public.complete_standby_game(
  p_game_id text,
  p_status text,
  p_expected_session jsonb,
  p_final_notes text DEFAULT NULL
)
RETURNS SETOF public.game_progress
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  previous_xp text := current_setting('just_play.atomic_xp', true);
  active_session public.sessions%ROWTYPE;
  finished_session public.sessions%ROWTYPE;
  progress public.game_progress%ROWTYPE;
  has_session boolean;
  elapsed integer := 0;
  ended timestamptz;
  timing jsonb;
BEGIN
  IF owner IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'StandBy writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('beaten', 'abandoned') THEN
    RAISE EXCEPTION 'Invalid game progress status';
  END IF;
  PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
  PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));
  SELECT * INTO active_session FROM public.sessions
    WHERE user_id = owner AND game_id = p_game_id AND active = true FOR UPDATE;
  has_session := FOUND;

  IF p_expected_session IS NULL OR p_expected_session = 'null'::jsonb THEN
    IF has_session THEN RAISE EXCEPTION 'Session changed. Refresh before trying again.'; END IF;
  ELSIF p_expected_session <> '{"mode":"latest"}'::jsonb THEN
    IF jsonb_typeof(p_expected_session) <> 'object'
      OR NOT (p_expected_session ?& ARRAY['id','status','started_at','paused_elapsed_seconds'])
      OR jsonb_typeof(p_expected_session->'id') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_expected_session->'status') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_expected_session->'started_at') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_expected_session->'paused_elapsed_seconds') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Full displayed session snapshot required';
    END IF;
    IF NOT has_session
      OR active_session.id IS DISTINCT FROM (p_expected_session->>'id')::uuid
      OR active_session.status IS DISTINCT FROM p_expected_session->>'status'
      OR active_session.started_at IS DISTINCT FROM (p_expected_session->>'started_at')::timestamptz
      OR coalesce(active_session.paused_elapsed_seconds, 0) IS DISTINCT FROM (p_expected_session->>'paused_elapsed_seconds')::integer THEN
      RAISE EXCEPTION 'Session changed. Refresh before trying again.';
    END IF;
  END IF;

  IF has_session THEN
    ended := clock_timestamp();
    IF active_session.record_time AND active_session.status <> 'LockedIn' THEN
      elapsed := greatest(0, coalesce(active_session.paused_elapsed_seconds, 0));
      IF active_session.status = 'Playing' THEN
        elapsed := elapsed + greatest(0, floor(extract(epoch FROM (ended - active_session.started_at)))::integer);
      END IF;
    END IF;
    timing := jsonb_build_object('status', 'Finished', 'ended_at', ended,
      'duration_minutes', round(elapsed::numeric / 60)::integer,
      'paused_elapsed_seconds', elapsed);
    IF p_final_notes IS NOT NULL THEN
      SELECT * INTO finished_session FROM public.finish_standby_session_with_notes(
        active_session.id, to_jsonb(active_session), timing, p_final_notes);
    ELSE
      SELECT * INTO finished_session FROM public.transition_standby_session(
        active_session.id, to_jsonb(active_session), timing);
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session changed. Refresh before trying again.'; END IF;
  END IF;

  PERFORM set_config('just_play.atomic_xp', 'standby_v1', true);
  SELECT * INTO progress FROM public.game_progress
    WHERE user_id = owner AND game_id = p_game_id FOR UPDATE;
  IF FOUND THEN
    IF progress.status IS DISTINCT FROM p_status THEN
      UPDATE public.game_progress SET status = p_status,
        completed_at = CASE WHEN p_status = 'beaten' THEN coalesce(ended, clock_timestamp()) ELSE completed_at END
        WHERE id = progress.id RETURNING game_progress.* INTO progress;
    END IF;
  ELSE
    INSERT INTO public.game_progress(user_id, game_id, status, total_sessions, total_time_minutes, completed_at)
      VALUES(owner, p_game_id, p_status, 0, 0, CASE WHEN p_status = 'beaten' THEN coalesce(ended, clock_timestamp()) ELSE NULL END)
      RETURNING * INTO progress;
  END IF;
  
  -- Recalculate counters from finished sessions
  UPDATE public.game_progress SET
    total_sessions = (
      SELECT COUNT(*)
      FROM public.sessions s
      WHERE s.user_id = progress.user_id
        AND s.game_id = progress.game_id
        AND s.status = 'Finished'
        AND s.active = false
    ),
    total_time_minutes = (
      SELECT COALESCE(SUM(s.duration_minutes), 0)
      FROM public.sessions s
      WHERE s.user_id = progress.user_id
        AND s.game_id = progress.game_id
        AND s.status = 'Finished'
        AND s.active = false
    )
    WHERE id = progress.id
    RETURNING * INTO progress;
  
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_xp, ''), true);
  RETURN NEXT progress;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
