import { defineConfig, devices } from "@playwright/test"
import path from "node:path"

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Software WebGL in the canopy specs times out when many workers share the CPU.
  workers: 2,
  reporter: "list",
  outputDir: "../../test-results/standby",
  // Automatic trace filmstrips force GPU readbacks on every captured frame.
  // Software WebGL then stalls independently of app input/render scheduling.
  // Keep DOM/network/source traces; composition specs still take explicit images.
  use: { trace: { mode: "retain-on-failure", screenshots: false, snapshots: true, sources: true } },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    cwd: process.cwd(),
    command: `node --import tsx "${path.resolve("tests", "standby", "harness-server.ts")}"`,
    env: { STANDBY_TEST_PORT: process.env.STANDBY_TEST_PORT || "0" },
    // Playwright exposes this capture through its default baseURL fixture.
    wait: { stdout: /StandBy harness ready at (?<playwright_test_base_url>http:\/\/127\.0\.0\.1:\d+)/ },
    reuseExistingServer: false,
  },
})
