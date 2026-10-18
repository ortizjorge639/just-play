-- Upgrade 018+019 only; existing RPCs and safe direct/legacy writes stay usable.
-- New completion is atomic. Old multi-request flows retain their concurrency
-- limits, but cannot commit terminal progress while a same-game session is active.
-- No reapplication of 018/019 and no historical data rewrite is needed.
BEGIN;

-- Fence writes while installing triggers without blocking ordinary readers.
-- If writers are busy, retry the entire migration; do not wait holding one table
-- while a pre020 writer holds another and needs the first.
LOCK TABLE public.users, public.sessions, public.game_progress IN SHARE ROW EXCLUSIVE MODE NOWAIT;

-- Statement triggers run before tuple locks, including direct/legacy DML.
-- Lock order: shared maintenance fence, account lock, then tuple locks.
-- Privileged DML without auth.uid() takes the exclusive maintenance fence instead,
-- covering direct/admin inserts without guessing their account before row access.
-- Anonymous app writes still fail RLS. Never change account context mid-transaction.
-- The two-int fence key is in a separate namespace from bigint account keys.
-- Hash collisions only over-serialize unrelated accounts.
-- READ COMMITTED is required so reads after waiting for the account lock see
-- the committed creator; a pre-existing repeatable-read snapshot is unsafe.
CREATE FUNCTION public.lock_standby_account_statement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
BEGIN
  IF owner IS NULL AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Authenticated account context required for StandBy writes';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'StandBy writes require READ COMMITTED. Retry in a new transaction.';
  END IF;
  IF owner IS NULL THEN
    PERFORM pg_advisory_xact_lock(2147418112, 0);
  ELSE
    PERFORM pg_advisory_xact_lock_shared(2147418112, 0);
    PERFORM pg_advisory_xact_lock(hashtextextended('just_play.standby:' || owner::text, 0));
  END IF;
  RETURN NULL;
END;
$$;

CREATE FUNCTION public.enforce_standby_account_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner uuid := auth.uid();
  row_owner uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF TG_TABLE_NAME = 'users' THEN row_owner := OLD.id; ELSE row_owner := OLD.user_id; END IF;
    IF owner IS NOT NULL AND row_owner IS DISTINCT FROM owner THEN
      RAISE EXCEPTION 'StandBy write must match the authenticated account';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF TG_TABLE_NAME = 'users' THEN row_owner := NEW.id; ELSE row_owner := NEW.user_id; END IF;
    IF owner IS NOT NULL AND row_owner IS DISTINCT FROM owner THEN
      RAISE EXCEPTION 'StandBy write must match the authenticated account';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME <> 'users' THEN
    IF NEW.game_id IS DISTINCT FROM OLD.game_id THEN
      RAISE EXCEPTION 'StandBy session/progress game identity is immutable';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'game_progress' AND TG_OP <> 'DELETE' THEN
    IF NEW.status IN ('beaten', 'abandoned') AND EXISTS (
      SELECT 1 FROM public.sessions
      WHERE user_id = NEW.user_id AND game_id = NEW.game_id AND active = true
    ) THEN
      RAISE EXCEPTION 'Active session exists for this game. Refresh before completing game progress.';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER standby_account_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_standby_account_statement();
CREATE TRIGGER standby_account_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.game_progress
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_standby_account_statement();
CREATE TRIGGER standby_account_lock
  BEFORE UPDATE OR DELETE ON public.users
  FOR EACH STATEMENT EXECUTE FUNCTION public.lock_standby_account_statement();

CREATE TRIGGER a_standby_account_owner
  BEFORE INSERT OR UPDATE OR DELETE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_standby_account_owner();
CREATE TRIGGER a_standby_account_owner
  BEFORE INSERT OR UPDATE OR DELETE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.enforce_standby_account_owner();
CREATE TRIGGER a_standby_account_owner
  BEFORE UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_standby_account_owner();

-- A separate RPC avoids double bookkeeping by existing018 callers, which still
-- call create_standby_session then update progress themselves. That RPC and
-- set_standby_game_progress keep their018 auth/CAS/XP semantics unchanged.
CREATE FUNCTION public.create_standby_session_with_progress(
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
    INSERT INTO public.game_progress(user_id, game_id, status, total_sessions, total_time_minutes)
      VALUES(owner, p_game_id, 'playing', 1, 0)
      ON CONFLICT (user_id, game_id) DO UPDATE SET
        status = 'playing', total_sessions = coalesce(game_progress.total_sessions, 0) + 1;
    UPDATE public.users SET last_session_date = (clock_timestamp() AT TIME ZONE 'UTC')::date
      WHERE id = owner;
  END IF;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_xp, ''), true);
  RETURN NEXT created;
END;
$$;

-- NULL/JSON null: caller displayed no active same-game session.
-- Exact {id,status,started_at,paused_elapsed_seconds}: displayed session.
-- {"mode":"latest"}: intentional undefined-JS legacy/programmatic semantics.
-- Session assertion, timing finalization, progress and XP are one transaction,
-- serialized against every same-account writer before the first state read.
CREATE FUNCTION public.complete_standby_game(
  p_game_id text,
  p_status text,
  p_expected_session jsonb
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
    SELECT * INTO finished_session FROM public.transition_standby_session(
      active_session.id, to_jsonb(active_session),
      jsonb_build_object('status', 'Finished', 'ended_at', ended,
        'duration_minutes', round(elapsed::numeric / 60)::integer,
        'paused_elapsed_seconds', elapsed)
    );
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
      VALUES(owner, p_game_id, p_status, CASE WHEN p_status = 'beaten' THEN 1 ELSE 0 END,
        0, CASE WHEN p_status = 'beaten' THEN coalesce(ended, clock_timestamp()) ELSE NULL END)
      RETURNING * INTO progress;
  END IF;
  PERFORM set_config('just_play.atomic_xp', coalesce(previous_xp, ''), true);
  RETURN NEXT progress;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_standby_account_statement() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_standby_account_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_standby_game(text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_standby_session_with_progress(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_standby_game(text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_standby_session_with_progress(text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
