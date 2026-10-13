import { defineConfig, devices } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Playwright suites for docs-only sites. Builds `fixtures/docs-basic/`,
 * `fixtures/docs-nested/` and `fixtures/docs-custom-header/` (repo root) with
 * the real CLI and serves their static exports, which is what sites deploy
 * (dev mode has a known MDX runtime issue on docs pages).
 *
 *   pnpm test:docs
 *
 * Ports: DOCS_PORT (docs-basic, default 3120), DOCS_NESTED_PORT
 * (docs-nested, default 3121) and DOCS_CUSTOM_HEADER_PORT
 * (docs-custom-header, default 3122); each spec reads its own.
 */
const isCI = !!process.env.CI
const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.DOCS_PORT ?? 3120)
const nestedPort = Number(process.env.DOCS_NESTED_PORT ?? 3121)
const customHeaderPort = Number(process.env.DOCS_CUSTOM_HEADER_PORT ?? 3122)


export default defineConfig({
  testDir: "./tests",
  testMatch: ["docs.spec.ts", "docs-nested.spec.ts", "custom-header.spec.ts"],
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
  // One command builds both fixtures one after the other (builds share the
  // shell's own folder, and Playwright starts webServer entries in parallel),
  // then serves each static export.
  webServer: {
    command: `node scripts/serve-built-fixtures.mjs docs-basic:${port} docs-nested:${nestedPort} docs-custom-header:${customHeaderPort}`,
    cwd: path.join(here, "../.."),
    url: `http://localhost:${customHeaderPort}`,
    timeout: 600_000,
    reuseExistingServer: !isCI,
    stdout: "pipe",
    stderr: "pipe",
  },
})
