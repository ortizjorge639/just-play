-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users: own row only
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_delete_own" ON public.users FOR DELETE USING (auth.uid() = id);

-- Games: readable by all authenticated users, no user writes
CREATE POLICY "games_select_authenticated" ON public.games FOR SELECT USING (auth.role() = 'authenticated');

-- Sessions: own rows only
CREATE POLICY "sessions_select_own" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions_insert_own" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update_own" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "sessions_delete_own" ON public.sessions FOR DELETE USING (auth.uid() = user_id);
