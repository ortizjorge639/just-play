import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { NextRequest } from "next/server"
import { middleware } from "../../middleware"
import { metadata } from "../../app/demo/layout"

test("the public demo removes the authenticated app manifest", () => {
  assert.equal(metadata.manifest, null)
})

test("photo support does not retain the WebGL drawing buffer", async () => {
  const scene = await readFile(new URL("../../components/demo/demo-scene.tsx", import.meta.url), "utf8")
  assert.doesNotMatch(scene, /preserveDrawingBuffer\s*:\s*true/)
})

test("the demo renders without any Supabase configuration or authentication", async () => {
  const beforeURL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const beforeKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  try {
    for (const path of ["/demo", "/demo/", "/demo?presentation=true"]) {
      const response = await middleware(new NextRequest(`http://localhost${path}`))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get("x-middleware-next"), "1")
      assert.equal(response.headers.get("location"), null)
    }
    await assert.rejects(middleware(new NextRequest("http://localhost/demo-private")), /supabase/i)
    await assert.rejects(middleware(new NextRequest("http://localhost/")), /supabase/i)
  } finally {
    if (beforeURL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = beforeURL
    if (beforeKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = beforeKey
  }
})
