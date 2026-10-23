// Tests scripts/029_settlement_pieces.sql by loading the real migration files 018 to 029 into PGlite.
// The tests run as real roles (set role + auth.uid()). 
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-029-settlement-pieces.test.mjs

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const loadPackage = createRequire(import.meta.url)
function resolvePGlite() {
  try {
    return loadPackage.resolve("@electric-sql/pglite")
  } catch {
    for (const bin of (process.env.PATH ?? "").split(path.delimiter)) {
      const candidate = path.resolve(bin, "..", "@electric-sql", "pglite")
      if (existsSync(path.join(candidate, "package.json"))) return candidate
    }
    throw new Error("Run the npx command documented at the top of this test.")
  }
}
const { PGlite } = loadPackage(resolvePGlite())

const here = path.dirname(fileURLToPath(import.meta.url))
const sqlFile = (name) => readFileSync(path.join(here, name), "utf8")
const migrationFiles = [
  "018_standby.sql",
  "019_restrict_standby_rpc_execute.sql",
  "020_atomic_standby_game_completion.sql",
  "021_close_games_insert_policy.sql",
  "022_fix_game_progress_counters.sql",
  "023_residents_and_postcards.sql",
  "024_stamps.sql",
  "025_name_cards.sql",
  "026_lock_display_name.sql",
  "027_resident_emotes.sql",
  "028_lock_xp_and_level.sql",
]
const piecesSql = sqlFile("029_settlement_pieces.sql")

const A = "11111111-1111-1111-1111-111111111111"
const B = "22222222-2222-2222-2222-222222222222"

async function rows(db, sql, args = []) {
  return (await db.query(sql, args)).rows
}

// Runs fn as a signed-in client user, then restores the owner role.
async function asUser(db, uid, fn) {
  await db.exec(`select set_config('test.uid', '${uid}', false); set role authenticated;`)
  try {
    return await fn()
  } finally {
    await db.exec("reset role")
  }
}

async function denied(db, uid, sql) {
  try {
    await asUser(db, uid, () => db.query(sql))
  } catch (err) {
    return err
  }
  return null
}

// Earlier migrations 001 to 017 are not replayed, so these tables mirror the columns they leave behind.
// Migrations 018 to 029 are the real files.
async function setup({ seed } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table public.users (
      id uuid primary key,
      display_name text,
      total_xp integer default 0,
      level integer default 1,
      last_session_date date
    );
    create table public.games (id text primary key, name text);
    create table public.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      game_id text not null references public.games(id),
      started_at timestamptz default now(),
      ended_at timestamptz,
      duration_minutes integer default 0,
      status text not null default 'LockedIn' check (status in ('LockedIn','Started','Playing','Paused','Finished')),
      active boolean default true,
      notes text,
      session_goal text,
      xp_awarded integer default 0,
      created_at timestamptz default now()
    );
    create unique index idx_one_active_session on public.sessions (user_id) where (active = true);
    create table public.game_progress (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      game_id text not null references public.games(id) on delete cascade,
      status text not null default 'playing' check (status in ('playing','beaten','abandoned')),
      total_sessions integer default 0,
      total_time_minutes integer default 0,
      started_at timestamptz default now(),
      completed_at timestamptz,
      created_at timestamptz default now(),
      unique (user_id, game_id)
    );
    alter table public.users enable row level security;
    alter table public.sessions enable row level security;
    alter table public.game_progress enable row level security;
    create policy users_own on public.users for all using (id = auth.uid()) with check (id = auth.uid());
    create policy sessions_own on public.sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    create policy progress_own on public.game_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    grant select, insert, update, delete on public.users, public.sessions, public.game_progress to authenticated;
    insert into public.users (id, display_name) values ('${A}', 'Ann'), ('${B}', 'Bob');
    insert into public.games values ('g1','One'), ('g2','Two'), ('g3','Three');
  `)
  for (const file of migrationFiles) await db.exec(sqlFile(file))
  if (seed) await db.exec(seed)
  await db.exec(piecesSql)
  return db
}


// Seven residents (two decks) for A. g1 has 3000 minutes, g2 has 2999, g3 has none. B has one resident g1 at 3000.
const SEED = `
  insert into public.games select 'x' || n, 'X' || n from generate_series(1, 4) n;
  insert into public.residents (user_id, game_id, arrived_at, arrival_source) values
    ('${A}', 'g1', now() - interval '9 days', 'beaten'),
    ('${A}', 'g2', now() - interval '8 days', 'beaten'),
    ('${A}', 'g3', now() - interval '7 days', 'beaten'),
    ('${A}', 'x1', now() - interval '6 days', 'beaten'),
    ('${A}', 'x2', now() - interval '5 days', 'beaten'),
    ('${A}', 'x3', now() - interval '4 days', 'beaten'),
    ('${A}', 'x4', now() - interval '3 days', 'beaten'),
    ('${B}', 'g1', now() - interval '3 days', 'beaten');
  insert into public.game_progress (user_id, game_id, total_time_minutes) values
    ('${A}', 'g1', 3000), ('${A}', 'g2', 2999), ('${A}', 'x1', 3000), ('${A}', 'x2', 5000),
    ('${B}', 'g1', 3000);
`
const place = (db, uid, game, deck, anchor) =>
  asUser(db, uid, async () => (await rows(db, "select * from public.place_piece($1, $2, $3)", [game, deck, anchor]))[0])
const remove = (db, uid, game) => asUser(db, uid, () => db.query("select public.remove_piece($1)", [game]))
const pieces = (db) => rows(db, "select user_id, game_id, deck, anchor from public.settlement_pieces order by user_id, game_id")

test("rule 1: 3000 minutes is accepted and 2999 is refused", async () => {
  const db = await setup({ seed: SEED })
  const ok = await place(db, A, "g1", 0, 0)
  assert.equal(ok.piece, "loft")
  await assert.rejects(place(db, A, "g2", 0, 1), /Not earned yet/)
  await assert.rejects(place(db, A, "g3", 0, 1), /Not earned yet/)
  assert.equal((await pieces(db)).length, 1)
})

test("rule 2: a game that is not a resident cannot place", async () => {
  const db = await setup({ seed: SEED })
  await assert.rejects(place(db, A, "missing", 0, 0), /Resident not found/)
  await assert.rejects(place(db, B, "g2", 0, 0), /Resident not found/)
  await assert.rejects(place(db, A, null, 0, 0), /Missing place/)
})

test("rule 3: a deck that does not exist and a spot outside 0 to 2 are refused", async () => {
  const db = await setup({ seed: SEED })
  await assert.rejects(place(db, A, "g1", 2, 0), /No such deck/)
  await assert.rejects(place(db, A, "g1", -1, 0), /No such deck/)
  await assert.rejects(place(db, A, "g1", 0, 3), /No such spot/)
  await assert.rejects(place(db, A, "g1", 0, -1), /No such spot/)
  assert.equal((await place(db, A, "g1", 1, 2)).deck, 1)
  assert.equal((await place(db, B, "g1", 0, 0)).deck, 0)
  await assert.rejects(place(db, B, "g1", 1, 0), /No such deck/)
})

test("rule 4: one piece per game and one per spot, including under concurrent calls", async () => {
  const db = await setup({ seed: SEED })
  await place(db, A, "g1", 0, 0)
  await assert.rejects(place(db, A, "x1", 0, 0), /Spot taken/)
  assert.equal((await place(db, A, "x1", 0, 1)).anchor, 1)
  const moved = await place(db, A, "g1", 0, 2)
  assert.equal(moved.anchor, 2)
  assert.equal((await pieces(db)).filter((p) => p.user_id === A).length, 2)
  // Placing again on its own spot is a no-op, not a clash.
  assert.equal((await place(db, A, "g1", 0, 2)).anchor, 2)
  await db.exec("delete from public.settlement_pieces")
  const results = await Promise.allSettled([place(db, A, "g1", 1, 0), place(db, A, "x1", 1, 0)])
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
  assert.equal((await pieces(db)).length, 1)
})

test("rule 5: a user cannot touch another user's pieces or write the table", async () => {
  const db = await setup({ seed: SEED })
  await place(db, A, "g1", 0, 0)
  await place(db, B, "g1", 0, 0)
  assert.deepEqual((await asUser(db, A, () => rows(db, "select user_id from public.settlement_pieces"))).map((r) => r.user_id), [A])
  await remove(db, B, "g1")
  assert.equal((await pieces(db)).filter((p) => p.user_id === A).length, 1)
  for (const sql of [
    `insert into public.settlement_pieces (user_id, game_id, piece, deck, anchor) values ('${A}', 'x1', 'loft', 0, 1)`,
    `update public.settlement_pieces set anchor = 1 where user_id = '${A}'`,
    `delete from public.settlement_pieces where user_id = '${A}'`,
  ]) assert.ok(await denied(db, A, sql), sql)
  await db.exec("select set_config('test.uid', '', false)")
  await assert.rejects(db.exec("select public.place_piece('g1', 0, 0)"), /Not authenticated/)
})

test("rule 6 and 7: moving and removing change no resident, no XP and no counters", async () => {
  const db = await setup({ seed: SEED })
  const snapshot = async () => ({
    residents: await rows(db, "select * from public.residents order by user_id, game_id"),
    users: await rows(db, "select id, total_xp, level from public.users order by id"),
    progress: await rows(db, "select user_id, game_id, total_sessions, total_time_minutes from public.game_progress order by user_id, game_id"),
  })
  const before = await snapshot()
  await place(db, A, "g1", 0, 0)
  await place(db, A, "g1", 1, 1)
  await remove(db, A, "g1")
  await remove(db, A, "g1")
  assert.deepEqual(await snapshot(), before)
  assert.equal((await pieces(db)).length, 0)
  assert.equal((await place(db, A, "g1", 0, 0)).deck, 0)
})

test("rule 8: applying the migration twice changes nothing", async () => {
  const db = await setup({ seed: SEED })
  await place(db, A, "g1", 1, 1)
  const before = await pieces(db)
  await db.exec(piecesSql)
  assert.deepEqual(await pieces(db), before)
})
