/**
 * Everything a site header (`components.header`) may build on, from one
 * import that stays stable across minor releases:
 *
 *   import { SearchTrigger, ThemeToggle, useHeaderSections } from "@sntlr/docs-shell/shell/components/header-kit"
 *
 * (`@sntlr/registry-shell/shell/components/header-kit` on Registry Shell.)
 * Other `shell/*` paths are internal and may move.
 */

// Navigation
export { useHeaderSections, type HeaderSection } from "@shell/hooks/use-header-sections"
export { useNavData, type NavData } from "@shell/components/nav-data-provider"
export { useActiveSection, type ActiveSection } from "@shell/hooks/use-active-section"
export { useMobileSidebar } from "@shell/components/sidebar-provider"

// Controls. `Link` is Next's: a site doesn't depend on Next itself.
export { default as Link } from "next/link"
export { SearchTrigger, type SearchTriggerVariant } from "@shell/components/search"
export { LocaleToggle } from "@shell/components/locale-toggle"
export { ThemeToggle } from "@shell/components/theme-toggle"
export { VersionSwitcher } from "@shell/components/version-switcher"
export { Button } from "@shell/components/shell-ui/button"

// The shell's own header, to wrap rather than replace
export { Header } from "@shell/components/header"

// Site settings and helpers
export { branding } from "@shell/lib/branding"
export { withBasePath } from "@shell/lib/base-path"
export { useLocale, useTranslations } from "@shell/lib/i18n"
export { MOBILE_MENU_TOOLS } from "@shell/lib/mobile-menu"
export { cn } from "@shell/lib/utils"
