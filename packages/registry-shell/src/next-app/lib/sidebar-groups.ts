import type { CategoryMeta, ComponentMeta } from "./registry-adapter"

/**
 * Stable slug for the uncategorized bucket's localStorage key + DOM id. Kept
 * in English on purpose so a user's collapsed/expanded preference and the
 * rendered id survive locale switches; the visible heading is translated via
 * `sidebar.base` (override per locale in extraTranslations).
 */
export const UNCATEGORIZED_SLUG = "base"

export interface SidebarGroup {
  /** Visible heading. */
  label: string
  /** Stable id for storage keys and DOM ids. */
  slug: string
  components: ComponentMeta[]
}

/**
 * Partition components into the sidebar's category groups.
 *
 * Groups follow the order of `categories`, which is the insertion order of
 * the `categories` object in the shell config. Components that belong to no
 * category go into a synthesized "Base" group (heading `baseLabel`), always
 * last. Empty categories are dropped. Within a group, components keep the
 * order they arrive in (the default adapter sorts them by label).
 */
export function groupComponentsByCategory(
  components: ComponentMeta[],
  categories: CategoryMeta[],
  baseLabel: string,
): SidebarGroup[] {
  const groups: SidebarGroup[] = categories
    .map((cat) => ({
      label: cat.label,
      slug: cat.label,
      components: components.filter((c) => c.categories?.includes(cat.label)),
    }))
    .filter((g) => g.components.length > 0)

  const uncategorized = components.filter(
    (c) => !c.categories || c.categories.length === 0,
  )
  if (uncategorized.length > 0) {
    groups.push({
      label: baseLabel,
      slug: UNCATEGORIZED_SLUG,
      components: uncategorized,
    })
  }

  return groups
}
