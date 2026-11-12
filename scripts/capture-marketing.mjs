import { chromium } from "@playwright/test"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const base = process.env.MARKETING_HARNESS_URL ?? "http://127.0.0.1:4517"
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname)) throw new Error("Only use the isolated local demo harness")
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await mkdir(path.resolve("public/media"), { recursive: true })
  for (const name of ["discovery", "now-playing", "standby", "home"]) {
    const flags = name === "discovery" ? "&discovery&deck" : name === "home" ? "&active-game&completed-games&residents" : ""
    await page.goto(`${base}/?marketing&app-shell${flags}`)
    if (name === "home") await page.getByRole("button", { name: "Home", exact: true }).click()
    if (name === "standby") await page.getByRole("button", { name: /StandBy/, exact: false }).first().click()
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `public/media/${name}.png` })
    console.log(`Captured ${name}`)
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
