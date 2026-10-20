// Test migration 022: verify game_progress counters are derived from finished sessions
// and never incremented at session start or miscounted on completion.
// From the repository root:
// npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-022-counters.test.mjs

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
    throw new Error("Run the npx --package=@electric-sql/pglite@0.5.10 command documented at the top of this test.")
  }
}

const { PGlite } = loadPackage(resolvePGlite())
const migration = (name) => readFileSync(new URL(name, import.meta.url), "utf8")

async function one(db, sql, args = []) {
  const result = await db.query(sql, args)
  return result.rows[0]
}

async function setupDb() {
  const db = new PGlite()
  // Load all migrations up to 022
  for (let i = 1; i <= 22; i++) {
    const num = String(i).padStart(3, "0")
    try {
      const sql = migration(`${num}_*.sql`)
      await db.exec(sql)
    } catch (e) {
      // Skip if not found
    }
  }

  // Set up auth context
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as 'select null'::uuid;
    
    -- Test user
    insert into auth.users values('11111111-1111-1111-1111-111111111111', 'test@example.com');
    
    -- Override auth.uid() to return test user
    create or replace function auth.uid() returns uuid language sql stable as
      $$ select '11111111-1111-1111-1111-111111111111'::uuid $$;
  `)

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

  await t.test("create_standby_session_with_progress does not increment total_sessions", async () => {
    const gameId2 = "game-2"
    await db.query(
      "insert into public.games (id, name, source) values ($1, $2, $3)",
      [gameId2, "Test Game 2", "test"]
    )

    // Create a session with start_xp > 0 (which triggers game_progress initialization)
    await db.exec("set transaction isolation level read committed")
    await db.query(
      `select public.create_standby_session_with_progress($1, $2)`,
      [gameId2, 10]
    )

    // Verify game_progress exists with total_sessions = 0 (not 1)
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId2]
    )
    assert.equal(progress.total_sessions, 0, "total_sessions should remain 0 after session start")
    assert.equal(progress.total_time_minutes, 0, "total_time_minutes should remain 0 after session start")
  })

  await t.test("complete_standby_game recalculates counters from finished sessions", async () => {
    const gameId3 = "game-3"
    await db.query(
      "insert into public.games (id, name, source) values ($1, $2, $3)",
      [gameId3, "Test Game 3", "test"]
    )

    // Create a session
    await db.exec("set transaction isolation level read committed")
    const sessionResult = await db.query(
      `select public.create_standby_session_with_progress($1, $2)`,
      [gameId3, 10]
    )
    const sessionId = sessionResult.rows[0].id

    // Finish the session
    await db.query(
      `update public.sessions set status = $1, active = $2, duration_minutes = $3
       where id = $4`,
      ["Finished", false, 60, sessionId]
    )

    // Call complete_standby_game
    await db.query(
      `select public.complete_standby_game($1, $2, $3)`,
      [gameId3, "beaten", null]
    )

    // Verify counters are correctly recalculated (1 finished session)
    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId3]
    )
    assert.equal(progress.total_sessions, 1, "total_sessions should be 1 after completion")
    assert.equal(progress.total_time_minutes, 60, "total_time_minutes should be 60")
  })

  await t.test("Multiple finished sessions accumulate correctly", async () => {
    const gameId4 = "game-4"
    await db.query(
      "insert into public.games (id, name, source) values ($1, $2, $3)",
      [gameId4, "Test Game 4", "test"]
    )

    // Manually create 3 finished sessions with different durations
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId4, "Finished", false, 30]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId4, "Finished", false, 45]
    )
    await db.query(
      `insert into public.sessions (user_id, game_id, status, active, duration_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId4, "Finished", false, 25]
    )

    // Create game_progress and complete game
    await db.exec("set transaction isolation level read committed")
    await db.query(
      `insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
       values ($1, $2, $3, $4, $5)`,
      [userId, gameId4, "playing", 0, 0]
    )

    await db.query(
      `select public.complete_standby_game($1, $2, $3)`,
      [gameId4, "beaten", null]
    )

    const progress = await one(
      db,
      `select total_sessions, total_time_minutes from public.game_progress
       where user_id = $1 and game_id = $2`,
      [userId, gameId4]
    )
    assert.equal(progress.total_sessions, 3, "total_sessions should be 3")
    assert.equal(progress.total_time_minutes, 100, "total_time_minutes should be 100 (30+45+25)")
  })
})
