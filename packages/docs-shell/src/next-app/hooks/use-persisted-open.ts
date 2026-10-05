"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Open / closed state for a collapsible sidebar group, remembered per
 * browser under `storageKey`.
 *
 * The stored value is read after mount, not in the state initializer: the
 * server renders `defaultOpen`, and reading localStorage during render made
 * the first client render disagree with it (a hydration mismatch) for anyone
 * who had collapsed a group. `forceOpen` reopens the group when it becomes
 * true (e.g. the active page is inside), without overwriting the preference.
 */
export function usePersistedOpen(storageKey: string, forceOpen = false, defaultOpen = true) {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored !== null) setOpen(stored === "1" || forceOpen)
    } catch {
      // Blocked storage: the default stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per key
  }, [storageKey])

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0")
      } catch {
        // Not remembering the preference isn't worth failing the toggle.
      }
      return next
    })
  }, [storageKey])

  return { open, toggle }
}
