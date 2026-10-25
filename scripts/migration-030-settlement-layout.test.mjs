// Tests scripts/030_settlement_layout.sql by loading the real migration files 018 to 030 into PGlite.
// The tests run as real roles (set role + auth.uid()). 
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-030-settlement-layout.test.mjs

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
  "029_settlement_pieces.sql",
]
const layoutSql = sqlFile("030_settlement_layout.sql")

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
// Migrations 018 to 030 are the real files.
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
  await db.exec(layoutSql)
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
const A_GAMES = ["g1", "g2", "g3", "x1", "x2", "x3", "x4"]
// Seven homes: deck 0 holds six, deck 1 holds one.
const full = (override = {}) =>
  A_GAMES.map((game_id, i) => ({
    game_id, deck: i < 6 ? 0 : 1, cell: i < 6 ? i : 0, rotation: 0, ...override[game_id],
  }))
const save = (db, uid, cells) =>
  asUser(db, uid, async () => (await rows(db, "select public.save_layout($1::jsonb) as n", [JSON.stringify(cells)]))[0].n)
const saved = (db) => rows(db, "select user_id, game_id, deck, cell, rotation from public.settlement_layout order by user_id, game_id")

test("a full layout saves and replaces the one before it", async () => {
  const db = await setup({ seed: SEED })
  assert.equal(await save(db, A, full()), 7)
  assert.equal((await saved(db)).length, 7)
  assert.equal(await save(db, A, full({ g1: { cell: 30, rotation: 3 }, g2: { cell: 29 } })), 7)
  const g1 = (await saved(db)).find((r) => r.game_id === "g1")
  assert.equal(g1.cell, 30)
  assert.equal(g1.rotation, 3)
})

test("homes can leave their deck", async () => {
  const db = await setup({ seed: SEED })
  await save(db, A, full({ x4: { deck: 0, cell: 20 } }))
  assert.equal((await saved(db)).find((r) => r.game_id === "x4").deck, 0)
})

test("a taken cell, a bad range and a missing or repeated home are refused", async () => {
  const db = await setup({ seed: SEED })
  await assert.rejects(save(db, A, full({ g2: { cell: 0 } })), /Cell taken/)
  await assert.rejects(save(db, A, full({ g1: { cell: 36 } })), /No such cell/)
  await assert.rejects(save(db, A, full({ g1: { rotation: 4 } })), /No such cell/)
  await assert.rejects(save(db, A, full({ g1: { cell: -1 } })), /Bad layout/)
  await assert.rejects(save(db, A, full({ g1: { cell: 1.5 } })), /Bad layout/)
  await assert.rejects(save(db, A, full().slice(1)), /Every home once/)
  await assert.rejects(save(db, A, [...full().slice(1), full()[1]]), /Every home once/)
  await assert.rejects(save(db, A, "nope"), /Bad layout/)
  assert.equal((await saved(db)).length, 0)
})

test("another user's game is refused", async () => {
  const db = await setup({ seed: SEED })
  const cells = full()
  cells[6].game_id = "missing"
  await assert.rejects(save(db, A, cells), /Resident not found/)
})

test("decks cannot have gaps or outnumber the automatic count", async () => {
  const db = await setup({ seed: SEED })
  await assert.rejects(save(db, A, full({ x4: { deck: 2 } })), /Empty deck/)
  await assert.rejects(save(db, A, full({ x4: { deck: 1 }, x3: { deck: 2, cell: 0 } })), /Empty deck|No such deck/)
  // Seven homes allow two decks at most. All on deck 0 is fine.
  assert.equal(await save(db, A, full({ x4: { deck: 0, cell: 10 } })), 7)
})

test("a piece on a deck that no longer exists is taken off, and stays earned", async () => {
  const db = await setup({ seed: SEED })
  await asUser(db, A, () => db.query("select * from public.place_piece('g1', 1, 0)"))
  await asUser(db, A, () => db.query("select * from public.place_piece('x1', 0, 0)"))
  await save(db, A, full({ x4: { deck: 0, cell: 10 } }))
  const left = await rows(db, "select game_id from public.settlement_pieces where user_id = $1", [A])
  assert.deepEqual(left.map((r) => r.game_id), ["x1"])
  assert.equal((await asUser(db, A, () => rows(db, "select * from public.place_piece('g1', 0, 1)"))).length, 1)
})

test("an empty list clears the layout", async () => {
  const db = await setup({ seed: SEED })
  await save(db, A, full())
  assert.equal(await save(db, A, []), 0)
  assert.equal((await saved(db)).length, 0)
})

test("users cannot write the table, read another user's rows, or save signed out", async () => {
  const db = await setup({ seed: SEED })
  await save(db, A, full())
  await save(db, B, [{ game_id: "g1", deck: 0, cell: 5, rotation: 1 }])
  assert.deepEqual((await asUser(db, B, () => rows(db, "select user_id from public.settlement_layout"))).map((r) => r.user_id), [B])
  for (const sql of [
    `insert into public.settlement_layout (user_id, game_id, deck, cell) values ('${A}', 'g2', 0, 9)`,
    `update public.settlement_layout set cell = 9 where user_id = '${A}'`,
    `delete from public.settlement_layout where user_id = '${A}'`,
  ]) assert.ok(await denied(db, A, sql), sql)
  assert.equal((await saved(db)).filter((r) => r.user_id === A).length, 7)
  await db.exec("select set_config('test.uid', '', false)")
  await assert.rejects(db.exec("select public.save_layout('[]'::jsonb)"), /Not authenticated/)
})

test("beating no new game and saving a layout change nothing else", async () => {
  const db = await setup({ seed: SEED })
  const snapshot = async () => ({
    residents: await rows(db, "select * from public.residents order by user_id, game_id"),
    users: await rows(db, "select id, total_xp, level from public.users order by id"),
    progress: await rows(db, "select user_id, game_id, total_sessions, total_time_minutes from public.game_progress order by user_id, game_id"),
  })
  const before = await snapshot()
  await save(db, A, full({ g1: { cell: 12, rotation: 2 } }))
  assert.deepEqual(await snapshot(), before)
})
