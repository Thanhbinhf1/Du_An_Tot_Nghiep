import { defineConfig, devices } from "@playwright/test";

const targetedRun = Boolean(process.env.E2E_TEST_MATCH);

export default defineConfig({
  testDir: "./e2e", testMatch: "*.spec.mjs", testIgnore: "**/.runtime/**", timeout: 45_000,
  expect: { timeout: 10_000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: `test-results/attempt-${process.env.E2E_RUN_LABEL ?? Date.now()}`,
  reporter: [
    ["list"],
    ["json", { outputFile: targetedRun ? "e2e/.runtime/targeted-results.json" : "e2e-results.json" }],
    ["html", { open: "never", outputFolder: targetedRun ? "e2e/.runtime/targeted-html" : "playwright-report" }],
    ["./e2e/report.mjs"],
  ],
  use: { baseURL: "http://127.0.0.1:3101", actionTimeout: 10_000, navigationTimeout: 20_000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
