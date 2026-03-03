-- Add tutorial_complete column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS tutorial_complete BOOLEAN DEFAULT false;
