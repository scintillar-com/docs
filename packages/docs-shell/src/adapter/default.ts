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
import type { ResolvedShellConfig } from "../config-loader.js"
// Extensionless: Next compiles this source file directly (no .js -> .ts
// mapping), and the CLI loads the compiled copy through jiti.
import { createFsDocsSource } from "./fs-docs-source"

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

// Docs types and logic live in fs-docs-source.ts (shared with the docs-only
// path); re-exported so existing imports from this module keep working.
export type { DocMeta, DocContent } from "./fs-docs-source.js"

function titleCase(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function createDefaultAdapter(resolved: ResolvedShellConfig) {
  const { paths } = resolved
  const docs = createFsDocsSource(resolved)

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
    getAllDocs: docs.getAllDocs,
    getDocBySlug: docs.getDocBySlug,
    getDocAllLocales: docs.getDocAllLocales,
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
