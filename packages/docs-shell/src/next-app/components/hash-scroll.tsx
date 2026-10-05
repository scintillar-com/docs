"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Scrolls to the heading named in the URL's `#hash` once the page has
 * mounted. The browser's own jump happens while the page hydrates and
 * doesn't survive it, so a shared link to a section (or a search result,
 * which links to its heading) used to open at the top of the page.
 */
export function HashScroll() {
  const pathname = usePathname()

  useEffect(() => {
    const scroll = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (id) document.getElementById(id)?.scrollIntoView({ block: "start" })
    }
    // After the frame that commits the page, so it runs after the router's
    // own scroll handling.
    const frame = requestAnimationFrame(scroll)
    window.addEventListener("hashchange", scroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("hashchange", scroll)
    }
  }, [pathname])

  return null
}
