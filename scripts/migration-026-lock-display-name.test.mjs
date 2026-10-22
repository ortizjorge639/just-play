// Tests scripts/026_lock_display_name.sql by loading the real migration files 018 to 026 into PGlite.
// The tests run as real roles (set role + auth.uid()). 
// From the repository root:
// npx --yes --registry https://registry.npmjs.org --package=@electric-sql/pglite@0.5.10 -- node --test scripts/migration-026-lock-display-name.test.mjs

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
]
const lockSql = sqlFile("026_lock_display_name.sql")

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
// Migrations 018 to 026 are the real files.
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
  await db.exec(lockSql)
  return db
}

const save = (db, uid, name, tagline = null, style = null, favorites = null) =>
  asUser(db, uid, async () =>
    (await rows(db, "select * from public.save_name_card($1, $2, $3, $4)", [name, tagline, style, favorites]))[0],
  )

const cards = (db) => rows(db, "select * from public.name_cards order by user_id")
const nameOf = async (db, uid) => (await rows(db, "select display_name from public.users where id = $1", [uid]))[0].display_name

test("a client cannot change its own display_name directly, even within the length limit", async () => {
  const db = await setup()
  const short = await denied(db, A, `update public.users set display_name = 'Edited' where id = '${A}'`)
  assert.match(String(short?.message), /name card/)
  const long = await denied(db, A, `update public.users set display_name = '${"x".repeat(80)}' where id = '${A}'`)
  assert.match(String(long?.message), /name card/)
  assert.equal(await nameOf(db, A), "Ann")
})

test("other user columns still update, and a same-value name write is allowed", async () => {
  const db = await setup()
  assert.equal(await denied(db, A, `update public.users set level = 2 where id = '${A}'`), null)
  assert.equal(await denied(db, A, `update public.users set display_name = 'Ann', level = 3 where id = '${A}'`), null)
})

test("save_name_card still changes the name, and refuses a bad one", async () => {
  const db = await setup()
  await save(db, A, "  Ann Lee ", null, null, [])
  assert.equal(await nameOf(db, A), "Ann Lee")
  await assert.rejects(save(db, A, "n".repeat(51)), /at most 50/)
  assert.equal(await nameOf(db, A), "Ann Lee")
})

test("a client still cannot touch another user's name", async () => {
  const db = await setup()
  const res = await asUser(db, A, () => db.query(`update public.users set display_name = 'Hacked' where id = '${B}'`))
  assert.equal(res.affectedRows, 0)
  assert.equal(await nameOf(db, B), "Bob")
})

test("026 is safe to run twice", async () => {
  const db = await setup()
  await db.exec(lockSql)
  await assert.rejects(asUser(db, A, () => db.query(`update public.users set display_name = 'E' where id = '${A}'`)), /name card/)
})
