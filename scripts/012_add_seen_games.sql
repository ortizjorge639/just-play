-- Track which games have been shown to avoid duplicates across refreshes
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS seen_game_ids text[] DEFAULT '{}';
