"use client"

import { Sidebar } from "@shell/components/sidebar"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import { useActiveSection } from "@shell/hooks/use-active-section"
import type { DocMeta } from "@shell/lib/docs"
import type { CategoryMeta, ComponentMeta } from "@shell/lib/components-nav"

export function SidebarLayout({
  docs,
  components,
  categories,
  children,
}: {
  docs: DocMeta[]
  components: ComponentMeta[]
  categories?: CategoryMeta[]
  children: React.ReactNode
}) {
  const { open, close, collapsed } = useMobileSidebar()
  const activeSection = useActiveSection(components)

  return (
    <div className="flex">
      {/* Desktop-only; the mobile floating card is mounted once from the root
          layout so the hamburger menu works on every page (homepage included). */}
      <Sidebar
        docs={docs}
        components={components}
        categories={categories}
        open={open}
        onClose={close}
        collapsed={collapsed}
        activeSection={activeSection}
        display="desktop"
      />
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 outline-none">{children}</main>
    </div>
  )
}
