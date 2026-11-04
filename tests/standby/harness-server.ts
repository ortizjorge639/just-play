import { createServer } from "node:http"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { build } from "esbuild"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"

// Isolated component harness: no Next route, authentication bypass, or database.
async function main() {
  const result = await build({
    entryPoints: [path.resolve("tests", "standby", "harness.tsx")],
    bundle: true,
    write: false,
    splitting: true,
    format: "esm",
    outdir: path.resolve("tests", "standby", "build"),
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    alias: {
      "@/app/actions": path.resolve("tests", "standby", "mock-actions.ts"),
      "@/app/auth/actions": path.resolve("tests", "standby", "mock-actions.ts"),
      "next/image": path.resolve("tests", "standby", "mock-image.tsx"),
      "three/addons/loaders/GLTFLoader.js": path.resolve("tests", "standby", "gated-gltf-loader.ts"),
    },
  })
  const assets = new Map(result.outputFiles.map(file => [`/assets/${path.basename(file.path)}`, file.contents]))
  const robot = await readFile(path.resolve("public", "canopy", "r1-4f33b632.glb"))
  const canopyAssets = new Map<string, Buffer>()
  for (const name of await readdir(path.resolve("public", "canopy"))) {
    if (name.endsWith(".glb")) canopyAssets.set(`/canopy/${name}`, await readFile(path.resolve("public", "canopy", name)))
  }
  const css = await postcss([tailwind()]).process(await readFile(path.resolve("app", "globals.css"), "utf8"), {
    from: path.resolve("app", "globals.css"),
  })
  const fixtureArt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="art"><stop stop-color="#243b55"/><stop offset="1" stop-color="#141e30"/></linearGradient></defs><rect width="800" height="600" fill="url(#art)"/><circle cx="550" cy="160" r="80" fill="#e9be78"/><path d="M0 600 250 160 430 440 600 280 800 600Z" fill="#142c2c"/></svg>`
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated StandBy test harness</title><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/assets/harness.css"></head><body><div id="root"></div><script type="module" src="/assets/harness.js"></script></body></html>`
  createServer((request, response) => {
    const url = request.url || "/"
    const asset = assets.get(url) ?? (url === "/fixture-art.svg" ? fixtureArt : url === "/canopy/r1-4f33b632.glb" ? robot : url === "/style.css" ? css.css : canopyAssets.get(url) ?? html)
    response.setHeader("Content-Type", url.endsWith(".js") ? "application/javascript"
      : url.endsWith(".css") ? "text/css" : url.endsWith(".glb") ? "model/gltf-binary" : url.endsWith(".svg") ? "image/svg+xml" : "text/html")
    response.end(asset)
  }).listen(Number(process.env.STANDBY_TEST_PORT || "4387"), "127.0.0.1")
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
