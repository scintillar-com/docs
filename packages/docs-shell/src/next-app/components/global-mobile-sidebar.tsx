"use client"

import { Sidebar } from "@shell/components/sidebar"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import type { DocMeta } from "@shell/lib/docs"
import type { CategoryMeta, ComponentMeta } from "@shell/lib/components-nav"

/**
 * Client-side wrapper that mounts the mobile-only variant of the Sidebar from
 * the root layout. This ensures the hamburger menu in the header works on
 * **every** page (including the homepage), even though the desktop inline
 * sidebar is still scoped to per-section layouts via `SidebarLayout`.
 *
 * The full Sidebar component reads its `open` / `onClose` from the
 * `useMobileSidebar` hook, which is a client-side context; this wrapper
 * exists purely to bridge the server `RootLayout` to those hooks.
 */
export function GlobalMobileSidebar({
  docs,
  components,
  categories,
}: {
  docs: DocMeta[]
  components: ComponentMeta[]
  categories?: CategoryMeta[]
}) {
  const { open, close } = useMobileSidebar()
  return (
    <Sidebar
      docs={docs}
      components={components}
      categories={categories}
      open={open}
      onClose={close}
      display="mobile"
    />
  )
}
