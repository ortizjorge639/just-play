-- Create a real session only after the player chooses Start Playing.
-- The selection/ready state remains client-only; this keeps canceled choices
-- out of session history, game progress, streaks, and XP.
BEGIN;

CREATE FUNCTION public.start_standby_session_with_progress(
  p_game_id text,
  p_start_xp integer DEFAULT 0
)
RETURNS SETOF public.sessions
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  created public.sessions%ROWTYPE;
  started public.sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'StandBy writes require READ COMMITTED. Retry in a new transaction.';
  END IF;

  SELECT * INTO created
    FROM public.create_standby_session_with_progress(p_game_id, p_start_xp);
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not create session'; END IF;

  SELECT * INTO started
    FROM public.transition_standby_session(
      created.id,
      to_jsonb(created),
      jsonb_build_object(
        'status', 'Playing',
        'started_at', clock_timestamp(),
        'paused_elapsed_seconds', 0
      )
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Could not start session'; END IF;

  RETURN NEXT started;
END;
$$;

REVOKE ALL ON FUNCTION public.start_standby_session_with_progress(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_standby_session_with_progress(text, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
