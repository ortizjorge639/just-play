import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4175);
const root = new URL("./", import.meta.url);
createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const filename = pathname === "/baseline.html" ? "baseline.html" : "index.html";
  if (!["/", "/index.html", "/baseline.html"].includes(pathname)) {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const html = await readFile(new URL(filename, root));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(html);
  } catch (error) {
    console.error(`Unable to serve ${fileURLToPath(new URL(filename, root))}`, error);
    response.writeHead(500).end("Build the prototype first: pnpm build");
  }
}).listen(port, "127.0.0.1", () => console.log(`Treehouse: http://127.0.0.1:${port}`));
