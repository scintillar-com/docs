"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useIsMobile } from "@shell/hooks/use-mobile"
import { usePersistedOpen } from "@shell/hooks/use-persisted-open"
import { BookOpen, Component, Blocks, ChevronRight } from "lucide-react"
import type { DocMeta, DocNode, DocSection } from "@shell/lib/docs"
import type { CategoryMeta, ComponentMeta } from "@shell/lib/components-nav"
import type { NavData } from "@shell/components/nav-data-provider"
import { sectionIcon } from "@shell/lib/section-icon"
import { useTranslations, useLocale } from "@shell/lib/i18n"
import { Backdrop } from "@shell/components/shell-ui/backdrop"
import { DragHandle } from "@shell/components/shell-ui/drag-handle"
import { RELEASES_ENABLED } from "@shell/lib/versions"
import { groupComponentsByCategory } from "@shell/lib/sidebar-groups"

import type { ActiveSection } from "@shell/hooks/use-active-section"

interface SidebarProps {
  /** Docs tree, sections, components and categories (see NavDataProvider). */
  nav: NavData
  open?: boolean
  onClose?: () => void
  collapsed?: boolean
  /** When set, desktop views show only this part. Mobile always shows everything. */
  activeSection?: ActiveSection
  /**
   * Which viewport variants of the sidebar to render.
   * - `"all"` (default): mobile floating card + desktop inline + desktop floating.
   * - `"mobile"`: only the mobile floating card + backdrop. Used by the root layout so the
   *   hamburger menu works on every page (including the homepage), without injecting a
   *   desktop sidebar on pages that don't have one.
   * - `"desktop"`: only the desktop inline + desktop floating card. Used by `SidebarLayout`
   *   so the per-section docs/components pages still get their desktop nav, while the
   *   root layout owns the mobile variant.
   */
  display?: "all" | "mobile" | "desktop"
}

export function Sidebar({
  nav,
  open,
  onClose,
  collapsed,
  activeSection,
  display = "all",
}: SidebarProps) {
  // Strip the trailing slash that Next emits when trailingSlash: true is set
  // on the shell's next.config.ts (needed for static export). Without this,
  // usePathname() returns e.g. "/components/button/" and the href comparisons
  // (which build "/components/button" without a trailing slash) never match,
  // so every sidebar link renders as non-active.
  const pathname = (usePathname() ?? "").replace(/\/$/, "") || "/"
  const t = useTranslations()

  const isMobile = useIsMobile()
  const { width, dragging, onResizeStart, onResizeMove, onResizeEnd } = useSidebarWidth()
  const uiComponents = nav.components.filter((c) => c.kind === "component")
  const blocks = nav.components.filter((c) => c.kind === "block")

  // Close floating nav on mobile navigation only
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (isMobileRef.current) onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on pathname change
  }, [pathname])

  // Pages at the root of the docs folder (every page of a flat docs site),
  // plus the Releases page of versioned builds with a changelog.
  const rootNodes = nav.trees[""] ?? []
  const docsSection =
    rootNodes.length > 0 || RELEASES_ENABLED ? (
      <SidebarSection icon={BookOpen} title={t("sidebar.documentation")}>
        <ul className="space-y-1">
          <SidebarTreeItems nodes={rootNodes} pathname={pathname} depth={0} />
          {RELEASES_ENABLED && (
            <SidebarLink href="/releases" active={pathname === "/releases"}>
              {t("releases.title")}
            </SidebarLink>
          )}
        </ul>
      </SidebarSection>
    ) : null

  // One block per docs section (top-level folder), nested as deep as the content.
  // A section with its own page (`<section>/_index.mdx`) links its heading
  // to it; that page isn't an entry in its own tree.
  const sectionPages = new Set(nav.docs.map((d) => d.slug))
  const renderDocSection = (section: DocSection) => (
    <SidebarSection
      key={section.dir}
      icon={sectionIcon(section.icon)}
      title={section.label}
      href={sectionPages.has(section.dir) ? `/docs/${section.dir}` : undefined}
      active={pathname === `/docs/${section.dir}`}
    >
      <ul className="space-y-1">
        <SidebarTreeItems nodes={nav.trees[section.dir] ?? []} pathname={pathname} depth={0} />
      </ul>
    </SidebarSection>
  )
  const activeDocSection =
    activeSection?.startsWith("docs:") ? nav.sections.find((s) => `docs:${s.dir}` === activeSection) : undefined

  // Hidden when empty, like blocks: a docs-only site has no components.
  const componentsSection = uiComponents.length > 0 ? (
    <SidebarSection icon={Component} title={t("sidebar.components")}>
      <SidebarComponentList
        components={uiComponents}
        categories={nav.categories}
        pathname={pathname}
      />
    </SidebarSection>
  ) : null

  const blocksSection = blocks.length > 0 ? (
    <SidebarSection icon={Blocks} title={t("sidebar.blocks")}>
      <ul className="space-y-1">
        {blocks.map((comp) => (
          <SidebarLink
            key={comp.name}
            href={`/components/${comp.name}`}
            active={pathname === `/components/${comp.name}`}
          >
            {comp.label}
          </SidebarLink>
        ))}
      </ul>
    </SidebarSection>
  ) : null

  const everything = (
    <>
      {docsSection}
      {nav.sections.map(renderDocSection)}
      {componentsSection}
      {blocksSection}
    </>
  )

  // Mobile: always show everything (no topbar tabs on mobile)
  const mobileNavContent = (
    <nav aria-label="Main navigation" className="p-4 space-y-4">
      {everything}
    </nav>
  )

  // Desktop: show only the active part (topbar tabs handle switching)
  const desktopNavContent = (
    <nav aria-label="Main navigation" className="p-4 space-y-4">
      {activeSection === "docs" && docsSection}
      {activeDocSection && renderDocSection(activeDocSection)}
      {activeSection === "components" && componentsSection}
      {activeSection === "blocks" && blocksSection}
      {/* Fallback: when we can't determine a section, show all */}
      {activeSection === null && everything}
    </nav>
  )

  const showMobile = display === "all" || display === "mobile"
  const showDesktop = display === "all" || display === "desktop"

  return (
    <>
      {/* Backdrop — mobile nav only (no backdrop in desktop fullscreen) */}
      {showMobile && open && !collapsed && (
        <Backdrop
          belowHeader
          className="md:hidden"
          onClick={onClose}
        />
      )}

      {/* Mobile floating card — mobile only */}
      {showMobile && (
        <aside
          className={`
            md:hidden fixed top-18 left-4 z-50 w-64 rounded-lg border border-border bg-background shadow-xl overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none
            ${open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}
          `}
          style={{ maxHeight: "calc(100vh - 6rem)" }}
        >
          {mobileNavContent}
        </aside>
      )}

      {/* Desktop floating card — only meaningful on component pages where the
          user can enter fullscreen preview mode. On other sections the
          fullscreen state is moot and the floating card just looks out of
          place; skip rendering it entirely. */}
      {showDesktop &&
        (activeSection === "components" || activeSection === "blocks") && (
          <aside
            className={`
            hidden md:block fixed top-18 left-4 z-50 w-64 rounded-lg border border-border bg-background shadow-xl overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none
            ${open && collapsed ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}
          `}
            style={{ maxHeight: "calc(100vh - 6rem)" }}
          >
            {desktopNavContent}
          </aside>
        )}

      {/* Desktop inline sidebar — only when not collapsed */}
      {showDesktop && !collapsed && (
        <aside
          style={{ width }}
          className="relative hidden md:block border-r border-border bg-background h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden sticky top-14 shrink-0"
        >
          {desktopNavContent}
          {/* Right-edge resize grip: reveals on hover, stays while dragging.
              Pinned to the aside's full height so it tracks the edge rather
              than the scrolled content. */}
          <DragHandle
            orientation="vertical"
            active={dragging}
            highlight
            onPointerDown={onResizeStart}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeEnd}
            className="absolute right-0 top-0 z-20 h-full w-1.5"
            style={{ height: "100%" }}
          />
        </aside>
      )}
    </>
  )
}

/** Default, floor and ceiling for the sidebar's width, in pixels. */
const DEFAULT_WIDTH = 256
const MIN_WIDTH = 180
const MAX_WIDTH = 520
const WIDTH_KEY = "docs-shell.sidebar-width"

/**
 * Drag-to-resize for the desktop sidebar, remembered per browser: pointer
 * capture on the grip, the width clamped so the nav can neither vanish nor
 * crowd out the article (at most 40% of the window), and one localStorage
 * write per drag, on pointer-up.
 */
function useSidebarWidth() {
  const [width, setWidth] = useState<number>(DEFAULT_WIDTH)
  const [dragging, setDragging] = useState(false)
  const lastWidth = useRef(DEFAULT_WIDTH)

  // Read the stored width after mount: the server renders the default, and
  // reading during render would make the first client paint disagree.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WIDTH_KEY)
      if (raw) {
        const stored = clampWidth(Number(raw))
        // eslint-disable-next-line react-hooks/set-state-in-effect -- apply the stored width after hydration (reading it during render would mismatch the server's default)
        setWidth(stored)
        lastWidth.current = stored
      }
    } catch {
      // Private mode / blocked storage: the default stands.
    }
  }, [])

  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }, [])

  const onResizeMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return
      // The sidebar's left edge is the viewport's, so the pointer's x is the width.
      const next = clampWidth(e.clientX)
      lastWidth.current = next
      setWidth(next)
    },
    [dragging],
  )

  const onResizeEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    try {
      window.localStorage.setItem(WIDTH_KEY, String(lastWidth.current))
    } catch {
      // Not remembering the width isn't worth failing a drag.
    }
  }, [])

  return { width, dragging, onResizeStart, onResizeMove, onResizeEnd }
}

export function clampWidth(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_WIDTH
  const ceiling =
    typeof window === "undefined" ? MAX_WIDTH : Math.min(MAX_WIDTH, window.innerWidth * 0.4)
  return Math.round(Math.min(Math.max(px, MIN_WIDTH), Math.max(MIN_WIDTH, ceiling)))
}

/** The list items of a tree level, without the wrapping `<ul>`. */
function SidebarTreeItems({
  nodes,
  pathname,
  depth,
}: {
  nodes: DocNode[]
  pathname: string
  depth: number
}) {
  return (
    <>
      {nodes.map((node) =>
        node.kind === "doc" ? (
          <SidebarDocLink key={node.doc.slug} doc={node.doc} pathname={pathname} depth={depth} />
        ) : (
          <SidebarFolder key={node.path} node={node} pathname={pathname} depth={depth} />
        ),
      )}
    </>
  )
}

/** True when the active route is this folder's own page or anything inside it. */
function containsActive(node: DocNode, pathname: string): boolean {
  if (node.kind === "doc") return pathname === `/docs/${node.doc.slug}`
  return (
    (node.index !== null && pathname === `/docs/${node.index.slug}`) ||
    node.children.some((child) => containsActive(child, pathname))
  )
}

function SidebarFolder({
  node,
  pathname,
  depth,
}: {
  node: Extract<DocNode, { kind: "folder" }>
  pathname: string
  depth: number
}) {
  const { locale } = useLocale()
  // Remembered per folder path (stable), not per label, so renaming a
  // folder's page doesn't reset anyone's preference. A folder holding the
  // active page opens regardless.
  const { open, toggle } = usePersistedOpen(
    `docs-shell.sidebar-folder.${node.path}`,
    containsActive(node, pathname),
  )
  const label = node.index?.titles?.[locale] ?? node.label
  const contentId = `sidebar-folder-${node.path.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`
  const indent = { paddingLeft: `${depth * 0.75}rem` }

  return (
    <li>
      <div className="flex items-center gap-0.5" style={indent}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          // The chevron alone toggles, so a folder with a landing page can be
          // opened without navigating and navigated to without collapsing.
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <ChevronRight
            className={`size-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
        </button>
        {node.index ? (
          <Link
            href={`/docs/${node.index.slug}`}
            className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-sm transition-colors ${
              pathname === `/docs/${node.index.slug}`
                ? "bg-primary/10 font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ) : (
          // A folder with no landing page is a heading, not a destination.
          <button
            type="button"
            onClick={toggle}
            className="min-w-0 flex-1 cursor-pointer truncate rounded-md px-1.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {label}
          </button>
        )}
      </div>
      {open && node.children.length > 0 && (
        <ul id={contentId} className="mt-1 space-y-1">
          <SidebarTreeItems nodes={node.children} pathname={pathname} depth={depth + 1} />
        </ul>
      )}
    </li>
  )
}

/** One page. Title follows the active locale when translations exist. */
function SidebarDocLink({
  doc,
  pathname,
  depth,
}: {
  doc: DocMeta
  pathname: string
  depth: number
}) {
  const { locale } = useLocale()
  const active = pathname === `/docs/${doc.slug}`
  return (
    <li>
      <Link
        href={`/docs/${doc.slug}`}
        // Nested pages clear the folder's chevron column; top-level pages
        // keep the flat list's padding.
        style={depth > 0 ? { paddingLeft: `${depth * 0.75 + 1.25}rem` } : undefined}
        className={`block truncate rounded-md px-2 py-1.5 text-sm transition-colors ${
          active
            ? "bg-primary/10 font-medium text-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        {doc.titles?.[locale] ?? doc.title}
      </Link>
    </li>
  )
}

function SidebarComponentList({
  components,
  categories,
  pathname,
}: {
  components: ComponentMeta[]
  categories: CategoryMeta[]
  pathname: string
}) {
  const t = useTranslations()

  // Fast path: no categories declared → flat list (matches pre-2.1 behavior).
  if (categories.length === 0) {
    return (
      <ul className="space-y-1">
        {components.map((comp) => (
          <SidebarLink
            key={comp.name}
            href={`/components/${comp.name}`}
            active={pathname === `/components/${comp.name}`}
          >
            {comp.label}
          </SidebarLink>
        ))}
      </ul>
    )
  }

  // Partition: each category gets the components whose `categories` include
  // its label, in the order the config declares the categories; leftovers
  // land in a synthesized group (translated via `sidebar.base`), always last.
  const groups = groupComponentsByCategory(components, categories, t("sidebar.base"))

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <SidebarCategoryGroup
          key={g.slug}
          label={g.label}
          slug={g.slug}
          components={g.components}
          pathname={pathname}
        />
      ))}
    </div>
  )
}

function SidebarCategoryGroup({
  label,
  slug,
  components,
  pathname,
}: {
  label: string
  /**
   * Stable identifier used for the localStorage key and DOM id. Distinct from
   * `label` so translated headings don't invalidate user preferences when the
   * locale changes.
   */
  slug: string
  components: ComponentMeta[]
  pathname: string
}) {
  // Remembered per category; a category holding the active component opens
  // so the current page shows in context.
  const hasActive = components.some((c) => pathname === `/components/${c.name}`)
  const { open, toggle } = usePersistedOpen(`registry-shell.sidebar-category.${slug}`, hasActive)

  const contentId = `sidebar-category-${slug.replace(/\s+/g, "-").toLowerCase()}`

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight
          className={`size-3 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          aria-hidden="true"
        />
        <span>{label}</span>
      </button>
      {open && (
        <ul id={contentId} className="space-y-1 mt-1">
          {components.map((comp) => (
            <SidebarLink
              key={comp.name}
              href={`/components/${comp.name}`}
              active={pathname === `/components/${comp.name}`}
            >
              {comp.label}
            </SidebarLink>
          ))}
        </ul>
      )}
    </div>
  )
}

function SidebarSection({
  icon: Icon,
  title,
  href,
  active = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  /** The section's own page, when it has one: the heading links to it. */
  href?: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
        <Icon className="size-4" />
        {href ? (
          <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 text-left underline-offset-4 hover:underline ${active ? "underline" : ""}`}
          >
            {title}
          </Link>
        ) : (
          <span className="flex-1 text-left">{title}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function SidebarLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        className={`block text-sm px-2 py-1.5 rounded-md transition-colors ${
          active
            ? "bg-primary/10 text-foreground font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
        }`}
      >
        {children}
      </Link>
    </li>
  )
}
