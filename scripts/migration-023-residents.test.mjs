// Tests scripts/023_residents_and_postcards.sql by loading the real file into PGlite.
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-023-residents.test.mjs

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
const migrationSql = readFileSync(path.join(here, "023_residents_and_postcards.sql"), "utf8")

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

// Prior migrations are not replayed here, so game_progress mirrors the columns 008/018 define.
async function setup({ seed } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create table public.users (id uuid primary key);
    create table public.games (id text primary key, name text);
    create table public.game_progress (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users(id) on delete cascade,
      game_id text not null references public.games(id) on delete cascade,
      status text not null default 'playing' check (status in ('playing','beaten','abandoned')),
      completed_at timestamptz,
      unique (user_id, game_id)
    );
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    grant select, insert, update, delete on public.game_progress to authenticated;
    insert into public.users values ('${A}'), ('${B}');
    insert into public.games values ('g1','One'), ('g2','Two'), ('g3','Three');
  `)
  if (seed) await db.exec(seed)
  await db.exec(migrationSql)
  return db
}

const set = (db, uid, game, status) =>
  db.query(
    `insert into public.game_progress (user_id, game_id, status, completed_at)
     values ($1, $2, $3, case when $3 = 'beaten' then now() end)
     on conflict (user_id, game_id) do update set status = excluded.status,
       completed_at = case when excluded.status = 'beaten' then now() else public.game_progress.completed_at end`,
    [uid, game, status],
  )

const residents = (db, uid) =>
  rows(db, "select game_id from public.residents where user_id = $1 order by game_id", [uid])
const postcards = (db, uid) =>
  rows(db, "select game_id from public.postcards where user_id = $1 order by game_id", [uid])

test("beating a game makes a resident, once", async () => {
  const db = await setup()
  await set(db, A, "g1", "playing")
  assert.equal((await residents(db, A)).length, 0)
  await set(db, A, "g1", "beaten")
  assert.deepEqual(await residents(db, A), [{ game_id: "g1" }])
  const first = (await rows(db, "select arrived_at from public.residents"))[0].arrived_at
  await set(db, A, "g1", "playing")
  await set(db, A, "g1", "beaten")
  const again = await rows(db, "select arrived_at from public.residents")
  assert.equal(again.length, 1)
  assert.equal(+again[0].arrived_at, +first, "replay keeps the original arrival")
})

test("a resident stays after replay or setting aside", async () => {
  const db = await setup()
  await set(db, A, "g1", "beaten")
  await set(db, A, "g1", "playing")
  await set(db, A, "g1", "abandoned")
  assert.deepEqual(await residents(db, A), [{ game_id: "g1" }])
  assert.deepEqual(await postcards(db, A), [], "no postcard when a resident exists")
})

test("setting a game aside makes a postcard; re-inviting keeps it; arrival removes it", async () => {
  const db = await setup()
  await set(db, A, "g2", "playing")
  await set(db, A, "g2", "abandoned")
  assert.deepEqual(await postcards(db, A), [{ game_id: "g2" }])
  await set(db, A, "g2", "playing")
  assert.deepEqual(await postcards(db, A), [{ game_id: "g2" }])
  await set(db, A, "g2", "beaten")
  assert.deepEqual(await postcards(db, A), [])
  assert.deepEqual(await residents(db, A), [{ game_id: "g2" }])
})

test("the completed_at stamp survives and other users are untouched", async () => {
  const db = await setup()
  await set(db, A, "g1", "beaten")
  const stamp = (await rows(db, "select completed_at from public.game_progress"))[0].completed_at
  await set(db, A, "g1", "abandoned")
  const after = (await rows(db, "select completed_at from public.game_progress"))[0].completed_at
  assert.equal(+after, +stamp)
  assert.deepEqual(await residents(db, B), [])
})

test("clients cannot write residents or postcards directly", async () => {
  const db = await setup()
  await set(db, A, "g1", "beaten")
  await set(db, A, "g2", "abandoned")
  for (const sql of [
    `insert into public.residents (user_id, game_id) values ('${A}', 'g3')`,
    `insert into public.postcards (user_id, game_id) values ('${A}', 'g3')`,
  ]) {
    assert.ok(await denied(db, A, sql), `expected denial: ${sql}`)
  }
  // With no write policy, RLS makes UPDATE and DELETE touch zero rows rather than raise.
  for (const sql of [
    `update public.residents set arrival_source = 'imported'`,
    `delete from public.residents`,
    `delete from public.postcards`,
  ]) {
    const res = await asUser(db, A, () => db.query(sql))
    assert.equal(res.affectedRows, 0, `expected no rows touched: ${sql}`)
  }
  const src = await rows(db, "select arrival_source from public.residents")
  assert.equal(src[0].arrival_source, "beaten")
  assert.equal((await residents(db, A)).length, 1)
  assert.equal((await postcards(db, A)).length, 1)
})

test("clients cannot call the arrival function; anon cannot delete postcards", async () => {
  const db = await setup()
  const err = await denied(db, A, `select public.grant_resident_arrival('${B}', 'g1', 'beaten')`)
  assert.match(String(err?.message), /permission denied/)
  await db.exec("set role anon")
  await assert.rejects(db.query("select public.delete_postcard('g1')"), /permission denied/)
  await db.exec("reset role")
  assert.deepEqual(await residents(db, B), [])
})

test("each user only sees their own rows", async () => {
  const db = await setup()
  await set(db, A, "g1", "beaten")
  await set(db, B, "g2", "beaten")
  await set(db, B, "g3", "abandoned")
  const a = await asUser(db, A, () => rows(db, "select user_id from public.residents"))
  assert.deepEqual(a.map((r) => r.user_id), [A])
  const bPost = await asUser(db, B, () => rows(db, "select user_id from public.postcards"))
  assert.deepEqual(bPost.map((r) => r.user_id), [B])
  const aPost = await asUser(db, A, () => rows(db, "select * from public.postcards"))
  assert.equal(aPost.length, 0)
})

test("delete_postcard removes only the caller's postcard", async () => {
  const db = await setup()
  await set(db, A, "g3", "abandoned")
  await set(db, B, "g3", "abandoned")
  await asUser(db, A, () => db.query("select public.delete_postcard('g3')"))
  assert.deepEqual(await postcards(db, A), [])
  assert.deepEqual(await postcards(db, B), [{ game_id: "g3" }])
  await assert.rejects(asUser(db, "", () => db.query("select public.delete_postcard('g3')")), /Not authenticated/)
})

test("backfill: finished games become residents, set-aside games become postcards", async () => {
  const db = await setup({
    seed: `
      insert into public.game_progress (user_id, game_id, status, completed_at) values
        ('${A}', 'g1', 'beaten',    '2025-01-02T03:04:05Z'),
        ('${A}', 'g2', 'abandoned', null),
        ('${A}', 'g3', 'abandoned', '2025-02-01T00:00:00Z'),
        ('${B}', 'g1', 'playing',   null);
    `,
  })
  assert.deepEqual(await residents(db, A), [{ game_id: "g1" }, { game_id: "g3" }])
  assert.deepEqual(await postcards(db, A), [{ game_id: "g2" }])
  assert.deepEqual(await residents(db, B), [])
  const arrived = (await rows(db, "select arrived_at from public.residents where game_id = 'g1'"))[0].arrived_at
  assert.equal(new Date(arrived).toISOString(), "2025-01-02T03:04:05.000Z")
})

test("running the real migration file a second time changes nothing", async () => {
  const db = await setup({
    seed: `insert into public.game_progress (user_id, game_id, status, completed_at)
           values ('${A}', 'g1', 'beaten', now()), ('${A}', 'g2', 'abandoned', null);`,
  })
  const before = {
    r: await rows(db, "select * from public.residents order by game_id"),
    p: await rows(db, "select * from public.postcards order by game_id"),
  }
  await db.exec(migrationSql)
  assert.deepEqual(await rows(db, "select * from public.residents order by game_id"), before.r)
  assert.deepEqual(await rows(db, "select * from public.postcards order by game_id"), before.p)
  const triggers = await rows(
    db,
    "select tgname from pg_trigger where tgrelid = 'public.game_progress'::regclass and not tgisinternal order by 1",
  )
  assert.deepEqual(triggers.map((t) => t.tgname), [
    "game_progress_postcards_on_abandoned",
    "game_progress_residents_on_beaten",
  ])
  await set(db, B, "g1", "beaten")
  assert.deepEqual(await residents(db, B), [{ game_id: "g1" }], "triggers still fire after the second run")
})
