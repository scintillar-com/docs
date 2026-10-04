"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "@shell/lib/i18n"

interface TocEntry {
  id: string
  text: string
  level: number
}

export function DocsToc() {
  const [entries, setEntries] = useState<TocEntry[]>([])
  const [activeId, setActiveId] = useState<string>("")
  const t = useTranslations()

  useEffect(() => {
    const article = document.querySelector("[data-docs-content]")
    if (!article) return

    const headings = article.querySelectorAll<HTMLHeadingElement>("h1, h2, h3")
    const items: TocEntry[] = []
    headings.forEach((h) => {
      if (!h.id) {
        h.id = h.textContent
          ?.toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-") ?? ""
      }
      if (!h.id) return
      const level = parseInt(h.tagName[1])
      items.push({ id: h.id, text: h.textContent ?? "", level })
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with external DOM headings
    setEntries(items)

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: "0px 0px -80% 0px", threshold: 0.1 }
    )
    headings.forEach((h) => { if (h.id) observer.observe(h) })
    return () => observer.disconnect()
  }, [])

  if (entries.length === 0) return null

  return (
    <nav aria-label={t("toc.title")} className="w-44 hidden xl:block">
      <p className="text-xs font-semibold text-foreground mb-2" aria-hidden="true">
        {t("toc.title")}
      </p>
      <ul role="list" className="space-y-0.5">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={activeId === entry.id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault()
                const el = document.getElementById(entry.id)
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" })
                  // Update URL hash without scroll jump
                  history.replaceState(null, "", `#${entry.id}`)
                }
              }}
              className={`block text-xs px-2 py-1 rounded-md transition-colors ${
                activeId === entry.id
                  ? "text-foreground font-medium bg-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              } ${entry.level === 3 ? "pl-4" : ""}`}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
