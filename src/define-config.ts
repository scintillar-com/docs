/**
 * `defineConfig` — the single entry point registry builders use.
 *
 * ```ts
 * // registry-shell.config.ts
 * import { defineConfig } from "@sntlr/registry-shell"
 *
 * export default defineConfig({
 *   branding: { siteName: "My UI", shortName: "UI", ... },
 *   // paths/homePage/adapter are optional
 * })
 * ```
 */

export interface GithubConfig {
  /** GitHub org or user that owns the repo. */
  owner: string
  /** Repo name. */
  repo: string
  /** Button label in the header. Default: `"Github"`. */
  label?: string
  /**
   * Show the public star count (fetched server-side, revalidated hourly).
   * Default: `true`.
   */
  showStars?: boolean
}

export interface BrandingConfig {
  /** Full product name, e.g. "My UI". Used in HTML title. */
  siteName: string
  /** Short breadcrumb label, e.g. "UI". */
  shortName: string
  /** Canonical URL of the deployed registry, e.g. "https://ui.example.com". */
  siteUrl?: string
  /** SEO meta description. Shown in search results + social cards. */
  description?: string
  /** Path/URL to a 1200×630 Open Graph image. Relative to `siteUrl` if no scheme. */
  ogImage?: string
  /** Twitter handle (without `@`) for Twitter card attribution. */
  twitterHandle?: string
  /**
   * Optional. Adds a GitHub link button to the header. Omit to hide the
   * button entirely (default).
   */
  github?: GithubConfig
  /** Accessible alt text for the logo image. Default: siteName. */
  logoAlt?: string
  /** Public path to the dark-theme SVG favicon. */
  faviconDark?: string
  /** Public path to the light-theme SVG favicon. */
  faviconLight?: string
  /** Public path to a fallback `.ico` favicon. */
  faviconIco?: string
}

/**
 * Filesystem locations the default adapter scans. All paths are relative to
 * the config file's directory. Any path can be omitted to use the default.
 */
export interface ShellPaths {
  /** Component source files. Default: "components/ui". */
  components?: string
  /** Block directories (each block is a folder). Default: "registry/new-york/blocks". */
  blocks?: string
  /** Preview index file. Default: "components/previews/index.ts" (or .tsx). */
  previews?: string
  /** Doc MDX files. Default: "content/docs". */
  docs?: string
  /** Built registry JSON files (served at /r/[name].json). Default: "public/r". */
  registryJson?: string
  /** A11y JSON files (served at /a11y/[name].json). Default: "public/a11y". */
  a11y?: string
  /** Test JSON files (served at /tests/[name].json). Default: "public/tests". */
  tests?: string
  /** Props JSON files (served at /props/[name].json). Default: "public/props". */
  props?: string
  /** Block names to omit from navigation (e.g. example blocks). */
  skipBlocks?: string[]
  /**
   * Optional. Path to a `.css` file the shell imports AFTER its own
   * globals. Use this for brand fonts (`@font-face`), token overrides
   * (redefine `--primary` etc. on `:root` / `.dark`), extra `@source`
   * directives, or any custom utilities.
   *
   * Imported at the very end of the shell's `globals.css` so your `:root`
   * declarations win the cascade against the shell's defaults.
   *
   * Example: `globalCss: "./styles/theme.css"`.
   */
  globalCss?: string
  /**
   * Optional. Directory (relative to the config file) where
   * `registry-shell build` writes Next's build output, and where
   * `registry-shell start` reads it back from. Default: `.next`.
   *
   * Override only if `.next` collides with something else in your
   * project. Most Next.js hosts (Vercel, Netlify, self-hosted)
   * auto-detect `.next` — if you change this, update your host's
   * "Output Directory" setting to match.
   */
  buildOutput?: string
}

/**
 * Opt-in versioned build. When set, `registry-shell build` keeps producing
 * the latest site at `/` and additionally publishes one frozen snapshot per
 * matching git tag: the site under `/v/<version>/` and the registry JSON
 * under `/r/v<version>/`. A `/versions.json` manifest drives the header's
 * version switcher and the "old version" banner.
 *
 * Every snapshot is built from the tag's own content (components, docs,
 * registry.json, previews) with the shell running the build, and cached
 * per tag commit so a deploy only rebuilds latest plus new tags.
 */
export interface VersionsConfig {
  /**
   * Git tag glob (as understood by `git tag --list`) selecting the tags to
   * publish. The version is the trailing semver of the tag name, so both
   * `v1.2.0` and `my-ui@1.2.0` work. Default: `"v*"`.
   */
  tags?: string
  /**
   * Where built snapshots are cached, relative to the config file.
   * Default: `"node_modules/.cache/registry-shell/versions"`, which most
   * CI/CD build caches (Vercel, Netlify) already persist.
   */
  cacheDir?: string
  /**
   * Command that builds the registry JSON inside a tag's checkout, run from
   * the registry root after dependencies are installed.
   * Default: `"npx shadcn build"`. Set to `""` to skip (e.g. when the built
   * `public/r` is committed).
   */
  registryBuildCommand?: string
  /**
   * Command that installs a tag's dependencies, run where its lockfile
   * lives. Default: picked from the lockfile (`pnpm install
   * --frozen-lockfile`, `npm ci`, `yarn install`, `bun install`). Set to
   * `""` to skip.
   */
  installCommand?: string
}

/**
 * Advanced: point at a custom adapter module. The module must default-export
 * a factory `(resolved: ResolvedShellConfig) => RegistryAdapter`. When unset,
 * the shell uses its built-in convention-based adapter.
 */
export type CustomAdapterSpec = string

export interface ShellConfig {
  /**
   * Required. Displayed in shell chrome.
   */
  branding: BrandingConfig

  /**
   * When `true`, docs are organized under per-locale subfolders
   * (e.g. `content/docs/en/foo.mdx`, `content/docs/fr/foo.mdx`) and each
   * subfolder name is treated as a locale code. Requires `defaultLocale`.
   *
   * When `false` (default), docs live directly under `paths.docs` and
   * locale variants use the file-extension convention `{slug}.{locale}.mdx`
   * alongside the canonical `{slug}.mdx`.
   */
  multilocale?: boolean

  /**
   * Required when `multilocale` is `true`. Locale code (e.g. `"en"`) of the
   * subfolder containing the canonical doc set. Other locales are optional
   * translations and fall back to this one when a slug is missing.
   */
  defaultLocale?: string

  /**
   * Optional in multilocale mode. Explicit list of locale codes the shell
   * should offer in its locale toggle (e.g. `["en", "fr", "ja"]`). When
   * unset, the shell auto-discovers locales by scanning subfolders under
   * `paths.docs`.
   *
   * Ignored in single-locale mode (the toggle is hidden).
   */
  locales?: string[]

  /**
   * Optional. Override filesystem layout. Defaults match the shadcn
   * registry convention used by `@sntlr/registry`.
   */
  paths?: ShellPaths

  /**
   * Optional. Locale → key → value dictionaries merged into the shell's
   * built-in i18n table. Use for marketing copy referenced by a custom
   * homepage.
   */
  extraTranslations?: Record<string, Record<string, string>>

  /**
   * Optional. Path to a custom adapter module. See `CustomAdapterSpec`.
   */
  adapter?: CustomAdapterSpec

  /**
   * Optional. Pin the dev/start server to a specific port. Falls through to
   * Next.js's default (3000, auto-incrementing if in use) when unset.
   */
  port?: number

  /**
   * Optional. Extra npm package names the shell's Next.js build should
   * transpile. Use this when your registry depends on another workspace
   * package (e.g. a shared components library) whose TSX files should be
   * compiled the same way as your own.
   *
   * Forwarded to Next's `transpilePackages`. The shell itself
   * (`@sntlr/registry-shell`) is always transpiled regardless.
   */
  transpilePackages?: string[]

  /**
   * Optional. Group components under collapsible sub-sections in the sidebar.
   * Keys are category labels (rendered verbatim as headings); values are
   * arrays of component names matching entries in `components/ui`. Components
   * not listed in any category render as a flat list below the categorized
   * groups (backward-compatible with the existing flat behavior).
   *
   * Example:
   * ```ts
   * categories: {
   *   "Web3": ["wallet", "connect-wallet", "token-amount"],
   * }
   * ```
   *
   * Blocks are always flat; categories only apply to the Components section.
   * A component listed in multiple categories appears in each (rare, but
   * supported for cross-cutting primitives).
   */
  categories?: Record<string, string[]>

  /**
   * Optional. Template the shell uses to render the install command in the
   * component "Install" tab. Supported placeholders:
   *   - `{name}`    — the component/block slug (e.g. `"button"`)
   *   - `{siteUrl}` — `branding.siteUrl` (trailing slash stripped)
   *
   * Default: `"npx shadcn@latest add {siteUrl}/r/{name}.json"`. Set to an
   * empty string to hide the install line entirely.
   */
  installCommandTemplate?: string

  /**
   * Optional. Publish a frozen, browsable snapshot of every released
   * version (see `VersionsConfig`). Off by default: when absent, the build
   * output is exactly the single latest site.
   */
  versions?: VersionsConfig
}

/**
 * Identity function with type inference — users call this purely for editor
 * support. No runtime validation here; the shell validates at boot time.
 */
export function defineConfig(config: ShellConfig): ShellConfig {
  return config
}
