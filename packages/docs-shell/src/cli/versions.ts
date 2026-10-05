/**
 * Pure helpers behind the opt-in versioned build (`versions` in the shell
 * config): git tag discovery, semver parsing/ordering, and the
 * `/versions.json` manifest. Kept free of build side effects so they can be
 * unit-tested directly; the orchestration lives in `versioned-build.ts`.
 */
import { execFileSync } from "node:child_process"

export const DEFAULT_TAG_GLOB = "v*"
export const VERSIONS_MANIFEST_FILE = "versions.json"

/** A git tag that matched the glob and carries a parseable version. */
export interface VersionTag {
  /** Tag name as it appears in git, e.g. `v1.2.0` or `my-ui@1.2.0`. */
  tag: string
  /** Semver without build metadata, e.g. `1.2.0` or `2.0.0-rc.1`. */
  version: string
  /** Full SHA of the commit the tag points at (annotated tags are peeled). */
  commit: string
  /** ISO date: tag creation for annotated tags, commit date otherwise. */
  date: string
}

export interface VersionEntry extends VersionTag {
  /** True for the newest release (highest stable version, see `pickLatest`). */
  isLatest: boolean
  /** Site root of the frozen snapshot, e.g. `/v/1.2.0/`. */
  path: string
  /** Registry JSON root of the frozen snapshot, e.g. `/r/v1.2.0/`. */
  registry: string
  /**
   * Where the snapshot's pages came from, when versions are taken from
   * another repository (`versions.source`): its `repo` as configured, the
   * tag and the commit it points at.
   */
  source?: { repo: string; ref: string; commit: string }
}

/** Shape of `/versions.json`, fetched at runtime by the switcher + banner. */
export interface VersionsManifest {
  /** Version of the newest release, or null when no tag matched. */
  latest: string | null
  /** Every published snapshot, newest first. */
  versions: VersionEntry[]
  /**
   * The site root, when it isn't the latest release (`versions.current`):
   * its label, e.g. `"develop"`. Null when the root is the latest release.
   */
  current: { label: string } | null
}

interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

// Trailing semver of a tag name: `v1.2.3`, `ui@1.2.3`, `release-1.2.3-rc.1`.
// Build metadata (`+sha`) is accepted but dropped: it isn't URL-friendly and
// semver ignores it for precedence anyway.
const TRAILING_SEMVER =
  /(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

/**
 * Extract the version from a tag name, or null when the tag doesn't end in
 * a semver. The character before the version must not be a digit or dot,
 * so `v11.2.3` never parses as `1.2.3`.
 */
export function parseVersionFromTag(tag: string): string | null {
  const m = TRAILING_SEMVER.exec(tag)
  if (!m) return null
  const before = tag.slice(0, m.index)
  if (/[0-9.]$/.test(before)) return null
  return `${m[1]}.${m[2]}.${m[3]}${m[4] ? `-${m[4]}` : ""}`
}

function parse(version: string): ParsedVersion {
  const [core, ...pre] = version.split("-")
  const [major, minor, patch] = core.split(".").map((n) => Number(n))
  return {
    major,
    minor,
    patch,
    prerelease: pre.length > 0 ? pre.join("-").split(".") : [],
  }
}

/** Semver precedence: negative when `a < b`, positive when `a > b`. */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a)
  const pb = parse(b)
  for (const key of ["major", "minor", "patch"] as const) {
    if (pa[key] !== pb[key]) return pa[key] - pb[key]
  }
  // A release outranks any of its prereleases.
  if (pa.prerelease.length === 0 || pb.prerelease.length === 0) {
    return pb.prerelease.length - pa.prerelease.length
  }
  const len = Math.max(pa.prerelease.length, pb.prerelease.length)
  for (let i = 0; i < len; i++) {
    const x = pa.prerelease[i]
    const y = pb.prerelease[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xNum = /^\d+$/.test(x)
    const yNum = /^\d+$/.test(y)
    if (xNum && yNum) {
      if (Number(x) !== Number(y)) return Number(x) - Number(y)
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

export function isPrerelease(version: string): boolean {
  return version.includes("-")
}

/**
 * The version the rest are compared against: the highest stable release,
 * falling back to the highest prerelease when nothing stable exists yet.
 */
export function pickLatest(versions: string[]): string | null {
  const sorted = [...versions].sort(compareVersions).reverse()
  return sorted.find((v) => !isPrerelease(v)) ?? sorted[0] ?? null
}

/**
 * Parse `git tag --list --format=...` output (see `listVersionTags`) into
 * version tags, newest first. Tags without a trailing semver are skipped;
 * when two tags carry the same version the first one listed wins.
 */
export function parseTagListing(output: string): {
  tags: VersionTag[]
  skipped: string[]
} {
  const byVersion = new Map<string, VersionTag>()
  const skipped: string[] = []
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [tag, objectSha, peeledSha, date] = line.split("\t")
    const version = parseVersionFromTag(tag)
    if (!version) {
      skipped.push(tag)
      continue
    }
    if (byVersion.has(version)) {
      skipped.push(tag)
      continue
    }
    byVersion.set(version, {
      tag,
      version,
      // Annotated tags point at a tag object; `%(*objectname)` peels it to
      // the commit. Lightweight tags leave the peeled field empty.
      commit: peeledSha || objectSha,
      date: date ?? "",
    })
  }
  const tags = [...byVersion.values()].sort((a, b) =>
    compareVersions(b.version, a.version),
  )
  return { tags, skipped }
}

const TAG_FORMAT = "%(refname:short)%09%(objectname)%09%(*objectname)%09%(creatordate:iso-strict)"

/** List the tags matching `glob` in the git repo containing `cwd`. */
export function listVersionTags(
  cwd: string,
  glob: string = DEFAULT_TAG_GLOB,
): { tags: VersionTag[]; skipped: string[] } {
  const output = execFileSync(
    "git",
    ["tag", "--list", glob, `--format=${TAG_FORMAT}`],
    { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  )
  return parseTagListing(output)
}

/** Site root of a version's snapshot. */
export function versionSitePath(version: string): string {
  return `/v/${version}/`
}

/** Next.js `basePath` of a version's snapshot (no trailing slash). */
export function versionBasePath(version: string): string {
  return `/v/${version}`
}

/** Registry JSON root of a version's snapshot. */
export function versionRegistryPath(version: string): string {
  return `/r/v${version}/`
}

/** Tags at or above `minVersion` (all of them when it's unset). */
export function filterMinVersion(tags: VersionTag[], minVersion?: string): VersionTag[] {
  if (!minVersion) return tags
  if (!parseVersionFromTag(minVersion)) {
    throw new Error(`[docs-shell] versions.minVersion: "${minVersion}" isn't a version (expected e.g. "1.0.0").`)
  }
  const min = parseVersionFromTag(minVersion)!
  return tags.filter((t) => compareVersions(t.version, min) >= 0)
}

export interface ManifestOptions {
  /** Label of the site root when it isn't the latest release. */
  currentLabel?: string
  /** `versions.source.repo`, recorded on every entry. */
  sourceRepo?: string
}

/** Build the `/versions.json` payload from the published tags. */
export function buildManifest(tags: VersionTag[], options: ManifestOptions = {}): VersionsManifest {
  const latest = pickLatest(tags.map((t) => t.version))
  const versions = [...tags]
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((t) => ({
      version: t.version,
      tag: t.tag,
      commit: t.commit,
      date: t.date,
      isLatest: t.version === latest,
      path: versionSitePath(t.version),
      registry: versionRegistryPath(t.version),
      ...(options.sourceRepo
        ? { source: { repo: options.sourceRepo, ref: t.tag, commit: t.commit } }
        : {}),
    }))
  return {
    latest,
    versions,
    current: options.currentLabel ? { label: options.currentLabel } : null,
  }
}
