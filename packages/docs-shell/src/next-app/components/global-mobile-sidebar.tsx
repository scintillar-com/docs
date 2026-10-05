"use client"

import { Sidebar } from "@shell/components/sidebar"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import { useNavData } from "@shell/components/nav-data-provider"

/**
 * Mounts the mobile-only variant of the Sidebar from the root layout, so the
 * hamburger menu in the header works on **every** page (including the
 * homepage), while the desktop inline sidebar stays scoped to the
 * per-section layouts via `SidebarLayout`.
 */
export function GlobalMobileSidebar() {
  const { open, close } = useMobileSidebar()
  const nav = useNavData()
  if (!nav) return null
  return <Sidebar nav={nav} open={open} onClose={close} display="mobile" />
}
