import { chromium, webkit, firefox } from "@playwright/test"
import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const base = process.env.MARKETING_URL ?? "http://127.0.0.1:4519"
const evidence = process.env.MARKETING_EVIDENCE_DIR ?? ".marketing-evidence"
await mkdir(evidence, { recursive: true })
for (const [name, browserType] of Object.entries({ chromium, webkit, firefox })) {
  const browser = await browserType.launch()
  try {
    for (const [width, height] of [[1440, 900], [320, 568], [390, 844], [844, 390]]) {
      const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 1000, reducedMotion: "reduce" })
      const errors = []
      const requested = []
      page.on("pageerror", error => errors.push(error.message))
      page.on("console", message => { if (message.type() === "error" && /hydration|did not match/i.test(message.text())) errors.push(message.text()) })
      page.on("request", request => requested.push(request.url()))
      const response = await page.goto(`${base}/about`)
      assert.equal(response.status(), 200)
      assert.equal(await page.getByRole("link", { name: "Watch the reel", exact: true }).getAttribute("href"), "#film")
      assert.equal((await page.request.get(`${base}/media/artwork-credits.txt`)).status(), 200)
      assert.equal(await page.locator("h1").innerText(), "Flow through\nyour backlog.")
      await page.waitForFunction(() => [...document.images].filter(image => image.loading !== "lazy").every(image => image.complete && image.naturalWidth > 0))
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: overflow at ${width}`)
      for (const selector of [".landing-nav nav a", ".landing-primary", ".landing-secondary", ".landing-feature figure > a", ".landing-footer > a", ".landing-faq summary"]) {
        const sizes = await page.locator(selector).evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => ({ height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })))
        assert.ok(sizes.every(size => size.height >= 44 && size.width >= 44), `${name}: small touch target ${selector} at ${width}`)
      }
      if (width <= 420) {
        const hero = await page.locator(".landing-hero-art").boundingBox()
        const cover = await page.locator(".landing-cover-front").boundingBox()
        assert.ok(cover.x >= hero.x && cover.x + cover.width <= hero.x + hero.width, "Cover clipped on phone")
        assert.ok(cover.y + cover.height <= hero.y + hero.height, "Cover overflows hero")
      }
      assert.ok(!requested.some(url => url.includes("just-play-wide.mp4")), "Video downloaded before interaction")
      assert.ok(!requested.some(url => /three|scene\.js/i.test(url)), "Marketing loaded WebGL")
      assert.equal(await page.locator("video").getAttribute("autoplay"), null)
      await page.getByText("Does Just Play connect to my Steam library?", { exact: true }).click()
      assert.equal(await page.locator(".landing-faq details").first().getAttribute("open"), "")
      await page.keyboard.press("Tab")
      assert.ok(await page.evaluate(() => document.activeElement !== document.body), "No keyboard focus")
      const popupPromise = page.waitForEvent("popup")
      await page.getByRole("link", { name: "Open full-size discovery screenshot" }).click()
      const popup = await popupPromise
      await popup.waitForLoadState()
      assert.ok(popup.url().endsWith("/media/discovery.png"))
      await popup.close()
      if (name !== "firefox") {
        await page.locator("video").evaluate(async video => { video.muted = true; await video.play(); })
        await page.waitForFunction(() => document.querySelector("video").currentTime > .1)
        await page.locator("video").evaluate(video => video.pause())
        assert.ok(await page.locator("video").evaluate(video => video.videoWidth === 1920 && video.videoHeight === 1080))
        if (name === "chromium" && width === 1440) {
          await page.locator("video").evaluate(video => new Promise(resolve => {
            video.addEventListener("seeked", resolve, { once: true })
            video.currentTime = 8
          }))
          await page.locator("video").screenshot({ path: path.join(evidence, "shipped-wide-promo.png") })
        }
      }
      assert.deepEqual(errors, [], `${name}: browser errors`)
      if (name === "chromium") {
        await page.evaluate(() => scrollTo(0, 0))
        await page.screenshot({ path: path.join(evidence, `landing-${width}.png`), fullPage: true })
      }
      if (width === 1440) {
        const root = await page.goto(base)
        assert.equal(root.status(), 200)
        await page.getByRole("heading", { name: "Flow through your backlog." }).waitFor()
        await page.getByRole("link", { name: "Find my next game" }).first().click()
        await page.waitForURL(`${base}/auth/sign-up`)
        await page.getByRole("heading", { name: "Create Account" }).waitFor()
        assert.ok(await page.getByLabel("Email", { exact: true }).isVisible())
        assert.ok(await page.getByLabel("Password", { exact: true }).isVisible())
        if (name === "chromium") await page.screenshot({ path: path.join(evidence, "signup-from-root.png"), fullPage: true })
        await page.goto(`${base}/about`)
        await page.getByRole("link", { name: "Sign in", exact: true }).click()
        await page.waitForURL(`${base}/auth/login`)
        assert.ok(await page.getByLabel("Email", { exact: true }).isVisible())
        assert.ok(await page.getByLabel("Password", { exact: true }).isVisible())
        const privateResponse = await page.request.get(`${base}/api/player`, { maxRedirects: 0 })
        assert.equal(privateResponse.status(), 307)
        assert.equal(new URL(privateResponse.headers().location, base).pathname, "/auth/login")
        assert.deepEqual(errors, [], `${name}: browser errors during navigation`)
      }
      await page.close()
      console.log(`${name} ${width}×${height}: public SSR, layout, media, keyboard, screenshots passed`)
    }
  } finally {
    await browser.close()
  }
}
