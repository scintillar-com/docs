"use client"

import { Sidebar } from "@shell/components/sidebar"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import { useNavData } from "@shell/components/nav-data-provider"
import { useActiveSection } from "@shell/hooks/use-active-section"

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { open, close, collapsed } = useMobileSidebar()
  const nav = useNavData()
  const activeSection = useActiveSection(nav?.components ?? [], nav?.sections ?? [])

  return (
    <div className="flex">
      {/* Desktop-only; the mobile floating card is mounted once from the root
          layout so the hamburger menu works on every page (homepage included). */}
      {nav && (
        <Sidebar
          nav={nav}
          open={open}
          onClose={close}
          collapsed={collapsed}
          activeSection={activeSection}
          display="desktop"
        />
      )}
      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 outline-none">{children}</main>
    </div>
  )
}
