"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from "react"

interface SidebarContextValue {
  open: boolean
  toggle: () => void
  close: () => void
  collapsed: boolean
  setCollapsed: (v: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
  collapsed: false,
  setCollapsed: () => {},
})

/**
 * Runs synchronously after DOM commit and *before* paint, so we can swap
 * client-only state into the tree post-hydration without ever rendering a
 * mismatched DOM. On the server it's a no-op alias to `useEffect`.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Always start with the SSR-safe defaults so the server HTML and the first
  // client render are identical. Reading from sessionStorage / matchMedia in
  // a `useState` initializer caused a hydration mismatch on the Header (which
  // builds className strings from `collapsed`), and React's mismatch recovery
  // discards the affected subtree — which restarts the bento card CSS
  // animations on the homepage. We restore the persisted state in a layout
  // effect that runs before the first paint, so users never see a flash.
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsedState] = useState(false)

  useIsomorphicLayoutEffect(() => {
    // Sidebar nav: only restore on desktop (mobile always starts closed).
    const isMobile = window.matchMedia("(max-width: 767px)").matches
    if (!isMobile) {
      const storedOpen = sessionStorage.getItem("sidebar-nav-open") === "true"
      if (storedOpen) setOpen(true)
    }
    // Preview fullscreen.
    const storedCollapsed = sessionStorage.getItem("preview-fullscreen") === "true"
    if (storedCollapsed) setCollapsedState(true)
  }, [])

  const toggle = useCallback(() => {
    setOpen((o) => {
      sessionStorage.setItem("sidebar-nav-open", String(!o))
      return !o
    })
  }, [])
  const close = useCallback(() => {
    setOpen(false)
    sessionStorage.setItem("sidebar-nav-open", "false")
  }, [])
  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    sessionStorage.setItem("preview-fullscreen", String(v))
  }, [])

  return (
    <SidebarContext.Provider value={{ open, toggle, close, collapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useMobileSidebar() {
  return useContext(SidebarContext)
}
