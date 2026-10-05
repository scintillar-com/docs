/**
 * Default filesystem docs source: reads MDX pages from `paths.docs`.
 *
 * Two layouts:
 *   - Single folder (`multilocale: false`): `content/docs/<slug>.mdx`.
 *   - Locale folders (`multilocale: true`): `content/docs/<locale>/<slug>.mdx`,
 *     the default locale's folder defines the page list.
 *
 * In both layouts a translation can also sit next to its page as
 * `<slug>.<locale>.mdx` (e.g. `intro.fr.mdx` beside `intro.mdx`). A file is
 * only treated as a translation when its base page exists, so a page whose
 * own name contains a dot (`v1.2-notes.mdx`) keeps its URL. When a locale
 * has both a `<locale>/<slug>.mdx` file and a `<slug>.<locale>.mdx` file,
 * the locale folder wins.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import type { ResolvedShellConfig } from "../config-loader.js"

// Re-declared here (this file compiles to dist/ separately from the Next
// app, which owns the canonical types in next-app/lib/registry-adapter.ts).
export interface DocMeta {
  slug: string
  title: string
  description: string
  order: number
  titles: Record<string, string>
}

export interface DocContent {
  meta: Omit<DocMeta, "titles">
  content: string
}

export interface DocsSource {
  getAllDocs(): DocMeta[]
  getDocBySlug(slug: string, locale?: string): DocContent | null
  getDocAllLocales(slug: string): Record<string, string>
}

/** `intro.fr.mdx` → { slug: "intro", locale: "fr" }; anything else → null. */
const VARIANT = /^(.+)\.([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\.mdx$/

interface PageFiles {
  /** Locale of the base file (the default locale, or "en" in single-folder mode). */
  baseLocale: string
  /** Base file path. */
  base: string
  /** Translation files by locale (locale folders first, then `<slug>.<locale>.mdx`). */
  variants: Record<string, string>
}

function readFrontmatter(file: string): Record<string, unknown> {
  return matter(fs.readFileSync(file, "utf-8")).data as Record<string, unknown>
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback
}

function num(value: unknown, fallback: number): number {
  // YAML gives numbers, but `order: "2"` (quoted) sorted fine before; keep it.
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? n : fallback
}

export function createFsDocsSource(resolved: ResolvedShellConfig): DocsSource {
  const docsDir = resolved.paths.docs
  const isMulti = resolved.multilocale
  // Single-folder sites historically key their only locale as "en"; keep that
  // unless a default locale is configured, so the client fallback still works.
  const baseLocale = resolved.defaultLocale || "en"
  const warned = new Set<string>()

  function listLocaleFolders(): string[] {
    if (!isMulti || !fs.existsSync(docsDir)) return []
    return fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  }

  /** The folder whose `.mdx` files define the page list. */
  function pageDir(): string {
    return isMulti ? path.join(docsDir, baseLocale) : docsDir
  }

  /** Every page with its files, keyed by slug. */
  function scan(): Map<string, PageFiles> {
    const dir = pageDir()
    const pages = new Map<string, PageFiles>()
    if (!fs.existsSync(dir)) return pages

    const mdx = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"))
    const names = new Set(mdx.map((f) => f.slice(0, -".mdx".length)))
    const variantFiles: Array<{ slug: string; locale: string; file: string }> = []

    for (const filename of mdx) {
      const m = VARIANT.exec(filename)
      // A translation only when its base page exists and it isn't the base
      // locale itself (intro.en.mdx on an English site is just a page).
      if (m && names.has(m[1]) && m[2] !== baseLocale) {
        variantFiles.push({ slug: m[1], locale: m[2], file: path.join(dir, filename) })
        continue
      }
      const slug = filename.slice(0, -".mdx".length)
      pages.set(slug, { baseLocale, base: path.join(dir, filename), variants: {} })
    }

    // Locale folders win over `<slug>.<locale>.mdx`, so they're added first.
    for (const loc of listLocaleFolders()) {
      if (loc === baseLocale) continue
      for (const [slug, page] of pages) {
        const p = path.join(docsDir, loc, `${slug}.mdx`)
        if (fs.existsSync(p)) page.variants[loc] = p
      }
    }
    for (const { slug, locale, file } of variantFiles) {
      const page = pages.get(slug)
      if (!page) continue
      if (page.variants[locale]) {
        // scan() runs on every lookup: warn once per conflict, not per render.
        if (!warned.has(file)) {
          warned.add(file)
          console.warn(
            `[registry-shell] docs: both ${path.join(locale, `${slug}.mdx`)} and ${path.basename(file)} exist; using the ${locale}/ folder.`,
          )
        }
        continue
      }
      page.variants[locale] = file
    }
    return pages
  }

  function getAllDocs(): DocMeta[] {
    const docs: DocMeta[] = []
    for (const [slug, page] of scan()) {
      const data = readFrontmatter(page.base)
      const title = str(data.title, slug)
      const titles: Record<string, string> = { [page.baseLocale]: title }
      for (const [loc, file] of Object.entries(page.variants)) {
        const locTitle = readFrontmatter(file).title
        if (typeof locTitle === "string" && locTitle) titles[loc] = locTitle
      }
      docs.push({
        slug,
        title,
        description: str(data.description, ""),
        order: num(data.order, 999),
        titles,
      })
    }
    // Stable order: by `order`, then by slug so equal orders don't depend on
    // the filesystem's listing order.
    return docs.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
  }

  function getDocBySlug(slug: string, locale?: string): DocContent | null {
    const page = scan().get(slug)
    if (!page) return null
    const file = (locale && page.variants[locale]) || page.base
    const { data, content } = matter(fs.readFileSync(file, "utf-8"))
    return {
      meta: {
        slug,
        title: str(data.title, slug),
        description: str(data.description, ""),
        order: num(data.order, 999),
      },
      content,
    }
  }

  function getDocAllLocales(slug: string): Record<string, string> {
    const page = scan().get(slug)
    if (!page) return {}
    const out: Record<string, string> = {
      [page.baseLocale]: matter(fs.readFileSync(page.base, "utf-8")).content,
    }
    for (const [loc, file] of Object.entries(page.variants)) {
      out[loc] = matter(fs.readFileSync(file, "utf-8")).content
    }
    return out
  }

  return { getAllDocs, getDocBySlug, getDocAllLocales }
}
