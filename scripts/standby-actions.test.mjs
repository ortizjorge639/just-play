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
      const table = ["set_standby_game_progress", "complete_standby_game"].includes(name) ? "game_progress" :
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
    ok([]),
  ])
  assert.deepEqual((await create.actions.createSession("game")).session, created)
  for (const [f, startXP] of [[start, 0], [create, 25]]) {
    const inserted = f.calls.find((call) => call.rpc === "create_standby_session_with_progress")
    assert.deepEqual(inserted.args, { p_game_id: "game", p_start_xp: startXP })
    assert.equal(f.calls.some((call) => call.table === "game_progress" && payload(call)), false)
    assert.equal(f.calls.some((call) => call.table === "users" && payload(call)), false)
    f.done()
  }
})

test("new creation actions on018/019 report missing020 RPC before any writes, streak update or fallback", async () => {
  for (const code of ["PGRST202", "42883"]) {
    const missing = { data: null, error: { code,
      message: "Could not find the function public.create_standby_session_with_progress in the schema cache" } }
    for (const action of ["startSessionForGame", "createSession"]) {
      const f = fixture(action === "createSession"
        ? [ok(null), ok(null), ok({ last_session_date: null }), missing]
        : [ok(null), missing])
      await assert.rejects(f.actions[action]("game"), /unavailable.*migration 020.*schema cache/)
      assert.deepEqual(f.calls.filter((call) => call.rpc).map((call) => call.rpc), ["create_standby_session_with_progress"])
      assert.equal(f.calls.some((call) => call.methods.some(([method]) => ["insert", "update"].includes(method))), false)
      assert.deepEqual(f.invalidations, [])
      f.done()
    }
  }
})

test("new completion actions on018/019 fail actionably before mutation, without old-RPC fallback", async () => {
  for (const action of ["markGameBeaten", "abandonGame"]) {
    const f = fixture([{ data: null, error: { code: "PGRST202",
      message: "Could not find the function public.complete_standby_game in the schema cache" } }])
    await assert.rejects(f.actions[action]("game", null), /unavailable.*migration 020.*schema cache/)
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].rpc, "complete_standby_game")
    assert.deepEqual(f.invalidations, [])
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

test("beaten/abandon send null, displayed snapshot or deliberate latest mode to one atomic RPC with no pre-read", async () => {
  for (const [action, status] of [["markGameBeaten", "beaten"], ["abandonGame", "abandoned"]]) {
    const displayed = { id: session.id, status: session.status, started_at: session.started_at, paused_elapsed_seconds: 120 }
    for (const expected of [null, displayed, undefined]) {
      const f = fixture([ok({ id: "progress", status })])
      await f.actions[action]("game", expected)
      assert.equal(f.calls.length, 1)
      assert.equal(f.calls[0].rpc, "complete_standby_game")
      assert.deepEqual(f.calls[0].args, {
        p_game_id: "game", p_status: status,
        p_expected_session: expected === undefined ? { mode: "latest" } : expected,
      })
      assert.deepEqual(f.invalidations, ["/"])
      f.done()
    }
  }
})

test("beaten/abandon propagate atomic stale, missing-row and deadlock failures without follow-up writes", async () => {
  for (const action of ["markGameBeaten", "abandonGame"]) {
    for (const response of [
      { data: null, error: { message: "Session changed. Refresh before trying again." } },
      { data: null, error: { message: "deadlock detected", code: "40P01" } },
      ok(null),
    ]) {
      const f = fixture([response])
      await assert.rejects(f.actions[action]("game", null), /Session changed|deadlock detected|Game progress changed/)
      assert.equal(f.calls.length, 1)
      assert.equal(f.calls[0].rpc, "complete_standby_game")
      assert.deepEqual(f.invalidations, [])
      f.done()
    }
    const unauthenticated = fixture([], false)
    await assert.rejects(unauthenticated.actions[action]("game", null), /Not authenticated/)
    assert.equal(unauthenticated.calls.length, 0)
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
