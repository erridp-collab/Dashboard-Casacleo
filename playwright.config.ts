import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const authFile = path.join(__dirname, "playwright/.auth/user.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalTeardown: "./tests/e2e/helpers/cleanup.ts",
  projects: [
    {
      name: "setup",
      testMatch: /setup\/auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Direct children of specs/ run on the personal test account —
      // storageState from the "setup" project, no per-test login.
      name: "authenticated",
      testMatch: /specs\/[^/]+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: authFile },
      dependencies: ["setup"],
    },
    {
      // specs/fixtures/ needs a throwaway org for technical reasons
      // (onboarding, signup, platform-admin, tenant isolation) and keeps
      // doing its own login per test — no storageState, no "setup" dependency.
      name: "fixtures",
      testMatch: /specs\/fixtures\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
