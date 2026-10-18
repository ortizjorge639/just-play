import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
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
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    alias: {
      "@/app/actions": path.resolve("tests", "standby", "mock-actions.ts"),
      "next/image": path.resolve("tests", "standby", "mock-image.tsx"),
    },
  })
  const css = await postcss([tailwind()]).process(await readFile(path.resolve("app", "globals.css"), "utf8"), {
    from: path.resolve("app", "globals.css"),
  })
  const html = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated StandBy test harness</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`
  createServer((request, response) => {
    const asset = request.url === "/bundle.js" ? result.outputFiles[0].contents
      : request.url === "/style.css" ? css.css : html
    response.setHeader("Content-Type", request.url === "/bundle.js" ? "application/javascript"
      : request.url === "/style.css" ? "text/css" : "text/html")
    response.end(asset)
  }).listen(Number(process.env.STANDBY_TEST_PORT || "4387"), "127.0.0.1")
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
