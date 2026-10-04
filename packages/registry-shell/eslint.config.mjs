import { FlatCompat } from "@eslint/eslintrc"
import path from "node:path"
import { fileURLToPath } from "node:url"

// ESLint 9 flat config. `FlatCompat` bridges the legacy `extends: [...]`
// style configs (which Next still ships) into the new flat format.
const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
})

const config = [
  // Ignore generated + vendored trees. Flat config requires these to live
  // on a dedicated config object (no other keys) to apply globally.
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src/next-app/.next/**",
      "src/next-app/next-env.d.ts",
      "src/next-app/app/_user-sources.css",
      "src/next-app/app/_user-global.css",
      "src/next-app/.*-mode",
      "*.tsbuildinfo",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Project-level overrides.
  {
    rules: {
      // Treat `_`-prefixed args and locals as intentional. Matches the
      // convention the codebase already uses (e.g. `_args` in CLI commands).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // CLI uses console as its entire UX — don't flag it there.
    files: ["src/cli/**/*.ts", "src/adapter/**/*.ts", "src/config-loader.ts"],
    rules: {
      "no-console": "off",
    },
  },
]

export default config
