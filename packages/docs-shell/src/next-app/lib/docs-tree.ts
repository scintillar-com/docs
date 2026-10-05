import type { DocMeta } from "./registry-adapter"

/**
 * Navigation model for the docs: sections (header tabs) and, per section, a
 * tree that mirrors the content's folders. Pure functions over the page
 * list, so a custom adapter that only implements `getAllDocs` gets nested
 * navigation from its slugs too.
 *
 *     content/docs/<section>/[<folder>/…]<name>.mdx  →  /docs/<section>/[<folder>/…]<name>
 *
 * A site whose docs are all at the root of the docs folder has no sections:
 * everything sits in the root tree, as before nesting existed.
 */

/** A top-level docs folder, shown as a header tab and a sidebar block. */
export interface DocSection {
  /** Folder name under the docs folder, e.g. `"user-guide"`. */
  dir: string
  label: string
  /** Lucide icon name (see lib/section-icon.ts). */
  icon: string
  order: number
  /** Where its header tab goes: the section's own `_index` page, else its first page. */
  firstSlug?: string
}

/**
 * One sidebar entry. A folder's `index` is its landing page (`_index.mdx`),
 * which also supplies its label and its position among its siblings.
 */
export type DocNode =
  | { kind: "doc"; doc: DocMeta }
  | { kind: "folder"; label: string; path: string; index: DocMeta | null; children: DocNode[] }

/** A section as declared in the config (`sections`). */
export interface DeclaredSection {
  dir: string
  label?: string
  icon?: string
}

/** `user-guide` → `User Guide`. */
export function titleCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** Section of a page: its own `section`, or the first segment of a nested slug. */
export function sectionOf(doc: DocMeta): string {
  if (doc.section !== undefined) return doc.section
  const parts = doc.slug.split("/")
  return parts.length > 1 ? parts[0] : ""
}

/**
 * Sections in display order: the declared ones (config order) that have
 * pages, then any other top-level folder found in the content,
 * alphabetically, so new content is reachable before anyone declares it.
 */
export function buildSections(docs: DocMeta[], declared: DeclaredSection[] = []): DocSection[] {
  const found = new Set(docs.map(sectionOf).filter(Boolean))
  const declaredDirs = new Set(declared.map((s) => s.dir))
  const out: DocSection[] = declared
    .filter((s) => found.has(s.dir))
    .map((s) => ({ dir: s.dir, label: s.label ?? titleCase(s.dir), icon: s.icon ?? "BookOpen", order: 0 }))
  for (const dir of [...found].filter((d) => !declaredDirs.has(d)).sort()) {
    out.push({ dir, label: titleCase(dir), icon: "BookOpen", order: 0 })
  }
  return out.map((s, i) => ({ ...s, order: i }))
}

/**
 * One section's tree (`""` for the root). Pages sort by `order` then title;
 * a folder sorts by its `_index` page's order, so it can be placed among its
 * siblings rather than always after them. A folder's `_index` is the folder,
 * not an entry inside it.
 */
export function buildTree(docs: DocMeta[], section: string): DocNode[] {
  const inSection = docs.filter((d) => sectionOf(d) === section)
  // Path segments below the section: `admin/users` for `user-guide/admin/users`.
  const rel = (doc: DocMeta) => {
    const parts = doc.slug.split("/")
    return section ? parts.slice(1) : parts
  }
  const prefixOf = (parts: string[]) => (section ? [section, ...parts] : parts).join("/")
  // A path is a folder when another page lives below it.
  const isFolder = (slug: string) => inSection.some((d) => d.slug.startsWith(`${slug}/`))

  function nodesUnder(prefix: string[]): DocNode[] {
    const depth = prefix.length
    const nodes: DocNode[] = []
    const seen = new Set<string>()
    const within = (parts: string[]) => prefix.every((p, i) => parts[i] === p)

    for (const doc of inSection) {
      const parts = rel(doc)
      if (parts.length !== depth + 1 || !within(parts)) continue
      const name = parts[depth]
      const path = [...prefix, name].join("/")
      if (isFolder(prefixOf([...prefix, name]))) {
        if (seen.has(path)) continue
        seen.add(path)
        nodes.push({ kind: "folder", label: doc.title, path, index: doc, children: nodesUnder([...prefix, name]) })
      } else {
        nodes.push({ kind: "doc", doc })
      }
    }

    // A folder with no `_index.mdx` has no page to be found through; collect
    // it separately and title it from its name.
    for (const doc of inSection) {
      const parts = rel(doc)
      if (parts.length <= depth + 1 || !within(parts)) continue
      const name = parts[depth]
      const path = [...prefix, name].join("/")
      if (seen.has(path)) continue
      seen.add(path)
      nodes.push({ kind: "folder", label: titleCase(name), path, index: null, children: nodesUnder([...prefix, name]) })
    }

    const weight = (n: DocNode) => (n.kind === "doc" ? n.doc.order : (n.index?.order ?? 999))
    const label = (n: DocNode) => (n.kind === "doc" ? n.doc.title : n.label)
    return nodes.sort((a, b) => weight(a) - weight(b) || label(a).localeCompare(label(b)))
  }

  return nodesUnder([])
}

/** Trees keyed by section dir, plus `""` for root-level pages. */
export function buildTrees(docs: DocMeta[], sections: DocSection[]): Record<string, DocNode[]> {
  const trees: Record<string, DocNode[]> = { "": buildTree(docs, "") }
  for (const s of sections) trees[s.dir] = buildTree(docs, s.dir)
  return trees
}

/** First page of a tree in sidebar order (a folder's own page counts). */
export function firstDocSlug(nodes: DocNode[]): string | undefined {
  for (const node of nodes) {
    if (node.kind === "doc") return node.doc.slug
    if (node.index) return node.index.slug
    const inside = firstDocSlug(node.children)
    if (inside) return inside
  }
  return undefined
}
