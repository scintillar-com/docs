"use client"

import { usePathname } from "next/navigation"
import type { ComponentMeta } from "@shell/lib/components-nav"

export type ActiveSection = "docs" | "components" | "blocks" | null

/**
 * Returns the current navigation section based on the URL and component list.
 * - `/docs/*` and `/releases` → "docs"
 * - `/components/{name}` → "components" or "blocks" depending on the item's kind
 * - anything else → null
 */
export function useActiveSection(components: ComponentMeta[]): ActiveSection {
  const pathname = usePathname()
  if (pathname.startsWith("/docs/") || /^\/releases\/?$/.test(pathname)) return "docs"
  if (pathname.startsWith("/components/")) {
    const name = pathname.split("/")[2]
    const item = components.find((c) => c.name === name)
    return item?.kind === "block" ? "blocks" : "components"
  }
  return null
}
