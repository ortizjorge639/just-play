-- Create users table (extends auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  steam_id text,
  preferences jsonb default '{}',
  streak_enabled boolean default false,
  created_at timestamptz default now()
);

-- Create games table
create table if not exists public.games (
  id text primary key,
  name text not null,
  genres text[] default '{}',
  estimated_session_length integer,
  header_image text,
  description text,
  source text default 'test' check (source in ('steam', 'test')),
  created_at timestamptz default now()
);

-- Create sessions table
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  game_id text not null references public.games(id),
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_minutes integer default 0,
  status text not null default 'LockedIn' check (status in ('LockedIn','Started','Playing','Finished')),
  active boolean default true,
  created_at timestamptz default now()
);

-- Unique partial index: only 1 active session per user
create unique index if not exists idx_one_active_session on public.sessions (user_id) where (active = true);
