// Repeatable, in-memory PostgreSQL smoke test; no Supabase credentials/connections.
// From the repository root (optional tooling; no project dependency changes):
// npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts\standby-migration.test.mjs
// Also run: npx --yes pnpm@10.28.2 exec tsx --test lib\session-time.test.ts
// PGlite serializes database statements. The competing requests below share an
// earlier snapshot and verify CAS losers/transaction effects, not multi-backend
// lock contention or an actual Next.js/PostgREST transport.
// BEFORE sessions: snapshots recording on insert; freezes recording and finished
// details; zeroes untracked timing; adds duration XP to the finishing row ledger.
// AFTER sessions/progress: only authenticated StandBy RPCs enable atomic profile
// XP using a transaction-local flag. Legacy direct writes do not trigger awards.
// Failure rolls back both row and profile; no bypass flag is stored on a user.
// 018/019 legacy checks run first; then the same populated fixture upgrades to020.
// 020 serializes creation/direct DML and atomic game completion with an account
// advisory lock acquired before tuple locks. The post-read regressions execute a
// remote committed write between the displayed read and completion RPC; they do
// NOT claim simultaneous multi-connection contention from serialized PGlite.
// Mixed-version rollout: safe main/direct progress bookkeeping remains allowed;
// terminal writes reject only when a same-game session is active. Old separate
// requests retain their original atomicity/CAS/profile read-modify-write limits.
// Rollout: old clients with any untracked-session history must reload. The direct
// profile-increment barrier remains after finish and during later tracked sessions.
// Final notes and finish share one020 transaction.018 fallback is only for
// acknowledged local drafts; it does not order unknown requests from other clients.
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
    // npm exec exposes its isolated package directory through PATH.
    for (const bin of (process.env.PATH ?? "").split(path.delimiter)) {
      const candidate = path.resolve(bin, "..", "@electric-sql", "pglite")
      if (existsSync(path.join(candidate, "package.json"))) return candidate
    }
    throw new Error("Run the npx --package=@electric-sql/pglite@0.5.10 command documented at the top of this test.")
  }
}
const { PGlite } = loadPackage(resolvePGlite())
const migration = (name) => readFileSync(new URL(name, import.meta.url), "utf8")
const rpcSignatures = [
  "public.create_standby_session(text,integer)",
  "public.transition_standby_session(uuid,jsonb,jsonb)",
  "public.set_standby_game_progress(text,text,text)",
  "public.backfill_standby_profile_xp(integer,date)",
]
const roleMembershipSQL = `
  with recursive inherited(role_id,path) as (
    select oid,array[oid] from pg_roles where rolname='anon'
    union all
    select m.roleid,i.path || m.roleid
    from inherited i join pg_auth_members m on m.member=i.role_id
    where not m.roleid=any(i.path)
  )
  select pg_has_role('anon','authenticated','MEMBER') as anon_member_of_authenticated,
    array(
      select distinct r.rolname::text
      from inherited i join pg_roles r on r.oid=i.role_id
      where cardinality(i.path)>1 order by r.rolname::text
    ) as anon_parent_roles,
    case when pg_has_role('anon','authenticated','MEMBER')
      then 'FAIL: anon reaches authenticated; review memberships separately'
      else 'No authenticated membership; still require effective anon RPC EXECUTE=false'
    end as membership_check
`
// Run this identical catalog-only bundle before/after an authorized020 upgrade.
// Before: all new020 routines are absent; after: all present, invoker, volatile,
// search_path=public. RPCs must retain authenticated EXECUTE, deny anon/PUBLIC.
// Twelve routines (seven018 + five020), including seven RPCs, exist after020.
// Postflight expects 10 enabled non-internal triggers (four018 + six020).
const approval020SQL = `
  begin transaction read only;
  select current_setting('default_transaction_isolation') as default_isolation,
    to_regprocedure('auth.uid()') as auth_uid,
    to_regprocedure('pg_catalog.hashtextextended(text,bigint)') as hash_function,
    to_regprocedure('pg_catalog.pg_advisory_xact_lock(bigint)') as account_lock,
    to_regprocedure('pg_catalog.pg_advisory_xact_lock(integer,integer)') as maintenance_lock,
    to_regprocedure('pg_catalog.pg_advisory_xact_lock_shared(integer,integer)') as shared_fence,
    to_regprocedure('public.complete_standby_game(text,text,jsonb)') as unexpected_old_completion_signature,
    pg_has_role('anon','authenticated','MEMBER') as unsafe_anon_membership;
  with expected(signature,new020,rpc) as (values
    ('public.enforce_standby_session()',false,false),
    ('public.award_standby_xp()',false,false),
    ('public.protect_untracked_profile_xp()',false,false),
    ('public.create_standby_session(text,integer)',false,true),
    ('public.transition_standby_session(uuid,jsonb,jsonb)',false,true),
    ('public.set_standby_game_progress(text,text,text)',false,true),
    ('public.backfill_standby_profile_xp(integer,date)',false,true),
    ('public.create_standby_session_with_progress(text,integer)',true,true),
    ('public.complete_standby_game(text,text,jsonb,text)',true,true),
    ('public.finish_standby_session_with_notes(uuid,jsonb,jsonb,text)',true,true),
    ('public.lock_standby_account_statement()',true,false),
    ('public.enforce_standby_account_owner()',true,false)
  )
  select e.*,p.oid is not null as present,p.prosecdef,p.provolatile,p.proconfig,
    pg_get_function_result(p.oid) as result,
    case when e.rpc then has_function_privilege('authenticated',p.oid,'EXECUTE') end as auth_execute,
    case when e.rpc then has_function_privilege('anon',p.oid,'EXECUTE') end as anon_execute,
    case when e.rpc and p.oid is not null then exists(
      select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE'
    ) end as public_execute,
    pg_get_functiondef(p.oid) as definition
  from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
  order by e.signature;
  select c.relname,c.relrowsecurity,c.relforcerowsecurity,
    has_table_privilege('authenticated',c.oid,'SELECT') as auth_select,
    has_table_privilege('authenticated',c.oid,'INSERT') as auth_insert,
    has_table_privilege('authenticated',c.oid,'UPDATE') as auth_update
  from pg_class c where c.oid in(
    to_regclass('public.users'),to_regclass('public.sessions'),to_regclass('public.game_progress')
  ) order by c.relname;
  select t.tgrelid::regclass as relation,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) as definition
  from pg_trigger t where not t.tgisinternal and t.tgrelid in(
    to_regclass('public.users'),to_regclass('public.sessions'),to_regclass('public.game_progress')
  ) order by 1,2;
  select i.indrelid::regclass as relation,i.indisunique,i.indisvalid,pg_get_indexdef(i.indexrelid) as definition
  from pg_index i where i.indrelid in(
    to_regclass('public.sessions'),to_regclass('public.game_progress')
  ) and i.indisunique order by 1,4;
  rollback;
`

test("StandBy migration, RLS and transactional XP contracts", async (t) => {
  const db = new PGlite()
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
  const rpcPrivileges = async () => Promise.all(rpcSignatures.map((signature) => one(`
    select $1::text as signature,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      exists (
        select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
        where a.grantee=0 and a.privilege_type='EXECUTE'
      ) as public_execute
    from pg_proc p where p.oid=to_regprocedure($1)
  `, [signature])))
  const assertRestrictedRPCs = async () => {
    for (const row of await rpcPrivileges()) {
      assert.ok(row, "RPC must exist")
      assert.equal(row.authenticated_execute, true, `${row.signature}: authenticated EXECUTE retained`)
      assert.equal(row.anon_execute, false, `${row.signature}: effective anon EXECUTE must be denied; review inherited role grants if this fails`)
      assert.equal(row.public_execute, false, `${row.signature}: PUBLIC EXECUTE must be denied`)
    }
  }
  let sequence = 0
  let creationRPC = "create_standby_session"
  const fixture = async () => {
    const user = `00000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`
    const game = `game-${sequence}`
    await db.exec("reset role")
    await db.query("insert into auth.users(id) values($1)", [user])
    await db.query("insert into public.users(id) values($1)", [user])
    await db.query("insert into public.games(id,name) values($1,'Test')", [game])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
    await db.exec("set role authenticated")
    return {
      user, game,
      profile: () => one("select * from public.users where id=$1", [user]),
      insert: async (status = "Playing", xp = 10, rpc = creationRPC) => {
        const created = await one(`select * from public.${rpc}($1,$2)`, [game, xp])
        if (status === "LockedIn") return created
        return one("select * from public.transition_standby_session($1,$2::jsonb,$3::jsonb)", [
          created.id, JSON.stringify(created),
          JSON.stringify({ status, started_at: new Date().toISOString(), paused_elapsed_seconds: 0 }),
        ])
      },
      recording: (value) => db.query(
        "update public.users set standby_preferences=jsonb_set(standby_preferences,'{record_time}',to_jsonb($2::boolean)) where id=$1",
        [user, value],
      ),
    }
  }
  // Mirrors transitionSession's full timing/state predicate, including NULLs.
  const finish = (snapshot, minutes = 60) => db.query(
    "select * from public.transition_standby_session($1,$2::jsonb,$3::jsonb)",
    [snapshot.id, JSON.stringify(snapshot), JSON.stringify({
      status: "Finished", active: false, ended_at: new Date().toISOString(),
      duration_minutes: minutes, paused_elapsed_seconds: minutes * 60,
    })],
  )
  try {
    await db.exec(`
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql as $$ select 'authenticated'::text $$;
      create role authenticated;
      create role anon;
    `)
    for (const name of [
      "001_create_tables.sql", "002_rls_policies.sql", "008_add_game_progress.sql",
      "009_fix_status_constraint.sql", "014_gamification.sql",
    ]) await db.exec(migration(name))
    const legacyUser = "10000000-0000-0000-0000-000000000001"
    await db.query("insert into auth.users(id) values($1)", [legacyUser])
    await db.query("insert into public.users(id) values($1)", [legacyUser])
    await db.exec("insert into public.games(id,name) values('legacy','Legacy')")
    const legacy = await one(
      "insert into public.sessions(user_id,game_id,status,active,paused_elapsed_seconds) values($1,'legacy','Finished',false,null) returning *",
      [legacyUser],
    )
    // Supabase-like defaults give anon an explicit grant, independent of PUBLIC.
    await db.exec("alter default privileges in schema public grant execute on functions to anon")
    await db.exec(migration("018_standby.sql"))
    await db.exec(`
      grant usage on schema public,auth to authenticated;
      grant select,insert,update on public.users,public.sessions,public.game_progress to authenticated;
      grant select on public.games to authenticated;
    `)

    await t.test("018 removes explicit Supabase-style anon defaults and PUBLIC RPC access but preserves authenticated", async () => {
      await assertRestrictedRPCs()
      assert.equal((await one(roleMembershipSQL)).anon_member_of_authenticated, false)
      await db.exec("set role anon")
      try {
        for (const sql of [
          "select * from public.create_standby_session('legacy',0)",
          "select * from public.transition_standby_session('00000000-0000-0000-0000-000000000001','{}','{}')",
          "select * from public.set_standby_game_progress('legacy','beaten',null)",
          "select public.backfill_standby_profile_xp(25,null)",
        ]) await assert.rejects(db.query(sql), /permission denied/)
      } finally {
        await db.exec("reset role")
      }
    })

    await t.test("019 corrects already-applied explicit anon grants without disturbing authenticated RPC grants", async () => {
      for (const signature of rpcSignatures) {
        await db.exec(`grant execute on function ${signature} to anon`)
      }
      for (const row of await rpcPrivileges()) assert.equal(row.anon_execute, true)
      await db.exec(migration("019_restrict_standby_rpc_execute.sql"))
      await assertRestrictedRPCs()
    })

    await t.test("inherited authenticated membership is detected, not silently fixed by explicit anon revokes", async () => {
      await db.exec("grant authenticated to anon")
      try {
        await db.exec(migration("019_restrict_standby_rpc_execute.sql"))
        const membership = await one(roleMembershipSQL)
        assert.equal(membership.anon_member_of_authenticated, true)
        assert.ok(membership.anon_parent_roles.includes("authenticated"))
        assert.match(membership.membership_check, /^FAIL:/)
        await assert.rejects(assertRestrictedRPCs(), /effective anon EXECUTE must be denied; review inherited role grants/)
      } finally {
        // Undo only the known membership introduced by this isolated test.
        await db.exec("revoke authenticated from anon")
      }
      await assertRestrictedRPCs()
    })

    await t.test("legacy recording defaults true; select * returns dedicated preferences without changing discovery", async () => {
      const oldSession = await one("select * from public.sessions where id=$1", [legacy.id])
      assert.equal(oldSession.record_time, true)
      assert.equal(oldSession.paused_elapsed_seconds, 0)
      const f = await fixture()
      await db.query(`update public.users set preferences='{"mood":"chill","discovery":"new"}' where id=$1`, [f.user])
      assert.deepEqual((await f.profile()).standby_preferences,
        { record_time: true, show_clock: true, reminders: false, keep_awake: false })
      assert.deepEqual((await f.profile()).preferences, { mood: "chill", discovery: "new" })
      await assert.rejects(db.query(`update public.users set standby_preferences='{"record_time":"no"}' where id=$1`, [f.user]), /check constraint/)
    })

    await t.test("untracked Playing snapshots account preference, keeps zero time and awards no duration XP", async () => {
      const f = await fixture()
      await f.recording(false)
      const session = await f.insert("Playing", 25)
      assert.equal(session.record_time, false)
      await f.recording(true)
      await assert.rejects(db.query("update public.sessions set record_time=true where id=$1", [session.id]), /immutable/)
      await db.query("update public.sessions set status='Paused',duration_minutes=90,paused_elapsed_seconds=5400 where id=$1", [session.id])
      const paused = await one("select * from public.sessions where id=$1", [session.id])
      assert.equal(paused.duration_minutes, 0)
      assert.equal(paused.paused_elapsed_seconds, 0)
      const finished = (await finish(paused, 90)).rows[0]
      assert.equal(finished.duration_minutes, 0)
      assert.equal(finished.paused_elapsed_seconds, 0)
      assert.equal(finished.xp_awarded, 25)
      assert.equal((await f.profile()).total_xp, 25)
      assert.equal((await f.insert()).record_time, true)
    })

    await t.test("LockedIn snapshots recording too; ending before play never earns duration XP", async () => {
      const f = await fixture()
      await f.recording(false)
      const untracked = await f.insert("LockedIn")
      assert.equal(untracked.record_time, false)
      await finish(untracked, 120)
      await f.recording(true)
      const locked = await f.insert("LockedIn")
      const finished = (await finish(locked, 240)).rows[0]
      assert.equal(finished.duration_minutes, 0)
      assert.equal(finished.paused_elapsed_seconds, 0)
      assert.equal(finished.xp_awarded, 10)
      assert.equal((await f.profile()).total_xp, 20)
    })

    await t.test("two finish requests sharing a snapshot have one winner and one duration award", async () => {
      const f = await fixture()
      const session = await f.insert()
      const results = await Promise.all([finish(session), finish(session)])
      assert.deepEqual(results.map((r) => r.rows.length).sort(), [0, 1])
      const winner = results.find((r) => r.rows.length).rows[0]
      assert.equal(winner.xp_awarded, 32) // 10 start + 12 duration + 10 long-session.
      assert.equal((await f.profile()).total_xp, 32)
      assert.equal((await finish(session)).rows.length, 0)
      assert.equal((await f.profile()).total_xp, 32)
    })

    await t.test("pause/resume invalidates an older Playing snapshot even when status matches again", async () => {
      const f = await fixture()
      const before = await f.insert()
      await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=120 where id=$1", [before.id])
      await db.query("update public.sessions set status='Playing',started_at=started_at+interval '10 minutes' where id=$1", [before.id])
      assert.equal((await finish(before)).rows.length, 0)
      assert.equal((await f.profile()).total_xp, 10)
      const current = await one("select * from public.sessions where id=$1", [before.id])
      await finish(current, 5)
      assert.equal((await f.profile()).total_xp, 11)
    })

    await t.test("finished session cannot revive or accept a delayed notes/goal write", async () => {
      const f = await fixture()
      const session = await f.insert()
      await finish(session, 5)
      for (const update of ["status='Playing',active=true", "notes='late flush'", "session_goal='late flush'"]) {
        await assert.rejects(db.query(`update public.sessions set ${update} where id=$1`, [session.id]), /immutable/)
      }
      assert.equal((await f.profile()).total_xp, 11)
    })

    await t.test("profile-update failure rolls back session finish and its XP ledger", async () => {
      const f = await fixture()
      const session = await f.insert()
      await db.exec("reset role; revoke update on public.users from authenticated; set role authenticated")
      await assert.rejects(finish(session), /permission denied/)
      assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
      const current = await one("select * from public.sessions where id=$1", [session.id])
      assert.equal(current.status, "Playing")
      assert.equal(current.xp_awarded, 10)
      assert.equal((await f.profile()).total_xp, 10)
      await db.exec("reset role; grant update on public.users to authenticated; set role authenticated")
      await finish(session)
      assert.equal((await f.profile()).total_xp, 32)
    })

    await t.test("rollout: main's original 60-minute finish sequence awards 22 once, not twice", async () => {
      const f = await fixture()
      const session = await f.insert("Playing", 25)
      assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
      // Original main action first updates the profile, then the session ledger.
      await db.query("update public.users set total_xp=$2,level=1 where id=$1", [f.user, (await f.profile()).total_xp + 22])
      await db.query("update public.sessions set status='Finished',active=false,ended_at=now(),duration_minutes=60,xp_awarded=47 where id=$1", [session.id])
      assert.equal((await f.profile()).total_xp, 47)
      assert.equal((await one("select xp_awarded from public.sessions where id=$1", [session.id])).xp_awarded, 47)
    })

    await t.test("rollout: main's original create-session sequence does not gain an extra trigger award", async () => {
      const f = await fixture()
      const session = await one(
        "insert into public.sessions(user_id,game_id,status) values($1,$2,'LockedIn') returning *", [f.user, f.game],
      )
      await db.query("update public.users set total_xp=25,level=1 where id=$1", [f.user])
      await db.query("update public.sessions set xp_awarded=25 where id=$1", [session.id])
      assert.equal((await f.profile()).total_xp, 25)
    })

    await t.test("rollout: main's original finish-progress-profile beaten sequence awards 50 once", async () => {
      for (const existingProgress of [true, false]) {
        const f = await fixture()
        const session = await f.insert("Playing", 25)
        if (existingProgress) {
          await db.query("insert into public.game_progress(user_id,game_id,status) values($1,$2,'playing')", [f.user, f.game])
        }
        await db.query("update public.sessions set status='Finished',active=false,ended_at=now() where id=$1", [session.id])
        if (existingProgress) {
          await db.query("update public.game_progress set status='beaten',completed_at=now() where user_id=$1 and game_id=$2", [f.user, f.game])
        } else {
          await db.query("insert into public.game_progress(user_id,game_id,status) values($1,$2,'beaten')", [f.user, f.game])
        }
        await db.query("update public.users set total_xp=$2,level=1 where id=$1", [f.user, (await f.profile()).total_xp + 50])
        assert.equal((await f.profile()).total_xp, 75)
      }
    })

    await t.test("rollout: new atomic finish and beaten RPCs award once and restore the local gate", async () => {
      const f = await fixture()
      const session = await f.insert("Playing", 25)
      await finish(session)
      assert.equal((await f.profile()).total_xp, 47)
      await db.query("select * from public.set_standby_game_progress($1,'beaten',null)", [f.game])
      assert.equal((await f.profile()).total_xp, 97)
      await db.query("select * from public.set_standby_game_progress($1,'beaten','beaten')", [f.game])
      assert.equal((await f.profile()).total_xp, 97)
      assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
    })

    await t.test("rollout: legacy profile writes cannot leak duration XP into an untracked session", async () => {
      const f = await fixture()
      await f.recording(false)
      const session = await f.insert("Playing", 25)
      await assert.rejects(db.query("update public.users set total_xp=47 where id=$1", [f.user]), /Untracked session history.*Reload/)
      await db.query("update public.sessions set status='Finished',active=false,duration_minutes=60,paused_elapsed_seconds=3600,xp_awarded=47 where id=$1", [session.id])
      const finished = await one("select * from public.sessions where id=$1", [session.id])
      assert.equal(finished.duration_minutes, 0)
      assert.equal(finished.paused_elapsed_seconds, 0)
      assert.equal(finished.xp_awarded, 25)
      assert.equal((await f.profile()).total_xp, 25)
    })

    await t.test("rollout: delayed legacy duration XP stays blocked after untracked finish and later tracked play", async () => {
      const f = await fixture()
      await f.recording(false)
      const legacySnapshot = await f.insert("Playing", 25)
      // The legacy request read Playing before the new RPC finalized it.
      const finished = (await finish(legacySnapshot, 60)).rows[0]
      assert.equal(finished.duration_minutes, 0)
      assert.equal(finished.xp_awarded, 25)
      await assert.rejects(db.query(
        "update public.users set total_xp=$2 where id=$1", [f.user, (await f.profile()).total_xp + 22],
      ), /Untracked session history.*Reload/)
      await assert.rejects(db.query(
        "update public.sessions set status='Finished',active=false,ended_at=now(),duration_minutes=60,xp_awarded=47 where id=$1",
        [legacySnapshot.id],
      ), /immutable/)
      assert.equal((await f.profile()).total_xp, 25)
      const persisted = await one("select * from public.sessions where id=$1", [legacySnapshot.id])
      assert.equal(persisted.record_time, false)
      assert.equal(persisted.duration_minutes, 0)
      assert.equal(persisted.xp_awarded, 25)

      await f.recording(true)
      const tracked = await f.insert("Playing", 10)
      assert.equal(tracked.record_time, true)
      assert.equal((await f.profile()).total_xp, 35)
      await assert.rejects(db.query(
        "update public.users set total_xp=57 where id=$1", [f.user],
      ), /Untracked session history.*Reload/)
      await finish(tracked, 5)
      assert.equal((await f.profile()).total_xp, 36)
      await assert.rejects(db.query(
        "update public.users set total_xp=58 where id=$1", [f.user],
      ), /Untracked session history.*Reload/)
      assert.equal((await f.profile()).total_xp, 36)
    })

    await t.test("new backfill can restore non-duration XP while an untracked session is active", async () => {
      const f = await fixture()
      await f.recording(false)
      await f.insert("Playing", 0)
      await db.query("select public.backfill_standby_profile_xp(25,current_date)")
      assert.equal((await f.profile()).total_xp, 25)
      await db.query("select public.backfill_standby_profile_xp(50,current_date)")
      assert.equal((await f.profile()).total_xp, 25)
      assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
    })

    await t.test("beaten-vs-abandoned progress CAS has one winner; repeated beaten writes award once", async () => {
      const f = await fixture()
      await db.query("insert into public.game_progress(user_id,game_id,status) values($1,$2,'playing')", [f.user, f.game])
      const transition = (status) => db.query(
        "select * from public.set_standby_game_progress($1,$2,'playing')", [f.game, status],
      )
      const results = await Promise.all([transition("beaten"), transition("abandoned")])
      assert.deepEqual(results.map((r) => r.rows.length).sort(), [0, 1])
      const winner = results.find((r) => r.rows.length).rows[0]
      assert.equal((await f.profile()).total_xp, winner.status === "beaten" ? 50 : 0)
      await db.query("select * from public.set_standby_game_progress($1,'beaten',$2)", [f.game, winner.status])
      await db.query("update public.game_progress set status='beaten' where user_id=$1 and game_id=$2", [f.user, f.game])
      assert.equal((await f.profile()).total_xp, 50)
    })

    await t.test("session finalizers racing for beaten/abandon cannot both claim the same finish", async () => {
      const f = await fixture()
      const session = await f.insert()
      const finalizer = async () => {
        const result = await finish(session, 5)
        if (!result.rows.length) throw new Error("Session changed")
      }
      const results = await Promise.allSettled([finalizer(), finalizer()])
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
      assert.equal((await f.profile()).total_xp, 11)
    })

    await t.test("beaten insert awards once and recalculates the same XP level curve", async () => {
      const f = await fixture()
      await db.query("update public.users set total_xp=40 where id=$1", [f.user])
      await f.insert("LockedIn", 35)
      await db.query("select * from public.set_standby_game_progress($1,'beaten',null)", [f.game])
      assert.equal((await f.profile()).total_xp, 125)
      assert.equal((await f.profile()).level, 2)
    })

    await t.test("RLS hides another user's session and blocks cross-user inserts/updates", async () => {
      const owner = await fixture()
      const session = await owner.insert()
      const other = await fixture()
      assert.equal((await db.query("select * from public.sessions where id=$1", [session.id])).rows.length, 0)
      assert.equal((await finish(session)).rows.length, 0)
      await assert.rejects(db.query(
        "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [owner.user, other.game],
      ), /row-level security/)
      assert.equal((await other.profile()).total_xp, 0)
    })

    await t.test("RPCs require an authenticated user even when the SQL role has execute permission", async () => {
      await fixture()
      await db.query("select set_config('request.jwt.claim.sub','',false)")
      for (const sql of [
        "select * from public.create_standby_session('legacy',0)",
        "select * from public.transition_standby_session('00000000-0000-0000-0000-000000000001','{}','{}')",
        "select * from public.set_standby_game_progress('legacy','beaten',null)",
        "select public.backfill_standby_profile_xp(25,null)",
      ]) await assert.rejects(db.query(sql), /Not authenticated/)
    })

    await t.test("new020 RPCs on018+019 fail undefined-function before writes; ordinary reads and session exit still work", async () => {
      const f = await fixture()
      const before = await f.profile()
      for (const [sql, args] of [
        ["select * from public.create_standby_session_with_progress($1,25)", [f.game]],
        ["select * from public.create_standby_session_with_progress($1,0)", [f.game]],
        ["select * from public.complete_standby_game($1,'beaten',null::jsonb)", [f.game]],
        ["select * from public.complete_standby_game($1,'abandoned',null::jsonb)", [f.game]],
        ["select * from public.finish_standby_session_with_notes($1::uuid,'{}'::jsonb,'{\"status\":\"Finished\"}'::jsonb,'')", [f.user]],
      ]) {
        await assert.rejects(db.query(sql, args), (error) => error.code === "42883")
        assert.deepEqual(await f.profile(), before)
        assert.equal((await db.query("select * from public.sessions where user_id=$1", [f.user])).rows.length, 0)
        assert.equal((await db.query("select * from public.game_progress where user_id=$1", [f.user])).rows.length, 0)
      }
      const existing = await f.insert()
      await assert.rejects(db.query(
        "select * from public.finish_standby_session_with_notes($1,$2::jsonb,$3::jsonb,'')",
        [existing.id, JSON.stringify(existing), JSON.stringify({ status: "Finished", duration_minutes: 0 })],
      ), (error) => error.code === "42883")
      assert.deepEqual(await one("select * from public.sessions where id=$1", [existing.id]), existing)
      assert.equal((await f.profile()).total_xp, 10)
      assert.equal((await finish(existing, 5)).rows[0].status, "Finished")
      assert.equal((await f.profile()).total_xp, 11)
    })

    // Upgrade the populated 018/019 fixture, rather than testing only fresh020.
    await db.exec("reset role")
    const before020 = await one(`select count(*) as sessions,sum(xp_awarded) as ledger,
      (select sum(total_xp) from public.users) as profile_xp from public.sessions`)
    const baselineSignatures = [...rpcSignatures,
      "public.enforce_standby_session()", "public.award_standby_xp()", "public.protect_untracked_profile_xp()"]
    const originalRPCs = await db.query(
      "select oid::regprocedure::text as signature,pg_get_functiondef(oid) as definition,proacl::text as acl from pg_proc where oid=any($1::regprocedure[]) order by 1",
      [baselineSignatures],
    )
    await db.exec(migration("019_restrict_standby_rpc_execute.sql"))
    const preflight = await db.exec(approval020SQL)
    assert.equal(preflight.flatMap((r) => r.rows ?? []).filter((r) => r.new020 && r.present).length, 0)
    await db.exec(migration("020_atomic_standby_game_completion.sql"))
    const postflight = await db.exec(approval020SQL)
    assert.equal(postflight.flatMap((r) => r.rows ?? []).filter((r) => r.new020 && r.present).length, 5)
    creationRPC = "create_standby_session_with_progress"
    const complete = (game, status, expected, notes) => db.query(
      notes === undefined ? "select * from public.complete_standby_game($1,$2,$3::jsonb)"
        : "select * from public.complete_standby_game($1,$2,$3::jsonb,$4)",
      [game, status, expected === null ? null : JSON.stringify(expected), ...(notes === undefined ? [] : [notes])],
    )
    const finishWithNotes = (snapshot, notes, minutes = 60) => db.query(
      "select * from public.finish_standby_session_with_notes($1,$2::jsonb,$3::jsonb,$4)",
      [snapshot.id, JSON.stringify(snapshot), JSON.stringify({
        status: "Finished", ended_at: new Date().toISOString(),
        duration_minutes: minutes, paused_elapsed_seconds: minutes * 60,
      }), notes],
    )
    const displayed = (s) => ({
      id: s.id, status: s.status, started_at: s.started_at,
      paused_elapsed_seconds: s.paused_elapsed_seconds,
    })

    await t.test("020 upgrades populated018+019 without changing history or seven018 function bodies/ACLs", async () => {
      assert.deepEqual(await one(`select count(*) as sessions,sum(xp_awarded) as ledger,
        (select sum(total_xp) from public.users) as profile_xp from public.sessions`), before020)
      assert.deepEqual((await db.query(
        "select oid::regprocedure::text as signature,pg_get_functiondef(oid) as definition,proacl::text as acl from pg_proc where oid=any($1::regprocedure[]) order by 1",
        [baselineSignatures],
      )).rows, originalRPCs.rows)
      assert.equal(originalRPCs.rows.length, 7)
      assert.equal((await one("select to_regprocedure('public.complete_standby_game(text,text,jsonb)') as old_signature")).old_signature, null)
      rpcSignatures.push("public.complete_standby_game(text,text,jsonb,text)", "public.create_standby_session_with_progress(text,integer)",
        "public.finish_standby_session_with_notes(uuid,jsonb,jsonb,text)")
      await assertRestrictedRPCs()
      const metadata = await one(`select prosecdef,proconfig from pg_proc
        where oid='public.complete_standby_game(text,text,jsonb,text)'::regprocedure`)
      assert.equal(metadata.prosecdef, false)
      assert.ok(metadata.proconfig.includes("search_path=public"))
      const locks = await db.query(`select c.relname,t.tgtype,t.tgenabled,pg_get_triggerdef(t.oid) as definition
        from pg_trigger t join pg_class c on c.oid=t.tgrelid
        where t.tgname='standby_account_lock' and c.relnamespace='public'::regnamespace`)
      assert.equal(locks.rows.length, 3)
      for (const row of locks.rows) {
        assert.equal(row.tgenabled, "O")
        assert.match(row.definition, /BEFORE/)
        assert.match(row.definition, /FOR EACH STATEMENT/)
        assert.match(row.definition, /lock_standby_account_statement/)
      }
    })

    await t.test("020 final draft wins a committed lost-response write or late older execution after a newer ACK", async () => {
      for (const order of ["committed-response-lost", "late-after-overwrite-ack"]) {
        for (const recording of [true, false]) {
          for (const notes of ["", "final draft"]) {
            const f = await fixture()
            await f.recording(recording)
            const s = await f.insert()
            await db.query("update public.sessions set notes='' where id=$1", [s.id])
            const snapshot = await one("select * from public.sessions where id=$1", [s.id])
            if (order === "late-after-overwrite-ack") {
              // The newer overwrite has ACKed while the older request has not
              // yet executed SQL. Its unknown execution arrives next.
              await db.query("update public.sessions set notes=$2 where id=$1", [s.id, notes])
            }
            await db.query("update public.sessions set notes='text to remove' where id=$1", [s.id])
            const ended = (await finishWithNotes(snapshot, notes)).rows[0]
            assert.equal(ended.notes, notes)
            assert.equal(ended.status, "Finished")
            assert.equal(ended.duration_minutes, recording ? 60 : 0)
            assert.equal(ended.paused_elapsed_seconds, recording ? 3600 : 0)
            assert.equal((await f.profile()).total_xp, recording ? 32 : 10)
            await assert.rejects(db.query("update public.sessions set notes='late older request' where id=$1", [s.id]), /immutable/)
            assert.equal((await db.query("update public.sessions set notes='late' where id=$1 and active=true returning *", [s.id])).rows.length, 0)
            assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, notes)
          }
        }
      }
    })

    await t.test("020 stale finalization rolls back its draft update and leaves session/profile unchanged", async () => {
      const f = await fixture()
      const s = await f.insert()
      await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=120,notes='remote draft' where id=$1", [s.id])
      const before = await one("select * from public.sessions where id=$1", [s.id])
      await assert.rejects(finishWithNotes(s, "stale final draft"), /Session changed/)
      assert.deepEqual(await one("select * from public.sessions where id=$1", [s.id]), before)
      assert.equal((await f.profile()).total_xp, 10)
      assert.equal((await finishWithNotes(before, "", 5)).rows[0].notes, "")
      assert.equal((await f.profile()).total_xp, 11)
    })

    await t.test("020 XP failure rolls back the final draft as well as session finish and duration award", async () => {
      const f = await fixture()
      const s = await f.insert()
      await db.query("update public.sessions set notes='acknowledged' where id=$1", [s.id])
      const before = await one("select * from public.sessions where id=$1", [s.id])
      await db.exec("reset role; revoke update on public.users from authenticated; set role authenticated")
      try {
        await assert.rejects(finishWithNotes(before, ""), /permission denied/)
        assert.deepEqual(await one("select * from public.sessions where id=$1", [s.id]), before)
        assert.equal((await f.profile()).total_xp, 10)
      } finally {
        await db.exec("reset role; grant update on public.users to authenticated; set role authenticated")
      }
      assert.equal((await finishWithNotes(before, "")).rows[0].notes, "")
      assert.equal((await f.profile()).total_xp, 32)
    })

    await t.test("020 final notes require nonnull text and Finished status without weakening018 transitions", async () => {
      const f = await fixture()
      const s = await f.insert()
      await assert.rejects(finishWithNotes(s, null), /Final notes.*Finished/)
      await assert.rejects(db.query(
        "select * from public.finish_standby_session_with_notes($1,$2::jsonb,'{\"status\":\"Paused\"}'::jsonb,'')",
        [s.id, JSON.stringify(s)],
      ), /Final notes.*Finished/)
      assert.deepEqual(await one("select * from public.sessions where id=$1", [s.id]), s)
      assert.equal((await f.profile()).total_xp, 10)
    })

    await t.test("020 final drafts sharing a snapshot have one finish winner and one duration award", async () => {
      const f = await fixture()
      const s = await f.insert()
      const results = await Promise.allSettled([finishWithNotes(s, "first draft"), finishWithNotes(s, "second draft")])
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
      const winner = results.find((r) => r.status === "fulfilled").value.rows[0]
      assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, winner.notes)
      assert.equal((await f.profile()).total_xp, 32)
    })

    await t.test("020 main b0 create/bookkeeping/profile and finish/progress/profile sequences remain usable", async () => {
      // Mirrors b0ecead app/actions.ts, including all existing-progress branches.
      for (const previous of [null, "playing", "beaten", "abandoned"]) {
        for (const terminal of ["beaten", "abandoned"]) {
          const f = await fixture()
          if (previous) await db.query(
            "insert into public.game_progress(user_id,game_id,status,total_sessions) values($1,$2,$3,3)",
            [f.user, f.game, previous],
          )
          const s = await one(
            "insert into public.sessions(user_id,game_id,status,active) values($1,$2,'LockedIn',true) returning *",
            [f.user, f.game],
          )
          const progress = await one("select * from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])
          if (!progress) {
            await db.query(
              "insert into public.game_progress(user_id,game_id,status,total_sessions,total_time_minutes) values($1,$2,'playing',1,0)",
              [f.user, f.game],
            )
          } else if (progress.status !== "playing") {
            await db.query("update public.game_progress set status='playing',total_sessions=$2 where id=$1", [progress.id, progress.total_sessions + 1])
          } else {
            await db.query("update public.game_progress set total_sessions=$2 where id=$1", [progress.id, progress.total_sessions + 1])
          }
          const startXP = previous ? 10 : 25
          await db.query("update public.users set total_xp=$2,level=1,last_session_date=current_date where id=$1",
            [f.user, (await f.profile()).total_xp + startXP])
          await db.query("update public.sessions set xp_awarded=$2 where id=$1", [s.id, startXP])
          assert.equal((await f.profile()).total_xp, startXP)
          assert.equal((await one("select total_sessions from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])).total_sessions, previous ? 4 : 1)
          await db.query("update public.sessions set active=false,status='Finished',ended_at=now() where user_id=$1 and game_id=$2 and active=true", [f.user, f.game])
          await db.query("update public.game_progress set status=$2,completed_at=case when $2='beaten' then now() else completed_at end where user_id=$1", [f.user, terminal])
          if (terminal === "beaten") await db.query("update public.users set total_xp=$2,level=1 where id=$1",
            [f.user, (await f.profile()).total_xp + 50])
          assert.equal((await f.profile()).total_xp, startXP + (terminal === "beaten" ? 50 : 0))
          assert.equal((await one("select * from public.sessions where id=$1", [s.id])).active, false)
          assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
        }
      }
    })

    await t.test("020 main duration finish awards 22 once and later raw beaten bookkeeping adds exactly 50", async () => {
      const f = await fixture()
      const s = await one("insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing') returning *", [f.user, f.game])
      await db.query("insert into public.game_progress(user_id,game_id,status,total_sessions) values($1,$2,'playing',1)", [f.user, f.game])
      await db.query("update public.users set total_xp=25,level=1 where id=$1", [f.user])
      await db.query("update public.sessions set xp_awarded=25 where id=$1", [s.id])
      // Main's ordinary duration finish increments profile BEFORE the session.
      await db.query("update public.users set total_xp=$2,level=1 where id=$1", [f.user, (await f.profile()).total_xp + 22])
      await db.query("update public.sessions set status='Finished',active=false,ended_at=now(),duration_minutes=60,xp_awarded=47 where id=$1", [s.id])
      assert.equal((await f.profile()).total_xp, 47)
      assert.equal((await one("select xp_awarded from public.sessions where id=$1", [s.id])).xp_awarded, 47)
      await db.query("update public.game_progress set status='beaten',completed_at=now() where user_id=$1", [f.user])
      await db.query("update public.users set total_xp=$2,level=1 where id=$1", [f.user, (await f.profile()).total_xp + 50])
      assert.equal((await f.profile()).total_xp, 97)
    })

    await t.test("020 main terminal progress INSERT after a session-only legacy start remains usable", async () => {
      for (const status of ["beaten", "abandoned"]) {
        const f = await fixture()
        await db.query("insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [f.user, f.game])
        await db.query("update public.sessions set active=false,status='Finished',ended_at=now() where user_id=$1 and game_id=$2 and active=true", [f.user, f.game])
        await db.query(
          "insert into public.game_progress(user_id,game_id,status,total_sessions,total_time_minutes,completed_at) values($1,$2,$3,$4,0,case when $3='beaten' then now() else null end)",
          [f.user, f.game, status, status === "beaten" ? 1 : 0],
        )
        if (status === "beaten") await db.query("update public.users set total_xp=$2,level=1 where id=$1",
          [f.user, (await f.profile()).total_xp + 50])
        assert.equal((await f.profile()).total_xp, status === "beaten" ? 50 : 0)
      }
    })

    await t.test("020 existing018 creator plus separate bookkeeping does not double-count sessions or XP", async () => {
      const f = await fixture()
      const first = await one("select * from public.create_standby_session($1,25)", [f.game])
      assert.equal(await one("select * from public.game_progress where user_id=$1", [f.user]), undefined)
      await db.query("insert into public.game_progress(user_id,game_id,status,total_sessions) values($1,$2,'playing',1)", [f.user, f.game])
      await db.query("update public.users set last_session_date=current_date where id=$1", [f.user])
      assert.equal((await f.profile()).total_xp, 25)
      await finish(first, 0)
      await db.query("select * from public.set_standby_game_progress($1,'beaten','playing')", [f.game])
      assert.equal((await f.profile()).total_xp, 75)
      const second = await one("select * from public.create_standby_session($1,10)", [f.game])
      await db.query("update public.game_progress set status='playing',total_sessions=total_sessions+1 where user_id=$1", [f.user])
      assert.equal((await one("select total_sessions from public.game_progress where user_id=$1", [f.user])).total_sessions, 2)
      assert.equal((await f.profile()).total_xp, 85)
      await finish(second, 0)
      await complete(f.game, "beaten", null)
      await f.insert("LockedIn")
      assert.equal((await one("select total_sessions from public.game_progress where user_id=$1", [f.user])).total_sessions, 3)
      assert.equal((await f.profile()).total_xp, 145)
    })

    await t.test("020 zero-XP atomic creation keeps session-only semantics and snapshots recording", async () => {
      const f = await fixture()
      await f.recording(false)
      const before = await f.profile()
      const created = await one("select * from public.create_standby_session_with_progress($1,0)", [f.game])
      assert.equal(created.record_time, false)
      assert.equal(created.xp_awarded, 0)
      assert.deepEqual(await f.profile(), before)
      assert.equal(await one("select * from public.game_progress where user_id=$1", [f.user]), undefined)
      await complete(f.game, "abandoned", displayed(created))
      assert.equal((await f.profile()).total_xp, 0)
    })

    await t.test("020 stale legacy terminal writes reject a replacement committed after their separate finish", async () => {
      for (const status of ["beaten", "abandoned"]) {
        for (const creator of ["atomic", "018", "direct"]) {
          const f = await fixture()
          const old = await f.insert()
          const read = await one("select * from public.game_progress where user_id=$1", [f.user])
          await finish(old, 0)
          const remote = creator === "atomic" ? await f.insert() : creator === "018"
            ? await one("select * from public.create_standby_session($1,10)", [f.game])
            : await one("insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing') returning *", [f.user, f.game])
          const xp = (await f.profile()).total_xp
          await assert.rejects(db.query("select * from public.set_standby_game_progress($1,$2,$3)", [f.game, status, read.status]), /Active session exists/)
          await assert.rejects(db.query("update public.game_progress set status=$2 where id=$1", [read.id, status]), /Active session exists/)
          assert.equal((await one("select active from public.sessions where id=$1", [remote.id])).active, true)
          assert.equal((await one("select status from public.game_progress where id=$1", [read.id])).status, "playing")
          assert.equal((await f.profile()).total_xp, xp)
        }
      }
    })

    await t.test("020 null assertion rejects a remote committed RPC/direct insert after the caller read no session", async () => {
      for (const status of ["beaten", "abandoned"]) {
        for (const creator of ["rpc", "018-rpc", "legacy-direct"]) {
          const f = await fixture()
          const read = await db.query("select * from public.sessions where user_id=$1 and game_id=$2 and active=true", [f.user, f.game])
          assert.equal(read.rows.length, 0)
          const remote = creator !== "legacy-direct"
            ? await f.insert("Playing", 10, creator === "rpc" ? creationRPC : "create_standby_session") : await one(
            "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing') returning *", [f.user, f.game],
          )
          const xp = (await f.profile()).total_xp
          await assert.rejects(complete(f.game, status, null), /Session changed/)
          const retained = await one("select * from public.sessions where id=$1", [remote.id])
          assert.equal(retained.active, true)
          assert.equal(retained.status, "Playing")
          assert.equal((await f.profile()).total_xp, xp)
          const progress = await one("select * from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])
          assert.equal(progress?.status ?? null, creator === "rpc" ? "playing" : null)
        }
      }
    })

    await t.test("020 displayed snapshot rejects a committed replacement created after the caller read the old session", async () => {
      for (const status of ["beaten", "abandoned"]) {
        for (const creator of ["rpc", "018-rpc", "legacy-direct"]) {
          const f = await fixture()
          const original = await f.insert()
          const callerRead = await one("select * from public.sessions where id=$1", [original.id])
          await finish(original, 5)
          const replacement = creator !== "legacy-direct"
            ? await f.insert("Playing", 10, creator === "rpc" ? creationRPC : "create_standby_session") : await one(
            "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing') returning *", [f.user, f.game],
          )
          const xp = (await f.profile()).total_xp
          await assert.rejects(complete(f.game, status, displayed(callerRead)), /Session changed/)
          assert.equal((await one("select * from public.sessions where id=$1", [replacement.id])).active, true)
          assert.equal((await one("select * from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])).status, "playing")
          assert.equal((await f.profile()).total_xp, xp)
          await assert.rejects(db.query("update public.sessions set status='Playing',active=true where id=$1", [original.id]), /immutable/)
        }
      }
    })

    await t.test("020 displayed snapshot rejects pause/resume changes to the same ID after the caller read", async () => {
      for (const status of ["beaten", "abandoned"]) {
        const f = await fixture()
        const read = await f.insert()
        await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=120 where id=$1", [read.id])
        await db.query("update public.sessions set status='Playing',started_at=started_at+interval '10 minutes' where id=$1", [read.id])
        await assert.rejects(complete(f.game, status, displayed(read)), /Session changed/)
        assert.equal((await f.profile()).total_xp, 10)
        assert.equal((await one("select active from public.sessions where id=$1", [read.id])).active, true)
      }
    })

    await t.test("020 no-session assertion succeeds when still absent and repeated status awards once", async () => {
      for (const status of ["beaten", "abandoned"]) {
        const f = await fixture()
        assert.equal((await complete(f.game, status, null)).rows[0].status, status)
        await complete(f.game, status, null)
        assert.equal((await f.profile()).total_xp, status === "beaten" ? 50 : 0)
      }
    })

    await t.test("020 both game endings atomically commit final drafts, duration, progress and XP including opt-out", async () => {
      for (const status of ["beaten", "abandoned"]) {
        for (const recording of [true, false]) {
          for (const notes of ["", "final draft"]) {
            const f = await fixture()
            await f.recording(recording)
            const s = await f.insert()
            await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=3600 where id=$1", [s.id])
            const paused = await one("select * from public.sessions where id=$1", [s.id])
            await db.query("update public.sessions set notes='late older draft' where id=$1", [s.id])
            const result = await complete(f.game, status, displayed(paused), notes)
            assert.equal(result.rows[0].status, status)
            const ended = await one("select * from public.sessions where id=$1", [s.id])
            assert.equal(ended.status, "Finished")
            assert.equal(ended.active, false)
            assert.equal(ended.duration_minutes, recording ? 60 : 0)
            assert.equal(ended.paused_elapsed_seconds, recording ? 3600 : 0)
            assert.equal(ended.xp_awarded, recording ? 32 : 10)
            assert.equal(ended.notes, notes)
            assert.equal((await f.profile()).total_xp, (recording ? 32 : 10) + (status === "beaten" ? 50 : 0))
            await assert.rejects(complete(f.game, status, displayed(paused), "stale final draft"), /Session changed/)
            await assert.rejects(db.query("update public.sessions set notes='late flush' where id=$1", [s.id]), /immutable/)
            assert.notEqual((await one("select current_setting('just_play.atomic_xp',true) as flag")).flag, "standby_v1")
            assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, notes)
          }
        }
      }
    })

    await t.test("020 omitted or null final notes preserve stored notes and no-session callers cannot rewrite finished notes", async () => {
      for (const notes of [undefined, null]) {
        for (const stored of ["stored draft", null]) {
          const f = await fixture()
          const s = await f.insert()
          await db.query("update public.sessions set notes=$2 where id=$1", [s.id, stored])
          await complete(f.game, "beaten", displayed(s), notes)
          assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, stored)
          await complete(f.game, "abandoned", null, "must not replace historical notes")
          assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, stored)
          assert.equal((await f.profile()).total_xp, 60)
        }
      }
    })

    await t.test("020 beaten/abandon final drafts sharing a displayed snapshot cannot both finalize or award", async () => {
      const f = await fixture()
      const s = await f.insert()
      await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=3600 where id=$1", [s.id])
      const paused = await one("select * from public.sessions where id=$1", [s.id])
      const results = await Promise.allSettled([
        complete(f.game, "beaten", displayed(paused), "beaten draft"),
        complete(f.game, "abandoned", displayed(paused), "abandoned draft"),
      ])
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
      const winner = results.find((r) => r.status === "fulfilled").value.rows[0]
      const ended = await one("select * from public.sessions where id=$1", [s.id])
      assert.equal(ended.notes, `${winner.status} draft`)
      assert.equal((await f.profile()).total_xp, 32 + (winner.status === "beaten" ? 50 : 0))
    })

    await t.test("020 LockedIn completion never counts waiting; undefined/latest deliberately targets current session", async () => {
      const f = await fixture()
      const locked = await f.insert("LockedIn")
      await db.query("update public.sessions set started_at=started_at-interval '2 hours' where id=$1", [locked.id])
      await complete(f.game, "beaten", { mode: "latest" }, "")
      const ended = await one("select * from public.sessions where id=$1", [locked.id])
      assert.equal(ended.duration_minutes, 0)
      assert.equal(ended.paused_elapsed_seconds, 0)
      assert.equal(ended.notes, "")
      assert.equal(ended.xp_awarded, 10)
      assert.equal((await f.profile()).total_xp, 60)
      await complete(f.game, "beaten", { mode: "latest" })
      assert.equal((await f.profile()).total_xp, 60)
    })

    await t.test("020 progress failure rolls back already-calculated session finish and duration XP", async () => {
      const f = await fixture()
      const s = await f.insert()
      await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=3600,notes='before' where id=$1", [s.id])
      const paused = await one("select * from public.sessions where id=$1", [s.id])
      await db.exec("reset role; revoke update on public.game_progress from authenticated; set role authenticated")
      try {
        await assert.rejects(complete(f.game, "beaten", displayed(paused), "final draft"), /permission denied/)
        assert.deepEqual(await one("select * from public.sessions where id=$1", [s.id]), paused)
        assert.equal((await f.profile()).total_xp, 10)
        assert.equal((await one("select status from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])).status, "playing")
      } finally {
        await db.exec("reset role; grant update on public.game_progress to authenticated; set role authenticated")
      }
      await complete(f.game, "beaten", displayed(paused), "final draft")
      assert.equal((await f.profile()).total_xp, 82)
      assert.equal((await one("select notes from public.sessions where id=$1", [s.id])).notes, "final draft")
    })

    await t.test("020 creation bookkeeping failure rolls back inserted session and its start XP", async () => {
      const f = await fixture()
      await db.exec("reset role; revoke insert on public.game_progress from authenticated; set role authenticated")
      try {
        await assert.rejects(f.insert(), /permission denied/)
        assert.equal((await f.profile()).total_xp, 0)
        assert.equal((await db.query("select * from public.sessions where user_id=$1", [f.user])).rows.length, 0)
      } finally {
        await db.exec("reset role; grant insert on public.game_progress to authenticated; set role authenticated")
      }
      await f.insert()
      assert.equal((await f.profile()).total_xp, 10)
      assert.equal((await one("select total_sessions from public.game_progress where user_id=$1 and game_id=$2", [f.user, f.game])).total_sessions, 1)
    })

    await t.test("020 legacy RPC/direct writes reject terminal progress only while a same-game session is active", async () => {
      for (const status of ["beaten", "abandoned"]) {
        const f = await fixture()
        const s = await f.insert()
        await db.query("update public.game_progress set total_sessions=2 where user_id=$1", [f.user])
        for (const [sql, args] of [
          ["select * from public.set_standby_game_progress($1,$2,'playing')", [f.game, status]],
          ["update public.game_progress set status=$2 where user_id=$1", [f.user, status]],
          ["insert into public.game_progress(user_id,game_id,status) values($1,$2,$3)", [f.user, f.game, status]],
        ]) await assert.rejects(db.query(sql, args), /Active session exists/)
        assert.equal((await one("select active from public.sessions where id=$1", [s.id])).active, true)
        assert.equal((await f.profile()).total_xp, 10)
        await finish(s, 0)
        assert.equal((await db.query("select * from public.set_standby_game_progress($1,$2,'playing')", [f.game, status])).rows.length, 1)
        assert.equal((await f.profile()).total_xp, status === "beaten" ? 60 : 10)
        assert.equal((await db.query("select * from public.set_standby_game_progress($1,$2,'playing')", [f.game, status])).rows.length, 0)
        await db.query("select * from public.set_standby_game_progress($1,$2,$2)", [f.game, status])
        assert.equal((await f.profile()).total_xp, status === "beaten" ? 60 : 10)
      }
    })

    await t.test("020 direct inserts/profile updates hold the same account advisory lock before row writes", async () => {
      const f = await fixture()
      for (const sql of [
        "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')",
        "update public.users set total_xp=total_xp where id=$1",
      ]) {
        await db.exec("begin")
        try {
          await db.query(sql, sql.startsWith("insert") ? [f.user, f.game] : [f.user])
          const locks = await one(`select count(*)::integer as count from pg_locks
            where locktype='advisory' and pid=pg_backend_pid() and granted`)
          assert.equal(locks.count, 2)
        } finally {
          await db.exec("rollback")
        }
      }
    })

    await t.test("020 no-UID privileged DML takes an exclusive fence; RLS and mismatched-owner checks remain", async () => {
      const f = await fixture()
      await db.exec("reset role")
      await db.query("select set_config('request.jwt.claim.sub','',false)")
      await db.exec("begin")
      try {
        await db.query("insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [f.user, f.game])
        const locks = await db.query(`select mode from pg_locks
          where locktype='advisory' and pid=pg_backend_pid() and granted`)
        assert.deepEqual(locks.rows, [{ mode: "ExclusiveLock" }])
      } finally {
        await db.exec("rollback")
      }
      await db.exec("set role authenticated")
      await assert.rejects(db.query(
        "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [f.user, f.game],
      ), /row-level security|Authenticated account context required/)
      await db.exec("reset role")
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", ["99999999-0000-0000-0000-000000000001"])
      await assert.rejects(db.query(
        "insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [f.user, f.game],
      ), /match the authenticated account/)
    })

    await t.test("020 rejects repeatable-read snapshots rather than reading stale absence after an account-lock wait", async () => {
      const f = await fixture()
      for (const mutation of [
        () => complete(f.game, "beaten", null),
        () => finishWithNotes({ id: f.user }, ""),
        () => f.insert(),
        () => db.query("select * from public.create_standby_session($1,0)", [f.game]),
        () => db.query("insert into public.sessions(user_id,game_id,status) values($1,$2,'Playing')", [f.user, f.game]),
        () => db.query("update public.users set total_xp=total_xp where id=$1", [f.user]),
        () => db.query("insert into public.game_progress(user_id,game_id,status) values($1,$2,'playing')", [f.user, f.game]),
        () => db.query("select * from public.set_standby_game_progress($1,'beaten',null)", [f.game]),
      ]) {
        await db.exec("begin isolation level repeatable read")
        try {
          await db.query("select * from public.sessions where user_id=$1", [f.user])
          await assert.rejects(mutation(), /require READ COMMITTED/)
        } finally {
          await db.exec("rollback")
        }
      }
      assert.equal((await f.profile()).total_xp, 0)
      assert.equal((await db.query("select * from public.sessions where user_id=$1", [f.user])).rows.length, 0)
    })

    await t.test("020 retains the delayed legacy opt-out XP barrier after finish and later tracked creation", async () => {
      const f = await fixture()
      await f.recording(false)
      const old = await f.insert("Playing", 25)
      await complete(f.game, "abandoned", displayed(old))
      await assert.rejects(db.query("update public.users set total_xp=47 where id=$1", [f.user]), /Untracked session history/)
      await assert.rejects(db.query("update public.sessions set duration_minutes=60,paused_elapsed_seconds=3600 where id=$1", [old.id]), /immutable/)
      const ended = await one("select * from public.sessions where id=$1", [old.id])
      assert.equal(ended.duration_minutes, 0)
      assert.equal(ended.paused_elapsed_seconds, 0)
      assert.equal(ended.xp_awarded, 25)
      await f.recording(true)
      const tracked = await f.insert("Playing", 10)
      assert.equal((await f.profile()).total_xp, 35)
      await assert.rejects(db.query("update public.users set total_xp=57 where id=$1", [f.user]), /Untracked session history/)
      await finish(tracked, 5)
      assert.equal((await f.profile()).total_xp, 36)
    })

    await t.test("020 keeps auth/RLS, anon denial, stale snapshot validation and history XP barrier", async () => {
      const owner = await fixture()
      await owner.recording(false)
      const s = await owner.insert()
      await complete(owner.game, "abandoned", displayed(s))
      await assert.rejects(db.query("update public.users set total_xp=32 where id=$1", [owner.user]), /Untracked session history/)
      const other = await fixture()
      await assert.rejects(complete(owner.game, "beaten", displayed(s)), /Session changed/)
      await assert.rejects(finishWithNotes(s, "other account"), /Session changed/)
      await assert.rejects(complete(other.game, "beaten", {}), /Full displayed session snapshot/)
      await db.query("select set_config('request.jwt.claim.sub','',false)")
      await assert.rejects(complete(other.game, "beaten", null), /Not authenticated/)
      await assert.rejects(finishWithNotes(s, ""), /Not authenticated/)
      await assert.rejects(db.query("select * from public.create_standby_session_with_progress($1,0)", [other.game]), /Not authenticated/)
      await db.exec("reset role; set role anon")
      try {
        await assert.rejects(complete(other.game, "beaten", null), /permission denied/)
        await assert.rejects(finishWithNotes(s, ""), /permission denied/)
        await assert.rejects(db.query("select * from public.create_standby_session_with_progress($1,0)", [other.game]), /permission denied/)
      } finally {
        await db.exec("reset role")
      }
      await assertRestrictedRPCs()
    })
  } finally {
    await db.close()
  }
})
