import { describe, expect, it } from "vitest"
import {
  buildManifest,
  compareVersions,
  parseTagListing,
  parseVersionFromTag,
  pickLatest,
  versionBasePath,
  versionRegistryPath,
  versionSitePath,
} from "./versions.js"

describe("parseVersionFromTag", () => {
  it("reads the trailing semver of common tag styles", () => {
    expect(parseVersionFromTag("v1.2.3")).toBe("1.2.3")
    expect(parseVersionFromTag("1.2.3")).toBe("1.2.3")
    expect(parseVersionFromTag("my-ui@1.2.3")).toBe("1.2.3")
    expect(parseVersionFromTag("@scope/ui@0.10.0")).toBe("0.10.0")
    expect(parseVersionFromTag("v2.0.0-rc.1")).toBe("2.0.0-rc.1")
    expect(parseVersionFromTag("v11.2.3")).toBe("11.2.3")
  })

  it("drops build metadata", () => {
    expect(parseVersionFromTag("v1.2.3+build.5")).toBe("1.2.3")
  })

  it("rejects tags that don't end in a semver", () => {
    expect(parseVersionFromTag("v1.2")).toBeNull()
    expect(parseVersionFromTag("latest")).toBeNull()
    expect(parseVersionFromTag("v1.2.3-")).toBeNull()
    expect(parseVersionFromTag("v1.2.3.4")).toBeNull()
  })
})

describe("compareVersions", () => {
  const sorted = (list: string[]) => [...list].sort(compareVersions)

  it("orders numerically, not lexically", () => {
    expect(sorted(["0.10.0", "0.2.0", "0.9.1", "1.0.0"])).toEqual([
      "0.2.0",
      "0.9.1",
      "0.10.0",
      "1.0.0",
    ])
  })

  it("follows semver prerelease precedence", () => {
    expect(
      sorted([
        "1.0.0",
        "1.0.0-rc.1",
        "1.0.0-beta.11",
        "1.0.0-beta.2",
        "1.0.0-beta",
        "1.0.0-alpha.1",
        "1.0.0-alpha",
        "1.0.0-alpha.beta",
      ]),
    ).toEqual([
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
    ])
  })

  it("returns 0 for equal versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0)
  })
})

describe("pickLatest", () => {
  it("prefers the highest stable release over newer prereleases", () => {
    expect(pickLatest(["0.1.0", "1.0.0", "2.0.0-rc.1"])).toBe("1.0.0")
  })

  it("falls back to the highest prerelease when nothing is stable", () => {
    expect(pickLatest(["1.0.0-alpha", "1.0.0-beta"])).toBe("1.0.0-beta")
  })

  it("is null without versions", () => {
    expect(pickLatest([])).toBeNull()
  })
})

describe("parseTagListing", () => {
  const listing = [
    // lightweight tag: no peeled sha
    "v0.1.0\taaaaaaaa\t\t2026-01-01T10:00:00+00:00",
    // annotated tag: object is the tag, peeled is the commit
    "v1.0.0\ttagobject\tcccccccc\t2026-03-01T10:00:00+00:00",
    "v0.10.0\tbbbbbbbb\t\t2026-02-01T10:00:00+00:00",
    "vNext\tdddddddd\t\t2026-04-01T10:00:00+00:00",
    "",
  ].join("\n")

  it("returns version tags newest first, peeling annotated tags", () => {
    const { tags, skipped } = parseTagListing(listing)
    expect(tags.map((t) => [t.tag, t.version, t.commit])).toEqual([
      ["v1.0.0", "1.0.0", "cccccccc"],
      ["v0.10.0", "0.10.0", "bbbbbbbb"],
      ["v0.1.0", "0.1.0", "aaaaaaaa"],
    ])
    expect(tags[0].date).toBe("2026-03-01T10:00:00+00:00")
    expect(skipped).toEqual(["vNext"])
  })

  it("keeps the first tag when two carry the same version", () => {
    const { tags, skipped } = parseTagListing(
      "v1.0.0\taaaa\t\t2026-01-01\nui@1.0.0\tbbbb\t\t2026-01-02\n",
    )
    expect(tags.map((t) => t.tag)).toEqual(["v1.0.0"])
    expect(skipped).toEqual(["ui@1.0.0"])
  })

  it("handles CRLF output", () => {
    const { tags } = parseTagListing("v1.0.0\taaaa\t\t2026-01-01\r\n")
    expect(tags[0].date).toBe("2026-01-01")
  })
})

describe("paths", () => {
  it("puts the site under /v/<version>/ and the registry under /r/v<version>/", () => {
    expect(versionSitePath("1.0.0")).toBe("/v/1.0.0/")
    expect(versionBasePath("1.0.0")).toBe("/v/1.0.0")
    expect(versionRegistryPath("1.0.0")).toBe("/r/v1.0.0/")
  })
})

describe("buildManifest", () => {
  it("lists versions newest first and flags the latest release", () => {
    const manifest = buildManifest([
      { tag: "v0.1.0", version: "0.1.0", commit: "a", date: "d1" },
      { tag: "v2.0.0-rc.1", version: "2.0.0-rc.1", commit: "c", date: "d3" },
      { tag: "v1.0.0", version: "1.0.0", commit: "b", date: "d2" },
    ])
    expect(manifest.latest).toBe("1.0.0")
    expect(manifest.versions).toEqual([
      {
        version: "2.0.0-rc.1",
        tag: "v2.0.0-rc.1",
        commit: "c",
        date: "d3",
        isLatest: false,
        path: "/v/2.0.0-rc.1/",
        registry: "/r/v2.0.0-rc.1/",
      },
      {
        version: "1.0.0",
        tag: "v1.0.0",
        commit: "b",
        date: "d2",
        isLatest: true,
        path: "/v/1.0.0/",
        registry: "/r/v1.0.0/",
      },
      {
        version: "0.1.0",
        tag: "v0.1.0",
        commit: "a",
        date: "d1",
        isLatest: false,
        path: "/v/0.1.0/",
        registry: "/r/v0.1.0/",
      },
    ])
  })

  it("is empty with no tags", () => {
    expect(buildManifest([])).toEqual({ latest: null, versions: [] })
  })
})
