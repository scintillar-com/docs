/**
 * Default filesystem docs source: reads MDX pages from `paths.docs`, nested
 * as deeply as the content is.
 *
 *     content/docs/[<folder>/…]<name>.mdx  →  /docs/[<folder>/…]<name>
 *
 * Two layouts:
 *   - Single folder (`multilocale: false`): the tree lives in `paths.docs`.
 *   - Locale folders (`multilocale: true`): the default locale's folder
 *     (`content/docs/<locale>/…`) defines the pages; other locale folders
 *     mirror its paths with translations.
 *
 * The first folder level is a page's section (a header tab); deeper levels
 * are folders in the sidebar. A nested folder's `_index.mdx` / `index.mdx`
 * is the folder's own page and answers at the folder's path
 * (`guides/_index.mdx` → `/docs/guides`). At the root of the docs folder an
 * `index.mdx` stays an ordinary page (`/docs/index`), as it always was.
 *
 * In both layouts a translation can also sit next to its page as
 * `<name>.<locale>.mdx` (e.g. `intro.fr.mdx` beside `intro.mdx`). A file is
 * only treated as a translation when its base page exists, so a page whose
 * own name contains a dot (`v1.2-notes.mdx`) keeps its URL. When a locale
 * has both a locale-folder file and a `<name>.<locale>.mdx` file, the locale
 * folder wins.
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
  section?: string
  group?: string
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
const FOLDER_INDEX = new Set(["_index", "index"])

interface PageFiles {
  /** Locale of the base file (the default locale, or "en" in single-folder mode). */
  baseLocale: string
  /** Base file path. */
  base: string
  /** Base file path relative to the page folder, for locale-folder lookups. */
  rel: string
  /** File name without `.mdx`, the title fallback. */
  name: string
  section: string
  group: string
  /** Translation files by locale (locale folders first, then `<name>.<locale>.mdx`). */
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
  // unless a default locale (or a `locales` list, whose first entry the
  // locale toggle then starts on) is configured.
  const baseLocale = resolved.defaultLocale || resolved.locales?.[0] || "en"
  const warned = new Set<string>()
  const warnOnce = (key: string, message: string) => {
    // scan() runs on every lookup: warn once per problem, not per render.
    if (warned.has(key)) return
    warned.add(key)
    console.warn(`[docs-shell] docs: ${message}`)
  }

  function listLocaleFolders(): string[] {
    if (!isMulti || !fs.existsSync(docsDir)) return []
    return fs
      .readdirSync(docsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  }

  /** The folder whose `.mdx` files define the pages. */
  function pageDir(): string {
    return isMulti ? path.join(docsDir, baseLocale) : docsDir
  }

  /** Every page with its files, keyed by slug. */
  function scan(): Map<string, PageFiles> {
    const root = pageDir()
    const pages = new Map<string, PageFiles>()
    if (!fs.existsSync(root)) return pages
    const variantFiles: Array<{ slug: string; locale: string; file: string }> = []

    const walk = (dirParts: string[]) => {
      const dir = path.join(root, ...dirParts)
      const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
      const names = new Set(entries.filter((e) => e.isFile() && e.name.endsWith(".mdx")).map((e) => e.name.slice(0, -4)))

      for (const entry of entries) {
        if (entry.isDirectory()) {
          walk([...dirParts, entry.name])
          continue
        }
        if (!entry.isFile() || !entry.name.endsWith(".mdx")) continue
        const name = entry.name.slice(0, -".mdx".length)
        const isIndex = FOLDER_INDEX.has(name) && dirParts.length > 0
        const slugParts = isIndex ? dirParts : [...dirParts, name]

        const m = VARIANT.exec(entry.name)
        // A translation only when its base page exists and it isn't the base
        // locale itself (intro.en.mdx on an English site is just a page).
        if (m && names.has(m[1]) && m[2] !== baseLocale) {
          const baseName = m[1]
          const baseSlug = FOLDER_INDEX.has(baseName) && dirParts.length > 0 ? dirParts : [...dirParts, baseName]
          variantFiles.push({ slug: baseSlug.join("/"), locale: m[2], file: path.join(dir, entry.name) })
          continue
        }

        const slug = slugParts.join("/")
        if (pages.has(slug)) {
          warnOnce(`dup:${slug}`, `two files answer at /docs/${slug}; using ${path.join(...dirParts, entry.name)}.`)
        }
        pages.set(slug, {
          baseLocale,
          base: path.join(dir, entry.name),
          rel: path.join(...dirParts, entry.name),
          name: isIndex ? (dirParts[dirParts.length - 1] ?? name) : name,
          section: dirParts[0] ?? "",
          group: dirParts.slice(1).join("/"),
          variants: {},
        })
      }
    }
    walk([])

    // Locale folders win over `<name>.<locale>.mdx`, so they're added first.
    for (const loc of listLocaleFolders()) {
      if (loc === baseLocale) continue
      for (const page of pages.values()) {
        const p = path.join(docsDir, loc, page.rel)
        if (fs.existsSync(p)) page.variants[loc] = p
      }
    }
    for (const { slug, locale, file } of variantFiles) {
      const page = pages.get(slug)
      if (!page) continue
      if (page.variants[locale]) {
        warnOnce(file, `both ${path.join(locale, page.rel)} and ${path.basename(file)} exist; using the ${locale}/ folder.`)
        continue
      }
      page.variants[locale] = file
    }
    return pages
  }

  const titleFallback = (page: PageFiles) => page.name

  function getAllDocs(): DocMeta[] {
    const docs: DocMeta[] = []
    for (const [slug, page] of scan()) {
      const data = readFrontmatter(page.base)
      const title = str(data.title, titleFallback(page))
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
        section: page.section,
        group: page.group,
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
        title: str(data.title, titleFallback(page)),
        description: str(data.description, ""),
        order: num(data.order, 999),
        section: page.section,
        group: page.group,
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
