import { build } from "esbuild"
import { chromium } from "@playwright/test"
import { createServer } from "node:http"
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { once } from "node:events"
import assert from "node:assert/strict"
import marketingArtwork from "../public/media/game-art/artwork.json" with { type: "json" }

const root = process.cwd()
const media = path.join(root, "public/media")
const evidence = process.env.PROMO_EVIDENCE_DIR ?? path.join(root, ".promo-evidence")
const fps = 30
const duration = 20
const composition = await build({ entryPoints: ["media/promo/scene.js"], bundle: true, write: false, format: "esm", minify: true })
const html = await readFile("media/promo/index.html")
const artworkCredits = await readFile(path.join(media, "artwork-credits.txt"), "utf8")
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost")
    if (url.pathname === "/") { response.setHeader("Content-Type", "text/html"); response.end(html); return }
    if (url.pathname === "/scene.js") { response.setHeader("Content-Type", "application/javascript"); response.end(composition.outputFiles[0].contents); return }
    const name = url.pathname.replace(/^\/media\//, "")
    const isArtwork = marketingArtwork.some(artwork => artwork.image === url.pathname)
    if (!url.pathname.startsWith("/media/") || (!isArtwork && name.includes("/")) || name.includes("..")) { response.writeHead(404).end(); return }
    const content = await readFile(path.join(media, name))
    response.setHeader("Content-Type", name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".jpg") ? "image/jpeg" : "image/png")
    response.end(content)
  } catch (error) {
    console.error(error)
    response.writeHead(500).end("Composition asset unavailable")
  }
})
server.listen(0, "127.0.0.1")
await once(server, "listening")
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
async function encode(width, height, name) {
  const frames = await mkdtemp(path.join(evidence, "frames-"))
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  try {
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(base)
  await page.waitForFunction(() => window.reelReady === true, { timeout: 30000 })
  const seek = async time => page.evaluate(time => {
    window.renderFrame(time)
    return window.frameEvidence
  }, time)
  for (const time of [0, 4, 8, 12, 15, 18]) {
    const draws = await seek(time)
    assert.ok(draws.drawCalls > 0 && draws.triangles > 0, `No geometry at ${time}`)
    if (time === 8) assert.ok(draws.artworkPixel.slice(0, 3).some(channel => channel > 20), `Selected artwork is black: ${JSON.stringify(draws)}`)
    await page.screenshot({ path: path.join(evidence, `${name}-${time}.jpg`), type: "jpeg", quality: 90 })
  }
  await seek(8.25)
  const first = await page.screenshot()
  await seek(1)
  await seek(8.25)
  assert.deepEqual(await page.screenshot(), first, "Seeking backward changed the same frame")
  if (process.argv.includes("--verify-only")) return
  for (let frame = 0; frame < fps * duration; frame++) {
    await seek(frame / fps)
    await page.screenshot({ path: path.join(frames, `${String(frame).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 })
    if (frame % 150 === 0) console.log(`${name}: ${frame}/${fps * duration} frames`)
  }
  const ffmpeg = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(frames, "%05d.jpg"), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-metadata", `comment=${artworkCredits}`, "-metadata", "copyright=Game artwork belongs to respective rights holders; IGDB sources and context in comment", "-movflags", "+faststart", path.join(media, `just-play-${name}.mp4`)], { stdio: "inherit" })
  const [code] = await once(ffmpeg, "exit")
  assert.equal(code, 0, "Video encoding failed")
  if (name === "wide") {
    await seek(17.9)
    await page.screenshot({ path: path.join(media, "reel-poster.jpg"), type: "jpeg", quality: 92 })
  }
  if (errors.length) throw new Error(errors.join("\n"))
  } finally {
    await Promise.all([page.close(), rm(frames, { recursive: true })])
  }
}
try {
  await mkdir(evidence, { recursive: true })
  await encode(1920, 1080, "wide")
  await encode(1080, 1920, "social")
  if (process.argv.includes("--verify-only")) { console.log("Both compositions verified without encoding."); } else {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.goto(base)
  await page.waitForFunction(() => window.reelReady)
  await page.evaluate(() => window.renderFrame(18))
  await page.screenshot({ path: path.join(media, "social-card.jpg"), type: "jpeg", quality: 92 })
  await page.close()
  console.log("Both 20-second 30fps cuts and share images exported.")
  }
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
