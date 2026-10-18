// Run: node --test scripts\standby-actions.test.mjs
// Uses the existing TypeScript dependency to execute real server-action code with
// mocked Supabase/Next boundaries. PostgreSQL triggers are covered separately by
// standby-migration.test.mjs; this is not a Next.js/PostgREST integration test.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { compileFunction } from "node:vm"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
function fixture(responses, authenticated = true) {
  const calls = []
  const invalidations = []
  const queue = [...responses]
  const supabase = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: "user" } : null } }) },
    rpc(name, args) {
      const table = name === "set_standby_game_progress" ? "game_progress" :
        name === "backfill_standby_profile_xp" ? "users" : "sessions"
      const query = this.from(table)
      Object.assign(calls.at(-1), { rpc: name, args })
      return query
    },
    from(table) {
      const call = { table, methods: [] }
      calls.push(call)
      const execute = () => {
        assert.ok(queue.length, `Unexpected ${table} query`)
        return Promise.resolve(queue.shift())
      }
      const query = {
        then(resolve, reject) { return execute().then(resolve, reject) },
        single: execute,
        maybeSingle: execute,
      }
      for (const method of ["select", "update", "insert", "eq", "neq", "is", "order", "limit", "returns"]) {
        query[method] = (...args) => {
          call.methods.push([method, ...args])
          return query
        }
      }
      return query
    },
  }
  const modules = new Map()
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename)
    const loaded = { exports: {} }
    modules.set(filename, loaded.exports)
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: filename,
    })
    const resolve = (specifier) => {
      if (specifier === "@/lib/supabase/server") return { createClient: async () => supabase }
      if (specifier === "next/cache") return { revalidatePath: (url) => invalidations.push(url) }
      if (specifier.startsWith("@/")) return load(path.join(root, `${specifier.slice(2)}.ts`))
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`))
      throw new Error(`Unexpected server-action dependency: ${specifier}`)
    }
    compileFunction(outputText, ["require", "module", "exports"], { filename })(resolve, loaded, loaded.exports)
    return loaded.exports
  }
  return {
    actions: load(path.join(root, "app", "actions.ts")), calls, invalidations,
    done: () => assert.equal(queue.length, 0, "All expected queries must run"),
  }
}
const ok = (data = null) => ({ data, error: null })
const session = {
  id: "session", user_id: "user", game_id: "game", status: "Playing", active: true,
  started_at: "2026-10-17T10:00:00.000Z", ended_at: null,
  paused_elapsed_seconds: 120, duration_minutes: 0, record_time: true, xp_awarded: 10,
}
const payload = (call) => call.args?.p_updates ??
  (call.rpc === "backfill_standby_profile_xp" ? { total_xp: call.args.p_total_xp } :
  call.rpc === "set_standby_game_progress" ? { status: call.args.p_status } :
    call.methods.find(([method]) => method === "update")?.[1])

test("getUser select * preserves discovery and exposes dedicated StandBy preferences", async () => {
  const profile = { id: "user", preferences: { mood: "chill" }, standby_preferences: {
    record_time: false, show_clock: true, reminders: false, keep_awake: false,
  } }
  const f = fixture([ok(profile)])
  assert.deepEqual(await f.actions.getUser(), profile)
  assert.deepEqual(f.calls[0].methods[0], ["select", "*"])
  f.done()
})

test("StandBy save requires authenticated full booleans and updates only its dedicated column", async () => {
  const f = fixture([ok({ id: "user" })])
  const prefs = { record_time: false, show_clock: false, reminders: true, keep_awake: true }
  await assert.rejects(f.actions.saveStandbyPreferences({ record_time: true }), /show_clock must be a boolean/)
  await f.actions.saveStandbyPreferences(prefs)
  assert.deepEqual(payload(f.calls[0]), { standby_preferences: prefs })
  assert.deepEqual(f.invalidations, ["/"])
  f.done()
  const unauthenticated = fixture([], false)
  await assert.rejects(unauthenticated.actions.saveStandbyPreferences(prefs), /Not authenticated/)
})

test("both creation actions use the gated RPC; the database snapshots recording at insertion", async () => {
  const created = { ...session, status: "LockedIn", record_time: false }
  const start = fixture([ok(null), ok(created)])
  assert.deepEqual(await start.actions.startSessionForGame("game"), created)
  const create = fixture([
    ok(null), ok(null), ok({ last_session_date: null }), ok(created),
    ok(), ok(), ok([]),
  ])
  assert.deepEqual((await create.actions.createSession("game")).session, created)
  for (const [f, startXP] of [[start, 0], [create, 25]]) {
    const inserted = f.calls.find((call) => call.rpc === "create_standby_session")
    assert.deepEqual(inserted.args, { p_game_id: "game", p_start_xp: startXP })
    f.done()
  }
})

test("status update uses the full timing/state CAS and returns the authoritative DB row", async () => {
  const authoritative = { ...session, status: "Paused", paused_elapsed_seconds: 999 }
  const f = fixture([ok(session), ok(authoritative)])
  const result = await f.actions.updateSessionStatus("session", "Paused", session)
  assert.deepEqual(result, { session: authoritative, xpAwarded: null })
  assert.equal(f.calls[1].rpc, "transition_standby_session")
  assert.equal(f.calls[1].args.p_session_id, "session")
  for (const field of [
    "status", "active", "started_at", "ended_at",
    "paused_elapsed_seconds", "duration_minutes", "record_time", "xp_awarded",
  ]) assert.equal(f.calls[1].args.p_expected[field], session[field], `CAS includes ${field}`)
  assert.equal(f.calls.some((call) => call.table === "users"), false)
  f.done()
})

test("stale client snapshots and lost CAS requests reject without a separate XP mutation", async () => {
  const stale = fixture([ok(session)])
  await assert.rejects(stale.actions.updateSessionStatus("session", "Finished", { ...session, paused_elapsed_seconds: 0 }), /Session changed/)
  assert.equal(stale.calls.length, 1)
  const lost = fixture([ok(session), ok(null)])
  await assert.rejects(lost.actions.updateSessionStatus("session", "Finished", session), /Session changed/)
  assert.equal(lost.calls.some((call) => call.table === "users"), false)
  lost.done()
})

test("no-record finish sends zero timing and returns no duration XP", async () => {
  const untracked = { ...session, record_time: false }
  const finished = { ...untracked, status: "Finished", active: false, duration_minutes: 0, paused_elapsed_seconds: 0 }
  const f = fixture([ok(untracked), ok(finished)])
  const result = await f.actions.updateSessionStatus("session", "Finished", untracked)
  assert.equal(payload(f.calls[1]).duration_minutes, 0)
  assert.equal(payload(f.calls[1]).paused_elapsed_seconds, 0)
  assert.deepEqual(result.xpAwarded, { total: 0, bonuses: [] })
  assert.deepEqual(result.session, finished)
  f.done()
})

test("starting LockedIn resets the stored started_at instead of counting lock-in waiting", async () => {
  const locked = { ...session, status: "LockedIn", paused_elapsed_seconds: 0 }
  const f = fixture([ok(locked), ok({ ...locked, status: "Playing" })])
  await f.actions.updateSessionStatus("session", "Playing", locked)
  assert.notEqual(payload(f.calls[1]).started_at, locked.started_at)
  assert.equal(payload(f.calls[1]).paused_elapsed_seconds, 0)
  f.done()
})

test("beaten and abandon stop when the shared timing finalizer loses CAS", async () => {
  for (const action of ["markGameBeaten", "abandonGame"]) {
    const f = fixture([ok(session), ok(session), ok(null)])
    await assert.rejects(f.actions[action]("game"), /Session changed/)
    assert.equal(f.calls.every((call) => call.table === "sessions"), true)
    assert.equal(payload(f.calls[2]).status, "Finished")
    f.done()
  }
})

test("beaten and abandon finalize paused/untracked timing before guarded progress updates", async () => {
  for (const [action, status] of [["markGameBeaten", "beaten"], ["abandonGame", "abandoned"]]) {
    for (const [recordTime, expectedMinutes] of [[true, 2], [false, 0]]) {
      const paused = { ...session, status: "Paused", record_time: recordTime }
      const finished = { ...paused, status: "Finished", active: false, duration_minutes: expectedMinutes }
      const f = fixture([
        ok(paused), ok(paused), ok(finished), ok({ id: "progress", status: "playing" }), ok({ id: "progress" }),
      ])
      await f.actions[action]("game")
      assert.equal(payload(f.calls[2]).status, "Finished")
      assert.equal(payload(f.calls[2]).duration_minutes, expectedMinutes)
      assert.equal(payload(f.calls[2]).paused_elapsed_seconds, expectedMinutes * 60)
      assert.equal(payload(f.calls[4]).status, status)
      assert.equal(f.calls[4].rpc, "set_standby_game_progress")
      assert.equal(f.calls[4].args.p_expected_status, "playing")
      assert.equal(f.calls.some((call) => call.table === "users"), false)
      f.done()
    }
  }
})

test("markGameBeaten on already-beaten progress does not repeat its mutation/award", async () => {
  const f = fixture([ok(null), ok({ id: "progress", status: "beaten" })])
  await f.actions.markGameBeaten("game")
  assert.equal(f.calls.some((call) => payload(call)), false)
  f.done()
})

test("beaten/abandon reject an expected old session instead of ending a replacement for the same game", async () => {
  for (const action of ["markGameBeaten", "abandonGame"]) {
    const expected = { ...session, id: "old-session" }
    for (const active of [{ ...session, id: "new-session" }, null]) {
      const f = fixture([ok(active)])
      await assert.rejects(f.actions[action]("game", expected), /Session changed/)
      assert.equal(f.calls.length, 1)
      assert.equal(f.calls[0].rpc, undefined)
      f.done()
    }
    const changed = fixture([ok(session), ok({ ...session, paused_elapsed_seconds: 999 })])
    await assert.rejects(changed.actions[action]("game", session), /Session changed/)
    assert.equal(changed.calls.length, 2)
    changed.done()
  }
})

test("explicit null rejects newly active same-game sessions but permits progress when none remains active", async () => {
  for (const [action, status] of [["markGameBeaten", "beaten"], ["abandonGame", "abandoned"]]) {
    const remote = fixture([ok({ ...session, id: "remote-new-session" })])
    await assert.rejects(remote.actions[action]("game", null), /Session changed/)
    assert.equal(remote.calls.length, 1)
    assert.equal(remote.calls[0].rpc, undefined)
    remote.done()

    const none = fixture([ok(null), ok({ id: "progress", status: "playing" }), ok({ id: "progress" })])
    await none.actions[action]("game", null)
    assert.equal(none.calls.filter((call) => call.table === "sessions").length, 1)
    assert.equal(none.calls.some((call) => call.rpc === "transition_standby_session"), false)
    assert.equal(none.calls[2].rpc, "set_standby_game_progress")
    assert.equal(none.calls[2].args.p_status, status)
    none.done()
  }
})

test("backfill excludes duration/long-session XP from untracked historical sessions", async () => {
  for (const [recordTime, expectedXP] of [[false, 25], [true, 59]]) {
    const historical = { ...session, record_time: recordTime, duration_minutes: 120, xp_awarded: 0 }
    const f = fixture([
      ok({ total_xp: 0 }), ok([historical]), ok(), ok([]), ok(), ok([]),
    ])
    await f.actions.backfillXP()
    const sessionAward = f.calls.find((call) => call.table === "sessions" && payload(call))
    const profileAward = f.calls.find((call) => call.table === "users" && payload(call))
    assert.equal(payload(sessionAward).xp_awarded, expectedXP)
    assert.equal(payload(profileAward).total_xp, expectedXP)
    f.done()
  }
})

test("getActiveSession throws for auth, session, game and progress failures; null means no active session", async () => {
  await assert.rejects(fixture([], false).actions.getActiveSession(), /Not authenticated/)
  await assert.rejects(fixture([{ data: null, error: { message: "session query" } }]).actions.getActiveSession(), /session query/)
  assert.equal(await fixture([ok(null)]).actions.getActiveSession(), null)
  for (const boundary of ["game", "progress"]) {
    const fail = { data: null, error: { message: `${boundary} query` } }
    const f = fixture([ok(session), boundary === "game" ? fail : ok({ id: "game" }), boundary === "progress" ? fail : ok(null)])
    await assert.rejects(f.actions.getActiveSession(), new RegExp(`${boundary} query`))
    f.done()
  }
})

test("delayed notes and goal writes require an active unfinished session", async () => {
  for (const action of ["updateSessionNotes", "updateSessionGoal"]) {
    const f = fixture([ok(null)])
    await assert.rejects(f.actions[action]("session", "late flush"), /Finished session/)
    assert.ok(f.calls[0].methods.some(([method, key, value]) => method === "eq" && key === "active" && value === true))
    assert.ok(f.calls[0].methods.some(([method, key, value]) => method === "neq" && key === "status" && value === "Finished"))
    f.done()
  }
})
