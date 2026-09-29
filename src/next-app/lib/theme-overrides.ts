/**
 * Theme overrides set from the theme panel: a primary color and a surface
 * tint, written as `--primary` / `--surface-tint` on `<html>`.
 *
 * Framework-free on purpose (no React) so the same rules drive the panel,
 * the preview iframes, the pre-paint init script and the unit tests.
 *
 * Persistence: one localStorage entry per browser (`STORAGE_KEY`). Every
 * storage access is wrapped in try/catch: private windows, blocked site data
 * and sandboxed frames can throw on access, and the panel must keep working
 * (for the current page) without it.
 *
 * Iframe sync: preview iframes are same-origin, so they get the same
 * localStorage and a `storage` event whenever the parent writes it. When
 * storage is unavailable, the parent also posts the overrides to every
 * preview iframe, and an iframe that boots asks its parent for the current
 * overrides (`REQUEST_MESSAGE`). Messages are only accepted from the same
 * origin.
 */
import type { ThemePanelControl } from "@shell/lib/theme-panel"

export const THEME_OVERRIDES_STORAGE_KEY = "registry-shell:theme-overrides"
export const THEME_OVERRIDES_MESSAGE = "registry-shell:theme-overrides"
export const THEME_OVERRIDES_REQUEST_MESSAGE = "registry-shell:theme-overrides-request"

export const PRIMARY_VAR = "--primary"
export const TINT_VAR = "--surface-tint"

export const TINT_MIN = 0
export const TINT_MAX = 2
export const TINT_STEP = 0.05
/** Tint shown when the theme doesn't define `--surface-tint`. */
export const TINT_FALLBACK = 1

export interface ThemeOverrides {
  /** Normalised `#rrggbb` (lowercase). */
  primary?: string
  /** Number in [TINT_MIN, TINT_MAX], snapped to TINT_STEP. */
  tint?: number
}

/**
 * Accept `#abc`, `abc`, `#aabbcc` or `aabbcc` (any case). Returns lowercase
 * `#rrggbb`, or null when the input isn't a hex color.
 */
export function normalizeHex(input: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim())
  if (!m) return null
  let hex = m[1].toLowerCase()
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("")
  return `#${hex}`
}

/** Clamp to [TINT_MIN, TINT_MAX] and snap to TINT_STEP. Null when not finite. */
export function clampTint(value: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  const clamped = Math.min(TINT_MAX, Math.max(TINT_MIN, value))
  return Number((Math.round(clamped / TINT_STEP) * TINT_STEP).toFixed(2))
}

/** `1` → `"1"`, `1.25` → `"1.25"`, `0.5` → `"0.5"`. */
export function formatTint(value: number): string {
  return String(Number(value.toFixed(2)))
}

/**
 * Keep only valid values, and only for the controls that are enabled
 * (`mode` has no override; next-themes owns it).
 */
export function sanitizeOverrides(
  value: unknown,
  controls: readonly ThemePanelControl[] = ["primary", "tint"],
): ThemeOverrides {
  const out: ThemeOverrides = {}
  if (!value || typeof value !== "object") return out
  const v = value as { primary?: unknown; tint?: unknown }
  if (controls.includes("primary") && typeof v.primary === "string") {
    const hex = normalizeHex(v.primary)
    if (hex) out.primary = hex
  }
  if (controls.includes("tint") && typeof v.tint === "number") {
    const tint = clampTint(v.tint)
    if (tint !== null) out.tint = tint
  }
  return out
}

export function isEmptyOverrides(o: ThemeOverrides): boolean {
  return o.primary === undefined && o.tint === undefined
}

/** Parse a stored JSON value. Anything invalid reads as "no overrides". */
export function parseStoredOverrides(
  raw: string | null | undefined,
  controls?: readonly ThemePanelControl[],
): ThemeOverrides {
  if (!raw) return {}
  try {
    return sanitizeOverrides(JSON.parse(raw), controls)
  } catch {
    return {}
  }
}

export function readStoredOverrides(controls?: readonly ThemePanelControl[]): ThemeOverrides {
  try {
    return parseStoredOverrides(window.localStorage.getItem(THEME_OVERRIDES_STORAGE_KEY), controls)
  } catch {
    return {}
  }
}

/** Save (or clear, when empty). Returns false when storage is unavailable. */
export function writeStoredOverrides(o: ThemeOverrides): boolean {
  try {
    if (isEmptyOverrides(o)) window.localStorage.removeItem(THEME_OVERRIDES_STORAGE_KEY)
    else window.localStorage.setItem(THEME_OVERRIDES_STORAGE_KEY, JSON.stringify(o))
    return true
  } catch {
    return false
  }
}

/** Minimal slice of `CSSStyleDeclaration` we touch; eases testing. */
interface StyleTarget {
  style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty">
}

/** Write the overrides as inline custom properties; unset ones are removed. */
export function applyThemeOverrides(root: StyleTarget, o: ThemeOverrides): void {
  if (o.primary) root.style.setProperty(PRIMARY_VAR, o.primary)
  else root.style.removeProperty(PRIMARY_VAR)
  if (o.tint !== undefined) root.style.setProperty(TINT_VAR, formatTint(o.tint))
  else root.style.removeProperty(TINT_VAR)
}

/**
 * The CSS the "Copy CSS" action puts on the clipboard: the resulting
 * `:root` variables (overrides, or the theme's own values where nothing was
 * overridden). A variable without a known value is left out.
 */
export function buildThemeCss(values: { primary?: string | null; tint?: number | null }): string {
  const lines: string[] = []
  if (values.primary) lines.push(`  ${PRIMARY_VAR}: ${values.primary};`)
  if (typeof values.tint === "number" && Number.isFinite(values.tint)) {
    lines.push(`  ${TINT_VAR}: ${formatTint(values.tint)};`)
  }
  return `:root {\n${lines.join("\n")}\n}\n`
}

/**
 * Inline script that applies stored overrides before first paint (like
 * next-themes' own script), so a reload doesn't flash the default colors.
 * Self-contained ES5; mirrors `sanitizeOverrides`.
 */
export function themeOverridesInitScript(controls: readonly ThemePanelControl[]): string {
  const key = JSON.stringify(THEME_OVERRIDES_STORAGE_KEY)
  const primary = controls.includes("primary")
  const tint = controls.includes("tint")
  return (
    `(function(){try{var r=window.localStorage.getItem(${key});if(!r)return;` +
    `var o=JSON.parse(r);if(!o||typeof o!=="object")return;` +
    `var s=document.documentElement.style;` +
    (primary
      ? `if(typeof o.primary==="string"&&/^#[0-9a-f]{6}$/i.test(o.primary))s.setProperty(${JSON.stringify(PRIMARY_VAR)},o.primary);`
      : "") +
    (tint
      ? `if(typeof o.tint==="number"&&o.tint>=${TINT_MIN}&&o.tint<=${TINT_MAX})s.setProperty(${JSON.stringify(TINT_VAR)},String(o.tint));`
      : "") +
    `}catch(e){}})();`
  )
}

export interface ThemeOverridesMessage {
  type: typeof THEME_OVERRIDES_MESSAGE
  overrides: ThemeOverrides
}

export function isThemeOverridesMessage(data: unknown): data is ThemeOverridesMessage {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { type?: unknown }).type === THEME_OVERRIDES_MESSAGE &&
    typeof (data as { overrides?: unknown }).overrides === "object"
  )
}

export function isThemeOverridesRequest(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    (data as { type?: unknown }).type === THEME_OVERRIDES_REQUEST_MESSAGE
  )
}

/** Post the overrides to one window (an iframe's contentWindow), same-origin only. */
export function postOverrides(target: Window | null | undefined, o: ThemeOverrides): void {
  if (!target) return
  try {
    const message: ThemeOverridesMessage = { type: THEME_OVERRIDES_MESSAGE, overrides: o }
    target.postMessage(message, window.location.origin)
  } catch {
    // Frame navigated away or cross-origin; nothing to sync.
  }
}

/** Post the overrides to every component preview iframe in the document. */
export function postOverridesToPreviewFrames(o: ThemeOverrides): void {
  const frames = document.querySelectorAll<HTMLIFrameElement>("iframe[data-component-preview-iframe]")
  frames.forEach((frame) => postOverrides(frame.contentWindow, o))
}

/**
 * Convert any CSS color the browser understands (oklch, rgb, named...) to
 * `#rrggbb` by painting one canvas pixel; out-of-gamut colors are clipped
 * to sRGB. Returns null outside a browser or when the color is invalid.
 */
export function cssColorToHex(color: string): string | null {
  const value = color.trim()
  if (!value) return null
  const direct = normalizeHex(value)
  if (direct) return direct
  try {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    // Detect invalid colors: fillStyle ignores them, so paint over a sentinel.
    ctx.fillStyle = "#010203"
    ctx.fillStyle = value
    if (ctx.fillStyle === "#010203" && value.toLowerCase() !== "#010203") return null
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`
  } catch {
    return null
  }
}

/**
 * Read a custom property's value as the theme defines it, ignoring the
 * panel's inline override (removed and restored synchronously, so nothing
 * repaints in between).
 */
export function readThemeDefault(root: HTMLElement, name: string): string {
  const inline = root.style.getPropertyValue(name)
  if (inline) root.style.removeProperty(name)
  const value = getComputedStyle(root).getPropertyValue(name).trim()
  if (inline) root.style.setProperty(name, inline)
  return value
}
