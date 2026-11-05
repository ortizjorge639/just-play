import { test, expect } from "@playwright/test"

test("Progress keeps the profile compact and places favorite art on the right", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/?app-shell&card-filled&card-library")
  await page.getByRole("button", { name: "Progress" }).click()

  const profile = page.getByRole("region", { name: "Player profile" })
  const favoriteArt = profile.getByTestId("favorite-game-art")
  await expect(profile.getByRole("heading", { name: "Player" })).toBeVisible()
  await expect(profile.getByText("Slow games, long evenings")).toBeVisible()
  await expect(profile.getByText("Library A")).toBeVisible()
  await expect(favoriteArt).toHaveCSS("aspect-ratio", "4 / 3")

  const profileBounds = await profile.boundingBox()
  const artBounds = await favoriteArt.boundingBox()
  expect(profileBounds).not.toBeNull()
  expect(artBounds).not.toBeNull()
  expect(profileBounds!.height).toBeLessThan(260)
  expect(artBounds!.x).toBeGreaterThan(profileBounds!.x + profileBounds!.width / 2)

  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(favoriteArt).toHaveCSS("aspect-ratio", "4 / 3")
  const desktopProfileBounds = await profile.boundingBox()
  const desktopArtBounds = await favoriteArt.boundingBox()
  expect(desktopProfileBounds).not.toBeNull()
  expect(desktopArtBounds).not.toBeNull()
  expect(desktopProfileBounds!.height).toBeLessThan(260)
  expect(desktopArtBounds!.x).toBeGreaterThan(desktopProfileBounds!.x + desktopProfileBounds!.width / 2)
})
