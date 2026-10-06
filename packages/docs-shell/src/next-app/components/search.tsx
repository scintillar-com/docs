"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Blocks, BookOpen, Component, Hash, Search, X } from "lucide-react"
import { Command } from "cmdk"
import { Button } from "@shell/components/shell-ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@shell/components/shell-ui/dialog"
import { useLocale, useTranslations } from "@shell/lib/i18n"
import { withBasePath } from "@shell/lib/base-path"
import { useNavData } from "@shell/components/nav-data-provider"
import { rankItems, type SearchHit, type SearchItem } from "@shell/lib/search-rank"

export type { SearchItem } from "@shell/lib/search-rank"

// One fetch per locale per page load, shared by every mount.
const indexes = new Map<string, Promise<SearchItem[]>>()

/**
 * The index for `locale`: `api/search-index.json` for the default locale,
 * `api/search-index.<locale>.json` for the others (falling back to the
 * default file, e.g. on a site built before per-locale indexes).
 */
function loadIndex(locale: string, defaultLocale: string): Promise<SearchItem[]> {
  const key = locale === defaultLocale ? "" : locale
  let pending = indexes.get(key)
  if (!pending) {
    const get = (file: string) =>
      fetch(withBasePath(`/api/${file}`)).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<SearchItem[]>
      })
    pending = (key ? get(`search-index.${key}.json`) : Promise.reject(new Error("default")))
      .catch(() => get("search-index.json"))
      .then((items) => (Array.isArray(items) ? items.map(normalize) : []))
      .catch(() => {
        indexes.delete(key) // let the next open retry
        return []
      })
    indexes.set(key, pending)
  }
  return pending
}

/** Records from older indexes (label / href / group name only) still work. */
function normalize(raw: Partial<SearchItem> & { label: string; href: string }): SearchItem {
  const group =
    raw.group === "Documentation" ? "docs" : raw.group === "Components" ? "components" : (raw.group ?? "docs")
  return {
    label: raw.label,
    page: raw.page ?? raw.label,
    href: raw.href,
    group,
    kind: raw.kind ?? (group === "components" || group === "blocks" ? "component" : "page"),
    text: raw.text ?? "",
  }
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

export function SearchTrigger() {
  return <SearchDialog />
}

function SearchDialog() {
  const router = useRouter()
  const t = useTranslations()
  const { locale, defaultLocale } = useLocale()
  const navData = useNavData()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<{ locale: string; list: SearchItem[] } | null>(null)
  /** Group to narrow to, or null for all of them. */
  const [group, setGroup] = useState<string | null>(null)
  const hasComponents = (navData?.components.length ?? 0) > 0

  // Fetch early (on page load) so the dialog opens on a ready index.
  useEffect(() => {
    let live = true
    loadIndex(locale, defaultLocale).then((list) => {
      if (live) setItems({ locale, list })
    })
    return () => {
      live = false
    }
  }, [locale, defaultLocale])
  const loading = open && items?.locale !== locale

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

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    // A filter left on would silently hide results of the next search.
    if (!next) setGroup(null)
  }, [])

  const onSelect = useCallback(
    (href: string) => {
      onOpenChange(false)
      router.push(href)
    },
    [router, onOpenChange],
  )

  // Group names and order follow the header tabs, so the chips don't
  // reshuffle as you type.
  const groupOrder = useMemo(() => {
    const labels = new Map<string, string>([["docs", t("search.groupDocs")]])
    for (const s of navData?.sections ?? []) labels.set(`docs:${s.dir}`, s.label)
    labels.set("components", t("search.groupComponents"))
    labels.set("blocks", t("sidebar.blocks"))
    return labels
  }, [navData?.sections, t])
  const labelOf = (g: string) => groupOrder.get(g) ?? g.replace(/^docs:/, "")

  const hits = useMemo((): SearchHit[] => {
    if (items?.locale !== locale) return []
    // Before typing: every page and component, to browse (as before
    // headings were indexed); headings only show up as matches.
    if (!query.trim()) {
      return items.list
        .filter((item) => item.kind !== "heading")
        .map((item) => ({ item, score: 0, excerpt: null }))
    }
    return rankItems(items.list, query)
  }, [items, locale, query])
  // Counts include the groups not shown: a chip says what it would show.
  const counts = new Map<string, number>()
  for (const h of hits) counts.set(h.item.group, (counts.get(h.item.group) ?? 0) + 1)
  const chips = [...groupOrder.keys(), ...[...counts.keys()].filter((g) => !groupOrder.has(g))].filter(
    (g) => counts.has(g),
  )

  const visible = group ? hits.filter((h) => h.item.group === group) : hits
  // Groups appear in the order of their best hit.
  const groups = new Map<string, SearchHit[]>()
  for (const hit of visible) {
    const list = groups.get(hit.item.group) ?? []
    list.push(hit)
    groups.set(hit.item.group, list)
  }

  return (
    <>
      {/* Desktop: full search bar */}
      <Button
        variant="outline"
        size="sm"
        className="hidden lg:inline-flex gap-2 text-muted-foreground font-normal w-56 justify-start"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span>{t("header.search")}</span>
        <kbd className="ml-auto pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
          <span className="text-xs">&#8984;</span>K
        </kbd>
      </Button>
      {/* Mobile and tablet: icon only, so the header tabs fit */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="overflow-hidden p-0 sm:max-w-xl max-md:max-w-full! max-md:h-dvh max-md:rounded-none max-md:border-0 max-md:top-0 max-md:translate-y-0"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command
            className="flex flex-col h-full min-w-0 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium"
            loop
            shouldFilter={false}
          >
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 size-4 shrink-0 opacity-50" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t(hasComponents ? "search.placeholder" : "search.placeholderDocs")}
                className="flex h-11 w-full min-w-0 rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                onClick={() => onOpenChange(false)}
                className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* Only once results span more than one group: with nothing to
                choose between, chips are clutter. Scrolls sideways on a
                phone instead of widening the dialog. */}
            {chips.length > 1 && (
              <div
                role="group"
                aria-label={t("search.filter")}
                className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2"
              >
                <FilterChip active={group === null} onClick={() => setGroup(null)}>
                  {t("search.all")}
                  <span className="ml-1 opacity-60 tabular-nums">{hits.length}</span>
                </FilterChip>
                {chips.map((g) => (
                  <FilterChip
                    key={g}
                    active={group === g}
                    // The active chip toggles off, back to all results.
                    onClick={() => setGroup(group === g ? null : g)}
                  >
                    {labelOf(g)}
                    <span className="ml-1 opacity-60 tabular-nums">{counts.get(g)}</span>
                  </FilterChip>
                ))}
              </div>
            )}
            <Command.List
              className="max-h-96 max-md:max-h-none max-md:flex-1 overflow-y-auto overflow-x-hidden p-1"
              aria-busy={loading}
              aria-live="polite"
            >
              {loading ? (
                <div className="py-6 text-center text-sm text-muted-foreground" role="status">
                  {t("a11y.loading")}
                </div>
              ) : (
                query.trim() && (
                  <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                    {t("search.noResults")}
                  </Command.Empty>
                )
              )}
              {[...groups].map(([g, groupHits]) => (
                <Command.Group key={g} heading={labelOf(g)}>
                  {groupHits.map(({ item, excerpt }) => {
                    const Icon =
                      item.kind === "heading"
                        ? Hash
                        : item.group === "blocks"
                          ? Blocks
                          : item.kind === "component"
                            ? Component
                            : BookOpen
                    return (
                      <Command.Item
                        key={item.href}
                        value={item.href}
                        onSelect={() => onSelect(item.href)}
                        className="relative flex cursor-pointer select-none items-start gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {item.label}
                            {/* Name the page only for a section of it. */}
                            {item.kind === "heading" && (
                              <span className="ml-1.5 text-xs text-muted-foreground">{item.page}</span>
                            )}
                          </span>
                          {excerpt && (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {excerpt}
                            </span>
                          )}
                        </span>
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
