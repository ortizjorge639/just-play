-- Allow 'igdb' as a valid game source
ALTER TABLE public.games DROP CONSTRAINT IF EXISTS games_source_check;
ALTER TABLE public.games ADD CONSTRAINT games_source_check CHECK (source IN ('steam', 'test', 'igdb'));
