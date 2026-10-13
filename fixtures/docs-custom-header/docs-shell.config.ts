import { defineConfig } from "@sntlr/docs-shell"

/**
 * A site with its own header: `components.header` replaces the shell's,
 * `--shell-header-height` (in styles/theme.css) makes it 4rem tall, and
 * `mobileMenu.tools` moves search, language and theme into the mobile menu.
 *
 *   pnpm --filter docs-custom-header shell        # dev (docs-shell), port 3131
 *   pnpm --filter docs-custom-header shell:build  # static export to out/
 *
 * Not in package.json#files, so it never ships to consumers.
 */
export default defineConfig({
  branding: {
    siteName: "Custom Header",
    shortName: "CH",
    siteUrl: "http://localhost:3131",
    description: "A site that supplies its own header.",
  },
  multilocale: true,
  defaultLocale: "en",
  locales: ["en", "fr"],
  sections: [{ dir: "guides", label: "Guides", icon: "Rocket" }],
  paths: {
    globalCss: "./styles/theme.css",
  },
  components: {
    header: "./components/site-header.tsx",
  },
  mobileMenu: {
    tools: true,
  },
  port: 3131,
})
