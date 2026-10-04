"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { DocMeta } from "@shell/lib/docs"
import type { ComponentMeta } from "@shell/lib/components-nav"

interface NavData {
  docs: DocMeta[]
  components: ComponentMeta[]
}

const NavDataContext = createContext<NavData | null>(null)

/**
 * Provides the full navigation data (docs + components + blocks) to any
 * descendant client component. Used by the Header to render section tabs
 * without having to load the data itself.
 */
export function NavDataProvider({
  docs,
  components,
  children,
}: {
  docs: DocMeta[]
  components: ComponentMeta[]
  children: ReactNode
}) {
  return (
    <NavDataContext.Provider value={{ docs, components }}>
      {children}
    </NavDataContext.Provider>
  )
}

export function useNavData(): NavData | null {
  return useContext(NavDataContext)
}
