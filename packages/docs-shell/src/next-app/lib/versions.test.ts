import { describe, expect, it } from "vitest"
import { withBasePath } from "./base-path"
import { latestReleaseHref, switchTargets, versionRoot, type VersionsManifest } from "./versions"

describe("withBasePath", () => {
  it("is the identity without a base path (regular builds)", () => {
    expect(withBasePath("/r/hello.json", "")).toBe("/r/hello.json")
  })

  it("prefixes root-relative URLs", () => {
    expect(withBasePath("/preview/hello/", "/v/1.0.0")).toBe("/v/1.0.0/preview/hello/")
    expect(withBasePath("/", "/v/1.0.0")).toBe("/v/1.0.0/")
  })

  it("leaves absolute, protocol-relative, relative and already-prefixed URLs alone", () => {
    expect(withBasePath("https://x.dev/a", "/v/1.0.0")).toBe("https://x.dev/a")
    expect(withBasePath("//cdn.x.dev/a", "/v/1.0.0")).toBe("//cdn.x.dev/a")
    expect(withBasePath("#usage", "/v/1.0.0")).toBe("#usage")
    expect(withBasePath("/v/1.0.0/docs/", "/v/1.0.0")).toBe("/v/1.0.0/docs/")
  })
})

describe("switchTargets", () => {
  it("maps the current page into another version", () => {
    expect(versionRoot("")).toBe("")
    expect(switchTargets("0.1.0", "/components/button/")).toEqual({
      candidate: "/v/0.1.0/components/button/",
      home: "/v/0.1.0/",
    })
    expect(switchTargets("", "/docs/intro")).toEqual({
      candidate: "/docs/intro/",
      home: "/",
    })
  })

  it("goes straight to the home page from the home page", () => {
    expect(switchTargets("1.0.0", "/")).toEqual({ candidate: null, home: "/v/1.0.0/" })
  })
})

describe("latestReleaseHref", () => {
  const entry = (version: string, isLatest: boolean) => ({
    version,
    tag: `v${version}`,
    commit: version,
    date: "",
    isLatest,
    path: `/v/${version}/`,
    registry: `/r/v${version}/`,
  })
  const versions = [entry("1.1.0", true), entry("1.0.0", false)]

  it("is the site root when the root is the latest release", () => {
    const manifest: VersionsManifest = { latest: "1.1.0", versions }
    expect(latestReleaseHref(manifest)).toBe("/")
    expect(latestReleaseHref({ ...manifest, current: null })).toBe("/")
  })

  it("is the latest release's snapshot when the root is labelled (e.g. develop)", () => {
    expect(latestReleaseHref({ latest: "1.1.0", versions, current: { label: "develop" } })).toBe("/v/1.1.0/")
  })
})
