import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Playwright suite for the theme panel. Boots the shell against
 * `test-fixtures/dev-registry/` (which sets `themePanel: {}`) and drives the
 * header popover end to end: mode, primary color, tint, Copy CSS,
 * persistence and sync into the preview iframe.
 *
 *   pnpm test:theme-panel
 *
 * Port: THEME_PANEL_PORT, default 3100 (the fixture's own port).
 */
const isCI = !!process.env.CI
const here = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(here, "test-fixtures/dev-registry")
const port = Number(process.env.THEME_PANEL_PORT ?? 3100)

export default defineConfig({
  testDir: "./tests",
  testMatch: "theme-panel.spec.ts",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [["github"], ["list"]] : "list",
  // First hits compile routes in `next dev`; give them room.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Trailing `-p` wins over the fixture's `port: 3100`.
    command: `node ../../dist/cli/index.js dev -p ${port}`,
    cwd: fixtureDir,
    url: `http://localhost:${port}`,
    timeout: 180_000,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
  },
})
