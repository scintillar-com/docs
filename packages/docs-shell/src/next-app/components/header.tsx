"use client"

import Image from "next/image"
import Link from "next/link"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@shell/components/shell-ui/breadcrumb"
import { Badge } from "@shell/components/shell-ui/badge"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Github, Menu, Star } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"
import { LocaleToggle } from "@shell/components/locale-toggle"
import { ThemeToggle } from "@shell/components/theme-toggle"
import { SearchTrigger } from "@shell/components/search"
import { VersionSwitcher } from "@shell/components/version-switcher"
import { useMobileSidebar } from "@shell/components/sidebar-provider"
import { useNavData } from "@shell/components/nav-data-provider"
import { useActiveSection, type ActiveSection } from "@shell/hooks/use-active-section"
import { TranslatedText } from "@shell/components/translated-text"
import { firstDocSlug } from "@shell/lib/docs-tree"
import { GITHUB_URL, formatStarCount } from "@shell/lib/github"
import { branding } from "@shell/lib/branding"
import { withBasePath } from "@shell/lib/base-path"

function HeaderTab({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-3.25 left-0 right-0 h-0.5 bg-primary" />
      )}
    </Link>
  )
}

export function Header({ githubStars }: { githubStars?: number | null } = {}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { open: sidebarOpen, toggle, collapsed } = useMobileSidebar()

  const navData = useNavData()
  const activeSection: ActiveSection = useActiveSection(navData?.components ?? [], navData?.sections ?? [])
  // "Documentation" covers pages at the root of the docs folder (every page
  // of a flat docs site); each docs section (top-level folder) gets its own
  // tab, landing on the section's own page or its first page.
  const firstRootSlug = firstDocSlug(navData?.trees[""] ?? [])
  const sectionTabs = (navData?.sections ?? []).filter((s) => s.firstSlug)
  const firstComponentName = navData?.components.find((c) => c.kind === "component")?.name
  const firstBlockName = navData?.components.find((c) => c.kind === "block")?.name
  const hasBlocks = Boolean(firstBlockName)

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration mount detection
  useEffect(() => setMounted(true), [])

  const faviconSrc = mounted
    ? resolvedTheme === "dark"
      ? branding.faviconLight
      : branding.faviconDark
    : branding.faviconDark

  return (
    <header className="h-14 border-b border-border sticky top-0 z-30 bg-background">
      <div className="relative flex items-center justify-between h-full px-4 md:px-6">
        {/* Left: hamburger + breadcrumb (fixed-width container so absolute-centered tabs don't shift) */}
        <div className="flex items-center gap-2 md:w-80 md:shrink-0 min-w-0">
          {/* Hamburger — always takes space on mobile for consistent brand position */}
          <div
            className={`md:overflow-hidden md:transition-all md:duration-300 md:ease-in-out motion-reduce:transition-none ${
              collapsed ? "md:w-9 md:opacity-100" : "md:w-0 md:opacity-0"
            }`}
          >
            <Button
              variant={sidebarOpen ? "default" : "ghost"}
              size="icon"
              onClick={toggle}
              aria-label="Toggle menu"
              aria-expanded={sidebarOpen}
            >
              <Menu className="size-4" />
            </Button>
          </div>

          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap gap-1.5 sm:gap-2 text-sm">
              <BreadcrumbItem>
                <BreadcrumbLink href={withBasePath("/")} className="flex items-center gap-2 hover:no-underline">
                  <Image
                    src={faviconSrc}
                    alt={`${branding.logoAlt} logo`}
                    width={22}
                    height={22}
                  />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={withBasePath("/")} className="font-medium hover:no-underline">
                  {branding.shortName}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <span id="header-breadcrumb" className="contents" />
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        {/* Center: section tabs — absolutely centered, independent of breadcrumb width */}
        {navData && (
          <nav
            aria-label="Sections"
            className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2 h-full"
          >
            {firstRootSlug && (
              <HeaderTab href={`/docs/${firstRootSlug}`} active={activeSection === "docs"}>
                <TranslatedText k="sidebar.documentation" />
              </HeaderTab>
            )}
            {sectionTabs.map((section) => (
              <HeaderTab
                key={section.dir}
                href={`/docs/${section.firstSlug}`}
                active={activeSection === `docs:${section.dir}`}
              >
                {section.label}
              </HeaderTab>
            ))}
            {firstComponentName && (
              <HeaderTab href={`/components/${firstComponentName}`} active={activeSection === "components"}>
                <TranslatedText k="sidebar.components" />
              </HeaderTab>
            )}
            {hasBlocks && firstBlockName && (
              <HeaderTab href={`/components/${firstBlockName}`} active={activeSection === "blocks"}>
                <TranslatedText k="sidebar.blocks" />
              </HeaderTab>
            )}
          </nav>
        )}

        <div className="flex items-center gap-1">
          {/* GitHub button — rendered only when the registry config provides
              a `github` object. Label defaults to "Github" but is overridable
              (e.g. "Sponsor"). Star count fetches server-side with hourly
              revalidation, unless the registry opted out via showStars=false. */}
          {branding.github && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="hidden md:inline-flex h-8 px-2.5 gap-1.5 text-xs font-medium"
            >
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={
                  typeof githubStars === "number"
                    ? `${branding.github.label ?? "GitHub"}, ${githubStars} stars`
                    : branding.github.label ?? "GitHub repository"
                }
              >
                <Github className="size-3.5" />
                <span>{branding.github.label ?? "Github"}</span>
                {typeof githubStars === "number" && (
                  <Badge
                    variant="secondary"
                    className="gap-0.5 px-1.5 py-0 h-4 text-[10px] font-mono tabular-nums"
                  >
                    {formatStarCount(githubStars)}
                    <Star className="size-2.5 fill-current" />
                  </Badge>
                )}
              </a>
            </Button>
          )}
          {/* Renders only on sites built with `versions` (see VersionSwitcher). */}
          <VersionSwitcher />
          <SearchTrigger />
          {/* Locale + theme switches always visible — small icons fit even on
              mobile and avoid the indirection of a Settings modal. */}
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
