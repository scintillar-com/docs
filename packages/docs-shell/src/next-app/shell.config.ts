/**
 * Server-side data sources, built once at Next.js module init from the
 * user's config (located by the CLI through env vars):
 *
 *   - `docs`: documentation pages (always present; empty without a config).
 *   - `registry`: the component registry (`null` in shell-only mode). It
 *     still carries the docs methods, wired to the same `docs` source, so
 *     code written against `RegistryAdapter` keeps working.
 *
 * A custom adapter module (`adapter` in the config) is loaded once and
 * shallow-merged over both: it can override one method (e.g.
 * getAllComponents from a DB) and keep the defaults for the rest.
 */
import "server-only"
import type { RegistryAdapter } from "@shell/lib/registry-adapter"
import { EMPTY_DOCS_SOURCE, type DocsSource } from "@shell/lib/docs-source"
import { loadResolvedConfig } from "../config-loader"
import { createDefaultAdapter } from "../adapter/default"
import { createFsDocsSource } from "../adapter/fs-docs-source"
import { loadCustomAdapterOverrides } from "../adapter/custom"

const resolved = loadResolvedConfig()
// Loaded via jiti, so the adapter file can be plain TS.
const overrides = (resolved ? loadCustomAdapterOverrides(resolved) : {}) as Partial<RegistryAdapter>

function buildDocs(): DocsSource {
  if (!resolved) return EMPTY_DOCS_SOURCE
  const fsSource = createFsDocsSource(resolved)
  return {
    getAllDocs: overrides.getAllDocs ?? fsSource.getAllDocs,
    getDocBySlug: overrides.getDocBySlug ?? fsSource.getDocBySlug,
    getDocAllLocales: overrides.getDocAllLocales ?? fsSource.getDocAllLocales,
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

function buildRegistry(docs: DocsSource): RegistryAdapter | null {
  if (!resolved) return null
  const base = createDefaultAdapter(resolved)
  return {
    getAllComponents: overrides.getAllComponents ?? base.getAllComponents,
    getCategories: overrides.getCategories ?? base.getCategories,
    getAllDocs: docs.getAllDocs,
    getDocBySlug: docs.getDocBySlug,
    getDocAllLocales: docs.getDocAllLocales,
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

export const docs: DocsSource = buildDocs()
export const registry: RegistryAdapter | null = buildRegistry(docs)
