// Playwright configuration for the phone-width layout spec
// (tests-e2e/layout.spec.ts). Kept separate from the Vitest suite:
// vitest.config.ts only includes tests/**, this only runs
// tests-e2e/**.
//
// The webServer serves the PRODUCTION build on a test port, so
// `npm run build` must have run first (CI builds before this step;
// locally, build once and the server reuses the output).

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
