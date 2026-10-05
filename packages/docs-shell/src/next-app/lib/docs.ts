import { declaredSections, docs } from "@shell/shell.config"
import type { DocMeta } from "./registry-adapter"
import { buildSections, buildTrees, firstDocSlug, type DocNode, type DocSection } from "./docs-tree"

export type { DocMeta, DocNode, DocSection }

export function getAllDocs(): DocMeta[] {
  return docs.getAllDocs()
}

export function getDocBySlug(slug: string, locale?: string) {
  return docs.getDocBySlug(slug, locale)
}

export function getDocAllLocales(slug: string): Record<string, string> {
  return docs.getDocAllLocales(slug)
}

/**
 * Docs navigation for the layouts: the sections (header tabs) and one
 * sidebar tree per section, plus `""` for pages at the root of the docs
 * folder. Built on the server; the client components render it as is.
 */
export function getDocsNav(): { sections: DocSection[]; trees: Record<string, DocNode[]> } {
  const all = getAllDocs()
  const sections = buildSections(all, declaredSections)
  const trees = buildTrees(all, sections)
  return {
    sections: sections.map((s) => ({
      ...s,
      firstSlug: all.find((d) => d.slug === s.dir)?.slug ?? firstDocSlug(trees[s.dir] ?? []),
    })),
    trees,
  }
}
