"use client"

import { useEffect } from "react"
import type { ThemePanelControl } from "@shell/lib/theme-panel"
import {
  THEME_OVERRIDES_REQUEST_MESSAGE,
  THEME_OVERRIDES_STORAGE_KEY,
  applyThemeOverrides,
  isThemeOverridesMessage,
  parseStoredOverrides,
  readStoredOverrides,
  sanitizeOverrides,
} from "@shell/lib/theme-overrides"

/**
 * Keeps a preview iframe's `--primary` / `--surface-tint` in step with the
 * theme panel in the parent docs page. Listens to `storage` events (shared
 * same-origin localStorage) and to same-origin `postMessage` from the parent
 * (for when storage is blocked), and asks the parent for the current values
 * on boot. Mounted by the (preview) root layout only when the panel is on.
 */
export function ThemeOverridesSync({ controls }: { controls: readonly ThemePanelControl[] }) {
  useEffect(() => {
    const root = document.documentElement
    applyThemeOverrides(root, readStoredOverrides(controls))

    function onStorage(e: StorageEvent) {
      if (e.key === THEME_OVERRIDES_STORAGE_KEY) {
        applyThemeOverrides(root, parseStoredOverrides(e.newValue, controls))
      } else if (e.key === null) {
        applyThemeOverrides(root, readStoredOverrides(controls))
      }
    }
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || !isThemeOverridesMessage(e.data)) return
      applyThemeOverrides(root, sanitizeOverrides(e.data.overrides, controls))
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener("message", onMessage)
    if (window.parent !== window) {
      try {
        window.parent.postMessage({ type: THEME_OVERRIDES_REQUEST_MESSAGE }, window.location.origin)
      } catch {
        // Parent is cross-origin (preview opened elsewhere); storage still syncs.
      }
    }
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("message", onMessage)
    }
  }, [controls])

  return null
}
