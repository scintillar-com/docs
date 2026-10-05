import type { DocContent, DocMeta } from "./registry-adapter"

/**
 * Where the shell's documentation pages come from. Separate from the
 * component registry (`RegistryAdapter`), so a site can be docs-only.
 *
 * The default implementation reads MDX from `paths.docs`
 * (src/adapter/fs-docs-source.ts). A custom adapter that defines
 * `getAllDocs` / `getDocBySlug` / `getDocAllLocales` replaces those methods,
 * as it always has.
 */
export interface DocsSource {
  /** Every page with its frontmatter, sorted for the sidebar. */
  getAllDocs(): DocMeta[]
  /** One page, preferring `locale`; falls back to the default locale. `null` if unknown. */
  getDocBySlug(slug: string, locale?: string): DocContent | null
  /** `{ [locale]: rawMdx }` for every locale the page exists in. */
  getDocAllLocales(slug: string): Record<string, string>
}

/** A source with no pages: shell-only mode (no config found). */
export const EMPTY_DOCS_SOURCE: DocsSource = {
  getAllDocs: () => [],
  getDocBySlug: () => null,
  getDocAllLocales: () => ({}),
}
