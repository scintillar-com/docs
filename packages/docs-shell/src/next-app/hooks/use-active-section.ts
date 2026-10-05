"use client"

import { usePathname } from "next/navigation"
import type { ComponentMeta } from "@shell/lib/components-nav"
import type { DocSection } from "@shell/lib/docs"

/**
 * Which part of the site is being viewed:
 * - `"docs:<dir>"`: a page in a docs section (`/docs/<dir>/…`)
 * - `"docs"`: a docs page outside any section (every page of a site with a
 *   flat docs folder), or `/releases`
 * - `"components"` / `"blocks"`: a component or block page
 * - `null`: anything else (the homepage)
 */
export type ActiveSection = "docs" | `docs:${string}` | "components" | "blocks" | null

export function useActiveSection(components: ComponentMeta[], sections: DocSection[] = []): ActiveSection {
  const pathname = usePathname() ?? ""
  if (/^\/releases\/?$/.test(pathname)) return "docs"
  if (pathname.startsWith("/docs/")) {
    const dir = pathname.split("/")[2]
    return dir && sections.some((s) => s.dir === dir) ? `docs:${dir}` : "docs"
  }
  if (pathname.startsWith("/components/")) {
    const name = pathname.split("/")[2]
    const item = components.find((c) => c.name === name)
    return item?.kind === "block" ? "blocks" : "components"
  }
  return null
}
