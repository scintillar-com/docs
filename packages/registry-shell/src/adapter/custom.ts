/**
 * Custom adapter loader.
 *
 * When a user's `registry-shell.config.ts` sets `adapter: "./my-adapter"`, the
 * shell calls `loadCustomAdapterOverrides(resolved)` to resolve that module
 * and extract method overrides. The overrides are then shallow-merged on top
 * of the default convention-based adapter's methods.
 *
 * The user's module should default-export one of:
 *   • A factory `(resolved) => Partial<AdapterMethods>` — preferred. Gets the
 *     resolved config so it can build paths against `resolved.paths`, decide
 *     based on `resolved.root`, etc.
 *   • A plain `Partial<AdapterMethods>` object — also accepted for simple
 *     static overrides that don't need the resolved config.
 *
 * Only the methods a user supplies are taken; any method they omit falls
 * through to the built-in default. That means you can override just
 * `getAllComponents` to serve from a database and keep convention-based
 * doc/registry-item loading for the rest.
 *
 * Loaded via jiti so the user can write the adapter in TypeScript without
 * their own build step — same approach we use for the config file itself.
 */
import "server-only"
import { createJiti } from "jiti"
import type { ResolvedShellConfig } from "../config-loader.js"

/**
 * Shape of what a custom adapter module may override. Mirrors the public
 * methods on RegistryAdapter (defined inside next-app/lib) minus the fields
 * that are wired via other mechanisms (previewLoader via `@user/previews`
 * alias, branding from config).
 *
 * Typed with `unknown` args on the server side — the Next app re-applies
 * its stricter RegistryAdapter types when consuming this.
 */
export interface AdapterOverrides {
  getAllComponents?: () => unknown[]
  getCategories?: () => unknown[]
  getAllDocs?: () => unknown[]
  getDocBySlug?: (slug: string, locale?: string) => unknown | null
  getDocAllLocales?: (slug: string) => Record<string, string>
  getComponentSource?: (name: string) => string | null
  getRegistryItem?: (name: string) => Promise<unknown | null>
  getA11yData?: (name: string) => Promise<unknown | null>
  getTestData?: (name: string) => Promise<unknown | null>
  getPropsData?: (name: string) => Promise<unknown | null>
  extraTranslations?: Record<string, Record<string, string>>
}

type AdapterFactory = (resolved: ResolvedShellConfig) => AdapterOverrides

export function loadCustomAdapterOverrides(
  resolved: ResolvedShellConfig,
): AdapterOverrides {
  if (!resolved.adapter) return {}

  const jiti = createJiti(import.meta.url, { interopDefault: true })
  let loaded: unknown
  try {
    loaded = jiti(resolved.adapter)
  } catch (err) {
    throw new Error(
      `[registry-shell] Failed to load custom adapter at ${resolved.adapter}: ` +
        (err instanceof Error ? err.message : String(err)),
    )
  }

  const extracted =
    loaded && typeof loaded === "object" && "default" in loaded
      ? (loaded as { default: unknown }).default
      : loaded

  if (typeof extracted === "function") {
    const overrides = (extracted as AdapterFactory)(resolved)
    if (!overrides || typeof overrides !== "object") {
      throw new Error(
        `[registry-shell] Custom adapter factory at ${resolved.adapter} did not return an object.`,
      )
    }
    return overrides
  }

  if (extracted && typeof extracted === "object") {
    return extracted as AdapterOverrides
  }

  throw new Error(
    `[registry-shell] Custom adapter at ${resolved.adapter} must default-export a factory function or an object.`,
  )
}
