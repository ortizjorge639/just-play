-- Drop the old check constraint and add updated one with Paused status
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE public.sessions ADD CONSTRAINT sessions_status_check 
  CHECK (status IN ('LockedIn', 'Playing', 'Paused', 'Finished'));
