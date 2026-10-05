// Fixture for versions taken from another repository
// (src/cli/versioned-source.test.ts copies `site/` and `source/` into two
// temp git repos and tags the source). Plain .mjs with no imports so it
// loads without installing anything.
const config = {
  branding: {
    siteName: "External Source Fixture",
    shortName: "EXT",
    siteUrl: "http://localhost:3140",
  },
  versions: {
    source: {
      // Sibling clone; the test also points it at a file:// URL.
      repo: "../source",
      sync: "node scripts/sync-docs.mjs {sourceDir}",
    },
    current: { label: "develop" },
  },
}

export default config
