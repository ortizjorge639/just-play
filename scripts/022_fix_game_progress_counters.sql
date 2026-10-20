-- Fix game_progress counters corrupted by migration 020.
-- Recalculate total_sessions and total_time_minutes from actual finished sessions.
-- This migration does NOT modify migrations 018, 019, or 020.
BEGIN;

-- Recalculate and fix game_progress counters based on finished sessions.
-- total_sessions: count of finished sessions for this user+game
-- total_time_minutes: sum of duration_minutes from finished sessions
UPDATE public.game_progress gp SET
  total_sessions = (
    SELECT COUNT(*)
    FROM public.sessions s
    WHERE s.user_id = gp.user_id
      AND s.game_id = gp.game_id
      AND s.status = 'Finished'
  ),
  total_time_minutes = (
    SELECT COALESCE(SUM(s.duration_minutes), 0)
    FROM public.sessions s
    WHERE s.user_id = gp.user_id
      AND s.game_id = gp.game_id
      AND s.status = 'Finished'
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
