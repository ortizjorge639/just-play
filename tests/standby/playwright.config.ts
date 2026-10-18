import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  outputDir: "../../test-results/standby",
  use: { baseURL: "http://127.0.0.1:4387", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    cwd: process.cwd(),
    command: `node --import tsx "${path.resolve("tests", "standby", "harness-server.ts")}"`,
    url: "http://127.0.0.1:4387",
    reuseExistingServer: false,
  },
})
