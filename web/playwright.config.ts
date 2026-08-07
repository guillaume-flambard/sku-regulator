import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests for the sku-regulator demo.
 *
 * The API and web servers are expected to already be running:
 *   - API: http://127.0.0.1:8000
 *   - Web: http://localhost:3000
 *
 * Run: npx playwright test
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: true,
  retries: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
