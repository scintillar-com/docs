// Fixture for the versioned build (src/cli/versioned-build.test.ts copies it
// into a temp git repo and tags it). Plain .mjs with no imports so it loads
// without installing anything.
const config = {
  branding: {
    siteName: "Versioned Fixture",
    shortName: "VF",
    siteUrl: "http://localhost:3111",
  },
  versions: {
    // Mini stand-in for `shadcn build` (no network, no install).
    registryBuildCommand: "node scripts/build-registry.mjs",
  },
}

export default config
