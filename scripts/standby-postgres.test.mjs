// node --test scripts/standby-postgres.test.mjs
// Docker only; creates/removes its own network-disabled PostgreSQL container.
// Synthetic auth functions/roles are not a Supabase Auth/PostgREST acceptance test.
import assert from "node:assert/strict"
import { spawn, execFileSync } from "node:child_process"
import { randomUUID, createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { loadActions } from "./standby-action-fixture.mjs"

const quote = value => value === null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const migration = name => readFileSync(new URL(name, import.meta.url), "utf8")
const container = `just-play-concurrency-${randomUUID()}`
const image = "postgres:17"
const clients = new Set()
const actionSource = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8")

function applicationActions(user, { loseResponse = false, loseNoteResponse = false, history = [] } = {}) {
  const literal = value => typeof value === "object" && value !== null ? json(value) : quote(value)
  const identifier = value => {
    assert.match(value, /^[a-z_]+$/)
    return value
  }
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: user } } }) },
    from(table) {
      assert.ok(["sessions", "users", "game_progress", "games"].includes(table))
      const filters = []
      let updates
      const execute = async () => {
        const where = filters.length ? ` WHERE ${filters.join(" AND ")}` : ""
        const statement = updates
          ? `UPDATE public.${table} SET ${Object.entries(updates).map(([key, value]) => `${identifier(key)}=${literal(value)}`).join(",")}${where} RETURNING *`
          : `SELECT * FROM public.${table}${where}`
        const sql = updates
          ? `WITH changed AS (${statement}) SELECT coalesce(json_agg(changed),'[]') FROM changed`
          : `SELECT coalesce(json_agg(result),'[]') FROM (${statement}) result`
        let rows
        try {
          rows = JSON.parse(await query(sql, user))
        } catch (error) {
          history.push({ phase: "database-error", table, message: error.message })
          return { data: null, error: { message: error.message } }
        }
        history.push({ phase: updates ? "write-commit" : "fresh-read", table, rows })
        if (updates && table === "sessions" && loseNoteResponse) {
          history.push({ phase: "response-unknown", table })
          throw new Error("Synthetic note response loss after real PostgreSQL commit")
        }
        assert.ok(rows.length <= 1, "Fixture expects single-row application requests")
        return { data: rows[0] ?? null, error: null }
      }
      const builder = {
        select: () => builder,
        update: value => { updates = value; return builder },
        eq: (key, value) => { filters.push(`${identifier(key)}=${literal(value)}`); return builder },
        neq: (key, value) => { filters.push(`${identifier(key)}<>${literal(value)}`); return builder },
        single: execute,
        maybeSingle: execute,
      }
      return builder
    },
    rpc(name, args) {
      assert.ok(["create_standby_session_with_progress", "transition_standby_session",
        "finish_standby_session_with_notes", "complete_standby_game"].includes(name))
      const execute = async () => {
        let rows
        try {
          rows = JSON.parse(await query(`SELECT coalesce(json_agg(result),'[]') FROM public.${name}(${
            Object.entries(args).map(([key, value]) => `${identifier(key)} => ${literal(value)}`).join(",")
          }) result`, user))
        } catch (error) {
          history.push({ phase: "database-error", rpc: name, message: error.message })
          return { data: null, error: { message: error.message } }
        }
        history.push({ phase: "server-commit", rpc: name })
        if (loseResponse) {
          history.push({ phase: "response-unknown", rpc: name })
          throw new Error("Synthetic transport loss after real PostgreSQL commit")
        }
        history.push({ phase: "ack", rpc: name })
        return { data: rows[0] ?? null, error: null }
      }
      const builder = { returns: () => builder, maybeSingle: execute, single: execute }
      return builder
    },
  }
  return loadActions(client, actionSource, [])
}

class Connection {
  constructor(name) {
    this.name = name
    this.output = ""
    this.errors = ""
    this.pending = null
    this.process = spawn("docker", ["exec", "-i", "-e", `PGAPPNAME=${name}`, container,
      "psql", "-X", "-qAt", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] })
    clients.add(this)
    this.closed = new Promise(resolve => {
      this.process.on("error", error => {
        this.pending?.reject(error)
        this.pending = null
        clients.delete(this)
        resolve()
      })
      this.process.on("close", code => {
        this.pending?.reject(new Error(`psql ${name} exited ${code}: ${this.errors}`))
        this.pending = null
        clients.delete(this)
        resolve()
      })
    })
    this.process.stderr.on("data", data => { this.errors += data })
    this.process.stdout.on("data", data => {
      this.output += data
      const pending = this.pending
      if (!pending) return
      const position = this.output.indexOf(`${pending.marker}\n`)
      if (position < 0) return
      const result = this.output.slice(0, position).trim()
      this.output = this.output.slice(position + pending.marker.length + 1)
      this.pending = null
      pending.resolve(result)
    })
  }

  query(sql) {
    assert.equal(this.pending, null, "A connection must not serialize overlapping test requests")
    assert.equal(this.process.exitCode, null, "Connection already exited")
    return new Promise((resolve, reject) => {
      const marker = `barrier_${randomUUID().replaceAll("-", "")}`
      this.pending = { resolve, reject, marker }
      this.process.stdin.write(`${sql};\n\\echo ${marker}\n`)
    })
  }

  async close() {
    if (!this.process.stdin.destroyed) this.process.stdin.end("\\q\n")
    await this.closed
  }
}

async function connection(name, user) {
  const client = new Connection(name)
  await client.query("SET statement_timeout='15s'; SET lock_timeout='12s'; SET idle_in_transaction_session_timeout='30s'")
  if (user) {
    await client.query(`SET ROLE authenticated; SET request.jwt.claim.sub=${quote(user)}`)
  }
  return client
}

async function query(sql, user) {
  const client = await connection(`fresh-${randomUUID()}`, user)
  try { return await client.query(sql) } finally { await client.close() }
}

async function row(sql, user) {
  return JSON.parse(await query(`SELECT row_to_json(result) FROM (${sql}) result`, user))
}

test("real PostgreSQL simultaneous StandBy writes (synthetic auth, not full Supabase)", { timeout: 180_000 }, async t => {
  let created = false
  let sequence = 0
  try {
    execFileSync("docker", ["run", "--detach", "--name", container, "--network", "none",
      "--label", "just-play.disposable=standby-concurrency",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image], { encoding: "utf8" })
    created = true
    const deadline = Date.now() + 15_000
    while (true) {
      try {
        // The image's temporary initialization server has no TCP listener.
        execFileSync("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "ignore" })
        break
      } catch (error) {
        if (Date.now() >= deadline) throw error
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    await query(`
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS
        $$ SELECT current_user::text $$;
      CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
      CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon
    `)
    const migrations = ["001_create_tables.sql", "002_rls_policies.sql", "008_add_game_progress.sql",
      "009_fix_status_constraint.sql", "014_gamification.sql", "018_standby.sql",
      "019_restrict_standby_rpc_execute.sql", "020_atomic_standby_game_completion.sql"]
    for (const name of migrations) await query(migration(name))
    await query(`
      GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
      GRANT SELECT,INSERT,UPDATE ON public.users,public.sessions,public.game_progress TO authenticated;
      GRANT SELECT ON public.games TO authenticated
    `)
    t.diagnostic(JSON.stringify({
      source: {
        head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
        actionsSHA256: createHash("sha256").update(actionSource).digest("hex"),
        harnessSHA256: createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex"),
        loaderSHA256: createHash("sha256").update(readFileSync(new URL("standby-action-fixture.mjs", import.meta.url))).digest("hex"),
      },
      environment: await row("SELECT version(), current_setting('default_transaction_isolation') AS isolation"),
      container, image: execFileSync("docker", ["inspect", container, "--format", "{{.Image}}"], { encoding: "utf8" }).trim(),
      network: "none", publishedPorts: [],
      migrations: migrations.map(name => ({ name, sha256: createHash("sha256").update(migration(name)).digest("hex") })),
      auth: "synthetic auth.users UUIDs; SET ROLE authenticated, request.jwt.claim.sub; no JWT/service transport",
    }))

    async function fixture({ session = true, recorded = true } = {}) {
      const user = `80000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`
      const game = `concurrency-${sequence}`
      await query(`INSERT INTO auth.users VALUES (${quote(user)});
        INSERT INTO public.users(id) VALUES (${quote(user)});
        INSERT INTO public.games(id,name) VALUES (${quote(game)},'Synthetic concurrency fixture')`)
      if (!recorded) await query(`UPDATE public.users SET standby_preferences=jsonb_set(standby_preferences,'{record_time}','false')`, user)
      let snapshot
      if (session) {
        const locked = await row(`SELECT * FROM public.create_standby_session_with_progress(${quote(game)},10)`, user)
        snapshot = await row(`SELECT * FROM public.transition_standby_session(${quote(locked.id)},${json(locked)},
          '{"status":"Playing","started_at":"2026-10-18T00:00:00Z","paused_elapsed_seconds":0}')`, user)
      }
      return { user, game, snapshot }
    }
    const finish = (f, notes = "final draft") => `SELECT count(*) FROM public.finish_standby_session_with_notes(
      ${quote(f.snapshot.id)},${json(f.snapshot)},
      '{"status":"Finished","duration_minutes":60,"paused_elapsed_seconds":3600,"ended_at":"2026-10-19T00:00:00Z"}',${quote(notes)})`
    const complete = (f, expected = f.snapshot, status = "beaten") => `SELECT count(*) FROM public.complete_standby_game(
      ${quote(f.game)},${quote(status)},${expected === null ? "NULL" : json(expected)},'final draft')`
    const note = f => `UPDATE public.sessions SET notes='older draft' WHERE id=${quote(f.snapshot.id)}
      AND active=true AND status<>'Finished' RETURNING id`
    const create = f => `SELECT count(*) FROM public.create_standby_session_with_progress(${quote(f.game)},10)`
    const oracle = f => row(`SELECT
      (SELECT coalesce(json_agg(s ORDER BY created_at),'[]') FROM public.sessions s WHERE user_id=${quote(f.user)}) AS sessions,
      (SELECT coalesce(json_agg(g),'[]') FROM public.game_progress g WHERE user_id=${quote(f.user)}) AS progress,
      (SELECT total_xp FROM public.users WHERE id=${quote(f.user)}) AS xp`, f.user)

    async function race(name, f, first, second, expectedError, { holderUser = f.user, waiterUser = f.user } = {}) {
      const holder = await connection(`holder-${sequence}`, holderUser)
      const waiter = await connection(`waiter-${sequence}`, waiterUser)
      let outcome
      try {
        const holderPID = Number(await holder.query("SELECT pg_backend_pid()"))
        const waiterPID = Number(await waiter.query("SELECT pg_backend_pid()"))
        await holder.query(`BEGIN; ${first}`)
        // Observe a real waiting backend before releasing the first transaction.
        const pending = waiter.query(second).then(value => ({ value }), error => ({ error }))
        const until = Date.now() + 10_000
        let blocked
        do {
          blocked = await row(`SELECT pid,wait_event_type,wait_event,pg_blocking_pids(pid) AS blockers
            FROM pg_stat_activity WHERE pid=${waiterPID}`)
          if (blocked.blockers.includes(holderPID)) break
          assert.ok(Date.now() < until, `${name}: second backend never blocked on first`)
          await new Promise(resolve => setTimeout(resolve, 20))
        } while (true)
        assert.equal(blocked.wait_event_type, "Lock")
        await holder.query("COMMIT")
        outcome = await pending
        if (expectedError) assert.match(outcome.error?.message ?? "", expectedError)
        else assert.equal(outcome.error, undefined, outcome.error?.message)
        const final = await oracle(f)
        t.diagnostic(JSON.stringify({ case: name, holderPID, waiterPID, barrier: blocked,
          ordering: ["first statement returned, transaction held", "second backend observed blocked", "first COMMIT", "second settled", "fresh authenticated read"],
          second: outcome.error ? { error: outcome.error.message } : { result: outcome.value }, final }))
        return final
      } finally {
        await holder.close()
        await waiter.close()
      }
    }

    await t.test("RLS, role and RPC grants are effective, not superuser mutation tests", async () => {
      const f = await fixture(), other = await fixture({ session: false })
      const security = await row(`SELECT current_user, r.rolsuper, r.rolbypassrls,
        (SELECT count(*) FROM public.sessions WHERE user_id=${quote(f.user)}) AS foreign_rows
        FROM pg_roles r WHERE rolname=current_user`, other.user)
      assert.deepEqual(security, { current_user: "authenticated", rolsuper: false, rolbypassrls: false, foreign_rows: 0 })
      await assert.rejects(query(`INSERT INTO public.sessions(user_id,game_id) VALUES (${quote(f.user)},${quote(f.game)})`, other.user),
        /must match the authenticated account|row-level security/)
      for (const signature of ["create_standby_session(text,integer)", "transition_standby_session(uuid,jsonb,jsonb)",
        "set_standby_game_progress(text,text,text)", "backfill_standby_profile_xp(integer,date)",
        "create_standby_session_with_progress(text,integer)", "complete_standby_game(text,text,jsonb,text)",
        "finish_standby_session_with_notes(uuid,jsonb,jsonb,text)"]) {
        const grants = await row(`SELECT has_function_privilege('anon',${quote(signature)},'EXECUTE') AS anon,
          has_function_privilege('authenticated',${quote(signature)},'EXECUTE') AS authenticated`)
        assert.deepEqual(grants, { anon: false, authenticated: true })
      }
      t.diagnostic(JSON.stringify({ security, rls: await query("SELECT relname,relrowsecurity FROM pg_class WHERE oid IN ('public.users'::regclass,'public.sessions'::regclass,'public.game_progress'::regclass)") }))
    })
    for (const ending of ["finish", "beaten", "abandoned"]) {
      for (const order of ["note-first", "end-first"]) {
        await t.test(`${ending}: ${order} preserves final draft and exactly one award`, async () => {
          const f = await fixture()
          const end = ending === "finish" ? finish(f) : complete(f, f.snapshot, ending)
          const final = await race(`${ending}-${order}`, f,
            order === "note-first" ? note(f) : end, order === "note-first" ? end : note(f))
          assert.equal(final.sessions[0].notes, "final draft")
          assert.equal(final.sessions[0].status, "Finished")
          assert.equal(final.sessions[0].active, false)
          // Duration is deterministic for finish; completion uses server elapsed time.
          const durationXP = Math.floor(final.sessions[0].duration_minutes / 5)
            + (final.sessions[0].duration_minutes >= 60 ? 10 : 0)
          assert.equal(final.sessions[0].xp_awarded, 10 + durationXP)
          assert.equal(final.xp, 10 + durationXP + (ending === "beaten" ? 50 : 0))
          assert.equal(final.progress[0].status, ending === "finish" ? "playing" : ending)
          if (ending === "finish") assert.equal(final.xp, 32)
          await assert.rejects(query(`UPDATE public.sessions SET notes='late' WHERE id=${quote(f.snapshot.id)}`, f.user), /immutable/)
        })
      }
    }
    await t.test("competing finalizers reject stale loser and roll back its final draft/XP", async () => {
      const f = await fixture()
      const final = await race("double-finish", f, finish(f, "winner"), finish(f, "loser"), /Session changed/)
      assert.equal(final.sessions[0].notes, "winner")
      assert.equal(final.xp, 32)
    })
    await t.test("duplicate game completion with latest mode awards one completion bonus", async () => {
      const f = await fixture({ recorded: false })
      const final = await race("double-complete", f, complete(f), complete(f, { mode: "latest" }))
      assert.equal(final.sessions[0].duration_minutes, 0)
      assert.equal(final.sessions[0].paused_elapsed_seconds, 0)
      assert.equal(final.sessions[0].xp_awarded, 10)
      assert.equal(final.progress[0].status, "beaten")
      assert.equal(final.xp, 60)
    })
    for (const order of ["finish-first", "complete-first"]) {
      await t.test(`session finish versus game completion: ${order} rejects stale displayed state`, async () => {
        const f = await fixture({ recorded: false })
        const final = await race(order, f, order === "finish-first" ? finish(f) : complete(f),
          order === "finish-first" ? complete(f) : finish(f), /Session changed/)
        assert.equal(final.sessions[0].notes, "final draft")
        assert.equal(final.sessions[0].status, "Finished")
        assert.equal(final.progress[0].status, order === "finish-first" ? "playing" : "beaten")
        assert.equal(final.xp, order === "finish-first" ? 10 : 60)
      })
    }
    for (const order of ["create-first", "complete-first"]) {
      await t.test(`absent-session completion versus creation: ${order}`, async () => {
        const f = await fixture({ session: false })
        const final = await race(order, f, order === "create-first" ? create(f) : complete(f, null),
          order === "create-first" ? complete(f, null) : create(f), order === "create-first" ? /Session changed/ : undefined)
        assert.equal(final.sessions.length, 1)
        assert.equal(final.sessions[0].active, true)
        assert.equal(final.progress[0].status, "playing")
        assert.equal(final.xp, order === "create-first" ? 10 : 60)
      })
    }
    for (const order of ["create-first", "legacy-first"]) {
      await t.test(`direct legacy terminal write versus creation: ${order}`, async () => {
        const f = await fixture({ session: false })
        const legacy = `INSERT INTO public.game_progress(user_id,game_id,status)
          VALUES (${quote(f.user)},${quote(f.game)},'beaten')`
        const final = await race(order, f, order === "create-first" ? create(f) : legacy,
          order === "create-first" ? legacy : create(f), order === "create-first" ? /Active session exists/ : undefined)
        assert.equal(final.sessions[0].active, true)
        assert.equal(final.progress[0].status, "playing")
        assert.equal(final.xp, 10, "legacy direct writes do not gain a second trigger reward")
      })
    }
    await t.test("pause wins against displayed completion; note, lifecycle and XP rollback together", async () => {
      const f = await fixture()
      const paused = `SELECT count(*) FROM public.transition_standby_session(${quote(f.snapshot.id)},${json(f.snapshot)},
        '{"status":"Paused","paused_elapsed_seconds":120}')`
      const final = await race("pause-stale-complete", f, paused, complete(f), /Session changed/)
      assert.equal(final.sessions[0].status, "Paused")
      assert.equal(final.sessions[0].notes, null)
      assert.equal(final.progress[0].status, "playing")
      assert.equal(final.xp, 10)
    })
    await t.test("stale finish rolls back the draft written before its full CAS", async () => {
      const f = await fixture()
      const paused = `SELECT count(*) FROM public.transition_standby_session(${quote(f.snapshot.id)},${json(f.snapshot)},
        '{"status":"Paused","paused_elapsed_seconds":120}')`
      const final = await race("pause-stale-finish", f, paused, finish(f), /Session changed/)
      assert.equal(final.sessions[0].status, "Paused")
      assert.equal(final.sessions[0].notes, null)
      assert.equal(final.xp, 10)
    })
    await t.test("finalization wins against an in-flight pause without reviving the session", async () => {
      const f = await fixture()
      const pause = `SELECT count(*) FROM public.transition_standby_session(${quote(f.snapshot.id)},${json(f.snapshot)},
        '{"status":"Paused","paused_elapsed_seconds":120}')`
      const final = await race("finish-pause", f, finish(f), pause)
      assert.equal(final.sessions[0].status, "Finished")
      assert.equal(final.sessions[0].active, false)
      assert.equal(final.sessions[0].notes, "final draft")
      assert.equal(final.xp, 32)
    })
    await t.test("delayed legacy profile XP waits for opt-out finish and is rejected", async () => {
      const f = await fixture({ recorded: false })
      const final = await race("finish-legacy-xp", f, finish(f),
        "UPDATE public.users SET total_xp=total_xp+100", /Untracked session history/)
      assert.equal(final.sessions[0].status, "Finished")
      assert.equal(final.xp, 10)
    })
    for (const order of ["maintenance-first", "account-first"]) {
      await t.test(`privileged no-auth maintenance fence: ${order}`, async () => {
        const f = await fixture()
        const maintenance = `UPDATE public.sessions SET notes='maintenance' WHERE id=${quote(f.snapshot.id)}`
        const final = await race(order, f, order === "maintenance-first" ? maintenance : finish(f),
          order === "maintenance-first" ? finish(f) : maintenance, order === "account-first" ? /immutable/ : undefined,
          order === "maintenance-first" ? { holderUser: null } : { waiterUser: null })
        assert.equal(final.sessions[0].status, "Finished")
        assert.equal(final.sessions[0].notes, "final draft")
        assert.equal(final.xp, 32)
      })
    }
    await t.test("repeatable-read writes fail explicitly rather than using an old snapshot", async () => {
      const f = await fixture()
      await assert.rejects(query(`BEGIN ISOLATION LEVEL REPEATABLE READ; ${finish(f)}`, f.user), /require READ COMMITTED/)
      assert.equal((await oracle(f)).sessions[0].status, "Playing")
    })
    await t.test("real application actions create, save, pause/resume and finish an opt-out session independently of game completion", async () => {
      const f = await fixture({ session: false, recorded: false })
      const history = []
      const actions = applicationActions(f.user, { history })
      let session = await actions.startSessionForGame(f.game)
      assert.equal(session.record_time, false)
      session = (await actions.updateSessionStatus(session.id, "Playing", session)).session
      await actions.updateSessionNotes(session.id, "acknowledged draft")
      assert.equal((await oracle(f)).sessions[0].notes, "acknowledged draft")
      session = (await actions.updateSessionStatus(session.id, "Paused", session)).session
      session = (await actions.updateSessionStatus(session.id, "Playing", session)).session
      const result = await actions.updateSessionStatus(session.id, "Finished", session, { notes: "" })
      assert.equal(result.session.status, "Finished")
      assert.equal(result.xpAwarded.total, 0)
      const final = await oracle(f)
      assert.equal(final.sessions[0].notes, "")
      assert.equal(final.sessions[0].duration_minutes, 0)
      assert.equal(final.xp, 0)
      assert.deepEqual(final.progress, [], "session-only zero-XP creation does not complete a game")
      await assert.rejects(actions.updateSessionNotes(session.id, "late draft"), /Active session not found/)
      t.diagnostic(JSON.stringify({ case: "application-opt-out", adapter: "scripted SQL, not PostgREST", history, final }))
    })
    await t.test("real note commit with lost response remains an error and explicit empty final draft wins", async () => {
      const f = await fixture({ recorded: false }), history = []
      const interrupted = applicationActions(f.user, { history, loseNoteResponse: true })
      await assert.rejects(interrupted.updateSessionNotes(f.snapshot.id, "uncertain draft"), /Synthetic note response loss/)
      assert.equal((await oracle(f)).sessions[0].notes, "uncertain draft")
      const fresh = applicationActions(f.user, { history })
      await fresh.updateSessionNotes(f.snapshot.id, "")
      await fresh.updateSessionStatus(f.snapshot.id, "Finished", f.snapshot, { notes: "" })
      const final = await oracle(f)
      assert.equal(final.sessions[0].notes, "")
      assert.equal(final.sessions[0].status, "Finished")
      assert.equal(final.xp, 10)
      t.diagnostic(JSON.stringify({ case: "application-lost-note-empty-final", history, final }))
    })
    for (const ending of ["finish", "beaten", "abandoned"]) {
      await t.test(`real action ${ending} with commit-then-lost-response reconciles without a duplicate reward`, async () => {
        const f = await fixture({ recorded: false }), history = []
        const interrupted = applicationActions(f.user, { history, loseResponse: true })
        const end = actions => ending === "finish"
          ? actions.updateSessionStatus(f.snapshot.id, "Finished", f.snapshot, { notes: "committed final draft" })
          : actions[ending === "beaten" ? "markGameBeaten" : "abandonGame"](f.game, f.snapshot, "committed final draft")
        await assert.rejects(end(interrupted), /Synthetic transport loss/)
        const fresh = applicationActions(f.user, { history })
        await assert.rejects(end(fresh), /Session changed/)
        assert.equal(await fresh.getActiveSession(), null)
        const final = await oracle(f)
        assert.equal(final.sessions.length, 1)
        assert.equal(final.sessions[0].notes, "committed final draft")
        assert.equal(final.sessions[0].active, false)
        assert.equal(final.sessions[0].duration_minutes, 0)
        assert.equal(final.xp, ending === "beaten" ? 60 : 10)
        assert.equal(final.progress[0].status, ending === "finish" ? "playing" : ending)
        t.diagnostic(JSON.stringify({ case: `application-lost-${ending}`, adapter: "synthetic response loss, real PostgreSQL commits", history, final }))
      })
    }
  } finally {
    for (const client of clients) await client.close()
    if (created) {
      execFileSync("docker", ["rm", "--force", "--volumes", container], { encoding: "utf8" })
      t.diagnostic(`Removed own disposable container ${container}`)
    }
  }
})
