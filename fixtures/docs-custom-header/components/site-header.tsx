"use client"

import {
  Button,
  Link,
  LocaleToggle,
  SearchTrigger,
  ThemeToggle,
  branding,
  cn,
  useHeaderSections,
  useMobileSidebar,
  withBasePath,
} from "@sntlr/docs-shell/shell/components/header-kit"

/**
 * A site header built from the header kit: brand and section links on the
 * left, search, language and theme on the right. On a phone it keeps only
 * the brand and the menu button; the menu carries the rest
 * (`mobileMenu.tools`).
 */
export default function SiteHeader() {
  const sections = useHeaderSections()
  const { open, toggle } = useMobileSidebar()

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-30 h-(--shell-header-height) border-b border-border bg-background/90 backdrop-blur"
    >
      <div className="flex h-full items-center gap-6 px-4 md:px-6">
        <a href={withBasePath("/")} className="font-bold">
          {branding.shortName} Docs
        </a>
        <nav aria-label="Site sections" className="hidden items-center gap-4 md:flex">
          {sections.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              aria-current={section.active ? "page" : undefined}
              className={cn(
                "text-sm transition-colors",
                section.active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          <SearchTrigger />
          <LocaleToggle />
          <ThemeToggle className="size-9" />
        </div>
        <Button
          variant={open ? "default" : "ghost"}
          size="icon"
          className="ml-auto md:hidden"
          onClick={toggle}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </div>
    </header>
  )
}
