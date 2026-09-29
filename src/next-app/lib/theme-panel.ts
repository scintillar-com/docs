/**
 * Client-safe theme panel config. The CLI forwards the registry's
 * `themePanel` option as JSON in NEXT_PUBLIC_SHELL_THEME_PANEL (see
 * cli/shared.ts `buildEnvVars`); this module normalises it and decides
 * whether the panel is enabled for the version being viewed.
 *
 * No `themePanel` in the config means the variable is unset, the parsed
 * config is `null`, and the header keeps its plain sun/moon toggle.
 */
import type { ThemePanelConfig, ThemePanelControl } from "../../define-config"

export type { ThemePanelConfig, ThemePanelControl }

export const THEME_PANEL_CONTROLS: readonly ThemePanelControl[] = ["mode", "primary", "tint"]

export interface ResolvedThemePanelConfig {
  /** Normalised `since` (no leading `v`), or null when unset/invalid. */
  since: string | null
  /** Controls to render, in order, deduplicated. Never empty. */
  controls: ThemePanelControl[]
}

/**
 * Normalise a raw `themePanel` value (object or JSON string). Returns `null`
 * when the panel is not configured, so callers fall back to the plain toggle.
 * Unknown controls are dropped; an empty or missing list means all controls.
 */
export function resolveThemePanelConfig(
  raw: ThemePanelConfig | string | null | undefined,
): ResolvedThemePanelConfig | null {
  let value: unknown = raw
  if (typeof raw === "string") {
    if (raw.trim() === "") return null
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null

  const cfg = value as { since?: unknown; controls?: unknown }
  const controls = Array.isArray(cfg.controls) ? dedupeControls(cfg.controls) : []
  const since =
    typeof cfg.since === "string" && parseVersion(cfg.since) ? stripV(cfg.since) : null

  return {
    since,
    controls: controls.length > 0 ? controls : [...THEME_PANEL_CONTROLS],
  }
}

function dedupeControls(list: unknown[]): ThemePanelControl[] {
  const out: ThemePanelControl[] = []
  for (const c of list) {
    if (THEME_PANEL_CONTROLS.includes(c as ThemePanelControl) && !out.includes(c as ThemePanelControl)) {
      out.push(c as ThemePanelControl)
    }
  }
  return out
}

function stripV(v: string): string {
  return v.trim().replace(/^v/i, "")
}

/** Parse `1.2.3`, `v1.2`, `1.0.0-beta.1` into comparable parts, or null. */
export function parseVersion(
  v: string,
): { nums: [number, number, number]; pre: string | null } | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/i.exec(v.trim())
  if (!m) return null
  return {
    nums: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)],
    pre: m[4] ?? null,
  }
}

/**
 * Compare two semver-ish versions. Returns <0, 0 or >0. A pre-release sorts
 * before its release (`1.0.0-rc.1` < `1.0.0`); pre-release tags compare as
 * plain strings, which is enough to gate a feature on a version. Returns
 * null when either side isn't a version.
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] - pb.nums[i]
  }
  if (pa.pre === pb.pre) return 0
  if (pa.pre === null) return 1
  if (pb.pre === null) return -1
  return pa.pre < pb.pre ? -1 : 1
}

/**
 * Versioning hook. Decides whether the panel is on for the docs version
 * being viewed.
 *
 *  - No config: off.
 *  - No `since`, or no known version (an unversioned build, or the latest
 *    build before versioning lands): on.
 *  - Otherwise: on when `version >= since`. An unparseable version keeps
 *    the panel on rather than hiding it by accident.
 *
 * Versioned builds pass the version they're rendering; see
 * `getCurrentDocsVersion`.
 */
export function isThemePanelEnabled(
  config: ResolvedThemePanelConfig | null,
  version: string | null | undefined,
): boolean {
  if (!config) return false
  if (!config.since || !version) return true
  const cmp = compareVersions(version, config.since)
  return cmp === null ? true : cmp >= 0
}

/**
 * The docs version this build renders, or null for an unversioned build.
 *
 * Integration point for versioned builds: set NEXT_PUBLIC_SHELL_DOCS_VERSION
 * (e.g. `"1.0.0"`) in the env of each snapshot's `next build`, or replace
 * this function with a read of the build's version info. Until then it
 * returns null and the panel is enabled wherever `themePanel` is set.
 */
export function getCurrentDocsVersion(): string | null {
  const v = process.env.NEXT_PUBLIC_SHELL_DOCS_VERSION
  return v && v.trim() !== "" ? v.trim() : null
}

/**
 * The panel config for this build: null when `themePanel` isn't set or the
 * current docs version predates `since`. Build-time constant (the env var is
 * inlined by Next), safe on server and client.
 */
export function getShellThemePanel(): ResolvedThemePanelConfig | null {
  const config = resolveThemePanelConfig(process.env.NEXT_PUBLIC_SHELL_THEME_PANEL)
  return isThemePanelEnabled(config, getCurrentDocsVersion()) ? config : null
}
