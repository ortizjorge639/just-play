// Tests scripts/027_resident_emotes.sql by loading the real migration files 018 to 027 into PGlite.
// The tests run as real roles (set role + auth.uid()). Rule numbers match docs/emotes-proposal.md.
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-027-resident-emotes.test.mjs

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
]
const emoteSql = sqlFile("027_resident_emotes.sql")

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
// Migrations 018 to 027 are the real files.
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
  await db.exec(emoteSql)
  return db
}

const emote = (db, uid, game, kind) =>
  asUser(db, uid, async () => (await rows(db, "select * from public.record_emote($1, $2)", [game, kind]))[0])
const all = (db) => rows(db, "select * from public.resident_emotes order by user_id, game_id")
const resident = (db, uid, game) =>
  db.exec(`insert into public.residents (user_id, game_id, arrival_source) values ('${uid}', '${game}', 'beaten') on conflict do nothing`)

test("rule 1: an emote for an arrived resident stores one row, and a second overwrites it", async () => {
  const db = await setup()
  await resident(db, A, "g2")
  const first = await emote(db, A, "g2", "wave")
  assert.equal(first.emote, "wave")
  const second = await emote(db, A, "g2", "rest")
  assert.equal(second.emote, "rest")
  const stored = await all(db)
  assert.equal(stored.length, 1)
  assert.equal(stored[0].emote, "rest")
  assert.ok(stored[0].emoted_at >= first.emoted_at)
  for (const kind of ["celebrate", "check_in"]) assert.equal((await emote(db, A, "g2", kind)).emote, kind)
})

test("rule 2: a game with no resident is refused and nothing is written", async () => {
  const db = await setup()
  await assert.rejects(emote(db, A, "g3", "wave"), /Resident not found/)
  await assert.rejects(emote(db, A, "missing", "wave"), /Resident not found/)
  await assert.rejects(emote(db, A, null, "wave"), /Resident not found/)
  await resident(db, B, "g2")
  await assert.rejects(emote(db, A, "g2", "wave"), /Resident not found/, "another user's resident does not count")
  assert.deepEqual(await all(db), [])
})

test("rule 3: an emote outside the four is refused", async () => {
  const db = await setup()
  await resident(db, A, "g2")
  for (const bad of ["dance", "", "WAVE", null]) await assert.rejects(emote(db, A, "g2", bad), /Unknown emote/)
  assert.deepEqual(await all(db), [])
  assert.ok(await denied(db, A, `insert into public.resident_emotes (user_id, game_id, emote) values ('${A}', 'g2', 'dance')`))
})

test("rule 4: users cannot read or write each other's emotes, or write the table directly", async () => {
  const db = await setup()
  await resident(db, A, "g2")
  await resident(db, B, "g2")
  await emote(db, A, "g2", "wave")
  await emote(db, B, "g2", "rest")
  assert.deepEqual(await asUser(db, A, () => rows(db, "select user_id, emote from public.resident_emotes")), [{ user_id: A, emote: "wave" }])
  assert.deepEqual(await asUser(db, B, () => rows(db, "select user_id, emote from public.resident_emotes")), [{ user_id: B, emote: "rest" }])
  for (const sql of [
    `insert into public.resident_emotes (user_id, game_id, emote) values ('${A}', 'g2', 'wave')`,
    `update public.resident_emotes set emote = 'rest'`,
    `delete from public.resident_emotes`,
    `truncate public.resident_emotes`,
  ]) assert.ok(await denied(db, A, sql), `expected denial: ${sql}`)
  await db.exec("set role anon")
  await assert.rejects(db.query("select public.record_emote('g2', 'wave')"), /permission denied/)
  await db.exec("reset role")
  await assert.rejects(asUser(db, "", () => db.query("select public.record_emote('g2', 'wave')")), /Not authenticated/)
  assert.equal((await all(db)).length, 2)
})

test("rule 5: emoting adds no XP and leaves counters, residents, postcards, sessions and stamps alone", async () => {
  const db = await setup()
  await db.exec(`update public.users set total_xp = 40, level = 2 where id = '${A}'`)
  await db.exec(`insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
                 values ('${A}', 'g1', 'beaten', 3, 200)`)
  const snap = async () => ({
    users: await rows(db, "select id, total_xp, level, last_session_date from public.users order by id"),
    gp: await rows(db, "select * from public.game_progress order by game_id"),
    sessions: await rows(db, "select * from public.sessions"),
    residents: await rows(db, "select * from public.residents order by game_id"),
    postcards: await rows(db, "select * from public.postcards order by game_id"),
    proofs: await rows(db, "select * from public.stamp_proofs"),
    rules: await rows(db, "select * from public.stamp_rules"),
    cards: await rows(db, "select * from public.name_cards"),
  })
  await resident(db, A, "g2")
  const before = await snap()
  assert.ok(before.residents.length >= 1)
  await emote(db, A, "g2", "wave")
  await emote(db, A, "g2", "celebrate")
  assert.deepEqual(await snap(), before)
})

test("rule 6: deleting the resident, the game or the user removes the emote row", async () => {
  const db = await setup()
  await db.exec("insert into public.games values ('g4', 'Four')")
  await resident(db, A, "g2")
  await resident(db, A, "g3")
  await resident(db, B, "g4")
  for (const [u, g] of [[A, "g2"], [A, "g3"], [B, "g4"]]) await emote(db, u, g, "wave")
  assert.equal((await all(db)).length, 3)
  await db.exec(`delete from public.residents where user_id = '${A}' and game_id = 'g2'`)
  assert.deepEqual((await all(db)).map(r => r.game_id).sort(), ["g3", "g4"])
  await db.exec("delete from public.games where id = 'g3'")
  assert.deepEqual((await all(db)).map(r => r.game_id), ["g4"])
  await db.exec(`delete from public.users where id = '${B}'`)
  assert.deepEqual(await all(db), [])
})

test("rule 8: applying the real migration file a second time changes nothing", async () => {
  const db = await setup()
  await resident(db, A, "g2")
  await emote(db, A, "g2", "rest")
  const snapshot = async () => ({
    emotes: await all(db),
    policies: await rows(db, "select tablename, policyname, cmd from pg_policies where tablename = 'resident_emotes' order by 1, 2"),
    constraints: await rows(db, "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.resident_emotes'::regclass order by 1"),
    functions: await rows(db, "select proname, proacl::text as acl, prosecdef, proconfig::text as cfg from pg_proc where proname = 'record_emote'"),
    grants: await rows(db, "select grantee, privilege_type from information_schema.table_privileges where table_name = 'resident_emotes' order by 1, 2"),
  })
  const before = await snapshot()
  await db.exec(emoteSql)
  assert.deepEqual(await snapshot(), before)
  assert.equal(before.policies.length, 1)
  assert.equal(before.functions[0].prosecdef, true)
  assert.match(before.functions[0].cfg, /search_path=public, pg_temp/)
  assert.doesNotMatch(before.functions[0].acl, /(^|[{,])=X/)
  assert.match(before.functions[0].acl, /authenticated=X/)
})
