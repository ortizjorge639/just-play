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
// markGameBeaten/abandonGame finalize via session CAS, then separately CAS progress.
// Those two statements are NOT one transaction: a progress failure can leave a
// finished session with unchanged progress. The actions test verifies CAS losers
// stop before progress, and this test verifies each database mutation's effects.
// Rollout: old clients with any untracked-session history must reload. The direct
// profile-increment barrier remains after finish and during later tracked sessions.
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
      insert: async (status = "Playing", xp = 10) => {
        const created = await one("select * from public.create_standby_session($1,$2)", [game, xp])
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
  } finally {
    await db.close()
  }
})
