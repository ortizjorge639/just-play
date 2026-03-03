-- Enable anonymous sign-ins in Supabase Auth config
-- Note: This needs to be enabled in the Supabase Dashboard under Authentication > Providers > Anonymous Sign-Ins
-- This script updates RLS policies to handle anonymous users properly

-- Update users policies to allow anonymous users to create their profile
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow anonymous users to update their own profile  
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users 
  FOR UPDATE USING (auth.uid() = id);

-- Sessions policies already use auth.uid() so they work for anonymous users too
