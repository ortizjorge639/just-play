// Tests scripts/025_name_cards.sql by loading the real migration files 018 to 025 into PGlite.
// The tests run as real roles (set role + auth.uid()). Rule numbers match docs/name-card-proposal.md.
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-025-name-cards.test.mjs

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
]
const cardsSql = sqlFile("025_name_cards.sql")

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
// Migrations 018 to 025 are the real files.
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
  await db.exec(cardsSql)
  return db
}

const save = (db, uid, name, tagline = null, style = null, favorites = null) =>
  asUser(db, uid, async () =>
    (await rows(db, "select * from public.save_name_card($1, $2, $3, $4)", [name, tagline, style, favorites]))[0],
  )

const cards = (db) => rows(db, "select * from public.name_cards order by user_id")
const nameOf = async (db, uid) => (await rows(db, "select display_name from public.users where id = $1", [uid]))[0].display_name

test("rule 1: a valid save stores the name and card, and a second save overwrites", async () => {
  const db = await setup()
  const first = await save(db, A, "  Ann Lee  ", " Slow and steady ", " I love cozy games ", ["g1", "g2"])
  assert.equal(first.user_id, A)
  assert.equal(first.tagline, "Slow and steady")
  assert.equal(first.play_style, "I love cozy games")
  assert.deepEqual(first.favorite_game_ids, ["g1", "g2"])
  assert.equal(await nameOf(db, A), "Ann Lee", "the name is trimmed and stored on the user")

  const second = await save(db, A, "Ann", null, null, ["g3"])
  assert.equal(second.tagline, null)
  assert.equal(second.play_style, null)
  assert.deepEqual(second.favorite_game_ids, ["g3"])
  assert.equal(await nameOf(db, A), "Ann")
  const all = await cards(db)
  assert.equal(all.length, 1, "one row per user")
  assert.deepEqual(all[0].favorite_game_ids, ["g3"])
  assert.ok(all[0].updated_at >= first.updated_at)

  const blank = await save(db, A, "Ann", "   ", "   ", [])
  assert.equal(blank.tagline, null, "blank text is stored as no text")
  assert.deepEqual(blank.favorite_game_ids, [])
  assert.deepEqual((await save(db, A, "Ann", null, null, null)).favorite_game_ids, [], "no favorites given means none")
})

test("rule 2: length limits accept the boundary and reject one over", async () => {
  const db = await setup()
  const ok = await save(db, A, "n".repeat(50), "t".repeat(200), "p".repeat(80), [])
  assert.equal(ok.tagline.length, 200)
  assert.equal(ok.play_style.length, 80)
  assert.equal((await nameOf(db, A)).length, 50)

  await assert.rejects(save(db, A, "n".repeat(51)), /at most 50/)
  await assert.rejects(save(db, A, "Ann", "t".repeat(201)), /at most 200/)
  await assert.rejects(save(db, A, "Ann", null, "p".repeat(81)), /at most 80/)
  await assert.rejects(save(db, A, ""), /name is required/)
  await assert.rejects(save(db, A, "   "), /name is required/)
  await assert.rejects(save(db, A, null), /name is required/)
  assert.equal(await nameOf(db, A), "n".repeat(50), "refusals left the name alone")
})

test("rule 3: at most 3 favorites, no duplicates, every id must exist", async () => {
  const db = await setup()
  await db.exec("insert into public.games values ('g4', 'Four')")
  const three = await save(db, A, "Ann", null, null, ["g1", "g2", "g3"])
  assert.equal(three.favorite_game_ids.length, 3)
  await assert.rejects(save(db, A, "Ann", null, null, ["g1", "g2", "g3", "g4"]), /at most 3/)
  await assert.rejects(save(db, A, "Ann", null, null, ["g1", "g1"]), /once/)
  await assert.rejects(save(db, A, "Ann", null, null, ["g1", "nope"]), /Game not found/)
  await assert.rejects(save(db, A, "Ann", null, null, ["g1", null]), /missing its id/)
  assert.deepEqual((await cards(db))[0].favorite_game_ids, ["g1", "g2", "g3"])
})

test("rule 4: users cannot read or write each other's card, or write name_cards directly", async () => {
  const db = await setup()
  await save(db, A, "Ann", "A's line", null, ["g1"])
  await save(db, B, "Bob", "B's line", null, ["g2"])

  const aSees = await asUser(db, A, () => rows(db, "select user_id, tagline from public.name_cards"))
  assert.deepEqual(aSees, [{ user_id: A, tagline: "A's line" }])
  const bSees = await asUser(db, B, () => rows(db, "select user_id, tagline from public.name_cards"))
  assert.deepEqual(bSees, [{ user_id: B, tagline: "B's line" }])

  await save(db, B, "Bob 2")
  assert.equal(await nameOf(db, A), "Ann", "B's save never touches A")
  assert.equal((await rows(db, "select tagline from public.name_cards where user_id = $1", [A]))[0].tagline, "A's line")

  for (const sql of [
    `insert into public.name_cards (user_id, tagline) values ('${A}', 'x')`,
    `insert into public.name_cards (user_id, tagline) values ('${B}', 'x')`,
    `update public.name_cards set tagline = 'x'`,
    `delete from public.name_cards`,
    `truncate public.name_cards`,
  ]) {
    assert.ok(await denied(db, A, sql), `expected denial: ${sql}`)
  }
  const anon = async (sql) => {
    await db.exec("set role anon")
    try {
      await db.query(sql)
    } catch (err) {
      return err
    } finally {
      await db.exec("reset role")
    }
    return null
  }
  assert.ok(await anon(`insert into public.name_cards (user_id) values ('${A}')`))
  assert.equal((await rows(db, "select * from public.name_cards")).length, 2)
})

test("rule 5: a failed validation changes nothing, including the name", async () => {
  const db = await setup()
  await save(db, A, "Ann", "Kept", "Kept style", ["g1"])
  const before = { cards: await cards(db), users: await rows(db, "select * from public.users order by id") }
  const bad = [
    ["New name", "x".repeat(201), null, ["g2"]],
    ["New name", "ok", "x".repeat(81), ["g2"]],
    ["New name", "ok", null, ["g1", "g2", "g3", "g1"]],
    ["New name", "ok", null, ["g2", "nope"]],
    ["x".repeat(51), "ok", null, ["g2"]],
  ]
  for (const args of bad) await assert.rejects(save(db, A, ...args), /./)
  assert.deepEqual(await cards(db), before.cards)
  assert.deepEqual(await rows(db, "select * from public.users order by id"), before.users)

  const fresh = await setup()
  await assert.rejects(save(fresh, A, "New name", null, null, ["nope"]), /Game not found/)
  assert.deepEqual(await cards(fresh), [], "a first failed save creates no card")
  assert.equal(await nameOf(fresh, A), "Ann")
})

test("rule 6: saving adds no XP and leaves counters, residents, postcards and sessions alone", async () => {
  const db = await setup()
  await db.exec(`update public.users set total_xp = 40, level = 2 where id = '${A}'`)
  await db.exec(`insert into public.game_progress (user_id, game_id, status, total_sessions, total_time_minutes)
                 values ('${A}', 'g1', 'beaten', 3, 200), ('${A}', 'g2', 'abandoned', 1, 5)`)
  const snap = async () => ({
    users: await rows(db, "select id, total_xp, level, last_session_date from public.users order by id"),
    gp: await rows(db, "select * from public.game_progress order by game_id"),
    sessions: await rows(db, "select * from public.sessions"),
    residents: await rows(db, "select * from public.residents order by game_id"),
    postcards: await rows(db, "select * from public.postcards order by game_id"),
    proofs: await rows(db, "select * from public.stamp_proofs"),
    rules: await rows(db, "select * from public.stamp_rules"),
  })
  const before = await snap()
  assert.equal(before.residents.length, 1)
  assert.equal(before.postcards.length, 1)
  await save(db, A, "Ann", "Hi", "Cozy", ["g1", "g2"])
  await save(db, A, "Ann again", null, null, [])
  assert.deepEqual(await snap(), before)
})

test("rule 7: an account with no card row reads an empty result, not an error", async () => {
  const db = await setup()
  const none = await asUser(db, A, () => rows(db, "select * from public.name_cards where user_id = $1", [A]))
  assert.deepEqual(none, [])
  await save(db, B, "Bob", "Only B")
  assert.deepEqual(await asUser(db, A, () => rows(db, "select * from public.name_cards")), [])
  assert.equal(await nameOf(db, A), "Ann", "the name is still there for the empty card")
})

test("rule 8: applying the real migration file a second time changes nothing", async () => {
  const db = await setup()
  await save(db, A, "Ann", "Hi", "Cozy", ["g1"])
  const snapshot = async () => ({
    cards: await cards(db),
    users: await rows(db, "select * from public.users order by id"),
    policies: await rows(db, "select tablename, policyname, cmd from pg_policies where tablename = 'name_cards' order by 1, 2"),
    constraints: await rows(
      db,
      "select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.name_cards'::regclass order by 1",
    ),
    functions: await rows(db, "select proname, proacl::text as acl, prosecdef, proconfig::text as cfg from pg_proc where proname = 'save_name_card'"),
    grants: await rows(
      db,
      "select grantee, privilege_type from information_schema.table_privileges where table_name = 'name_cards' order by 1, 2",
    ),
  })
  const before = await snapshot()
  await db.exec(cardsSql)
  assert.deepEqual(await snapshot(), before)
  assert.equal(before.policies.length, 1)
  assert.equal(before.functions[0].prosecdef, true)
  assert.match(before.functions[0].cfg, /search_path=public, pg_temp/)
})

test("only signed-in users can run save_name_card", async () => {
  const db = await setup()
  await db.exec("set role anon")
  await assert.rejects(db.query("select public.save_name_card('x')"), /permission denied/)
  await db.exec("reset role")
  await assert.rejects(asUser(db, "", () => db.query("select public.save_name_card('x')")), /Not authenticated/)
  const acl = (await rows(db, "select proacl::text as acl from pg_proc where proname = 'save_name_card'"))[0].acl
  assert.doesNotMatch(acl, /(^|[{,])=X/, "PUBLIC has no execute")
  assert.match(acl, /authenticated=X/)
  assert.doesNotMatch(acl, /anon=/)
  assert.deepEqual(await cards(db), [])
})

// Open check from the proposal. These record what a signed-in client can do today; they assert
// the current behavior and do not change it. Findings go in the PR body.
test("open check: what a client can write directly on name_cards and users", async () => {
  const db = await setup()
  await save(db, A, "Ann", "Hi", null, ["g1"])

  const findings = {}
  for (const [label, sql] of [
    ["name_cards insert", `insert into public.name_cards (user_id, tagline) values ('${B}', 'x')`],
    ["name_cards update", `update public.name_cards set tagline = 'x'`],
    ["name_cards delete", `delete from public.name_cards`],
  ]) {
    findings[label] = (await denied(db, A, sql)) ? "denied" : "allowed"
  }
  assert.deepEqual(findings, {
    "name_cards insert": "denied",
    "name_cards update": "denied",
    "name_cards delete": "denied",
  })
  assert.equal((await cards(db)).length, 1)

  const userWrites = {}
  for (const col of ["display_name", "total_xp", "level"]) {
    const value = col === "display_name" ? "'Edited'" : "999"
    const err = await denied(db, A, `update public.users set ${col} = ${value} where id = '${A}'`)
    userWrites[col] = err ? "denied" : "allowed"
  }
  const other = await asUser(db, A, () =>
    db.query(`update public.users set display_name = 'Hacked' where id = '${B}'`),
  )
  assert.equal(other.affectedRows, 0, "the users policy still keeps a client to its own row")
  assert.equal(await nameOf(db, B), "Bob")

  // The users policy has no column limit, so a client can write its own display_name directly,
  // skipping the 50 character check. XP can also be raised directly while the account has no
  // untracked session history (the 018 trigger only guards accounts that have it).
  assert.deepEqual(userWrites, { display_name: "allowed", total_xp: "allowed", level: "allowed" })
  assert.equal(await nameOf(db, A), "Edited")
  const long = await denied(db, A, `update public.users set display_name = '${"x".repeat(80)}' where id = '${A}'`)
  assert.equal(long, null, "a direct write skips the 50 character limit")
  console.log("open check findings:", JSON.stringify({ ...findings, ...Object.fromEntries(Object.entries(userWrites).map(([k, v]) => [`users.${k} update`, v])) }))
})
