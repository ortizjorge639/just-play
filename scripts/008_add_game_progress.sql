-- Add notes and session_goal to sessions table
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS session_goal TEXT,
ADD COLUMN IF NOT EXISTS paused_elapsed_seconds INTEGER DEFAULT 0;

-- Create game_progress table to track overall game completion
CREATE TABLE IF NOT EXISTS public.game_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing', 'beaten', 'abandoned')),
  total_sessions INTEGER DEFAULT 0,
  total_time_minutes INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Enable RLS on game_progress
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

-- RLS policies for game_progress
CREATE POLICY "game_progress_select_own" ON public.game_progress 
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "game_progress_insert_own" ON public.game_progress 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "game_progress_update_own" ON public.game_progress 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "game_progress_delete_own" ON public.game_progress 
  FOR DELETE USING (auth.uid() = user_id);
