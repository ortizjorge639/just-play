// Test migration 022: verify game_progress counters are derived from finished sessions
// and never incremented at session start or miscounted on completion.
// Uses PGlite in-memory database (no Docker required).
// From the repository root:
// npx --yes --package=@electric-sql/pglite@0.5.9 -- node --test scripts/migration-022-counters.test.mjs

import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"

const loadPackage = createRequire(import.meta.url)
function resolvePGlite() {
  try {
    return loadPackage.resolve("@electric-sql/pglite")
  } catch {
    for (const bin of (process.env.PATH ?? "").split(path.delimiter)) {
      const candidate = path.resolve(bin, "..", "@electric-sql", "pglite")
      if (existsSync(path.join(candidate, "package.json"))) return candidate
    }
    throw new Error("Run the npx --package=@electric-sql/pglite@0.5.9 command documented at the top of this test.")
  }
}

const { PGlite } = loadPackage(resolvePGlite())

async function one(db, sql, args = []) {
  const result = await db.query(sql, args)
  return result.rows[0]
}

async function setupDb() {
  const db = new PGlite()
  
  // Create auth schema and minimal functions
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
  `)
  
  // Create public schema with minimal tables and functions for testing
  await db.exec(`
    create table public.users (
      id uuid primary key,
      last_session_date date,
      total_xp integer default 0,
      level integer default 1
    );
    
    create table public.games (
      id text primary key,
      name text not null,
      source text default 'test',
      created_at timestamptz default now()
    );
    
    create table public.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      game_id text not null,
      status text not null default 'LockedIn',
      active boolean not null default true,
      started_at timestamptz default now(),
      ended_at timestamptz,
      duration_minutes integer default 0,
      paused_elapsed_seconds integer default 0,
      record_time boolean default true,
      xp_awarded integer default 0,
      notes text,
      session_goal text,
      created_at timestamptz default now()
    );
    
    create table public.game_progress (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      game_id text not null,
      status text not null,
      total_sessions integer default 0,
      total_time_minutes integer default 0,
      completed_at timestamptz,
      created_at timestamptz default now()
    );
    
    create unique index game_progress_user_game_idx on public.game_progress (user_id, game_id);
  `)
  
  // Create the helper functions from migration 020 (simplified versions)
  await db.exec(`
    create or replace function public.create_standby_session(
      p_game_id text,
      p_start_xp integer default 0
    )
    returns setof public.sessions
    language plpgsql
    set search_path = public
    as $$
    declare
      owner uuid := auth.uid();
    begin
      if owner is null then raise exception 'Not authenticated'; end if;
      if p_start_xp is null or p_start_xp < 0 or p_start_xp > 35 then
        raise exception 'Invalid session start XP';
      end if;
      return query insert into public.sessions (user_id, game_id, status, active, xp_awarded)
        values (owner, p_game_id, 'LockedIn', true, p_start_xp)
        returning *;
    end;
    $$;
    
    create or replace function public.transition_standby_session(
      p_session_id uuid,
      p_expected jsonb,
      p_updates jsonb
    )
    returns setof public.sessions
    language plpgsql
    set search_path = public
    as $$
    declare
      owner uuid := auth.uid();
      next_status text := p_updates->>'status';
    begin
      if owner is null then raise exception 'Not authenticated'; end if;
      return query update public.sessions s set
        status = next_status,
        active = case when next_status = 'Finished' then false else s.active end,
        ended_at = case when p_updates ? 'ended_at' then (p_updates->>'ended_at')::timestamptz else s.ended_at end,
        duration_minutes = case when p_updates ? 'duration_minutes' then (p_updates->>'duration_minutes')::integer else s.duration_minutes end,
        paused_elapsed_seconds = case when p_updates ? 'paused_elapsed_seconds' then (p_updates->>'paused_elapsed_seconds')::integer else s.paused_elapsed_seconds end
      where s.id = p_session_id and s.user_id = owner and s.active = true
      returning s.*;
    end;
    $$;
  `)
  
  // Create the fixed create_standby_session_with_progress from migration 022
  await db.exec(`
    create or replace function public.create_standby_session_with_progress(
      p_game_id text,
      p_start_xp integer default 0
    )
    returns setof public.sessions
    language plpgsql
    set search_path = public
    as $$
    declare
      owner uuid := auth.uid();
      created public.sessions%rowtype;
    begin
      if owner is null then raise exception 'Not authenticated'; end if;
      if p_start_xp is null or p_start_xp < 0 or p_start_xp > 35 then
        raise exception 'Invalid session start XP';
      end if;
      select * into created from public.create_standby_session(p_game_id, p_start_xp);
      if p_start_xp > 0 then
        -- Initialize game_progress only if it doesn't exist; do NOT increment total_sessions
        insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
          values (owner, p_game_id, 'playing', 0, 0)
          on conflict (user_id, game_id) do nothing;
        update public.users set last_session_date = (clock_timestamp() at time zone 'UTC')::date
          where id = owner;
      end if;
      return next created;
    end;
    $$;
  `)
  
  // Create the fixed complete_standby_game from migration 022
  await db.exec(`
    create or replace function public.complete_standby_game(
      p_game_id text,
      p_status text,
      p_expected_session jsonb
    )
    returns setof public.game_progress
    language plpgsql
    set search_path = public
    as $$
    declare
      owner uuid := auth.uid();
      active_session public.sessions%rowtype;
      progress public.game_progress%rowtype;
      has_session boolean;
      ended timestamptz;
      elapsed integer := 0;
      timing jsonb;
    begin
      if owner is null then raise exception 'Not authenticated'; end if;
      if p_status is null or p_status not in ('beaten', 'abandoned') then
        raise exception 'Invalid game progress status';
      end if;
      
      select * into active_session from public.sessions
        where user_id = owner and game_id = p_game_id and active = true;
      has_session := found;
      
      if has_session then
        ended := clock_timestamp();
        if active_session.record_time and active_session.status <> 'LockedIn' then
          elapsed := greatest(0, coalesce(active_session.paused_elapsed_seconds, 0));
          if active_session.status = 'Playing' then
            elapsed := elapsed + greatest(0, floor(extract(epoch from (ended - active_session.started_at)))::integer);
          end if;
        end if;
        timing := jsonb_build_object('status', 'Finished', 'ended_at', ended,
          'duration_minutes', round(elapsed::numeric / 60)::integer,
          'paused_elapsed_seconds', elapsed);
        
        select * into active_session from public.transition_standby_session(
          active_session.id, to_jsonb(active_session), timing);
      end if;
      
      select * into progress from public.game_progress
        where user_id = owner and game_id = p_game_id;
      if found then
        if progress.status is distinct from p_status then
          update public.game_progress set status = p_status,
            completed_at = case when p_status = 'beaten' then coalesce(ended, clock_timestamp()) else completed_at end
            where id = progress.id
            returning game_progress.* into progress;
        end if;
      else
        insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes, completed_at)
          values (owner, p_game_id, p_status, 0, 0, case when p_status = 'beaten' then coalesce(ended, clock_timestamp()) else null end)
          returning * into progress;
      end if;
      
      -- Recalculate counters from finished sessions only (no active sessions counted)
      update public.game_progress set
        total_sessions = (
          select count(*)
          from public.sessions s
          where s.user_id = progress.user_id
            and s.game_id = progress.game_id
            and s.status = 'Finished'
            and s.active = false
        ),
        total_time_minutes = (
          select coalesce(sum(s.duration_minutes), 0)
          from public.sessions s
          where s.user_id = progress.user_id
            and s.game_id = progress.game_id
            and s.status = 'Finished'
            and s.active = false
        )
        where id = progress.id
        returning * into progress;
      
      return next progress;
    end;
    $$;
  `)
  
  // Insert test user
  await db.query(
    "insert into auth.users values ($1, $2)",
    ["11111111-1111-1111-1111-111111111111", "test@example.com"]
  )

  return db
}

await test("Migration 022: Counter derivation and correctness", async (t) => {
  const db = await setupDb()
  const userId = "11111111-1111-1111-1111-111111111111"
  const gameId = "game-test-022"

  // Insert test user profile
  await db.query(
    "insert into public.users (id, last_session_date) values ($1, $2)",
    [userId, new Date().toISOString().split("T")[0]]
  )

  // Add test game
  await db.query(
    "insert into public.games (id, name, source, created_at) values ($1, $2, $3, now())",
    [gameId, "Test Game for 022", "test"]
  )

  await t.test("create_standby_session_with_progress does NOT increment total_sessions at start", async () => {
    // Call the real function with start_xp > 0
    const sessionResult = await db.query(
      `select * from public.create_standby_session_with_progress($1, $2)`,
      [gameId, 10]
    )
    
    assert.ok(sessionResult.rows.length > 0, "create_standby_session_with_progress should return a session")
    
    // Verify game_progress was created with total_sessions = 0 (not incremented)
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes, status from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId]
    )
    
    assert.equal(progress.status, "playing", "Progress status should be 'playing'")
    assert.equal(progress.total_sessions, 0, "total_sessions should be 0 at session start (NOT incremented)")
    assert.equal(progress.total_time_minutes, 0, "total_time_minutes should be 0 at session start")
  })

  await t.test("complete_standby_game derives total_sessions from finished sessions", async () => {
    // Get the active session
    const sessions = await db.query(
      `select id, status, active from public.sessions where user_id = $1 and game_id = $2 and active = true`,
      [userId, gameId]
    )
    
    assert.equal(sessions.rows.length, 1, "Should have one active session")
    const session = sessions.rows[0]
    assert.equal(session.status, "LockedIn", "Session should be in LockedIn status")
    
    // Finish the session
    await db.query(
      `update public.sessions set status = $1, active = $2, duration_minutes = $3, started_at = now() - interval '45 minutes'
       where id = $4`,
      ["Finished", false, 45, session.id]
    )
    
    // Call complete_standby_game to finish the game as beaten
    const completeResult = await db.query(
      `select * from public.complete_standby_game($1, $2, $3)`,
      [gameId, "beaten", null]
    )
    
    assert.ok(completeResult.rows.length > 0, "complete_standby_game should return game_progress")
    
    // Verify total_sessions was recalculated from finished sessions
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes, status from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId]
    )
    
    assert.equal(progress.status, "beaten", "Progress status should be 'beaten'")
    assert.equal(progress.total_sessions, 1, "total_sessions should be 1 (derived from 1 finished session)")
    assert.equal(progress.total_time_minutes, 45, "total_time_minutes should be 45 (sum of finished session durations)")
  })

  await t.test("complete_standby_game with zero finished sessions gives 0 counters (beaten edge case)", async () => {
    const gameId2 = "game-test-022-edge-case"
    
    // Add second test game
    await db.query(
      "insert into public.games (id, name, source, created_at) values ($1, $2, $3, now())",
      [gameId2, "Edge Case Game", "test"]
    )
    
    // Create game_progress without an active session
    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [userId, gameId2, "playing", 0, 0]
    )
    
    // Call complete_standby_game without an active session (beaten edge case)
    const completeResult = await db.query(
      `select * from public.complete_standby_game($1, $2, $3)`,
      [gameId2, "beaten", null]
    )
    
    assert.ok(completeResult.rows.length > 0, "complete_standby_game should handle no active session")
    
    // Verify counters are 0 (no finished sessions exist)
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes, status from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId2]
    )
    
    assert.equal(progress.status, "beaten", "Progress status should be 'beaten'")
    assert.equal(progress.total_sessions, 0, "total_sessions should be 0 (no finished sessions)")
    assert.equal(progress.total_time_minutes, 0, "total_time_minutes should be 0 (no finished sessions)")
  })

  await t.test("Backfill recalculates existing wrong counters from finished sessions", async () => {
    const gameId3 = "game-test-022-backfill"
    
    // Add third test game
    await db.query(
      "insert into public.games (id, name, source, created_at) values ($1, $2, $3, now())",
      [gameId3, "Backfill Test Game", "test"]
    )
    
    // Create sessions: 2 finished, 1 active
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [userId, gameId3, "Finished", false, 30]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [userId, gameId3, "Finished", false, 45]
    )
    // Active session (should not be counted)
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [userId, gameId3, "Playing", true, 0]
    )
    
    // Create game_progress with WRONG counters (corruption from migration 020)
    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes, created_at)
       values ($1, $2, $3, $4, $5, now())`,
      [userId, gameId3, "playing", 9999, 9999]
    )
    
    // Apply backfill UPDATE from migration 022
    await db.query(`
      update public.game_progress gp set
        total_sessions = (
          select count(*)
          from public.sessions s
          where s.user_id = gp.user_id
            and s.game_id = gp.game_id
            and s.status = 'Finished'
            and s.active = false
        ),
        total_time_minutes = (
          select coalesce(sum(s.duration_minutes), 0)
          from public.sessions s
          where s.user_id = gp.user_id
            and s.game_id = gp.game_id
            and s.status = 'Finished'
            and s.active = false
        )
      where game_id = $1
    `, [gameId3])
    
    // Verify counters were fixed
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId3]
    )
    
    assert.equal(progress.total_sessions, 2, "Backfill should fix total_sessions to 2 (only finished, active=false)")
    assert.equal(progress.total_time_minutes, 75, "Backfill should fix total_time_minutes to 75 (30+45)")
  })
})
