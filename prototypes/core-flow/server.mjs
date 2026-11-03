import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const root = new URL("./", import.meta.url)
const page = fileURLToPath(new URL("index.html", root))
const imageDirectory = fileURLToPath(new URL("../../public/images/games/", import.meta.url))
const images = new Set([
  "animal-crossing.jpg",
  "celeste.jpg",
  "hades.jpg",
  "hollow-knight.jpg",
  "stardew.jpg",
])
const port = Number(process.env.CORE_FLOW_PROTOTYPE_PORT || 4392)

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname
  const imageName = pathname.startsWith("/art/") ? pathname.slice(5) : null
  const target = pathname === "/" ? page
    : imageName && images.has(imageName) ? `${imageDirectory}/${imageName}`
      : null

  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("Not found")
    return
  }

  try {
    const content = await readFile(target)
    response.writeHead(200, {
      "Content-Type": pathname === "/" ? "text/html; charset=utf-8" : "image/jpeg",
      "Cache-Control": "no-store",
    })
    response.end(content)
  } catch (error) {
    console.error("Could not serve core-flow prototype:", error)
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("Prototype file could not be loaded.")
  }
})

server.on("error", error => {
  console.error("Core-flow prototype server failed:", error)
  process.exitCode = 1
})
server.listen(port, "127.0.0.1", () => {
  console.log(`Core-flow prototype: http://127.0.0.1:${port}`)
})
