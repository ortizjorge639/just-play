import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { test } from "node:test"
import { compileFunction } from "node:vm"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
const root = process.cwd()
function fixture({ authenticated = false, exchangeError = null } = {}) {
  const calls = []
  const profile = { id: "fixture-user", display_name: "Demo player" }
  const auth = {
    getUser: async () => { calls.push("auth"); return { data: { user: authenticated ? { id: profile.id } : null } } },
    exchangeCodeForSession: async code => { calls.push(`exchange:${code}`); return { error: exchangeError } },
  }
  const actions = Object.fromEntries(["getUser", "getActiveSession", "getActiveGame", "getSessionHistory", "getPlayerStats", "getResidents", "getCompletedGames", "getPostcards", "getStampRules", "getNameCard", "getBoosterPackStatus", "backfillXP"].map(name => [
    name, async () => {
      calls.push(name)
      if (name === "getUser") return profile
      if (name === "getBoosterPackStatus") return { packsOpenedToday: 0, packsRemaining: 3 }
      return name === "getPlayerStats" ? null : []
    },
  ]))
  const NextResponse = {
    next: () => ({ status: 200, cookies: { set: () => {} } }),
    redirect: url => ({ status: 307, location: String(url) }),
  }
  function load(relative) {
    const base = path.resolve(root, relative)
    const filename = [base, `${base}.ts`, `${base}.tsx`].find(name => existsSync(name))
    const loaded = { exports: {} }
    const code = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const resolve = specifier => {
      if (specifier.endsWith(".css")) return {}
      if (specifier === "@/lib/supabase/server") return { createClient: async () => ({ auth }) }
      if (specifier === "@supabase/ssr") return { createServerClient: () => ({ auth }) }
      if (specifier === "next/server") return { NextResponse }
      if (specifier === "next/navigation") return { redirect: location => { throw new Error(`redirect:${location}`) } }
      if (specifier === "./actions") return actions
      if (specifier === "@/components/app-shell") return { AppShell: props => React.createElement("div", { "data-app": props.user.id }, "Authenticated app") }
      if (specifier === "next/link") return function Link(props) { return React.createElement("a", props) }
      if (specifier === "next/image") return function Image({ fill, priority, ...props }) { return React.createElement("img", props) }
      if (specifier.startsWith("@/")) return load(specifier.slice(2))
      if (specifier.endsWith("artwork.json")) return require(path.resolve(root, "public/media/game-art/artwork.json"))
      return require(specifier)
    }
    compileFunction(code, ["require", "module", "exports", "process"], { filename })(resolve, loaded, loaded.exports, { env: {} })
    return loaded.exports
  }
  return { load, calls }
}
test("public allowlist is bounded, not a substring match", () => {
  const { isPublicRoute } = fixture().load("lib/public-routes.ts")
  for (const route of ["/", "/about", "/about/", "/auth/login", "/media/reel.vtt"]) assert.ok(isPublicRoute(route), route)
  for (const route of ["/private", "/about/private", "/about-us", "/media-private", "/author", "/api/player"]) assert.equal(isPublicRoute(route), false, route)
})
test("analytics scripts bypass middleware, private data APIs do not", () => {
  const { config } = fixture().load("middleware.ts")
  const matcher = new RegExp(`^${config.matcher[0]}$`)
  assert.equal(matcher.test("/_vercel/insights/script.js"), false)
  assert.equal(matcher.test("/_vercel/insights/view"), false)
  assert.equal(matcher.test("/api/search-games"), true)
  assert.equal(matcher.test("/_vercel/insights-private"), true)
})
test("anonymous root renders real marketing without fetching player data", async () => {
  const f = fixture()
  const result = await f.load("app/page.tsx").default({ searchParams: Promise.resolve({}) })
  const html = renderToStaticMarkup(result)
  assert.match(html, /Flow through/)
  assert.match(html, /curated catalog/)
  assert.match(html, /Library import is not available yet/)
  assert.deepEqual(f.calls, ["auth"])
  assert.ok(!html.includes("fixture-user"))
  assert.match(html, /Watch the reel/)
  assert.match(html, /\/media\/game-art\/hades.jpg/)
  assert.match(html, /\/media\/game-art\/stardew-valley.jpg/)
  assert.match(html, /\/media\/artwork-credits.txt/)
  assert.ok(!/mosslight\.svg|afterlight\.svg/.test(html))
})
test("catalog covers are varied, local, attributed, and not relicensed", () => {
  const artworks = require(path.resolve(root, "public/media/game-art/artwork.json"))
  assert.equal(artworks.length, 6)
  assert.equal(new Set(artworks.map(art => art.source)).size, 6)
  const catalog = readFileSync(path.resolve(root, "scripts/011_seed_igdb_games.sql"), "utf8")
  for (const artwork of artworks) {
    assert.ok(artwork.author && artwork.catalogId)
    assert.match(artwork.source, /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_720p\/[a-z0-9]+\.jpg$/)
    assert.ok(catalog.includes(artwork.source) && catalog.includes(artwork.catalogId))
    assert.ok(artwork.image.startsWith("/media/game-art/") && !artwork.image.includes(".."))
    assert.ok(existsSync(path.resolve(root, "public", artwork.image.slice(1))))
  }
  const credits = readFileSync(path.resolve(root, "public/media/artwork-credits.txt"), "utf8")
  assert.match(credits, /IGDB/)
  assert.match(credits, /Supergiant Games/)
  assert.match(credits, /NOT licensed CC BY-SA/)
  assert.match(credits, /application-code license is unchanged/)
})
test("signed-in root still renders the app and fetches its existing data", async () => {
  const f = fixture({ authenticated: true })
  const result = await f.load("app/page.tsx").default({ searchParams: Promise.resolve({}) })
  assert.match(renderToStaticMarkup(result), /data-app="fixture-user"/)
  assert.ok(f.calls.includes("getSessionHistory"))
  assert.ok(f.calls.includes("getBoosterPackStatus"))
})
test("root confirmation code still exchanges and redirects to a clean root", async () => {
  const f = fixture()
  await assert.rejects(f.load("app/page.tsx").default({ searchParams: Promise.resolve({ code: "demo-code" }) }), /redirect:\/$/)
  assert.deepEqual(f.calls, ["exchange:demo-code"])
})
test("failed code exchange does not expose protected data", async () => {
  const f = fixture({ exchangeError: new Error("Expired code") })
  const result = await f.load("app/page.tsx").default({ searchParams: Promise.resolve({ code: "expired" }) })
  assert.match(renderToStaticMarkup(result), /Flow through/)
  assert.deepEqual(f.calls, ["exchange:expired", "auth"])
})
test("marketing bypasses auth network, private routes redirect, auth routes still refresh", async () => {
  for (const [pathname, status, refreshed] of [["/about", 200, false], ["/media/just-play-wide.mp4", 200, false], ["/private", 307, true], ["/auth/login", 200, true], ["/", 200, true]]) {
    const f = fixture()
    const result = await f.load("lib/supabase/proxy.ts").updateSession({
      cookies: { getAll: () => [], set: () => {} }, nextUrl: { pathname, clone: () => new URL(`https://demo.invalid${pathname}`) },
    })
    assert.equal(result.status, status, pathname)
    assert.equal(f.calls.includes("auth"), refreshed, pathname)
    if (status === 307) assert.equal(result.location, "https://demo.invalid/auth/login")
  }
})
