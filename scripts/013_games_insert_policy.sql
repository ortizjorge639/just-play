-- Allow authenticated users to insert games (for search-and-add feature)
-- Alternative to using the service role key: run this in Supabase SQL Editor
CREATE POLICY "games_insert_authenticated" ON public.games
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
