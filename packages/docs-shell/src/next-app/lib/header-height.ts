/**
 * The header's height in pixels, read from `--shell-header-height` (see
 * globals.css). For APIs that take pixels, such as an IntersectionObserver's
 * `rootMargin`. Browser only.
 */
export function headerHeightPx(): number {
  const root = document.documentElement
  const raw = getComputedStyle(root).getPropertyValue("--shell-header-height").trim()
  const value = parseFloat(raw)
  if (!Number.isFinite(value)) return 56
  if (raw.endsWith("rem")) return value * parseFloat(getComputedStyle(root).fontSize)
  return value
}
