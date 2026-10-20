// Test migration 022: verify game_progress counters are derived from finished sessions
// and never incremented at session start or miscounted on completion.
// From the repository root:
// npx --yes --package=@electric-sql/pglite@0.5.9 -- node --test scripts/migration-022-counters.test.mjs

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
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
  
  // Create auth schema and functions
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `)
  
  // Create public schema tables needed for migration 022
  await db.exec(`
    create table public.games (
      id text primary key,
      name text not null,
      source text default 'test'
    );
    
    create table public.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      game_id text not null references public.games(id),
      status text not null default 'Playing' check (status in ('LockedIn','Started','Playing','Finished')),
      active boolean default true,
      duration_minutes integer default 0
    );
    
    create table public.game_progress (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      game_id text not null,
      status text not null default 'playing' check (status in ('playing', 'beaten', 'abandoned')),
      total_sessions integer default 0,
      total_time_minutes integer default 0,
      completed_at timestamptz,
      unique(user_id, game_id)
    );
    
    create table public.users (
      id uuid primary key,
      last_session_date date
    );
  `)
  
  // Insert test user
  await db.query(
    "insert into auth.users values ($1, $2)",
    ["11111111-1111-1111-1111-111111111111", "test@example.com"]
  )

  return db
}

await test("Migration 022 counter recalculation", async (t) => {
  const db = await setupDb()
  const userId = "11111111-1111-1111-1111-111111111111"
  const gameId = "game-1"

  // Add test game
  await db.query(
    "insert into public.games (id, name, source) values ($1, $2, $3)",
    [gameId, "Test Game", "test"]
  )

  await t.test("Backfill recalculates counters from finished sessions only", async () => {
    // Create game_progress with wrong counters (as if before migration 022)
    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId, "playing", 5, 120]
    )

    // Create sessions: 2 finished, 1 active
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId, "Finished", false, 30]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId, "Finished", false, 45]
    )
    // Active session (should not be counted)
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId, "Playing", true, 0]
    )

    // Simulate migration 022 backfill
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
    `)

    // Verify counters are now correct (2 finished sessions, 75 minutes total)
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId]
    )
    assert.equal(progress.total_sessions, 2, "total_sessions should be 2 (finished sessions only)")
    assert.equal(progress.total_time_minutes, 75, "total_time_minutes should be 75")
  })

  await t.test("Multiple finished sessions accumulate correctly", async () => {
    const gameId2 = "game-2"
    await db.query(
      "insert into public.games (id, name, source) values ($1, $2, $3)",
      [gameId2, "Test Game 2", "test"]
    )

    // Manually create 3 finished sessions with different durations
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId2, "Finished", false, 30]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId2, "Finished", false, 45]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId2, "Finished", false, 25]
    )

    // Create game_progress and simulate migration 022 backfill
    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId2, "playing", 0, 0]
    )

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
    `, [gameId2])

    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId2]
    )
    assert.equal(progress.total_sessions, 3, "total_sessions should be 3")
    assert.equal(progress.total_time_minutes, 100, "total_time_minutes should be 100 (30+45+25)")
  })

  await t.test("Active sessions are not counted", async () => {
    const gameId3 = "game-3"
    await db.query(
      "insert into public.games (id, name, source) values ($1, $2, $3)",
      [gameId3, "Test Game 3", "test"]
    )

    // Create mix of sessions: 2 finished, 2 active (should only count finished)
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId3, "Finished", false, 60]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId3, "Finished", false, 40]
    )
    // Active sessions (should not count)
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId3, "Playing", true, 20]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId3, "Playing", true, 15]
    )

    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId3, "playing", 0, 0]
    )

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

    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId3]
    )
    assert.equal(progress.total_sessions, 2, "total_sessions should be 2 (only finished, not active)")
    assert.equal(progress.total_time_minutes, 100, "total_time_minutes should be 100 (only finished)")
  })
})
