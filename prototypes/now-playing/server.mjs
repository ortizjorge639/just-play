import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const page = fileURLToPath(new URL("./index.html", import.meta.url))
const artwork = fileURLToPath(new URL("../../public/images/games/hollow-knight.jpg", import.meta.url))
const port = Number(process.env.NOW_PLAYING_PROTOTYPE_PORT || 4391)

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname
  const target = pathname === "/" ? page : pathname === "/artwork.jpg" ? artwork : null
  if (!target) {
    response.writeHead(404, { "Content-Type": "text/plain" })
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
    console.error("Could not serve Now Playing prototype:", error)
    response.writeHead(500, { "Content-Type": "text/plain" })
    response.end("Prototype file could not be loaded.")
  }
})

server.on("error", error => {
  console.error("Now Playing prototype server failed:", error)
  process.exitCode = 1
})
server.listen(port, "127.0.0.1", () => {
  console.log(`Now Playing layout prototype: http://127.0.0.1:${port}`)
})
