import { test as base, expect, type Page } from "@playwright/test";
import { SAMPLE_GAMES, SAVE_KEY, type Save } from "./src/data";

const test = base.extend<{ networkGuard: void }>({
  networkGuard: [async ({ context, baseURL }, use) => {
    const requests: string[] = [];
    const origin = new URL(baseURL!).origin;
    await context.route("**/*", route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.isNavigationRequest() && request.resourceType() === "document"
        && url.origin === origin && ["/", "/index.html"].includes(url.pathname)) {
        return route.continue();
      }
      requests.push(request.url());
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", socket => {
      requests.push(socket.url());
      socket.close();
    });
    await use();
    expect(requests, "The standalone HTML must not request runtime resources").toEqual([]);
  }, { auto: true }],
});

type Metrics = {
  backend: string;
  frames: number;
  draws: number;
  triangles: number;
  readyMs: number;
  residents: number;
};

function metrics(page: Page) {
  return page.evaluate(() =>
    (window as Window & { treehouseMetrics?: Metrics }).treehouseMetrics ?? null);
}

async function rendererReady(page: Page, backend = /^(WebGPU|WebGL2 fallback)$/) {
  await expect.poll(async () => {
    const value = await metrics(page);
    return Boolean(value && value.readyMs > 0 && value.frames > 0
      && value.draws > 0 && value.triangles > 0);
  }, { message: "The renderer must submit actual geometry, not only report ready", timeout: 45_000 }).toBe(true);
  expect((await metrics(page))!.backend).toMatch(backend);
  await expect(page.locator(".scene-loading, .scene-error")).toHaveCount(0);
}

async function storedSave(page: Page): Promise<Save> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SAVE_KEY);
}

async function seedSave(page: Page, value: string) {
  await page.addInitScript(({ key, value }) => {
    // Seed once so reloads cannot conceal an unwanted automatic overwrite.
    if (sessionStorage.getItem("treehouse-test-seeded")) return;
    localStorage.setItem(key, value);
    sessionStorage.setItem("treehouse-test-seeded", "yes");
  }, { key: SAVE_KEY, value });
}

function nav(page: Page, name: "Backlog" | "In progress" | "Treehouse") {
  return page.getByRole("navigation", { name: "Game library" })
    .getByRole("button", { name: new RegExp(`^${name}\\s+\\d+$`) });
}

function gameCard(page: Page, title: string) {
  return page.getByRole("article").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

async function settledFrames(page: Page) {
  await expect.poll(async () => {
    const before = (await metrics(page))!.frames;
    // Observe real idle time rather than advancing the animation clock.
    await page.waitForTimeout(400);
    return (await metrics(page))!.frames === before;
  }, { message: "Reduced-motion rendering should stop submitting idle frames", timeout: 8_000 }).toBe(true);
  return (await metrics(page))!.frames;
}

test("embedded runtime renders and Backlog search works offline", async ({ page, context }) => {
  await page.goto("/");
  await rendererReady(page);
  expect((await metrics(page))!.residents).toBe(4);
  await context.setOffline(true);

  await page.getByRole("button", { name: "Prototype settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText((await metrics(page))!.backend);
  await page.keyboard.press("Escape");

  await nav(page, "Backlog").click();
  await page.getByRole("searchbox", { name: "Search backlog" }).fill("tUnIc");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(gameCard(page, "TUNIC")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search backlog" }).fill("no such little adventure");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No games by that name." })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(4);
});

test("explicit WebGL2 fallback also submits real draws", async ({ page }) => {
  await page.goto("/?webgl");
  await rendererReady(page, /^WebGL2 fallback$/);
  await page.getByRole("button", { name: "Prototype settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("WebGL2 fallback");
});

test("TUNIC session switches, pauses, finishes, and persists its new resident", async ({ page }) => {
  await page.goto("/");
  await rendererReady(page);
  const startedAt = Date.now();
  await page.clock.setFixedTime(startedAt);
  await nav(page, "Backlog").click();
  await gameCard(page, "TUNIC").getByRole("button", { name: "Start playing" }).click();
  await expect(nav(page, "In progress")).toHaveAttribute("aria-current", "page");
  await expect(gameCard(page, "TUNIC")).toBeVisible();
  expect((await storedSave(page)).games.find(game => game.id === "tunic")!.status).toBe("playing");

  const tunic = gameCard(page, "TUNIC");
  const spirit = gameCard(page, "Spiritfarer");
  const spiritMinutes = SAMPLE_GAMES.find(game => game.id === "spirit")!.minutes;
  await tunic.getByRole("button", { name: "Start a session" }).click();
  expect((await storedSave(page)).session).toMatchObject({ gameId: "tunic", startedAt: expect.any(Number) });
  await page.clock.setFixedTime(startedAt + 65_000);
  await expect(tunic.getByLabel("Session elapsed time")).toHaveText("01:05");

  await spirit.getByRole("button", { name: "Start a session" }).click();
  let save = await storedSave(page);
  expect(save.session!.gameId).toBe("spirit");
  expect(save.games.find(game => game.id === "tunic")!.minutes).toBeCloseTo(65 / 60, 2);
  await expect(page.getByRole("button", { name: "Pause & save" })).toHaveCount(1);
  await expect(tunic.getByRole("button", { name: "Start a session" })).toBeVisible();
  await page.clock.setFixedTime(startedAt + 100_000);
  await expect(spirit.getByLabel("Session elapsed time")).toHaveText("00:35");
  await spirit.getByRole("button", { name: "Pause & save" }).click();
  save = await storedSave(page);
  expect(save.session).toBeNull();
  expect(save.games.find(game => game.id === "spirit")!.minutes).toBeCloseTo(spiritMinutes + 35 / 60, 2);
  await expect(page.getByRole("button", { name: "Pause & save" })).toHaveCount(0);

  await tunic.getByRole("button", { name: "Start a session" }).click();
  await page.clock.setFixedTime(startedAt + 160_000);
  await tunic.getByRole("button", { name: "Finished the game?" }).click();
  await expect(nav(page, "Treehouse")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".resident-item").filter({ hasText: "TUNIC" })).toContainText("Fern lives here now");
  await expect(page.locator(".resident-item")).toHaveCount(5);
  await expect.poll(async () => (await metrics(page))!.residents).toBe(5);
  save = await storedSave(page);
  expect(save.session).toBeNull();
  expect(save.games.find(game => game.id === "tunic")).toMatchObject({ status: "completed", resident: "Fern" });
  expect(save.games.find(game => game.id === "tunic")!.minutes).toBeCloseTo(125 / 60, 2);

  await page.reload();
  await rendererReady(page);
  expect((await metrics(page))!.residents).toBe(5);
  await expect(page.locator(".resident-item")).toHaveCount(5);
  await expect(page.locator(".resident-item").filter({ hasText: "TUNIC" })).toContainText("Fern lives here now");
  expect(await storedSave(page)).toEqual(save);
  await nav(page, "In progress").click();
  await expect(gameCard(page, "TUNIC")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause & save" })).toHaveCount(0);
});

test("keyboard dialogs restore focus and custom HTML metacharacters stay text", async ({ page }) => {
  await page.goto("/");
  const settings = page.getByRole("button", { name: "Prototype settings", exact: true });
  await settings.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Your little prototype." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(settings).toBeFocused();

  await nav(page, "Backlog").click();
  const add = page.getByRole("button", { name: "Add a game", exact: true });
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "A new little possibility." })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
  await page.keyboard.press("Enter");

  const title = '<b>Camp</b> & "friends" <img src=x onerror=alert(1)>';
  const resident = "<Fern & Co>";
  await page.getByLabel("Game title", { exact: true }).fill(title);
  await page.getByLabel("Resident name", { exact: true }).fill(resident);
  await page.getByRole("button", { name: "Add to backlog", exact: true }).click();
  await expect(gameCard(page, title).getByRole("heading")).toHaveText(title);
  await expect(gameCard(page, title).locator("h2 b, h2 img, h2 script")).toHaveCount(0);
  expect((await storedSave(page)).games.find(game => game.title === title)).toMatchObject({ resident, status: "backlog" });
  await page.reload();
  await nav(page, "Backlog").click();
  await expect(gameCard(page, title).getByRole("heading")).toHaveText(title);
  await expect(gameCard(page, title).locator("h2 b, h2 img, h2 script")).toHaveCount(0);
});

test("reduced-motion rendering settles but scene controls still draw updates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await rendererReady(page);
  let frames = await settledFrames(page);
  await page.waitForTimeout(750);
  expect((await metrics(page))!.frames).toBe(frames);

  for (const name of ["Rotate left", "Zoom in", "Switch to evening", "Reset view"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect.poll(async () => (await metrics(page))!.frames).toBeGreaterThan(frames);
    frames = await settledFrames(page);
  }
  await expect(page.getByRole("button", { name: "Switch to afternoon" })).toBeVisible();
  await page.getByRole("button", { name: "Prototype settings", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Reduced (system preference)");
  await page.keyboard.press("Escape");
  await nav(page, "Backlog").click();
  await gameCard(page, "TUNIC").getByRole("button", { name: "Start playing" }).click();
  await expect(nav(page, "In progress")).toHaveAttribute("aria-current", "page");
});

test("a valid empty save renders no residents or sample games", async ({ page }) => {
  const empty = JSON.stringify({ version: 1, games: [], session: null } satisfies Save);
  await seedSave(page, empty);
  await page.goto("/");
  await rendererReady(page);
  expect((await metrics(page))!.residents).toBe(0);
  await expect(page.locator(".resident-item, .resident-note, .mobile-resident-note")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A little room to grow." })).toBeVisible();
  await expect(page.locator(".storage-error")).toHaveCount(0);
  await nav(page, "Backlog").click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A clear shelf. A fresh start." })).toBeVisible();
  await nav(page, "In progress").click();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "What are you in the mood for?" })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(empty);
});

for (const [name, corrupt] of [
  ["invalid schema", JSON.stringify({ version: 1, games: "not an array", session: null })],
  ["malformed JSON", "{unfinished"],
]) {
  test(`${name} shows an explicit saved-data warning without automatic overwrite`, async ({ page }) => {
    await seedSave(page, corrupt);
    await page.goto("/");
    await rendererReady(page);
    const banner = page.locator(".storage-error[role=alert]");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/saved.*(couldn't be read|corrupt|invalid)/i);
    await expect(banner).toContainText(/(hasn't been changed|not.*(changed|overwrit))/i);
    await expect(page.locator(".resident-item")).toHaveCount(4);
    await nav(page, "Backlog").click();
    await nav(page, "In progress").click();
    await page.getByRole("button", { name: "Prototype settings", exact: true }).click();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(corrupt);
    await page.reload();
    await expect(banner).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)).toBe(corrupt);
  });
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}×${viewport.height} views and dialogs have no document horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await rendererReady(page);
    const noOverflow = async (view: string) => {
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth),
      { message: `${view} must fit the ${viewport.width}px viewport` }).toBeLessThanOrEqual(1);
    };
    await noOverflow("Treehouse");
    await page.getByRole("button", { name: "Prototype settings", exact: true }).click();
    await noOverflow("Settings dialog");
    await page.keyboard.press("Escape");
    await nav(page, "Backlog").click();
    await noOverflow("Backlog");
    await page.getByRole("button", { name: "Add a game", exact: true }).click();
    await noOverflow("Add game dialog");
    await page.keyboard.press("Escape");
    await nav(page, "In progress").click();
    await noOverflow("In progress");
  });
}
