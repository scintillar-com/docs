import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Playwright smoke suite for @scintillar/ui-shell.
 *
 * Boots the shell against `test-fixtures/minimal-registry/` on port 3100 and
 * hits a handful of routes to catch gross regressions. Fast (~20s), no visual
 * comparison, no user flows — just "does each route render at all".
 */
const isCI = !!process.env.CI
const here = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(here, "test-fixtures/minimal-registry")

export default defineConfig({
  testDir: "./tests",
  // The theme panel suite runs against the dev-registry fixture with its own
  // config (playwright.theme-panel.config.ts).
  testIgnore: ["**/theme-panel.spec.ts"],
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node ../../dist/cli/index.js dev",
    cwd: fixtureDir,
    url: "http://localhost:3100",
    timeout: 60_000,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
  },
})
