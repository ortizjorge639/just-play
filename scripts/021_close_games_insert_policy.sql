-- Games are written by the server with the service role key (addSearchedGame).
-- Signed-in users no longer insert into the shared catalog directly.
-- Apply only after SUPABASE_SERVICE_ROLE_KEY is set in the deployment environment.
DROP POLICY IF EXISTS "games_insert_authenticated" ON public.games;
