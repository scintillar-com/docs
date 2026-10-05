import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Playwright suite for docs-only sites. Builds `fixtures/docs-basic/` (repo
 * root) with the real CLI and serves its static export, which is what sites
 * deploy (dev mode has a known MDX runtime issue on docs pages).
 *
 *   pnpm test:docs
 *
 * Port: DOCS_PORT, default 3120.
 */
const isCI = !!process.env.CI
const here = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(here, "../../fixtures/docs-basic")
const port = Number(process.env.DOCS_PORT ?? 3120)

export default defineConfig({
  testDir: "./tests",
  testMatch: "docs.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Phone width: no horizontal scrolling allowed.
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: `node ../../packages/registry-shell/dist/cli/index.js build && node ../../scripts/serve-static.mjs out ${port}`,
    cwd: fixtureDir,
    url: `http://localhost:${port}`,
    timeout: 300_000,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
  },
})
