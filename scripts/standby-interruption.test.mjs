// Actual action source + actual isolated PostgreSQL oracle, with a scripted
// request/response adapter (not a real PostgREST transport or parallel backends).
// npx --yes --package=@electric-sql/pglite@0.5.10 -- node --test scripts\standby-interruption.test.mjs
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { execFileSync, spawnSync } from "node:child_process"
import { compileFunction } from "node:vm"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)
let packagePath
try { packagePath = require.resolve("@electric-sql/pglite") } catch {
  packagePath = (process.env.PATH ?? "").split(path.delimiter)
    .map(bin => path.resolve(bin, "..", "@electric-sql", "pglite"))
    .find(candidate => existsSync(path.join(candidate, "package.json")))
}
if (!packagePath) throw new Error("Run with the pinned PGlite command above.")
const { PGlite } = require(packagePath)
const unsafeSHA = "09bda0541852efd88a03d2224d2897f308280741"
const currentSource = readFileSync(path.join(root, "app", "actions.ts"), "utf8")
const unsafeSource = execFileSync("git", ["show", `${unsafeSHA}:app/actions.ts`], { cwd: root, encoding: "utf8" })
const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const currentSourceCommitted = spawnSync("git", ["diff", "--quiet", "HEAD", "--", "app/actions.ts"], { cwd: root }).status === 0
const currentBlob = execFileSync("git", ["hash-object", "app/actions.ts"], { cwd: root, encoding: "utf8" }).trim()
const wireRow = row => row ? JSON.parse(JSON.stringify(row)) : null

function actionsFor(db, user, source, history, beforeRPC = async () => {}, loseTerminalResponse = false) {
  const invalidations = []
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from(table) {
      assert.equal(table, "sessions")
      const filters = []
      const execute = async () => {
        const result = await db.query(`select * from public.sessions where ${
          filters.map(([key], i) => `${key}=$${i + 1}`).join(" and ")
        }`, filters.map(([, value]) => value))
        history.push({ phase: "read-ack", status: result.rows[0]?.status, notes: result.rows[0]?.notes })
        return { data: wireRow(result.rows[0]), error: null }
      }
      const query = {
        select: () => query,
        eq: (key, value) => { assert.ok(["id", "user_id"].includes(key)); filters.push([key, value]); return query },
        single: execute,
      }
      return query
    },
    rpc(name, args) {
      assert.ok(["finish_standby_session_with_notes", "transition_standby_session", "complete_standby_game"].includes(name))
      const execute = async () => {
        history.push({ phase: "invoke", rpc: name })
        await beforeRPC(name)
        let result
        try {
          const entries = Object.entries(args)
          result = await db.query(`select * from public.${name}(${
            entries.map(([key], i) => `${key} => $${i + 1}`).join(",")
          })`, entries.map(([, value]) => value && typeof value === "object" ? JSON.stringify(value) : value))
        } catch (error) {
          history.push({ phase: "server-reject", rpc: name, code: error.code })
          return { data: null, error: { code: error.code, message: error.message } }
        }
        history.push({ phase: "server-commit", rpc: name })
        if (loseTerminalResponse) {
          history.push({ phase: "response-unknown", rpc: name })
          throw new Error("Terminal response lost after commit")
        }
        history.push({ phase: "ack", rpc: name })
        return { data: wireRow(result.rows[0]), error: null }
      }
      const query = { returns: () => query, maybeSingle: execute }
      return query
    },
  }
  const modules = new Map()
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename)
    const loaded = { exports: {} }
    modules.set(filename, loaded.exports)
    const output = ts.transpileModule(filename === path.join(root, "app", "actions.ts") ? source : readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    compileFunction(output, ["require", "module", "exports"], { filename })((specifier) => {
      if (specifier === "@/lib/supabase/server") return { createClient: async () => client }
      if (specifier === "next/cache") return { revalidatePath: url => invalidations.push(url) }
      if (specifier.startsWith("@/")) return load(path.join(root, `${specifier.slice(2)}.ts`))
      if (specifier.startsWith(".")) return load(path.resolve(path.dirname(filename), `${specifier}.ts`))
      throw new Error(`Unexpected dependency ${specifier}`)
    }, loaded, loaded.exports)
    return loaded.exports
  }
  return { actions: load(path.join(root, "app", "actions.ts")), invalidations }
}

test("interruption histories use independent SQL rows, not mocked mutation success", async t => {
  const db = new PGlite()
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
  let sequence = 0
  async function fixture() {
    const user = `90000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`
    const game = `interruption-${sequence}`
    await db.exec("reset role")
    await db.query("insert into auth.users(id) values($1)", [user])
    await db.query("insert into public.users(id) values($1)", [user])
    await db.query("insert into public.games(id,name) values($1,'Interruption fixture')", [game])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user])
    await db.exec("set role authenticated")
    const locked = await one("select * from public.create_standby_session($1,10)", [game])
    const session = await one("select * from public.transition_standby_session($1,$2,$3)", [
      locked.id, JSON.stringify(locked), JSON.stringify({ status: "Playing", started_at: new Date().toISOString(), paused_elapsed_seconds: 0 }),
    ])
    await db.query("update public.sessions set notes='' where id=$1", [session.id])
    return {
      user, game, session: wireRow({ ...session, notes: "" }),
      oracle: async () => ({
        session: await one("select * from public.sessions where id=$1", [session.id]),
        progress: (await db.query("select * from public.game_progress where user_id=$1 and game_id=$2", [user, game])).rows,
        profile: await one("select total_xp,level from public.users where id=$1", [user]),
      }),
    }
  }
  const receipt = (name, source, history, oracle) => t.diagnostic(JSON.stringify({
    protocol: "standby-interruption-v1", case: name,
    sourceSHA: source === unsafeSource ? unsafeSHA : currentSourceCommitted ? head : null,
    sourceBaseSHA: head,
    sourceGitBlob: source === unsafeSource
      ? execFileSync("git", ["rev-parse", `${unsafeSHA}:app/actions.ts`], { cwd: root, encoding: "utf8" }).trim()
      : currentBlob,
    sourceSHA256: createHash("sha256").update(source).digest("hex"),
    oracleType: "actual-PGlite-serialized-committed-schedule",
    transport: "scripted-response-adapter", parallelContentionProven: false,
    history: history.map((event, sequence) => ({
      operationId: `${name}:${event.request ?? "terminal"}`,
      attemptId: `${name}:${event.context ?? (event.request ? "external" : "initial")}:1`,
      contextId: event.context ?? (event.request ? "external" : "initial"),
      barrierSequence: sequence + 1, ...event,
    })), oracle: {
      notes: oracle.session.notes, status: oracle.session.status, active: oracle.session.active,
      durationMinutes: oracle.session.duration_minutes, sessionXP: oracle.session.xp_awarded,
      progress: oracle.progress.map(row => ({ status: row.status, totalSessions: row.total_sessions, totalMinutes: row.total_time_minutes })),
      profile: oracle.profile,
    },
  }))
  try {
    await db.exec(`
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql as $$ select 'authenticated'::text $$;
      create role authenticated; create role anon;
    `)
    for (const name of ["001_create_tables.sql", "002_rls_policies.sql", "008_add_game_progress.sql",
      "009_fix_status_constraint.sql", "014_gamification.sql", "018_standby.sql", "019_restrict_standby_rpc_execute.sql"]) {
      await db.exec(readFileSync(new URL(name, import.meta.url), "utf8"))
    }
    await db.exec(`grant usage on schema public,auth to authenticated;
      grant select,insert,update on public.users,public.sessions,public.game_progress to authenticated;
      grant select on public.games to authenticated;`)

    await t.test("negative control: clean matching read plus external commit violates final draft only in pinned unsafe source", async () => {
      for (const source of [unsafeSource, currentSource]) {
        const f = await fixture()
        const history = []
        let injected = false
        const { actions, invalidations } = actionsFor(db, f.user, source, history, async () => {
          if (injected) return
          injected = true
          await db.query("update public.sessions set notes='external old request' where id=$1", [f.session.id])
          history.push({ phase: "server-commit", request: "external-context-note", notes: "external old request" })
          history.push({ phase: "response-unknown", request: "external-context-note" })
        })
        let error
        try {
          // Old source receives its clean authorization flag; new source ignores it.
          await actions.updateSessionStatus(f.session.id, "Finished", f.session, { notes: "", requiresAtomicFinish: false })
          history.push({ phase: "caller-completed" })
        } catch (cause) { error = cause; history.push({ phase: "caller-error", message: cause.message }) }
        const observed = await f.oracle()
        if (source === unsafeSource) {
          assert.equal(error, undefined)
          assert.equal(observed.session.status, "Finished")
          assert.throws(() => assert.equal(observed.session.notes, ""), /external old request/,
            "negative control must FAIL the required final-draft invariant")
          await assert.rejects(db.query("update public.sessions set notes='' where id=$1", [f.session.id]), /immutable/)
        } else {
          assert.match(error.message, /unavailable.*migration 020/)
          assert.equal(observed.session.status, "Playing")
          assert.equal(observed.session.active, true)
          assert.deepEqual(observed.profile, { total_xp: 10, level: 1 })
          assert.deepEqual(observed.progress, [])
          assert.deepEqual(invalidations, [])
          assert.equal(history.some(e => e.rpc === "transition_standby_session"), false)
        }
        receipt("clean-external-context-negative-control", source, history, observed)
      }
    })

    await t.test("018/019-only: all new endings reject before terminal writes including omitted finish options", async () => {
      for (const ending of ["finish", "finish-omitted", "beaten", "abandoned"]) {
        const f = await fixture(), before = await f.oracle(), history = []
        const { actions, invalidations } = actionsFor(db, f.user, currentSource, history)
        await assert.rejects(ending.startsWith("finish")
          ? actions.updateSessionStatus(f.session.id, "Finished", f.session, ending === "finish" ? { notes: "" } : undefined)
          : actions[ending === "beaten" ? "markGameBeaten" : "abandonGame"](f.game, f.session, ""),
        /unavailable.*migration 020/)
        assert.deepEqual(await f.oracle(), before)
        assert.deepEqual(invalidations, [])
        receipt(`missing020-${ending}`, currentSource, history, await f.oracle())
      }
    })

    await db.exec("reset role")
    await db.exec(readFileSync(new URL("020_atomic_standby_game_completion.sql", import.meta.url), "utf8"))
    await t.test("committed note with lost response, revert to old empty, acknowledged overwrite and atomic end", async () => {
      for (const ending of ["finish", "beaten", "abandoned"]) {
        const f = await fixture(), history = []
        history.push({ phase: "invoke", request: "note-save" })
        await db.query("update public.sessions set notes='text to remove' where id=$1", [f.session.id])
        history.push({ phase: "server-commit", request: "note-save" })
        history.push({ phase: "response-unknown", request: "note-save" })
        history.push({ phase: "draft-reverted", notes: "" })
        await db.query("update public.sessions set notes='' where id=$1", [f.session.id])
        history.push({ phase: "server-commit", request: "overwrite" })
        history.push({ phase: "ack", request: "overwrite" })
        const { actions } = actionsFor(db, f.user, currentSource, history)
        if (ending === "finish") await actions.updateSessionStatus(f.session.id, "Finished", f.session, { notes: "" })
        else await actions[ending === "beaten" ? "markGameBeaten" : "abandonGame"](f.game, f.session, "")
        const observed = await f.oracle()
        assert.equal(observed.session.notes, "")
        assert.equal(observed.session.status, "Finished")
        assert.equal(observed.profile.total_xp, ending === "beaten" ? 60 : 10)
        receipt(`commit-lost-revert-${ending}`, currentSource, history, observed)
      }
    })
    await t.test("020: response-unknown execution before/after atomic ending cannot corrupt final notes; stale assertion rolls back", async () => {
      for (const ending of ["finish", "beaten", "abandoned"]) {
        for (const execution of ["before", "after", "stale"]) {
          const f = await fixture(), history = []
          const { actions } = actionsFor(db, f.user, currentSource, history, async () => {
            if (execution === "after") return
            await db.query("update public.sessions set notes='external old request' where id=$1", [f.session.id])
            if (execution === "stale") await db.query("update public.sessions set status='Paused',paused_elapsed_seconds=120 where id=$1", [f.session.id])
            history.push({ phase: "server-commit", request: "external-context-note" })
            history.push({ phase: "response-unknown", request: "external-context-note" })
          })
          const request = () => ending === "finish"
            ? actions.updateSessionStatus(f.session.id, "Finished", f.session, { notes: "" })
            : actions[ending === "beaten" ? "markGameBeaten" : "abandonGame"](f.game, f.session, "")
          if (execution === "stale") {
            await assert.rejects(request(), /Session changed/)
            const observed = await f.oracle()
            assert.equal(observed.session.notes, "external old request")
            assert.equal(observed.session.status, "Paused")
            assert.equal(observed.session.active, true)
            assert.deepEqual(observed.profile, { total_xp: 10, level: 1 })
            assert.deepEqual(observed.progress, [])
          } else {
            await request()
            if (execution === "after") {
              history.push({ phase: "invoke", request: "external-context-note" })
              await assert.rejects(db.query("update public.sessions set notes='late external' where id=$1", [f.session.id]), /immutable/)
              history.push({ phase: "server-reject", request: "external-context-note" })
            }
            const observed = await f.oracle()
            assert.equal(observed.session.notes, "")
            assert.equal(observed.session.status, "Finished")
            assert.equal(observed.session.active, false)
            assert.equal(observed.session.xp_awarded, 10)
            assert.equal(observed.profile.total_xp, ending === "beaten" ? 60 : 10)
            assert.equal(observed.progress[0]?.status ?? null, ending === "finish" ? null : ending)
          }
          receipt(`atomic-${ending}-${execution}`, currentSource, history, await f.oracle())
        }
      }
    })
    await t.test("terminal commit with lost response is reconciled from a fresh context without duplicate rows or XP", async () => {
      for (const ending of ["finish", "beaten", "abandoned"]) {
        const f = await fixture(), history = []
        await db.query("update public.sessions set started_at=now()-interval '60 minutes' where id=$1", [f.session.id])
        const snapshot = wireRow(await one("select * from public.sessions where id=$1", [f.session.id]))
        const request = actions => ending === "finish"
          ? actions.updateSessionStatus(snapshot.id, "Finished", snapshot, { notes: "committed final draft" })
          : actions[ending === "beaten" ? "markGameBeaten" : "abandonGame"](f.game, snapshot, "committed final draft")
        const first = actionsFor(db, f.user, currentSource, history, undefined, true)
        await assert.rejects(request(first.actions), /response lost after commit/)
        history.push({ phase: "caller-error", outcome: "UNKNOWN, not rollback" })
        const committed = await f.oracle()
        assert.equal(committed.session.status, "Finished")
        assert.equal(committed.session.notes, "committed final draft")
        assert.ok(committed.session.xp_awarded > 10, "duration XP really committed")
        assert.equal(committed.profile.total_xp, committed.session.xp_awarded + (ending === "beaten" ? 50 : 0))
        const freshHistory = []
        const fresh = actionsFor(db, f.user, currentSource, freshHistory)
        await assert.rejects(request(fresh.actions), /Session changed|Cannot transition/)
        history.push(...freshHistory.map(event => ({ ...event, context: "fresh" })))
        const active = (await db.query("select id from public.sessions where user_id=$1 and active=true", [f.user])).rows
        assert.deepEqual(active, [])
        assert.equal((await one("select count(*)::int as count from public.sessions where user_id=$1", [f.user])).count, 1)
        await assert.rejects(db.query("update public.sessions set notes='retry overwrite' where id=$1", [snapshot.id]), /immutable/)
        assert.deepEqual(await f.oracle(), committed)
        assert.deepEqual(first.invalidations, [])
        assert.deepEqual(fresh.invalidations, [])
        history.push({ phase: "fresh-context-reconciled", context: "fresh", activeSessions: 0, finishedRecords: 1 })
        receipt(`terminal-unknown-${ending}`, currentSource, history, committed)
      }
    })
  } finally { await db.close() }
})
