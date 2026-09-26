import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175";

export default defineConfig({
  testDir: ".",
  testMatch: "prototype.spec.ts",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    browserName: "chromium",
    channel: "chromium",
    headless: true,
    baseURL,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    serviceWorkers: "block",
    launchOptions: {
      args: ["--enable-unsafe-webgpu"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node serve.mjs",
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
