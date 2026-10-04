/**
 * Pre-build generator: writes `public/api/search-index.json` into the
 * user's public tree. Replaces the former `/api/search-index` route
 * handler — the shell's static-export mode can't serve dynamic route
 * handlers, so we bake the search index at build time instead.
 *
 * The generator runs in a child `tsx` process so the shell's own build
 * pipeline (which ships as compiled `.js`) can invoke user-registry-side
 * .ts files (docs loaders, adapters) without the user's `node_modules/`
 * needing to be on our resolution path.
 */
import fs from "node:fs"
import path from "node:path"
import { createJiti } from "jiti"
import type { LoadedConfig } from "./shared.js"
import type { ResolvedShellConfig } from "../config-loader.js"

interface SearchItem {
  label: string
  href: string
  group: string
}

/**
 * Writes the search index JSON into `targetPublicDir/api/search-index.json`.
 * `targetPublicDir` is expected to be the shell's bundled `public/` dir
 * (inside node_modules). The build pipeline overlays the user's public/
 * onto this dir so the merged tree is what `next build` sees.
 */
export async function generateSearchIndex(
  loaded: LoadedConfig,
  targetPublicDir: string,
): Promise<void> {
  const { config } = loaded
  void config

  // Load the shell's registry-adapter + config-loader via jiti so we can
  // evaluate the same filesystem-walking logic the server used to do at
  // request time.
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const resolved: ResolvedShellConfig | null = (
    jiti("../config-loader.js") as {
      loadResolvedConfig: () => ResolvedShellConfig | null
    }
  ).loadResolvedConfig()

  if (!resolved) {
    console.warn("[registry-shell] generate-search-index: no resolved config, skipping")
    return
  }

  const { createDefaultAdapter } = jiti("../adapter/default.js") as {
    createDefaultAdapter: (r: ResolvedShellConfig) => {
      getAllComponents: () => { name: string; label: string }[]
      getAllDocs: () => { slug: string; title: string }[]
    }
  }
  const adapter = createDefaultAdapter(resolved)

  const docs: SearchItem[] = adapter.getAllDocs().map((doc) => ({
    label: doc.title,
    href: `/docs/${doc.slug}/`,
    group: "Documentation",
  }))

  const components: SearchItem[] = adapter.getAllComponents().map((comp) => ({
    label: comp.label,
    href: `/components/${comp.name}/`,
    group: "Components",
  }))

  const items = [...docs, ...components]

  const outDir = path.join(targetPublicDir, "api")
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "search-index.json")
  fs.writeFileSync(outPath, JSON.stringify(items), "utf-8")

  console.log(
    `[registry-shell] Wrote search index (${items.length} items) → ${outPath}`,
  )
}
