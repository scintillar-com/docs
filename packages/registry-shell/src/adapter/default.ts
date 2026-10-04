/**
 * Default convention-based RegistryAdapter implementation.
 *
 * Builds a RegistryAdapter from a `ResolvedShellConfig`: scans the filesystem
 * paths declared in the user's config, parses MDX frontmatter, and reads
 * registry JSON. The `previewLoader` is wired separately via a Next.js alias
 * (see next-app/next.config.ts) because Next's `dynamic()` needs string
 * literal imports.
 */
import fs from "node:fs"
import path from "node:path"
import matter from "gray-matter"
import type { ResolvedShellConfig } from "../config-loader.js"

// The RegistryAdapter interface lives inside the Next app (next-app/lib).
// This file is compiled to dist/ separately and consumed at Next runtime,
// so we re-declare the types it needs here.

export interface ComponentMeta {
  name: string
  label: string
  kind: "component" | "block"
  categories?: string[]
}

export interface CategoryMeta {
  label: string
}

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

function titleCase(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function createDefaultAdapter(resolved: ResolvedShellConfig) {
  const { paths } = resolved
  const isMulti = resolved.multilocale
  const defaultLocale = resolved.defaultLocale

  /** In multilocale mode, return all locale subfolder names. */
  function listLocales(): string[] {
    if (!isMulti || !fs.existsSync(paths.docs)) return []
    return fs
      .readdirSync(paths.docs, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  }

  /** Path to the directory holding `.mdx` files for a given locale (multi mode). */
  function localeDir(locale: string): string {
    return path.join(paths.docs, locale)
  }

  function getAllComponents(): ComponentMeta[] {
    const items: ComponentMeta[] = []

    if (fs.existsSync(paths.components)) {
      for (const filename of fs.readdirSync(paths.components).filter((f) => f.endsWith(".tsx"))) {
        const name = filename.replace(/\.tsx$/, "")
        const categories = resolved.categories
          .filter((c) => c.names.has(name))
          .map((c) => c.label)
        items.push({
          name,
          label: titleCase(name),
          kind: "component",
          ...(categories.length > 0 ? { categories } : {}),
        })
      }
    }

    if (fs.existsSync(paths.blocks)) {
      for (const dir of fs.readdirSync(paths.blocks, { withFileTypes: true })) {
        if (!dir.isDirectory() || paths.skipBlocks.has(dir.name)) continue
        items.push({ name: dir.name, label: titleCase(dir.name), kind: "block" })
      }
    }

    return items.sort((a, b) => a.label.localeCompare(b.label))
  }

  function getCategories(): CategoryMeta[] {
    return resolved.categories.map((c) => ({ label: c.label }))
  }

  function getAllDocs(): DocMeta[] {
    if (!fs.existsSync(paths.docs)) return []

    if (isMulti) {
      const dir = localeDir(defaultLocale)
      if (!fs.existsSync(dir)) return []
      const otherLocales = listLocales().filter((l) => l !== defaultLocale)

      return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".mdx"))
        .map((filename) => {
          const slug = filename.replace(/\.mdx$/, "")
          const { data } = matter(fs.readFileSync(path.join(dir, filename), "utf-8"))
          const titles: Record<string, string> = { [defaultLocale]: data.title ?? slug }

          for (const loc of otherLocales) {
            const p = path.join(localeDir(loc), filename)
            if (!fs.existsSync(p)) continue
            const { data: locData } = matter(fs.readFileSync(p, "utf-8"))
            if (locData.title) titles[loc] = locData.title
          }

          return {
            slug,
            title: data.title ?? slug,
            description: data.description ?? "",
            order: data.order ?? 999,
            titles,
          }
        })
        .sort((a, b) => a.order - b.order)
    }

    // Single-folder mode: one locale, no variant scanning.
    return fs
      .readdirSync(paths.docs)
      .filter((f) => f.endsWith(".mdx"))
      .map((filename) => {
        const slug = filename.replace(/\.mdx$/, "")
        const { data } = matter(fs.readFileSync(path.join(paths.docs, filename), "utf-8"))
        return {
          slug,
          title: data.title ?? slug,
          description: data.description ?? "",
          order: data.order ?? 999,
          titles: { en: data.title ?? slug },
        }
      })
      .sort((a, b) => a.order - b.order)
  }

  function getDocBySlug(slug: string, locale?: string): DocContent | null {
    if (isMulti) {
      const want = locale && locale !== defaultLocale ? locale : defaultLocale
      const candidates = [
        path.join(localeDir(want), `${slug}.mdx`),
        path.join(localeDir(defaultLocale), `${slug}.mdx`),
      ]
      return readDocFile(slug, candidates)
    }

    // Single-folder mode: `locale` is ignored, only `{slug}.mdx` matters.
    return readDocFile(slug, [path.join(paths.docs, `${slug}.mdx`)])
  }

  function getDocAllLocales(slug: string): Record<string, string> {
    if (!fs.existsSync(paths.docs)) return {}

    if (isMulti) {
      const out: Record<string, string> = {}
      for (const loc of listLocales()) {
        const p = path.join(localeDir(loc), `${slug}.mdx`)
        if (fs.existsSync(p)) {
          out[loc] = matter(fs.readFileSync(p, "utf-8")).content
        }
      }
      return out
    }

    // Single-folder mode: exactly one file, keyed under `en` so the client
    // renderer's fallback chain works without needing a special case.
    const p = path.join(paths.docs, `${slug}.mdx`)
    if (!fs.existsSync(p)) return {}
    return { en: matter(fs.readFileSync(p, "utf-8")).content }
  }

  function getComponentSource(name: string): string | null {
    const candidates = [
      path.join(paths.components, `${name}.tsx`),
      path.join(paths.blocks, name, `${name}.tsx`),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8")
    }
    return null
  }

  async function getRegistryItem(name: string): Promise<unknown | null> {
    return readJson(paths.registryJson, name)
  }

  async function getA11yData(name: string): Promise<unknown | null> {
    return readJson(paths.a11y, name)
  }

  async function getTestData(name: string): Promise<unknown | null> {
    return readJson(paths.tests, name)
  }

  async function getPropsData(name: string): Promise<unknown | null> {
    return readJson(paths.props, name)
  }

  return {
    getAllComponents,
    getCategories,
    getAllDocs,
    getDocBySlug,
    getDocAllLocales,
    getComponentSource,
    getRegistryItem,
    getA11yData,
    getTestData,
    getPropsData,
    branding: resolved.branding,
    extraTranslations: resolved.extraTranslations,
  }
}

async function readJson(dir: string, name: string): Promise<unknown | null> {
  const base = name.replace(/\.json$/, "")
  const filePath = path.join(dir, `${base}.json`)
  try {
    const data = await fs.promises.readFile(filePath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

/** Try each candidate path; return the first that parses to a DocContent. */
function readDocFile(slug: string, candidates: string[]): DocContent | null {
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    const { data, content } = matter(fs.readFileSync(p, "utf-8"))
    return {
      meta: {
        slug,
        title: data.title ?? slug,
        description: data.description ?? "",
        order: data.order ?? 999,
      },
      content,
    }
  }
  return null
}
