-- Gamification: Add XP, level, and streak tracking
-- Users: persistent stats cached on the user record
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_xp integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS level integer DEFAULT 1;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS streak_count integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS best_streak integer DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_session_date date;

-- Sessions: track how much XP each session awarded (prevents double-counting on backfill)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS xp_awarded integer DEFAULT 0;
