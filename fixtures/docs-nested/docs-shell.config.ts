import { defineConfig } from "@sntlr/docs-shell"

/**
 * Nested docs fixture: sections (top-level folders), folders with and
 * without an `_index` page, a root-level page, and locale folders (en / fr)
 * mirroring nested paths. `guides` is declared (label + icon); `reference`
 * is only found on disk, so it gets a title-cased label.
 *
 *   pnpm --filter docs-nested shell        # dev (docs-shell), port 3130
 *   pnpm --filter docs-nested shell:build  # static export to out/
 *
 * Not in package.json#files, so it never ships to consumers.
 */
export default defineConfig({
  branding: {
    siteName: "Docs Nested",
    shortName: "NEST",
    siteUrl: "http://localhost:3130",
    description: "Sections, nested folders and translated pages.",
  },
  multilocale: true,
  defaultLocale: "en",
  locales: ["en", "fr"],
  sections: [{ dir: "guides", label: "User guide", icon: "Rocket" }],
  port: 3130,
})
