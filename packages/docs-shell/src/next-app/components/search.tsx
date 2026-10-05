"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpen, Component, Search, X } from "lucide-react"
import { Command } from "cmdk"
import { Button } from "@shell/components/shell-ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@shell/components/shell-ui/dialog"
import { useTranslations } from "@shell/lib/i18n"
import { withBasePath } from "@shell/lib/base-path"

export interface SearchItem {
  label: string
  href: string
  group: string
}

// Module-level cache — survives re-renders, shared across mounts
let cachedItems: SearchItem[] | null = null
let fetchPromise: Promise<void> | null = null

function preloadSearchIndex() {
  if (cachedItems || fetchPromise) return
  fetchPromise = fetch(withBasePath("/api/search-index.json"))
    .then((r) => r.json())
    .then((data) => { cachedItems = data })
    .catch(() => {})
}

export function SearchTrigger() {
  return <SearchDialog />
}

function SearchDialog() {
  const router = useRouter()
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<SearchItem[]>([])
  const [loading, setLoading] = useState(false)

  // Preload search index on mount (fires on page load)
  useEffect(() => {
    preloadSearchIndex()
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // When dialog opens, use cached data or wait for in-flight fetch
  useEffect(() => {
    if (!open || items.length > 0) return
    if (cachedItems) {
      setItems(cachedItems)
      return
    }
    setLoading(true)
    const waitForCache = async () => {
      if (fetchPromise) await fetchPromise
      if (cachedItems) setItems(cachedItems)
      setLoading(false)
    }
    waitForCache()
  }, [open, items.length])

  const onSelect = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  const groups = items.reduce<Record<string, SearchItem[]>>((acc, item) => {
    ;(acc[item.group] ??= []).push(item)
    return acc
  }, {})

  return (
    <>
      {/* Desktop: full search bar */}
      <Button
        variant="outline"
        size="sm"
        className="hidden md:inline-flex gap-2 text-muted-foreground font-normal w-56 justify-start"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span>{t("header.search")}</span>
        <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>
      {/* Mobile: icon only */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="overflow-hidden p-0 sm:max-w-lg max-md:max-w-full! max-md:h-dvh max-md:rounded-none max-md:border-0 max-md:top-0 max-md:translate-y-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command
            className="flex flex-col h-full [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
            loop
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 size-4 shrink-0 opacity-50" />

              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t("search.placeholder")}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={() => setOpen(false)}
                className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <Command.List className="max-h-80 max-md:max-h-none max-md:flex-1 overflow-y-auto p-1" aria-busy={loading} aria-live="polite">
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground" role="status">
                  {t("a11y.loading")}
                </div>
              ) : (
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {t("search.noResults")}
              </Command.Empty>
              )}
              {Object.entries(groups).map(([group, groupItems]) => {
                const Icon =
                  group === "Documentation" ? BookOpen : Component
                return (
                  <Command.Group key={group} heading={group}>
                    {groupItems.map((item) => (
                      <Command.Item
                        key={item.href}
                        value={`${item.group} ${item.label}`}
                        onSelect={() => onSelect(item.href)}
                        className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        {item.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )
              })}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
