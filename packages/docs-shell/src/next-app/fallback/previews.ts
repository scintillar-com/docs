/**
 * Fallback previewLoader used when the user's registry has no
 * `components/previews/index.ts`. Renders the caller's `fallback` prop (or
 * nothing) for every name.
 */
import { createElement, Fragment, type ReactNode } from "react"
import type { PreviewLoader } from "@shell/lib/registry-adapter"

function EmptyPreview({ fallback = null }: { name: string; fallback?: ReactNode }) {
  return createElement(Fragment, null, fallback)
}

export const previewLoader: PreviewLoader = {
  Preview: EmptyPreview,
  load: () => null,
  names: () => [],
}
