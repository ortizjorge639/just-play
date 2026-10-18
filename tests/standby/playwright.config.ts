import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

const baseURL = `http://127.0.0.1:${process.env.STANDBY_TEST_PORT || "4387"}`

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/standby",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    cwd: process.cwd(),
    command: `node --import tsx "${path.resolve("tests", "standby", "harness-server.ts")}"`,
    url: baseURL,
    reuseExistingServer: false,
  },
})
