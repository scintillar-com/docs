import { defineConfig } from "@sntlr/registry-shell"

/**
 * Development fixture used to iterate on shell features without publishing or
 * touching a real consumer registry. Rich enough to exercise the shell's UI
 * surfaces (sidebar grouping, active-link highlighting, blocks section, docs,
 * primary-tint hover states) with a tiny per-component footprint.
 *
 *   pnpm dev:registry   # from the shell root
 *
 * Not in package.json#files, so it never ships to consumers.
 */
export default defineConfig({
  branding: {
    siteName: "Dev Registry",
    shortName: "DEV",
    siteUrl: "http://localhost:3100",
    description:
      "In-repo dev fixture for the shell. Not a real registry; exists only to validate shell changes end-to-end.",
    github: {
      owner: "scintillar-com",
      repo: "registry-shell",
      label: "Shell repo",
      showStars: false,
    },
  },
  // Exercises the sidebar's category grouping + Base fallback bucket.
  categories: {
    Primitives: ["button", "input", "badge"],
    Layout: ["card"],
    // `hello` and anything new falls through to the synthesized Base group.
  },

  // Exercises the per-component default preview height (clamped 200..1000).
  previewHeight: { card: 520 },

  // Multi-locale exercises the header locale toggle, getDocAllLocales, and
  // the LocalizedMdx serialize → client-render path. Matches /registry's
  // real-world config so the fixture catches multi-locale regressions.
  multilocale: true,
  defaultLocale: "en",
  locales: ["en", "fr"],

  // Exercises the header theme panel (mode, primary color, surface tint,
  // Copy CSS) and its sync into preview iframes. Remove to get the plain
  // sun/moon toggle back.
  themePanel: {},

  port: 3100,
})
