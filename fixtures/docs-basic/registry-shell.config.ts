import { defineConfig } from "@sntlr/registry-shell"

/**
 * Docs-only fixture: documentation pages, no components or blocks. Checks
 * that the shell works as a plain documentation site (docs homepage, no
 * empty Components section) and exercises `<slug>.<locale>.mdx`
 * translations in the single-folder layout.
 *
 *   pnpm --filter docs-basic shell        # dev, port 3110
 *   pnpm --filter docs-basic shell:build  # static export to out/
 *
 * Not in package.json#files, so it never ships to consumers.
 */
export default defineConfig({
  branding: {
    siteName: "Docs Basic",
    shortName: "DOCS",
    siteUrl: "http://localhost:3110",
    description: "A documentation site with no component registry.",
  },
  defaultLocale: "en",
  locales: ["en", "fr"],
  port: 3110,
})
