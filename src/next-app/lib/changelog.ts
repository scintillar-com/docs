/**
 * Parser for the consumer registry's `CHANGELOG.md` (changesets format),
 * rendered by the Releases page of sites built with `versions`:
 *
 *   # my-ui
 *
 *   ## 1.1.0
 *
 *   ### Minor Changes
 *
 *   - 1a2b3c4: Add the `size` prop to Button.
 *
 *   ### Patch Changes
 *
 *   - 5d6e7f8: Fix focus ring on Input.
 *
 *   ## 1.0.0
 *   ...
 *
 * Each `## ` heading starts a release. Its version is the first semver in
 * the heading (`## 1.1.0`, `## v1.1.0`, `## [1.1.0] - 2026-09-29` all work);
 * a heading without one (`## Unreleased`) keeps `version: null`. `## ` lines
 * inside fenced code blocks are ignored. Pure (no I/O) so it's unit-tested
 * directly; the page reads the file.
 */

export type BumpType = "major" | "minor" | "patch"

export interface ChangelogRelease {
  /** Heading text without the `## ` marker, e.g. `1.1.0`. */
  heading: string
  /** Semver found in the heading (no `v` prefix), or null. */
  version: string | null
  /** Markdown between this heading and the next `## ` (trimmed). */
  body: string
  /** Kinds of change listed (`### Major|Minor|Patch Changes`), in that order. */
  bumps: BumpType[]
}

export interface ParsedChangelog {
  /** Text of the leading `# ` heading (changesets writes the package name), if any. */
  title: string | null
  /** Markdown before the first release (after the title), trimmed. */
  intro: string
  /** Releases in file order (changesets writes newest first). */
  releases: ChangelogRelease[]
}

const SEMVER = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)/
const FENCE = /^\s{0,3}(```|~~~)/
const BUMP_ORDER: BumpType[] = ["major", "minor", "patch"]

export function parseChangelog(markdown: string): ParsedChangelog {
  const lines = markdown.replace(/^﻿/, "").split(/\r?\n/)
  let title: string | null = null
  const intro: string[] = []
  const releases: Array<{ heading: string; lines: string[] }> = []
  let fence: string | null = null

  for (const line of lines) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]
      else if (fenceMatch[1] === fence) fence = null
    }
    const inCode = fence !== null || fenceMatch !== null
    if (!inCode) {
      const h2 = /^##\s+(.+?)\s*#*\s*$/.exec(line)
      if (h2 && !line.startsWith("###")) {
        releases.push({ heading: h2[1], lines: [] })
        continue
      }
      const h1 = /^#\s+(.+?)\s*#*\s*$/.exec(line)
      if (h1 && releases.length === 0 && title === null && intro.join("").trim() === "") {
        title = h1[1]
        continue
      }
    }
    if (releases.length === 0) intro.push(line)
    else releases[releases.length - 1].lines.push(line)
  }

  return {
    title,
    intro: intro.join("\n").trim(),
    releases: releases.map(({ heading, lines: body }) => {
      const text = body.join("\n").trim()
      return {
        heading,
        version: SEMVER.exec(heading)?.[1] ?? null,
        body: text,
        bumps: detectBumps(text),
      }
    }),
  }
}

/** Which `### Major|Minor|Patch Changes` subsections a release body has. */
export function detectBumps(body: string): BumpType[] {
  const found = new Set<BumpType>()
  for (const m of body.matchAll(/^###\s+(major|minor|patch)\s+changes\b/gim)) {
    found.add(m[1].toLowerCase() as BumpType)
  }
  return BUMP_ORDER.filter((b) => found.has(b))
}

/** Anchor id of a release section on the Releases page. */
export function releaseAnchor(release: Pick<ChangelogRelease, "heading" | "version">): string {
  if (release.version) return `v${release.version}`
  return release.heading.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "release"
}
