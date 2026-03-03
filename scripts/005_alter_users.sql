-- Add missing columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_complete boolean default false;
