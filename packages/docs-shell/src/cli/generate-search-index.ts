/**
 * Pre-build generator: writes the search index into the shell's public
 * tree, which the header's search dialog fetches. A static export has no
 * server to answer a search route, so the index is baked at build time.
 *
 * Indexed by heading, not by page: each page gets a record for its opening
 * and one per H2–H4 with the prose under it, linking to the heading's
 * anchor (see `pageSearchRecords`), so a search for words in a paragraph
 * lands on that paragraph. Components and blocks get one record each.
 *
 * One file per locale: `api/search-index.json` for the default locale and
 * `api/search-index.<locale>.json` for each other one, with every page in
 * that locale's version (the default-locale text where a page isn't
 * translated, which is what the page itself shows).
 *
 * The config and adapter are loaded through jiti so the same file-walking
 * code the Next app uses runs here, from the compiled CLI.
 */
import fs from "node:fs"
import path from "node:path"
import { createJiti } from "jiti"
import type { LoadedConfig } from "./shared.js"
import type { ResolvedShellConfig } from "../config-loader.js"
import { writeFileAtomicSync } from "./atomic-write.js"
import { pageSearchRecords, type SearchRecord } from "../content/index.js"

interface IndexAdapter {
  getAllComponents: () => { name: string; label: string; kind: "component" | "block" }[]
  getAllDocs: () => { slug: string; section?: string }[]
  getDocBySlug: (
    slug: string,
    locale?: string,
  ) => { meta: { title: string; description: string }; content: string } | null
}

/** Records of every page in `locale`, then every component. */
export function buildSearchRecords(adapter: IndexAdapter, locale?: string): SearchRecord[] {
  const records: SearchRecord[] = []
  for (const { slug, section } of adapter.getAllDocs()) {
    const doc = adapter.getDocBySlug(slug, locale)
    if (!doc) continue
    records.push(
      ...pageSearchRecords({
        content: doc.content,
        title: doc.meta.title,
        description: doc.meta.description,
        href: `/docs/${slug}/`,
        // The header tab the page is under (see useActiveSection).
        group: section ? `docs:${section}` : "docs",
      }),
    )
  }
  for (const comp of adapter.getAllComponents()) {
    records.push({
      label: comp.label,
      page: comp.label,
      href: `/components/${comp.name}/`,
      group: comp.kind === "block" ? "blocks" : "components",
      kind: "component",
      text: "",
    })
  }
  return records
}

/**
 * Writes the index files into `targetPublicDir/api/`. `targetPublicDir` is
 * the shell's bundled `public/` dir; the build overlays the user's
 * `public/` onto it, so the merged tree is what `next build` sees.
 */
export async function generateSearchIndex(
  loaded: LoadedConfig,
  targetPublicDir: string,
): Promise<void> {
  void loaded

  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const resolved: ResolvedShellConfig | null = (
    jiti("../config-loader.js") as {
      loadResolvedConfig: () => ResolvedShellConfig | null
    }
  ).loadResolvedConfig()

  if (!resolved) {
    console.warn("[docs-shell] generate-search-index: no resolved config, skipping")
    return
  }

  const { createDefaultAdapter } = jiti("../adapter/default.js") as {
    createDefaultAdapter: (r: ResolvedShellConfig) => IndexAdapter
  }
  const adapter = createDefaultAdapter(resolved)

  const outDir = path.join(targetPublicDir, "api")
  fs.mkdirSync(outDir, { recursive: true })
  // Drop locale files from an earlier build: a locale removed from the
  // config would otherwise keep a stale index.
  for (const file of fs.readdirSync(outDir)) {
    if (/^search-index\..+\.json$/.test(file)) fs.rmSync(path.join(outDir, file), { force: true })
  }

  const defaultLocale = resolved.defaultLocale || "en"
  const write = (file: string, records: SearchRecord[]) => {
    const outPath = path.join(outDir, file)
    // Atomic: a running dev server may be serving this file while a second
    // `dev` regenerates it. The rename also replaces a pnpm-store hard link
    // instead of writing through it.
    writeFileAtomicSync(outPath, JSON.stringify(records))
    const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
    console.log(`[docs-shell] Wrote search index (${records.length} records, ${kb} KB) → ${outPath}`)
  }

  write("search-index.json", buildSearchRecords(adapter, defaultLocale))
  for (const locale of resolved.locales) {
    if (locale === defaultLocale) continue
    write(`search-index.${locale}.json`, buildSearchRecords(adapter, locale))
  }
}
