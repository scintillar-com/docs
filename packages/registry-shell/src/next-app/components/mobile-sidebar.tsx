"use client"

import { Sidebar } from "@shell/components/sidebar"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import type { DocMeta } from "@shell/lib/docs"
import type { ComponentMeta } from "@shell/lib/components-nav"

export function MobileSidebar({
  docs,
  components,
}: {
  docs: DocMeta[]
  components: ComponentMeta[]
}) {
  const { open, close } = useMobileSidebar()

  return (
    <div className="md:hidden">
      <Sidebar docs={docs} components={components} open={open} onClose={close} />
    </div>
  )
}
