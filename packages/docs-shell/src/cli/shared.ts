/**
 * Helpers shared across CLI commands: locating the shell's bundled Next app,
 * finding the user's config file, and injecting the env vars the Next app
 * reads at boot.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { createJiti } from "jiti"
import type { ShellConfig } from "../define-config.js"
import { writeFileFresh } from "./fs-safe.js"

/**
 * Absolute path to the Next.js CLI binary shipped with the shell package.
 * Resolves against the shell's own node_modules so a consumer doesn't need
 * to declare Next as a direct dep — they depend on `@sntlr/registry-shell`
 * and transitively get Next.
 */
const requireFromHere = createRequire(import.meta.url)
export const NEXT_BIN = requireFromHere.resolve("next/dist/bin/next")

// `path` / `fs` already imported above; ensure both stay usable below.

const HERE = path.dirname(fileURLToPath(import.meta.url))

// docs-shell's own name first; registry-shell.config.* keeps working for
// every existing site (and is what `registry-shell init` writes).
export const CONFIG_FILE_CANDIDATES = [
  "docs-shell.config.ts",
  "docs-shell.config.js",
  "docs-shell.config.mjs",
  "registry-shell.config.ts",
  "registry-shell.config.js",
  "registry-shell.config.mjs",
]


/** Walk upward from cwd looking for a config file. Returns null if none. */
export function findConfigFile(cwd: string = process.cwd()): string | null {
  let dir = cwd
  while (true) {
    for (const name of CONFIG_FILE_CANDIDATES) {
      const candidate = path.join(dir, name)
      if (fs.existsSync(candidate)) return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Absolute path to the Next.js app bundled inside the shell package. */
export function nextAppDir(): string {
  // When running from dist (published), this file is at dist/cli/shared.js.
  // When running from source via tsx, it's at src/cli/shared.ts.
  // In both cases, next-app lives at ../next-app relative to the cli dir.
  const distNextApp = path.resolve(HERE, "../next-app")
  if (fs.existsSync(distNextApp)) return distNextApp

  const srcNextApp = path.resolve(HERE, "../../src/next-app")
  if (fs.existsSync(srcNextApp)) return srcNextApp

  throw new Error(
    `[docs-shell] Couldn't locate the bundled Next app. Looked in:\n  ${distNextApp}\n  ${srcNextApp}`,
  )
}

export interface LoadedConfig {
  configPath: string
  root: string
  config: ShellConfig
}

/**
 * Read + parse the user's config file via jiti (zero-build TS). Returns null
 * when no config is found (shell-only mode).
 */
export function loadUserConfig(): LoadedConfig | null {
  const configPath = findConfigFile()
  if (!configPath) return null
  return loadUserConfigFile(configPath)
}

/** Parse a specific config file (used for tag snapshots). */
export function loadUserConfigFile(configPath: string): LoadedConfig {
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  const loaded = jiti(configPath) as unknown
  const config = (
    loaded && typeof loaded === "object" && "default" in loaded
      ? (loaded as { default: ShellConfig }).default
      : (loaded as ShellConfig)
  )

  if (!config?.branding) {
    throw new Error(
      `[docs-shell] Invalid config at ${configPath}: missing required \`branding\`.`,
    )
  }

  return {
    configPath,
    root: path.dirname(configPath),
    config,
  }
}

/**
 * Generate a CSS file containing `@source` directives that tell Tailwind v4
 * to scan the user's component/block/doc files for utility classes. Without
 * this, classes used only in the user's files don't end up in the bundled
 * stylesheet. Rewritten every time the CLI boots so path changes in the
 * user's config take effect immediately.
 */
/**
 * The shell's `.next/` build output is keyed to the active config. When the
 * user switches from a wired registry to shell-only (or swaps registries
 * altogether), the old build has eager references to files that may no
 * longer resolve. Detect that by stamping the current mode and clearing
 * `.next/` when it changes.
 */
export function clearStaleNextCacheIfModeChanged(loaded: LoadedConfig | null): void {
  const nextApp = nextAppDir()
  const nextDir = path.join(nextApp, ".next")
  const stampPath = path.join(nextApp, ".registry-shell-mode")
  // The module set changes which route files Next compiles, so a switch
  // (e.g. a site gains its first component) must also clear the cache.
  const currentMode = `${loaded?.configPath ?? "<shell-only>"} [${resolveModules(loaded).join(",")}]`

  let previousMode = "<never>"
  if (fs.existsSync(stampPath)) {
    try {
      previousMode = fs.readFileSync(stampPath, "utf-8").trim()
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(nextDir) && previousMode !== currentMode) {
    console.log(
      `[docs-shell] Mode changed (${previousMode} → ${currentMode}) — clearing .next cache.`,
    )
    // Windows can hold file locks (antivirus, IDE indexers) for a moment
    // after the previous Next process exits. Retry a few times; if the
    // directory still won't remove, clear its contents in place instead.
    const tryRemove = (attempt = 0): boolean => {
      try {
        fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
        return true
      } catch {
        if (attempt < 5) return tryRemove(attempt + 1)
        return false
      }
    }
    if (!tryRemove()) {
      try {
        for (const entry of fs.readdirSync(nextDir)) {
          fs.rmSync(path.join(nextDir, entry), {
            recursive: true,
            force: true,
            maxRetries: 5,
            retryDelay: 200,
          })
        }
        console.log("[docs-shell] Directory locked — cleared contents instead.")
      } catch (err) {
        console.warn(
          `[docs-shell] Couldn't clear .next cache cleanly (${(err as Error).message}). ` +
            `Continuing; you may see stale-build warnings.`,
        )
      }
    }
  }

  writeFileFresh(stampPath, currentMode + "\n")
}

/** Optional shell modules (see `ShellConfig.modules`). */
export type ShellModule = "registry"

/**
 * Modules this site uses. Each one is either set explicitly in the config or
 * detected from the project: the registry module is on when the site has a
 * custom adapter, component files, or blocks. Shell-only mode (no config)
 * enables nothing. Feeds `SHELL_MODULES`, which gates the module's routes in
 * next.config.ts.
 */
export function resolveModules(loaded: LoadedConfig | null): ShellModule[] {
  if (!loaded) return []
  const { config, root } = loaded
  const modules: ShellModule[] = []

  const explicit = config.modules?.registry
  const registry =
    explicit ??
    (() => {
      if (config.adapter) return true
      const components = path.resolve(root, config.paths?.components ?? "components/ui")
      if (fs.existsSync(components) && fs.readdirSync(components).some((f) => f.endsWith(".tsx"))) {
        return true
      }
      const blocks = path.resolve(root, config.paths?.blocks ?? "registry/new-york/blocks")
      return fs.existsSync(blocks) && fs.readdirSync(blocks).length > 0
    })()
  if (registry) modules.push("registry")

  return modules
}

export function writeUserSourcesCss(loaded: LoadedConfig | null): void {
  const nextApp = nextAppDir()
  const appDir = path.join(nextApp, "app")
  const sourcesTarget = path.join(appDir, "_user-sources.css")
  const globalTarget = path.join(appDir, "_user-global.css")

  // Tailwind 4 resolves `@source` paths relative to the CSS file on disk and
  // handles platform-specific separators. Use relative paths so Windows
  // drive-letter handling doesn't trip the scanner.
  const rel = (abs: string) => {
    const r = path.relative(appDir, abs).replace(/\\/g, "/")
    return r.startsWith(".") ? r : `./${r}`
  }

  // ── _user-sources.css — `@source` directives only ──────────────────
  // Imported near the TOP of globals.css so Tailwind's class scanner
  // picks up utility usage from the listed dirs.
  const sources = ["/* Auto-generated by @sntlr/registry-shell. Do not edit. */"]
  sources.push(`@source "${rel(path.join(nextApp, "app"))}";`)
  sources.push(`@source "${rel(path.join(nextApp, "components"))}";`)
  sources.push(`@source "${rel(path.join(nextApp, "lib"))}";`)
  sources.push(`@source "${rel(path.join(nextApp, "hooks"))}";`)
  sources.push(`@source "${rel(path.join(nextApp, "fallback"))}";`)

  // The registry's own folders only matter when its pages are built.
  if (loaded && resolveModules(loaded).includes("registry")) {
    const paths = loaded.config.paths ?? {}
    const resolve = (r: string | undefined, fallback: string) =>
      path.resolve(loaded.root, r ?? fallback)

    sources.push(`@source "${rel(resolve(paths.components, "components/ui"))}";`)
    sources.push(`@source "${rel(resolve(paths.blocks, "registry/new-york/blocks"))}";`)
    sources.push(
      `@source "${rel(resolve(paths.previews?.replace(/\/index\.[tj]sx?$/, ""), "components/previews"))}";`,
    )
  }
  writeFileFresh(sourcesTarget, sources.join("\n") + "\n")

  // ── _user-global.css — user's extra theme/tokens ──────────────────
  // Imported at the BOTTOM of globals.css so `:root { --primary: ... }`
  // style overrides win the cascade over the shell's defaults. Absent
  // when paths.globalCss is not configured (file is written as a no-op
  // so the `@import` in globals.css never 404s).
  const globalLines = ["/* Auto-generated by @sntlr/registry-shell. Do not edit. */"]
  if (loaded) {
    const userGlobal = loaded.config.paths?.globalCss
    if (userGlobal) {
      const abs = path.resolve(loaded.root, userGlobal)
      if (!fs.existsSync(abs)) {
        console.warn(
          `[docs-shell] paths.globalCss points at ${abs} but the file doesn't exist — skipping.`,
        )
      } else {
        globalLines.push(`@import "${rel(abs)}";`)
      }
    }
  }
  writeFileFresh(globalTarget, globalLines.join("\n") + "\n")
}

/**
 * Build the env-var bag the Next app reads at startup. The CLI spreads this
 * into child `next` processes.
 */
/**
 * Resolve the locale list the client's locale toggle should offer. Uses the
 * explicit `locales` array if provided, otherwise auto-scans subfolders of
 * the registry's docs path. Mirrors the logic in the server config-loader
 * but runs client-side via inlined env vars.
 */
function resolveLocaleList(root: string, config: ShellConfig): string[] {
  // Single-folder sites translate with `<slug>.<locale>.mdx` files; there
  // are no folders to scan, so only an explicit `locales` list counts.
  if (!config.multilocale) return config.locales ? [...config.locales] : []
  if (config.locales && config.locales.length > 0) return [...config.locales]

  const docsAbs = path.resolve(root, config.paths?.docs ?? "content/docs")
  if (!fs.existsSync(docsAbs)) {
    return config.defaultLocale ? [config.defaultLocale] : []
  }
  const found = fs
    .readdirSync(docsAbs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  if (config.defaultLocale && found.includes(config.defaultLocale)) {
    return [config.defaultLocale, ...found.filter((l) => l !== config.defaultLocale)]
  }
  return found
}

/**
 * Extra build-time knobs used by the versioned build. All optional; with
 * none set, `buildEnvVars` returns exactly what it did before versioning.
 */
export interface BuildEnvOptions {
  /**
   * Next.js `basePath` for a frozen snapshot, e.g. `/v/1.0.0`. Forwarded
   * as NEXT_PUBLIC_SHELL_BASE_PATH (read by next.config.ts and by client
   * code that builds raw URLs).
   */
  basePath?: string
  /** Version shown by a frozen snapshot, e.g. `1.0.0`. Empty for latest. */
  version?: string
  /** Turns on the header version switcher and banner. */
  versions?: boolean
  /**
   * Absolute path of an existing changelog to render at `/releases`
   * (versioned builds only). Forwarded as SHELL_CHANGELOG_PATH, plus
   * NEXT_PUBLIC_SHELL_RELEASES for the nav link.
   */
  changelog?: string
}

export function buildEnvVars(
  loaded: LoadedConfig | null,
  options: BuildEnvOptions = {},
): Record<string, string> {
  // Always set SHELL_APP_ROOT so the Next app can resolve its own bundled
  // files (fallbacks, globals.css) independently of process.cwd().
  const base: Record<string, string> = {
    SHELL_APP_ROOT: nextAppDir(),
    // Read by next.config.ts: which modules' routes to compile.
    SHELL_MODULES: resolveModules(loaded).join(","),
  }
  if (options.versions) base.NEXT_PUBLIC_SHELL_VERSIONS = "1"
  if (options.version) base.NEXT_PUBLIC_SHELL_VERSION = options.version
  if (options.basePath) base.NEXT_PUBLIC_SHELL_BASE_PATH = options.basePath
  if (options.changelog) {
    base.SHELL_CHANGELOG_PATH = options.changelog
    base.NEXT_PUBLIC_SHELL_RELEASES = "1"
  }
  if (!loaded) return base

  const { configPath, root, config } = loaded
  const b = config.branding

  const env: Record<string, string> = {
    ...base,
    USER_CONFIG_PATH: configPath,
    USER_REGISTRY_ROOT: root,
    NEXT_PUBLIC_SHELL_SITE_NAME: b.siteName,
    NEXT_PUBLIC_SHELL_SHORT_NAME: b.shortName,
  }

  if (b.siteUrl) env.NEXT_PUBLIC_SHELL_SITE_URL = b.siteUrl
  if (b.description) env.NEXT_PUBLIC_SHELL_DESCRIPTION = b.description
  if (b.ogImage) env.NEXT_PUBLIC_SHELL_OG_IMAGE = b.ogImage
  if (b.twitterHandle) env.NEXT_PUBLIC_SHELL_TWITTER_HANDLE = b.twitterHandle
  if (b.github?.owner) env.NEXT_PUBLIC_SHELL_GITHUB_OWNER = b.github.owner
  if (b.github?.repo) env.NEXT_PUBLIC_SHELL_GITHUB_REPO = b.github.repo
  if (b.github?.label) env.NEXT_PUBLIC_SHELL_GITHUB_LABEL = b.github.label
  if (b.github && b.github.showStars === false) {
    env.NEXT_PUBLIC_SHELL_GITHUB_SHOW_STARS = "false"
  }
  if (b.logoAlt) env.NEXT_PUBLIC_SHELL_LOGO_ALT = b.logoAlt
  if (b.faviconDark) env.NEXT_PUBLIC_SHELL_FAVICON_DARK = b.faviconDark
  if (b.faviconLight) env.NEXT_PUBLIC_SHELL_FAVICON_LIGHT = b.faviconLight
  if (b.faviconIco) env.NEXT_PUBLIC_SHELL_FAVICON_ICO = b.faviconIco

  if (config.installCommandTemplate !== undefined) {
    env.NEXT_PUBLIC_SHELL_INSTALL_CMD = config.installCommandTemplate
  }
  if (config.transpilePackages && config.transpilePackages.length > 0) {
    env.USER_TRANSPILE_PACKAGES = config.transpilePackages.join(",")
  }

  // Theme panel: forwarded as raw JSON; the client normalises it (defaults,
  // unknown controls) in lib/theme-panel.ts. Absent = plain theme toggle.
  if (config.themePanel) {
    env.NEXT_PUBLIC_SHELL_THEME_PANEL = JSON.stringify(config.themePanel)
  }

  // Multilocale signalling for the locale toggle. Resolves the toggle's
  // locale set from explicit config or auto-scan of doc subfolders so the
  // client has a complete list at build time.
  if (config.multilocale && config.defaultLocale) {
    env.NEXT_PUBLIC_SHELL_DEFAULT_LOCALE = config.defaultLocale
    const locales = resolveLocaleList(loaded.root, config)
    env.NEXT_PUBLIC_SHELL_LOCALES = locales.join(",")
  } else if (!config.multilocale) {
    // A single-folder site with `<slug>.<locale>.mdx` translations offers
    // the toggle when it lists more than one locale.
    const locales = resolveLocaleList(loaded.root, config)
    if (locales.length > 1) {
      env.NEXT_PUBLIC_SHELL_DEFAULT_LOCALE = config.defaultLocale || locales[0]
      env.NEXT_PUBLIC_SHELL_LOCALES = locales.join(",")
    }
  }

  return env
}
