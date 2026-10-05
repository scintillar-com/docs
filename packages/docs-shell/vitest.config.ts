import { defineConfig } from "vitest/config"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

// Vitest config — scoped to unit tests only. The `tests/` folder is owned
// by Playwright (see playwright.theme-panel.config.ts `testDir: "./tests"`); without an
// explicit `include`, Vitest would also pick up `tests/*.spec.ts` and crash
// on Playwright's `test.describe()`. So we restrict to `src/**/*` and let
// future unit tests live next to the code they cover.
//
// `passWithNoTests` stops CI from failing when no unit tests exist yet —
// CI's job is to catch regressions, not to mandate that tests exist.
export default defineConfig({
  // Mirror the `@shell/*` path alias from tsconfig.json so unit tests can
  // import shell components the same way the app does.
  resolve: {
    alias: { "@shell": path.join(here, "src/next-app") },
  },
  // tsconfig.json keeps `jsx: "preserve"` for Next; tests need JSX compiled.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "tests/**",
    ],
    passWithNoTests: true,
  },
})
