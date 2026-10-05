import { describe, expect, it } from "vitest"
import { detectBumps, parseChangelog, releaseAnchor } from "./changelog"

const CHANGESETS = `# @acme/ui

## 1.1.0

### Minor Changes

- 1a2b3c4: Add the \`size\` prop to Button.

### Patch Changes

- 5d6e7f8: Fix focus ring on Input.
- Updated dependencies [9f8e7d6]

## 1.0.0

### Major Changes

- abcdef0: Monark 2026 theme.

## 0.1.0

### Patch Changes

- Initial release.
`

describe("parseChangelog", () => {
  it("splits a changesets changelog into one release per ## section", () => {
    const parsed = parseChangelog(CHANGESETS)
    expect(parsed.title).toBe("@acme/ui")
    expect(parsed.intro).toBe("")
    expect(parsed.releases.map((r) => [r.heading, r.version, r.bumps])).toEqual([
      ["1.1.0", "1.1.0", ["minor", "patch"]],
      ["1.0.0", "1.0.0", ["major"]],
      ["0.1.0", "0.1.0", ["patch"]],
    ])
    expect(parsed.releases[0].body).toBe(
      "### Minor Changes\n\n- 1a2b3c4: Add the `size` prop to Button.\n\n### Patch Changes\n\n- 5d6e7f8: Fix focus ring on Input.\n- Updated dependencies [9f8e7d6]",
    )
  })

  it("reads versions from other heading styles and keeps unversioned ones", () => {
    const parsed = parseChangelog(
      "## Unreleased\n\n- wip\n\n## [v2.0.0-rc.1] - 2026-09-29\n\n- rc\n\n## v1.2.3\n",
    )
    expect(parsed.title).toBeNull()
    expect(parsed.releases.map((r) => r.version)).toEqual([null, "2.0.0-rc.1", "1.2.3"])
    expect(parsed.releases[2].body).toBe("")
  })

  it("ignores ## lines inside fenced code and handles CRLF + BOM", () => {
    const md = "﻿# pkg\r\n\r\nIntro text.\r\n\r\n## 1.0.0\r\n\r\n```md\r\n## not a release\r\n```\r\n\r\n~~~\r\n## nor this\r\n~~~\r\n"
    const parsed = parseChangelog(md)
    expect(parsed.title).toBe("pkg")
    expect(parsed.intro).toBe("Intro text.")
    expect(parsed.releases).toHaveLength(1)
    expect(parsed.releases[0].body).toContain("## not a release")
    expect(parsed.releases[0].body).toContain("## nor this")
  })

  it("returns no releases for an empty or heading-less file", () => {
    expect(parseChangelog("").releases).toEqual([])
    expect(parseChangelog("Just text.\n").intro).toBe("Just text.")
  })
})

describe("detectBumps", () => {
  it("orders bump kinds major, minor, patch whatever the file order", () => {
    expect(detectBumps("### Patch Changes\n\n### major changes\n")).toEqual(["major", "patch"])
    expect(detectBumps("- no headings")).toEqual([])
  })
})

describe("releaseAnchor", () => {
  it("uses v<version>, else a slug of the heading", () => {
    expect(releaseAnchor({ heading: "1.0.0", version: "1.0.0" })).toBe("v1.0.0")
    expect(releaseAnchor({ heading: "Unreleased (next)", version: null })).toBe("unreleased-next")
  })
})
