import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.env.PROTOTYPE_URL || "http://127.0.0.1:4175";
const output = new URL("./artifacts/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--enable-unsafe-webgpu"] });
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
try {
  for (const filename of ["baseline.html", "index.html"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${base}/${filename}`);
    await page.waitForFunction(() => window.treehouseMetrics?.frames > 12, { timeout: 60000 });
    await page.waitForTimeout(5000);
    const metrics = await page.evaluate(() => window.treehouseMetrics);
    if (errors.length) throw new Error(`${filename}: ${errors.join("\n")}`);
    results.push({
      file: filename, backend: metrics.backend, draws: metrics.draws,
      triangles: metrics.triangles, staticMeshes: metrics.staticMeshes,
      staticBatches: metrics.staticBatches, pixelRatio: metrics.pixelRatio,
      readyMs: Math.round(metrics.readyMs),
      renderSubmitMedianMs: Number(median(metrics.renderTimes).toFixed(2)),
      renderSubmitP95Ms: Number([...metrics.renderTimes].sort((a, b) => a - b)[Math.floor(metrics.renderTimes.length * .95)].toFixed(2)),
      frameIntervalMedianMs: Number(median(metrics.frameIntervals).toFixed(2)),
    });
    if (filename === "index.html" && !process.argv.includes("--metrics-only")) {
      await page.screenshot({ path: fileURLToPath(new URL("desktop.png", output)), fullPage: true });
      await page.getByRole("button", { name: /Backlog \d/ }).click();
      await page.screenshot({ path: fileURLToPath(new URL("backlog.png", output)), fullPage: true });
      await page.getByRole("button", { name: /In progress \d/ }).click();
      await page.screenshot({ path: fileURLToPath(new URL("playing.png", output)), fullPage: true });
      await page.getByRole("button", { name: /Treehouse \d/ }).click();
      await page.getByRole("button", { name: "Switch to evening" }).click();
      await page.waitForTimeout(150);
      await page.screenshot({ path: fileURLToPath(new URL("evening.png", output)), fullPage: true });
      await page.getByRole("button", { name: "Switch to afternoon" }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: fileURLToPath(new URL("mobile.png", output)), fullPage: true });
      await page.getByRole("button", { name: /Backlog \d/ }).click();
      await page.screenshot({ path: fileURLToPath(new URL("mobile-backlog.png", output)), fullPage: true });
    }
    await context.close();
  }
  await writeFile(new URL("profile.json", output), JSON.stringify({ environment: "Chromium headless, 1440x1000 CSS px, DPR 2, 5-second warmed sample. CPU render submission, not GPU execution timing.", results }, null, 2));
  console.table(results);
} finally {
  await browser.close();
}
