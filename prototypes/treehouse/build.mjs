import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const baseline = process.argv.includes("--baseline");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/app.tsx"],
  bundle: true,
  write: false,
  minify: !baseline,
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  legalComments: "inline",
  metafile: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
const css = await readFile(path.join(root, "src/style.css"), "utf8");
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const dependencyRoots = new Set(Object.keys(result.metafile.inputs)
  .map(input => input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1]).filter(Boolean));
const notices = [];
for (const directory of [...dependencyRoots].sort()) {
  const metadata = JSON.parse(await readFile(path.join(root, directory, "package.json"), "utf8"));
  let license = null;
  for (const candidate of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENSE-MIT"]) {
    try {
      license = await readFile(path.join(root, directory, candidate), "utf8");
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!license) throw new Error(`Missing redistribution license for ${metadata.name}`);
  notices.push({ name: metadata.name, version: metadata.version, license });
}
const html = `<!doctype html>
<!--
THESIS: Finished games become friends in a handcrafted miniature clubhouse.
OWN-WORLD: Mint forest, butter-yellow paper, cedar joinery, woolly leaf crowns;
rounded toy residents and familiar, clearly labeled controls.
STORY: Visit your residents, choose a game, enjoy a session, welcome a new friend.
FIRST VIEWPORT: Full-width diorama below a compact navigation bar; welcome at
left, island at center, a small resident note at right, resident shelf below.
FORM: User-pinned cozy toy diorama. No generated direction or copied game assets.
-->
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#eef3df">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='12' fill='%2352775e'/%3E%3Cpath d='M29 10C14 8 8 15 13 25c8 6 17-2 16-15ZM12 30l12-15' fill='none' stroke='%23fff1c8' stroke-width='2'/%3E%3C/svg%3E">
<meta name="description" content="A cozy little home for the games you finish. Interactive Just Play prototype.">
<title>Just Play - Your little treehouse</title>
<style>${css}</style></head><body>
<div id="root"></div>
<noscript>This interactive prototype needs JavaScript. No account or network connection is required.</noscript>
<script type="application/json" id="third-party-notices">${JSON.stringify(notices).replace(/</g, "\\u003c")}</script>
${baseline ? '<script>window.__TREEHOUSE_BASELINE__ = true;</script>' : ""}
<script>${js}</script></body></html>`;
const filename = baseline ? "baseline.html" : "index.html";
await writeFile(path.join(root, filename), html);
console.log(`${filename}: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB raw, ${(gzipSync(html).length / 1024).toFixed(1)} KiB gzip; all runtime dependencies embedded.`);
