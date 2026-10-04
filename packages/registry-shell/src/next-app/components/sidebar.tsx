"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useIsMobile } from "@shell/hooks/use-mobile"
import { BookOpen, Component, Blocks, ChevronRight } from "lucide-react"
import type { DocMeta } from "@shell/lib/docs"
import type { CategoryMeta, ComponentMeta } from "@shell/lib/components-nav"
import { useTranslations, useLocale } from "@shell/lib/i18n"
import { Backdrop } from "@shell/components/shell-ui/backdrop"
import { RELEASES_ENABLED } from "@shell/lib/versions"

import type { ActiveSection } from "@shell/hooks/use-active-section"

interface SidebarProps {
  docs: DocMeta[]
  components: ComponentMeta[]
  /**
   * Ordered sidebar categories. When empty, the components section renders
   * flat (backward-compatible). When populated, components whose `categories`
   * include a label are grouped under that collapsible subheading; components
   * with no category match render flat below the category groups.
   */
  categories?: CategoryMeta[]
  open?: boolean
  onClose?: () => void
  collapsed?: boolean
  /** When set, desktop views show only this section. Mobile always shows all three. */
  activeSection?: ActiveSection
  /**
   * Which viewport variants of the sidebar to render.
   * - `"all"` (default): mobile floating card + desktop inline + desktop floating (current behavior).
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
  docs,
  components,
  categories = [],
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
  const { locale } = useLocale()

  const isMobile = useIsMobile()
  const uiComponents = components.filter((c) => c.kind === "component")
  const blocks = components.filter((c) => c.kind === "block")

  // Close floating nav on mobile navigation only
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    if (isMobileRef.current) onClose?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only trigger on pathname change
  }, [pathname])

  const docsSection = (
    <SidebarSection icon={BookOpen} title={t("sidebar.documentation")}>
      <ul className="space-y-1">
        {docs.map((doc) => (
          <SidebarLink
            key={doc.slug}
            href={`/docs/${doc.slug}`}
            active={pathname === `/docs/${doc.slug}`}
          >
            {doc.titles?.[locale] ?? doc.title}
          </SidebarLink>
        ))}
        {/* Versioned builds with a changelog only (see /releases). */}
        {RELEASES_ENABLED && (
          <SidebarLink href="/releases" active={pathname === "/releases"}>
            {t("releases.title")}
          </SidebarLink>
        )}
      </ul>
    </SidebarSection>
  )

  const componentsSection = (
    <SidebarSection icon={Component} title={t("sidebar.components")}>
      <SidebarComponentList
        components={uiComponents}
        categories={categories}
        pathname={pathname}
      />
    </SidebarSection>
  )

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

  // Mobile: always show all three sections (no topbar tabs on mobile)
  const mobileNavContent = (
    <nav aria-label="Main navigation" className="p-4 space-y-4">
      {docsSection}
      {componentsSection}
      {blocksSection}
    </nav>
  )

  // Desktop: show only the active section (topbar tabs handle section switching)
  const desktopNavContent = (
    <nav aria-label="Main navigation" className="p-4 space-y-4">
      {activeSection === "docs" && docsSection}
      {activeSection === "components" && componentsSection}
      {activeSection === "blocks" && blocksSection}
      {/* Fallback: when we can't determine a section, show all */}
      {activeSection === null && (
        <>
          {docsSection}
          {componentsSection}
          {blocksSection}
        </>
      )}
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
          className="hidden md:block w-64 border-r border-border bg-background h-[calc(100vh-3.5rem)] overflow-y-auto overflow-x-hidden sticky top-14 shrink-0"
        >
          {desktopNavContent}
        </aside>
      )}
    </>
  )
}

/**
 * Stable slug for the uncategorized bucket's localStorage key + DOM id. Kept
 * in English on purpose so a user's collapsed/expanded preference and the
 * rendered id survive locale switches; the visible heading is translated via
 * `sidebar.base` (override per locale in extraTranslations).
 */
const UNCATEGORIZED_SLUG = "base"

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
  // its label; leftovers land in a synthesized group (translated via
  // `sidebar.base`). All groups — including Base — render alphabetically so
  // declaration order in config has no effect on presentation.
  const uncategorized = components.filter(
    (c) => !c.categories || c.categories.length === 0
  )

  const groups: Array<{
    label: string
    slug: string
    components: ComponentMeta[]
  }> = categories
    .map((cat) => ({
      label: cat.label,
      slug: cat.label,
      components: components.filter((c) => c.categories?.includes(cat.label)),
    }))
    .filter((g) => g.components.length > 0)

  if (uncategorized.length > 0) {
    groups.push({
      label: t("sidebar.base"),
      slug: UNCATEGORIZED_SLUG,
      components: uncategorized,
    })
  }

  groups.sort((a, b) => a.label.localeCompare(b.label))

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
  // Persist expand/collapse across navigations via localStorage. Key uses the
  // slug (stable), not the translated label.
  const storageKey = `registry-shell.sidebar-category.${slug}`
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(storageKey)
    return stored === null ? true : stored === "1"
  })

  // If a component inside this category is the active route, auto-expand so
  // the user can see their current page in context.
  const activeChildName = components.find(
    (c) => pathname === `/components/${c.name}`
  )?.name
  useEffect(() => {
    if (activeChildName && !open) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when active route enters this category
  }, [activeChildName])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, next ? "1" : "0")
      }
      return next
    })
  }, [storageKey])

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
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
        <Icon className="size-4" />
        <span className="flex-1 text-left">{title}</span>
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
