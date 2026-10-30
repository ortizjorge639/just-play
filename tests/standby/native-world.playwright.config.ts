import { defineConfig } from "@playwright/test"
import standard from "./playwright.config"

// Run with xvfb-run on headless Linux. A separate entry point is intentional:
// native OS tab visibility cannot be tested with the ordinary page fixture.
export default defineConfig({
  ...standard,
  testMatch: "*.native.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  outputDir: "../../test-results/native-world",
  use: { baseURL: standard.use?.baseURL, trace: "off" },
  projects: [{ name: "native-chromium" }],
})
