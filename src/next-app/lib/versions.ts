/**
 * Client side of the versioned build (see `versions` in the shell config).
 *
 * Which version THIS build is comes from env vars inlined at build time.
 * The list of versions does not: frozen snapshots are cached across
 * deploys, so they fetch `/versions.json` from the site root at runtime and
 * always see releases made after they were built.
 */
import { useEffect, useState } from "react"

/** True when the site was built with `versions` enabled. */
export const VERSIONS_ENABLED = process.env.NEXT_PUBLIC_SHELL_VERSIONS === "1"

/** True when this build renders a changelog at `/releases` (versioned builds only). */
export const RELEASES_ENABLED = process.env.NEXT_PUBLIC_SHELL_RELEASES === "1"

/** Version of this frozen snapshot (e.g. `"0.1.0"`), or `""` on the latest site. */
export const CURRENT_VERSION = process.env.NEXT_PUBLIC_SHELL_VERSION ?? ""

/** Mirrors `VersionsManifest` in src/cli/versions.ts (the file this reads). */
export interface VersionsManifest {
  latest: string | null
  versions: Array<{
    version: string
    tag: string
    commit: string
    date: string
    isLatest: boolean
    path: string
    registry: string
  }>
}

/** Always at the site root, whatever the current build's base path. */
export const VERSIONS_MANIFEST_URL = "/versions.json"

/** Site root of a version (`""` = the latest site at `/`), without trailing slash. */
export function versionRoot(version: string): string {
  return version ? `/v/${version}` : ""
}

/**
 * Candidate URL for `pathname` (as returned by `usePathname()`, i.e.
 * without base path) in another version, plus that version's home as the
 * fallback when the page doesn't exist there.
 */
export function switchTargets(
  targetVersion: string,
  pathname: string,
): { candidate: string | null; home: string } {
  const root = versionRoot(targetVersion)
  const home = `${root}/`
  if (!pathname || pathname === "/") return { candidate: null, home }
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`
  return { candidate: `${root}${normalized}`, home }
}

let manifestPromise: Promise<VersionsManifest | null> | null = null

function loadManifest(): Promise<VersionsManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(VERSIONS_MANIFEST_URL, { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<VersionsManifest>) : null))
      .then((m) => (m && Array.isArray(m.versions) ? m : null))
      .catch(() => null)
  }
  return manifestPromise
}

/** The `/versions.json` manifest, or null while loading / when unavailable. */
export function useVersionsManifest(): VersionsManifest | null {
  const [manifest, setManifest] = useState<VersionsManifest | null>(null)
  useEffect(() => {
    if (!VERSIONS_ENABLED) return
    let active = true
    loadManifest().then((m) => {
      if (active) setManifest(m)
    })
    return () => {
      active = false
    }
  }, [])
  return manifest
}
