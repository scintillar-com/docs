/**
 * Server-side registry adapter. Not user-editable anymore — the shell reads
 * the user's `registry-shell.config.ts` via env vars set by the CLI and
 * instantiates the default convention-based adapter (or a user-supplied
 * custom one).
 *
 * Loaded once at Next.js module init.
 */
import "server-only"
import type { RegistryAdapter } from "@shell/lib/registry-adapter"
import { loadResolvedConfig } from "../config-loader"
import { createDefaultAdapter } from "../adapter/default"
import { loadCustomAdapterOverrides } from "../adapter/custom"

function buildAdapter(): RegistryAdapter | null {
  const resolved = loadResolvedConfig()
  if (!resolved) return null

  const base = createDefaultAdapter(resolved)
  // Shallow-merged on top of `base` so a custom adapter can override one
  // method (e.g. getAllComponents from a DB) and keep the defaults for the
  // rest. Loaded via jiti — the adapter file can be plain TS.
  const overrides = loadCustomAdapterOverrides(resolved) as Partial<RegistryAdapter>

  return {
    getAllComponents: overrides.getAllComponents ?? base.getAllComponents,
    getCategories: overrides.getCategories ?? base.getCategories,
    getAllDocs: overrides.getAllDocs ?? base.getAllDocs,
    getDocBySlug: overrides.getDocBySlug ?? base.getDocBySlug,
    getDocAllLocales: overrides.getDocAllLocales ?? base.getDocAllLocales,
    getComponentSource: overrides.getComponentSource ?? base.getComponentSource,
    getRegistryItem: overrides.getRegistryItem ?? base.getRegistryItem,
    getA11yData: overrides.getA11yData ?? base.getA11yData,
    getTestData: overrides.getTestData ?? base.getTestData,
    getPropsData: overrides.getPropsData ?? base.getPropsData,
    previewLoader: UNUSED_SERVER_SIDE_PREVIEW_LOADER,
    branding: base.branding,
    extraTranslations: overrides.extraTranslations ?? base.extraTranslations,
  }
}

// The adapter's `previewLoader` field is never read on the server — previews
// are imported directly from the `@user/previews` alias in client code (see
// lib/preview-loader.ts). This placeholder satisfies the interface.
const UNUSED_SERVER_SIDE_PREVIEW_LOADER: RegistryAdapter["previewLoader"] = {
  Preview: () => null,
  load: () => null,
  names: () => [],
}

export const registry: RegistryAdapter | null = buildAdapter()
