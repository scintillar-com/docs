/**
 * Loads the user's `registry-shell.config.ts` at server boot. Uses `jiti` so
 * the user doesn't need a build step or TS tooling of their own — the shell
 * parses TS on the fly.
 *
 * Called from two places:
 *   • Next.js server startup (src/next-app/registry.config.ts) — runtime.
 *   • The shell CLI's build pipeline (src/cli/generate-search-index.ts) —
 *     pre-build. The CLI runs in plain Node, not inside Next, so we don't
 *     use Next's `server-only` guard here.
 *
 * The returned `ResolvedShellConfig` contains absolute paths and defaults
 * applied.
 */
import path from "node:path"
import fs from "node:fs"
import { createJiti } from "jiti"
import type { ShellConfig, ShellPaths, BrandingConfig } from "./define-config.js"

// `skipBlocks`, `globalCss`, and `buildOutput` are excluded from the
// "must have a default" shape: skipBlocks is always an array (empty
// default); globalCss is purely opt-in; buildOutput is read by the CLI
// directly (with its own `.next` default) and doesn't flow through the
// server-side resolver.
const DEFAULT_PATHS: Required<
  Omit<ShellPaths, "skipBlocks" | "globalCss" | "buildOutput">
> & { skipBlocks: string[] } = {
  components: "components/ui",
  blocks: "registry/new-york/blocks",
  previews: "components/previews/index.ts",
  docs: "content/docs",
  registryJson: "public/r",
  a11y: "public/a11y",
  tests: "public/tests",
  props: "public/props",
  skipBlocks: [],
}

const DEFAULT_BRANDING: BrandingConfig = {
  siteName: "UI Registry",
  shortName: "UI",
  siteUrl: "",
  logoAlt: "UI",
  faviconDark: "/favicon_dark.svg",
  faviconLight: "/favicon_light.svg",
  faviconIco: "/favicon.ico",
}

export interface ResolvedShellConfig {
  /** Absolute path to the user's registry root (dir containing the config). */
  root: string
  /** Absolute path to the config file itself. */
  configPath: string
  branding: Required<BrandingConfig>
  /** All paths resolved to absolute locations. */
  paths: {
    components: string
    blocks: string
    previews: string
    docs: string
    registryJson: string
    a11y: string
    tests: string
    props: string
    skipBlocks: Set<string>
    /** Absolute path to user's extra global CSS, or null when not configured. */
    globalCss: string | null
  }
  /** Absolute path to a custom adapter module, or null. */
  adapter: string | null
  extraTranslations: Record<string, Record<string, string>>
  /**
   * Ordered list of component-sidebar categories (preserves user config order).
   * Each entry holds a label and the set of component names it contains. When
   * empty, the shell renders the flat, un-grouped sidebar.
   */
  categories: Array<{ label: string; names: Set<string> }>
  /** When true, docs live under per-locale subfolders. */
  multilocale: boolean
  /** Locale subfolder containing the canonical doc set. Empty when multilocale is off. */
  defaultLocale: string
  /** Explicit locale list (resolved — may be empty in single-locale mode). */
  locales: string[]
}

/**
 * Read env vars set by the CLI, load the config file, resolve paths. Returns
 * `null` when no config is set (shell-only dev mode) — the Next app falls
 * back to built-in shell docs.
 */
export function loadResolvedConfig(): ResolvedShellConfig | null {
  const configPath = process.env.USER_CONFIG_PATH
  const root = process.env.USER_REGISTRY_ROOT
  if (!configPath || !root) return null

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `[registry-shell] Config file not found: ${configPath}. ` +
        `Check USER_CONFIG_PATH.`,
    )
  }

  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const loaded = jiti(configPath) as unknown
  const config = extractDefault(loaded) as ShellConfig

  if (!config?.branding) {
    throw new Error(
      `[registry-shell] Invalid config at ${configPath}: missing required \`branding\`.`,
    )
  }
  if (config.multilocale && !config.defaultLocale) {
    throw new Error(
      `[registry-shell] Invalid config at ${configPath}: \`multilocale\` is true but \`defaultLocale\` is missing.`,
    )
  }

  const rootAbs = path.resolve(root)
  const cfgPaths = config.paths ?? {}

  return {
    root: rootAbs,
    configPath,
    branding: applyBrandingDefaults(config.branding),
    paths: {
      components: path.resolve(rootAbs, cfgPaths.components ?? DEFAULT_PATHS.components),
      blocks: path.resolve(rootAbs, cfgPaths.blocks ?? DEFAULT_PATHS.blocks),
      previews: path.resolve(rootAbs, cfgPaths.previews ?? DEFAULT_PATHS.previews),
      docs: path.resolve(rootAbs, cfgPaths.docs ?? DEFAULT_PATHS.docs),
      registryJson: path.resolve(rootAbs, cfgPaths.registryJson ?? DEFAULT_PATHS.registryJson),
      a11y: path.resolve(rootAbs, cfgPaths.a11y ?? DEFAULT_PATHS.a11y),
      tests: path.resolve(rootAbs, cfgPaths.tests ?? DEFAULT_PATHS.tests),
      props: path.resolve(rootAbs, cfgPaths.props ?? DEFAULT_PATHS.props),
      skipBlocks: new Set(cfgPaths.skipBlocks ?? []),
      globalCss: cfgPaths.globalCss ? path.resolve(rootAbs, cfgPaths.globalCss) : null,
    },
    adapter: config.adapter ? path.resolve(rootAbs, config.adapter) : null,
    extraTranslations: config.extraTranslations ?? {},
    categories: Object.entries(config.categories ?? {}).map(([label, names]) => ({
      label,
      names: new Set(names),
    })),
    multilocale: Boolean(config.multilocale),
    defaultLocale: config.defaultLocale ?? "",
    locales: resolveLocales(rootAbs, cfgPaths.docs ?? DEFAULT_PATHS.docs, config),
  }
}

/**
 * Resolve the locale list for the locale toggle. In single-locale mode we
 * return an empty array (the toggle hides itself). In multilocale mode we
 * use the explicit `locales` config if present, otherwise auto-scan
 * subfolders under `paths.docs`.
 */
function resolveLocales(rootAbs: string, docsRel: string, config: ShellConfig): string[] {
  if (!config.multilocale) return []
  if (config.locales && config.locales.length > 0) return [...config.locales]

  const docsAbs = path.resolve(rootAbs, docsRel)
  if (!fs.existsSync(docsAbs)) return config.defaultLocale ? [config.defaultLocale] : []
  const found = fs
    .readdirSync(docsAbs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  // Put the default locale first so the toggle cycles predictably.
  if (config.defaultLocale && found.includes(config.defaultLocale)) {
    return [config.defaultLocale, ...found.filter((l) => l !== config.defaultLocale)]
  }
  return found
}

function extractDefault(loaded: unknown): unknown {
  if (loaded && typeof loaded === "object" && "default" in loaded) {
    return (loaded as { default: unknown }).default
  }
  return loaded
}

function applyBrandingDefaults(b: BrandingConfig): Required<BrandingConfig> {
  return {
    siteName: b.siteName,
    shortName: b.shortName,
    siteUrl: b.siteUrl ?? "",
    description: b.description ?? "",
    ogImage: b.ogImage ?? "",
    twitterHandle: b.twitterHandle ?? "",
    github: b.github
      ? {
          owner: b.github.owner,
          repo: b.github.repo,
          label: b.github.label ?? "Github",
          showStars: b.github.showStars ?? true,
        }
      : { owner: "", repo: "", label: "", showStars: false },
    logoAlt: b.logoAlt ?? b.siteName,
    faviconDark: b.faviconDark ?? DEFAULT_BRANDING.faviconDark!,
    faviconLight: b.faviconLight ?? DEFAULT_BRANDING.faviconLight!,
    faviconIco: b.faviconIco ?? DEFAULT_BRANDING.faviconIco!,
  }
}
