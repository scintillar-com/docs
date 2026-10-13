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
import { useHeaderSections } from "@shell/hooks/use-header-sections"
import { GITHUB_URL, formatStarCount } from "@shell/lib/github"
import { branding } from "@shell/lib/branding"
import { withBasePath } from "@shell/lib/base-path"
import { MOBILE_MENU_TOOLS } from "@shell/lib/mobile-menu"

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
      className={`relative flex h-full items-center px-3 text-sm font-medium transition-colors ${
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-primary" />
      )}
    </Link>
  )
}

export function Header({ githubStars }: { githubStars?: number | null } = {}) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { open: sidebarOpen, toggle, collapsed } = useMobileSidebar()

  const navData = useNavData()
  // One tab per top-level section (see useHeaderSections).
  const sections = useHeaderSections()

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration mount detection
  useEffect(() => setMounted(true), [])

  const faviconSrc = mounted
    ? resolvedTheme === "dark"
      ? branding.faviconLight
      : branding.faviconDark
    : branding.faviconDark

  return (
    <header className="h-(--shell-header-height) border-b border-border sticky top-0 z-30 bg-background">
      {/* From md up, a 1fr | auto | 1fr grid keeps the tabs centred whatever the
          breadcrumb width, and the columns can't overlap when space runs out. */}
      <div className="flex items-center justify-between h-full px-4 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6">
        {/* Left: hamburger + breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
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

        {/* Center: section tabs */}
        {navData && (
          <nav
            aria-label="Sections"
            className="hidden md:flex items-center gap-1 h-full"
          >
            {sections.map((section) => (
              <HeaderTab key={section.key} href={section.href} active={section.active}>
                {section.label}
              </HeaderTab>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1 md:col-start-3 md:justify-self-end">
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
                {/* Icon only below lg, where the tabs need the room. */}
                <span className="hidden lg:inline">{branding.github.label ?? "Github"}</span>
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
          {/* Locale + theme switches always visible — small icons fit even on
              mobile and avoid the indirection of a Settings modal — unless
              `mobileMenu.tools` moves them into the mobile menu. */}
          <div className={MOBILE_MENU_TOOLS ? "contents max-md:hidden" : "contents"}>
            <SearchTrigger />
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
