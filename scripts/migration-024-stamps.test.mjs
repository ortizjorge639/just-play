// Tests scripts/024_stamps.sql by loading the real migration files 018 to 024 into PGlite.
// The tests run as real roles (set role + auth.uid()). Rule numbers match docs/stamps-proposal.md.
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-024-stamps.test.mjs

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
]
const stampsSql = sqlFile("024_stamps.sql")

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
// Migrations 018 to 024 are the real files.
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
    insert into public.users (id) values ('${A}'), ('${B}');
    insert into public.games values ('g1','One'), ('g2','Two'), ('g3','Three');
  `)
  for (const file of migrationFiles) await db.exec(sqlFile(file))
  if (seed) await db.exec(seed)
  await db.exec(stampsSql)
  return db
}

// Progress rows are inputs the player's play would have produced; the stamp code paths run for real.
const progress = (db, uid, game, status, minutes = 0) =>
  db.query(
    `insert into public.game_progress (user_id, game_id, status, total_time_minutes)
     values ($1, $2, $3, $4)
     on conflict (user_id, game_id) do update set status = excluded.status,
       total_time_minutes = excluded.total_time_minutes`,
    [uid, game, status, minutes],
  )

const setRule = (db, uid, game, kind, minutes = null, label = null) =>
  asUser(db, uid, () => db.query("select public.set_stamp_rule($1, $2, $3, $4)", [game, kind, minutes, label]))
const confirm = (db, uid, game) =>
  asUser(db, uid, async () => (await rows(db, "select public.confirm_stamp($1) as arrived", [game]))[0].arrived)

const residents = (db, uid) =>
  rows(db, "select game_id, arrival_source from public.residents where user_id = $1 order by game_id", [uid])
const proofs = (db, uid) =>
  rows(db, "select * from public.stamp_proofs where user_id = $1 order by game_id", [uid])
const postcards = (db, uid) =>
  rows(db, "select game_id from public.postcards where user_id = $1 order by game_id", [uid])

test("rule 1: confirming twice leaves one resident and one proof", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 30)
  await setRule(db, A, null, "milestone", null, "Reached the second act")
  assert.equal(await confirm(db, A, "g1"), true, "first confirm reports an arrival")
  const first = await proofs(db, A)
  assert.equal(await confirm(db, A, "g1"), false, "second confirm reports no change")
  assert.equal(await confirm(db, A, "g1"), false)
  assert.deepEqual(await residents(db, A), [{ game_id: "g1", arrival_source: "stamp" }])
  assert.deepEqual(await proofs(db, A), first)
  assert.equal(first.length, 1)
})

test("rule 2: an hours stamp refuses just under the target and accepts at it", async () => {
  const db = await setup()
  await setRule(db, A, null, "hours", 600)
  await progress(db, A, "g1", "playing", 599)
  await assert.rejects(confirm(db, A, "g1"), /Not enough time played/)
  assert.deepEqual(await residents(db, A), [])
  assert.deepEqual(await proofs(db, A), [])
  await progress(db, A, "g1", "playing", 600)
  assert.equal(await confirm(db, A, "g1"), true)
  assert.deepEqual(await residents(db, A), [{ game_id: "g1", arrival_source: "stamp" }])
  assert.equal((await proofs(db, A))[0].minutes_at_confirm, 600)
  await progress(db, A, "g2", "playing", 0)
  await assert.rejects(confirm(db, A, "g2"), /Not enough time played/)
})

test("rule 3: a milestone is refused when the game is not invited", async () => {
  const db = await setup()
  await setRule(db, A, null, "milestone", null, "Second act")
  await assert.rejects(confirm(db, A, "g1"), /not invited/, "no progress row at all")
  await progress(db, A, "g2", "abandoned", 100)
  await assert.rejects(confirm(db, A, "g2"), /not invited/, "set aside")
  await progress(db, A, "g3", "beaten", 100)
  assert.deepEqual(await proofs(db, A), [])
  assert.deepEqual((await residents(db, A)).map((r) => r.arrival_source), ["beaten"], "g3 arrived by beating, not a stamp")
})

test("rule 4: users cannot touch each other's rules or proofs, or write tables directly", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 10)
  await progress(db, B, "g1", "playing", 10)
  await setRule(db, A, "g1", "milestone", null, "A's mark")
  await setRule(db, B, "g1", "hours", 600)
  assert.equal(await confirm(db, A, "g1"), true)

  const aRules = await asUser(db, A, () => rows(db, "select user_id, label from public.stamp_rules"))
  assert.deepEqual(aRules, [{ user_id: A, label: "A's mark" }])
  const bProofs = await asUser(db, B, () => rows(db, "select * from public.stamp_proofs"))
  assert.equal(bProofs.length, 0, "B cannot read A's proof")
  const bConfirm = await denied(db, B, "select public.confirm_stamp('g1')")
  assert.match(String(bConfirm?.message), /Not enough time played/, "B is judged by B's own rule")
  assert.deepEqual(await residents(db, B), [])

  for (const sql of [
    `insert into public.stamp_rules (user_id, kind, target_minutes) values ('${A}', 'hours', 1)`,
    `insert into public.stamp_proofs (user_id, game_id, rule_snapshot) values ('${B}', 'g1', '{}')`,
    `insert into public.residents (user_id, game_id, arrival_source) values ('${B}', 'g1', 'stamp')`,
    `update public.stamp_rules set target_minutes = 1`,
    `update public.stamp_proofs set minutes_at_confirm = 0`,
    `delete from public.stamp_rules`,
    `delete from public.stamp_proofs`,
  ]) {
    assert.ok(await denied(db, A, sql), `expected denial: ${sql}`)
  }
  assert.equal((await rows(db, "select * from public.stamp_rules")).length, 2)
  assert.equal((await proofs(db, A)).length, 1)
})

test("rule 5: changing or clearing a rule leaves residents and proofs alone", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 120)
  await setRule(db, A, null, "hours", 60)
  await confirm(db, A, "g1")
  const proof = await proofs(db, A)
  const resident = await rows(db, "select * from public.residents")
  await setRule(db, A, null, "hours", 6000)
  await setRule(db, A, null, "milestone", null, "Different now")
  await setRule(db, A, "g1", "hours", 9999)
  await setRule(db, A, null, null)
  await setRule(db, A, "g1", null)
  assert.deepEqual(await rows(db, "select * from public.stamp_rules"), [])
  assert.deepEqual(await proofs(db, A), proof)
  assert.deepEqual(await rows(db, "select * from public.residents"), resident)
  assert.equal(proof[0].rule_snapshot.target_minutes, 60, "the snapshot keeps what the rule said then")
})

test("rule 6: a stamp arrival removes the game's postcard", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 90)
  await progress(db, A, "g1", "abandoned", 90)
  await progress(db, A, "g2", "abandoned", 5)
  assert.deepEqual(await postcards(db, A), [{ game_id: "g1" }, { game_id: "g2" }])
  await progress(db, A, "g1", "playing", 90)
  assert.deepEqual(await postcards(db, A), [{ game_id: "g1" }, { game_id: "g2" }], "inviting again keeps the postcard")
  await setRule(db, A, null, "hours", 60)
  await confirm(db, A, "g1")
  assert.deepEqual(await postcards(db, A), [{ game_id: "g2" }], "only the arriving game's postcard goes")
  assert.deepEqual(await residents(db, A), [{ game_id: "g1", arrival_source: "stamp" }])
})

test("rule 7: confirming adds no XP and changes no counters", async () => {
  const db = await setup()
  await db.exec(`update public.users set total_xp = 40, level = 1 where id = '${A}'`)
  await db.exec(`insert into public.game_progress (user_id, game_id, total_sessions, total_time_minutes)
                 values ('${A}', 'g1', 3, 200)`)
  const before = {
    users: await rows(db, "select * from public.users order by id"),
    gp: await rows(db, "select * from public.game_progress order by game_id"),
    sessions: await rows(db, "select * from public.sessions"),
  }
  await setRule(db, A, null, "hours", 120)
  assert.equal(await confirm(db, A, "g1"), true)
  assert.deepEqual(await rows(db, "select * from public.users order by id"), before.users)
  assert.deepEqual(await rows(db, "select * from public.game_progress order by game_id"), before.gp)
  assert.deepEqual(await rows(db, "select * from public.sessions"), before.sessions)
})

// PGlite has one connection, so the race is checked in both orders. Both writers take the
// same per-account advisory lock, which is what makes the real race serial.
test("rule 8: confirm and Mark beaten on one game give one resident and no error", async () => {
  const db = await setup()
  await setRule(db, A, null, "milestone", null, "Second act")
  const complete = (game) =>
    asUser(db, A, () => db.query("select * from public.complete_standby_game($1, 'beaten', null)", [game]))

  await progress(db, A, "g1", "playing", 10)
  await confirm(db, A, "g1")
  await complete("g1")
  assert.equal((await residents(db, A)).filter((r) => r.game_id === "g1").length, 1)
  assert.equal((await residents(db, A))[0].arrival_source, "stamp", "the first arrival keeps its source")

  await progress(db, A, "g2", "playing", 10)
  await complete("g2")
  assert.equal(await confirm(db, A, "g2"), false, "confirming after beating is a quiet no-op")
  const g2 = (await residents(db, A)).filter((r) => r.game_id === "g2")
  assert.deepEqual(g2, [{ game_id: "g2", arrival_source: "beaten" }])
  assert.equal((await proofs(db, A)).filter((p) => p.game_id === "g2").length, 0)
})

test("rule 9: a game's own rule beats the default, and no rule means refusal", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 30)
  await progress(db, A, "g2", "playing", 30)
  await assert.rejects(confirm(db, A, "g1"), /No stamp rule/)
  assert.deepEqual(await residents(db, A), [])

  await setRule(db, A, null, "hours", 600)
  await setRule(db, A, "g1", "milestone", null, "Own mark")
  assert.equal(await confirm(db, A, "g1"), true, "override accepts at 30 minutes")
  assert.equal((await proofs(db, A))[0].rule_snapshot.scope, "game")
  await assert.rejects(confirm(db, A, "g2"), /Not enough time played/, "default still holds elsewhere")

  await setRule(db, A, "g2", "milestone", null, "Own mark")
  await setRule(db, A, "g2", null)
  await assert.rejects(confirm(db, A, "g2"), /Not enough time played/, "clearing an override falls back to the default")
  await setRule(db, A, null, null)
  await assert.rejects(confirm(db, A, "g2"), /No stamp rule/)
  assert.equal((await rows(db, "select * from public.stamp_rules")).length, 1, "one row per scope, rewritten in place")
})

test("rule 10: applying the real migration file a second time changes nothing", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 90)
  await setRule(db, A, null, "hours", 60)
  await setRule(db, A, "g2", "milestone", null, "Mark")
  await confirm(db, A, "g1")
  const snapshot = async () => ({
    rules: await rows(db, "select * from public.stamp_rules order by id"),
    proofs: await rows(db, "select * from public.stamp_proofs order by game_id"),
    residents: await rows(db, "select * from public.residents order by game_id"),
    policies: await rows(db, "select tablename, policyname, cmd from pg_policies where tablename like 'stamp_%' order by 1, 2"),
    indexes: await rows(db, "select indexname from pg_indexes where tablename like 'stamp_%' order by 1"),
    constraints: await rows(
      db,
      "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid in ('public.residents'::regclass, 'public.stamp_rules'::regclass, 'public.stamp_proofs'::regclass) order by 1",
    ),
    functions: await rows(
      db,
      "select proname, proacl::text as acl from pg_proc where proname in ('confirm_stamp', 'set_stamp_rule') order by 1",
    ),
  })
  const before = await snapshot()
  await db.exec(stampsSql)
  assert.deepEqual(await snapshot(), before)
  assert.ok(before.constraints.some((c) => /stamp/.test(c.def) && c.conname === "residents_arrival_source_check"))
  assert.equal(await confirm(db, A, "g1"), false)
})

test("only signed-in users can run the stamp functions", async () => {
  const db = await setup()
  await progress(db, A, "g1", "playing", 10)
  await db.exec("set role anon")
  await assert.rejects(db.query("select public.confirm_stamp('g1')"), /permission denied/)
  await assert.rejects(db.query("select public.set_stamp_rule(null, 'hours', 60, null)"), /permission denied/)
  await db.exec("reset role")
  await assert.rejects(asUser(db, "", () => db.query("select public.confirm_stamp('g1')")), /Not authenticated/)
  await assert.rejects(asUser(db, "", () => db.query("select public.set_stamp_rule(null, 'hours', 60, null)")), /Not authenticated/)
  const err = await denied(db, A, `select public.grant_resident_arrival('${A}', 'g1', 'stamp')`)
  assert.match(String(err?.message), /permission denied/, "the arrival function stays closed to clients")
})

test("rule checks: bad rules are refused and a stamp source is allowed on residents", async () => {
  const db = await setup()
  const bad = [
    ["hours", 0, null],
    ["hours", null, null],
    ["hours", 60, "has a label"],
    ["milestone", null, null],
    ["milestone", null, "   "],
    ["milestone", null, "x".repeat(61)],
    ["milestone", 60, "mixed"],
    ["streak", 60, null],
  ]
  for (const [kind, minutes, label] of bad) {
    await assert.rejects(setRule(db, A, null, kind, minutes, label), /./, `expected refusal for ${kind} ${minutes} ${label}`)
  }
  await assert.rejects(setRule(db, A, "nope", "hours", 60), /Game not found/)
  await setRule(db, A, null, "milestone", null, "x".repeat(60))
  assert.equal((await rows(db, "select * from public.stamp_rules")).length, 1)
  await assert.rejects(
    db.query(`insert into public.residents (user_id, game_id, arrival_source) values ('${A}', 'g1', 'other')`),
    /residents_arrival_source_check/,
  )
})
