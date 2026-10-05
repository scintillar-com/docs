"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { DocMeta, DocNode, DocSection } from "@shell/lib/docs"
import type { CategoryMeta, ComponentMeta } from "@shell/lib/components-nav"

export interface NavData {
  docs: DocMeta[]
  /** Docs sections (top-level folders), in header-tab order. */
  sections: DocSection[]
  /** Sidebar tree per section dir, plus `""` for root-level pages. */
  trees: Record<string, DocNode[]>
  components: ComponentMeta[]
  categories: CategoryMeta[]
}

const NavDataContext = createContext<NavData | null>(null)

/**
 * Provides the full navigation data (docs tree + components + blocks) to
 * any descendant client component: the header's tabs and both sidebar
 * variants read it here instead of having it threaded through every layout.
 * Built once on the server by the root layout.
 */
export function NavDataProvider({ children, ...data }: NavData & { children: ReactNode }) {
  return <NavDataContext.Provider value={data}>{children}</NavDataContext.Provider>
}

export function useNavData(): NavData | null {
  return useContext(NavDataContext)
}
