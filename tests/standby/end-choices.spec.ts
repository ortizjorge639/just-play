import { test, expect, type Page } from "@playwright/test"

const writes = (page: Page) => page.evaluate(() => window.standbyFixture.gameEndWrites.map(write => write.kind))
const confirm = (page: Page) => page.getByRole("button", { name: "Yes, I beat it", exact: true })

async function openEndSheet(page: Page) {
  await page.getByRole("button", { name: "End Session", exact: true }).click()
  const beaten = page.getByRole("button", { name: "I Beat This Game!", exact: true })
  await expect(page.locator("div.rounded-t-3xl").filter({ has: beaten })).toHaveCSS("transform", "none")
  return beaten
}

test("beating a game from a session asks first, and Not yet changes nothing", async ({ page }) => {
  await page.goto("/")
  await (await openEndSheet(page)).click()

  await expect(page.getByRole("heading", { name: "Beat A Short Hike?" })).toBeVisible()
  await expect(page.getByText("It can't be undone.")).toBeVisible()
  expect(await writes(page)).toEqual([])

  await page.getByRole("button", { name: "Not yet", exact: true }).click()
  await expect(page.getByRole("heading", { name: "End Session" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Done for Today" })).toBeVisible()
  expect(await writes(page)).toEqual([])

  await page.getByRole("button", { name: "I Beat This Game!", exact: true }).click()
  await confirm(page).click()
  await expect.poll(() => writes(page)).toEqual(["beaten"])
})

test("the end sheet reopens on its choices after a dismissed confirmation", async ({ page }) => {
  await page.goto("/")
  await (await openEndSheet(page)).click()
  await expect(confirm(page)).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(confirm(page)).toHaveCount(0)

  await openEndSheet(page)
  await expect(page.getByRole("heading", { name: "End Session" })).toBeVisible()
  expect(await writes(page)).toEqual([])
})

test("setting a game aside from a session takes one tap", async ({ page }) => {
  await page.goto("/")
  await openEndSheet(page)
  await page.getByRole("button", { name: "Set Game Aside", exact: true }).click()
  await expect.poll(() => writes(page)).toEqual(["abandoned"])
})

test("beating the current game asks first, and Not yet changes nothing", async ({ page }) => {
  await page.goto("/?current-game")
  await page.getByRole("button", { name: "More options", exact: true }).click()
  await page.getByRole("button", { name: "I Beat This Game!", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Beat A Short Hike?" })).toBeVisible()
  expect(await writes(page)).toEqual([])
  await page.getByRole("button", { name: "Not yet", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Game options" })).toBeVisible()
  expect(await writes(page)).toEqual([])
})

for (const name of ["I Beat This Game!", "Set Game Aside"]) {
  test(`a failed ${name} closes the sheet so its error is readable`, async ({ page }) => {
    await page.goto("/?current-game")
    await expect(page.getByRole("button", { name: "Start Today's Session", exact: true })).toBeEnabled()
    await page.evaluate(() => { window.standbyFixture.completionError = "Could not update this game. Try again." })
    await page.getByRole("button", { name: "More options", exact: true }).click()
    await page.getByRole("button", { name, exact: true }).click()
    if (name === "I Beat This Game!") await confirm(page).click()

    await expect(page.getByText("Could not update this game. Try again.")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Game options" })).toHaveCount(0)
    await expect(confirm(page)).toHaveCount(0)
    // Nothing covers the page, so the next action is reachable.
    await page.getByRole("button", { name: "More options", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Game options" })).toBeVisible()
  })
}

test("the current-game details show status without a made-up completion bar", async ({ page }) => {
  await page.goto("/?current-game")
  await page.getByRole("button", { name: "View details" }).click()
  const journey = page.getByText("Journey", { exact: true }).locator("..")
  await expect(journey).toContainText("In progress")
  await expect(journey.locator("..").locator("div.rounded-full")).toHaveCount(0)
})
