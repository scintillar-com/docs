"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"

// Simple external store for navigation state
let listeners: Array<() => void> = []
let navProgress = { loading: false, progress: 0 }

function setNav(updates: Partial<typeof navProgress>) {
  navProgress = { ...navProgress, ...updates }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => { listeners = listeners.filter((l) => l !== listener) }
}

function getSnapshot() { return navProgress }

export function NavigationProgress() {
  const pathname = usePathname()
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setNav({ progress: 100 })
      const timer = setTimeout(() => setNav({ loading: false, progress: 0 }), 200)
      return () => clearTimeout(timer)
    }
  }, [pathname])

  // Intercept link clicks to show progress
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const link = (e.target as HTMLElement).closest("a")
      if (!link) return
      const href = link.getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:")) return
      if (href === pathname) return
      setNav({ loading: true, progress: 30 })
      setTimeout(() => setNav({ progress: 70 }), 100)
    }
    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [pathname])

  if (!state.loading && state.progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 z-[100] h-0.5 bg-primary transition-all duration-300 ease-out"
      style={{
        width: `${state.progress}%`,
        opacity: state.progress >= 100 ? 0 : 1,
      }}
    />
  )
}
