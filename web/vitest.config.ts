// Vitest runs the logic suite only (tests/**). The Playwright
// layout spec lives in tests-e2e/ and is run by playwright.config.ts
// — without this include list Vitest would try to collect it too.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
