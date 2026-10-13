"use client"

import { useNavData } from "@shell/components/nav-data-provider"
import { useActiveSection } from "@shell/hooks/use-active-section"
import { firstDocSlug } from "@shell/lib/docs-tree"
import { useTranslations } from "@shell/lib/i18n"

export interface HeaderSection {
  /** Stable key, also the value `useActiveSection` returns for it. */
  key: string
  label: string
  href: string
  active: boolean
}

/**
 * The site's top-level sections, in header order, each with its landing
 * page and whether the current page belongs to it: "Documentation" for pages
 * at the root of the docs folder, one per docs section (top-level folder),
 * then Components and Blocks on registry sites. Empty outside NavDataProvider.
 */
export function useHeaderSections(): HeaderSection[] {
  const t = useTranslations()
  const navData = useNavData()
  const activeSection = useActiveSection(navData?.components ?? [], navData?.sections ?? [])
  if (!navData) return []

  const sections: HeaderSection[] = []
  const add = (key: string, label: string, href: string) =>
    sections.push({ key, label, href, active: activeSection === key })

  const firstRootSlug = firstDocSlug(navData.trees[""] ?? [])
  if (firstRootSlug) add("docs", t("sidebar.documentation"), `/docs/${firstRootSlug}`)
  for (const section of navData.sections) {
    if (section.firstSlug) add(`docs:${section.dir}`, section.label, `/docs/${section.firstSlug}`)
  }
  const firstComponent = navData.components.find((c) => c.kind === "component")?.name
  if (firstComponent) add("components", t("sidebar.components"), `/components/${firstComponent}`)
  const firstBlock = navData.components.find((c) => c.kind === "block")?.name
  if (firstBlock) add("blocks", t("sidebar.blocks"), `/components/${firstBlock}`)
  return sections
}
