-- Add IGDB time-to-beat data to games table
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS time_to_beat_minutes integer;

COMMENT ON COLUMN public.games.time_to_beat_minutes IS 'Typical play session length in minutes from IGDB time_to_beat data (normally). Falls back to estimated_session_length when null.';
