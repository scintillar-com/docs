/**
 * Versioned `registry-shell build` (opt-in via `versions` in the config).
 *
 * Output layout (all under `<registry>/out/`):
 *
 *   /                      latest site, built from the working tree (as today)
 *   /r/<name>.json         latest registry JSON (unchanged shadcn contract)
 *   /v/<version>/          frozen site of each release tag (Next basePath)
 *   /r/v<version>/         frozen registry JSON of each release tag
 *   /versions.json         manifest read at runtime by the switcher + banner
 *   /changes/<name>.json   per-item history for the "Changes" tab (see
 *                          version-changes.ts), also read at runtime
 *   /releases/             (per site) the changelog, when `versions.changelog`
 *                          exists in that version's content
 *
 * A snapshot is built from the TAG's content (components, docs,
 * registry.json, previews, its own registry-shell config) with the CURRENT
 * shell, so tags that predate versioning still get the switcher, banner and
 * base-path-aware URLs. Per tag:
 *
 *   1. `git worktree add --detach <tmp> <commit>` materialises the tag
 *      outside the project (no node_modules above it, nothing mutated in
 *      the user's checkout besides git's worktree bookkeeping, removed
 *      after with `git worktree remove`).
 *   2. Install the tag's dependencies (lockfile-detected, or
 *      `versions.installCommand`).
 *   3. Build its registry JSON (`versions.registryBuildCommand`, default
 *      `npx shadcn build`).
 *   4. Run the shell's static export against that root with
 *      `basePath: /v/<version>`.
 *
 * The result (site + registry JSON) is cached in `versions.cacheDir` under
 * `<version>-<commit>`: a tag never moves, so later deploys only rebuild
 * latest plus new tags. Entries also record the shell version that built
 * them; upgrading the shell rebuilds every snapshot once, so frozen
 * versions pick up shell fixes and features (their CONTENT stays frozen).
 *
 * With `versions.source`, the tags are another repository's and each
 * snapshot is the committed SITE (config, theme, sync script; installed
 * node_modules linked in) with that tag's pages copied in by the site's
 * `sync` command (see `ensureSourceSnapshot` and version-source.ts). Its
 * cache key adds a hash of the site's files, minus what the sync writes.
 *
 * Because snapshots are cached, nothing about the version list is baked
 * into a build: the switcher and banner fetch `/versions.json` at runtime,
 * so an old cached snapshot still knows about releases made after it.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync, spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { CONFIG_FILE_CANDIDATES, loadUserConfigFile, resolveModules, type LoadedConfig } from "./shared.js"
import type { BuildSite } from "./build.js"
import { writeChangeIndexes, type RegistrySource } from "./version-changes.js"
import type { VersionsSourceConfig } from "../define-config.js"
import {
  expandSyncCommand,
  linkNodeModules,
  prepareSource,
  readFileAtCommit,
  resolveRef,
  siteInputsHash,
  unlinkNodeModules,
  type PreparedSource,
} from "./version-source.js"
import {
  DEFAULT_TAG_GLOB,
  VERSIONS_MANIFEST_FILE,
  buildManifest,
  filterMinVersion,
  listVersionTags,
  versionBasePath,
  type VersionTag,
  type VersionsManifest,
} from "./versions.js"

export const DEFAULT_CACHE_DIR = "node_modules/.cache/registry-shell/versions"
export const DEFAULT_REGISTRY_BUILD_COMMAND = "npx shadcn build"
export const DEFAULT_CHANGELOG = "CHANGELOG.md"
const CACHE_META_FILE = "snapshot.json"

export interface VersionedBuildOptions {
  loaded: LoadedConfig
  /** Extra args forwarded to every `next build`. */
  args: string[]
  /** Builds one static site; injectable so tests can skip `next build`. */
  buildSite: BuildSite
  /** Shell version recorded in (and required of) cache entries. */
  shellVersion?: string
  /** Parent dir for temporary tag checkouts. Default: `os.tmpdir()`. */
  tmpRoot?: string
}

interface CacheMeta {
  version: string
  tag: string
  commit: string
  shellVersion: string
  builtAt: string
  /** False when the tag had no registry JSON to copy. */
  hasRegistry: boolean
  /** With `versions.source`: hash of the committed site files that built it. */
  siteHash?: string
}

const log = (msg: string) => console.log(`[docs-shell] ${msg}`)

export async function runVersionedBuild(
  options: VersionedBuildOptions,
): Promise<VersionsManifest> {
  const { loaded, args, buildSite } = options
  const versionsConfig = loaded.config.versions ?? {}
  const outDir = path.resolve(loaded.root, "out")
  const cacheDir = path.resolve(loaded.root, versionsConfig.cacheDir ?? DEFAULT_CACHE_DIR)
  const glob = versionsConfig.tags ?? DEFAULT_TAG_GLOB
  const shellVersion = options.shellVersion ?? readShellVersion()

  // Discover tags before the (slow) latest build so git problems fail fast.
  const repoRoot = gitTopLevel(loaded.root)
  const registryRoot = fs.realpathSync(loaded.root)
  const sourceConfig = versionsConfig.source
  const source = sourceConfig ? prepareSourceFor(loaded, sourceConfig, cacheDir) : null
  const listing = listVersionTags(source?.gitDir ?? loaded.root, glob)
  const tags = filterMinVersion(listing.tags, versionsConfig.minVersion)
  const { skipped } = listing
  if (skipped.length > 0) {
    log(`versions: ignoring tags without a usable semver: ${skipped.join(", ")}`)
  }
  if (source && sourceConfig) {
    log(`versions: taking versions from ${sourceConfig.repo}`)
    const dirty = git(repoRoot, ["status", "--porcelain", "--", path.relative(repoRoot, registryRoot) || "."]).trim()
    if (dirty) {
      log("versions: snapshots are built from the committed site; its uncommitted changes aren't in them.")
    }
  }
  if (tags.length === 0) {
    const shallow =
      !source && git(repoRoot, ["rev-parse", "--is-shallow-repository"]).trim() === "true"
    log(
      `versions: no tag matches "${glob}"` +
        (shallow
          ? " — this is a shallow clone, fetch tags first (e.g. `git fetch --tags --unshallow`)."
          : "; only the latest site will be published."),
    )
  } else {
    log(`versions: ${tags.map((t) => t.tag).join(", ")}`)
  }

  // 1. Latest, at the site root. With a source, its changelog is the
  // source's, as it is on `source.ref`.
  const rootChangelog =
    source && sourceConfig
      ? sourceChangelogOption(
          source,
          resolveRef(source, sourceConfig.ref ?? "HEAD"),
          versionsConfig.changelog,
          path.join(cacheDir, "current-changelog.md"),
        )
      : changelogOption(loaded.root, versionsConfig.changelog)
  await buildSite(loaded, { args, outDir, versions: true, ...rootChangelog })

  // 2. One frozen snapshot per tag (cache hit or fresh build).
  const published: VersionTag[] = []
  const registryDirs = new Map<string, string>()
  const siteHash =
    source && sourceConfig
      ? siteInputsHash(
          repoRoot,
          path.relative(repoRoot, registryRoot),
          // What the sync writes, plus build output and this cache, in case
          // they're committed.
          [
            ...(sourceConfig.syncOutputs ?? [loaded.config.paths?.docs ?? "content/docs"]),
            "out",
            cacheDir,
          ].map((p) => path.relative(registryRoot, path.resolve(registryRoot, p))),
        )
      : ""
  for (const tag of tags) {
    const common = {
      tag,
      loaded,
      registryRoot,
      repoRoot,
      cacheDir,
      shellVersion,
      args,
      buildSite,
      tmpRoot: options.tmpRoot ?? os.tmpdir(),
    }
    const entryDir =
      source && sourceConfig
        ? await ensureSourceSnapshot({ ...common, source, sourceConfig, siteHash })
        : await ensureSnapshot(common)
    if (!entryDir) continue
    fs.cpSync(path.join(entryDir, "site"), path.join(outDir, "v", tag.version), {
      recursive: true,
    })
    const registrySrc = path.join(entryDir, "registry")
    if (fs.existsSync(registrySrc)) {
      fs.cpSync(registrySrc, path.join(outDir, "r", `v${tag.version}`), { recursive: true })
      registryDirs.set(tag.version, registrySrc)
    }
    published.push(tag)
  }

  // 3. Manifest.
  const manifest = buildManifest(published, {
    currentLabel: versionsConfig.current?.label,
    sourceRepo: sourceConfig?.repo,
  })
  fs.writeFileSync(
    path.join(outDir, VERSIONS_MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  )
  log(
    `versions: published ${published.length} snapshot(s)` +
      (manifest.latest ? `, latest release ${manifest.latest}` : "") +
      ` → ${path.join(outDir, VERSIONS_MANIFEST_FILE)}`,
  )

  // 4. Per-item change history, oldest release first, the latest site last.
  // Only for registries: it feeds the component pages' Changes tab.
  // Versions from a source repository are docs, with no registry JSON.
  if (source || !resolveModules(loaded).includes("registry")) return manifest
  const sources: RegistrySource[] = [...published]
    .reverse()
    .filter((t) => registryDirs.has(t.version))
    .map((t) => ({ version: t.version, dir: registryDirs.get(t.version)! }))
  sources.push({
    version: "",
    dir: path.resolve(loaded.root, loaded.config.paths?.registryJson ?? "public/r"),
  })
  const items = writeChangeIndexes(outDir, sources)
  log(`versions: change history for ${items} registry item(s) → ${path.join(outDir, "changes")}`)
  return manifest
}

/**
 * `{ changelog }` build option for a site rooted at `root`: the configured
 * (or default) changelog path, when that file exists there. Empty object
 * otherwise, so the Releases page is left out.
 */
export function changelogOption(
  root: string,
  configured: string | undefined,
): { changelog?: string } {
  const rel = configured ?? DEFAULT_CHANGELOG
  if (!rel) return {}
  const abs = path.resolve(root, rel)
  return fs.existsSync(abs) && fs.statSync(abs).isFile() ? { changelog: abs } : {}
}

/** Validate `versions.source` and make its repository available. */
function prepareSourceFor(
  loaded: LoadedConfig,
  config: VersionsSourceConfig,
  cacheDir: string,
): PreparedSource {
  if (!config.repo || !config.sync) {
    throw new Error("[docs-shell] versions.source needs both `repo` and `sync` (the command copying a tag's pages in).")
  }
  return prepareSource(config.repo, loaded.root, cacheDir, config.tokenEnv)
}

/**
 * `{ changelog }` for a page built from the source at `commit`: the
 * configured (or default) changelog path read from the source, written to
 * `dest`. Empty when disabled, when `commit` is null or the file isn't
 * there at that commit.
 */
export function sourceChangelogOption(
  source: PreparedSource,
  commit: string | null,
  configured: string | undefined,
  dest: string,
): { changelog?: string } {
  const rel = configured ?? DEFAULT_CHANGELOG
  if (!rel || !commit) return {}
  const text = readFileAtCommit(source, commit, rel)
  if (text === null) return {}
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.rmSync(dest, { force: true })
  fs.writeFileSync(dest, text, "utf-8")
  return { changelog: dest }
}

interface EnsureSourceSnapshotArgs extends EnsureSnapshotArgs {
  source: PreparedSource
  sourceConfig: VersionsSourceConfig
  /** {@link siteInputsHash} of the committed site. */
  siteHash: string
}

/**
 * Like {@link ensureSnapshot}, for a tag of the source repository: the
 * committed site, with the tag's pages synced in, built under
 * `/v/<version>`. Cached per source commit, site files and shell version.
 */
async function ensureSourceSnapshot(a: EnsureSourceSnapshotArgs): Promise<string | null> {
  const { tag, repoRoot, cacheDir, shellVersion, source, sourceConfig, siteHash } = a
  const entryDir = path.join(cacheDir, `${tag.version}-${tag.commit.slice(0, 12)}`)
  const meta = readCacheMeta(entryDir)
  if (
    meta &&
    meta.commit === tag.commit &&
    meta.shellVersion === shellVersion &&
    meta.siteHash === siteHash
  ) {
    log(`versions: ${tag.tag} — cached (${tag.commit.slice(0, 7)})`)
    return entryDir
  }

  const relRoot = path.relative(repoRoot, a.registryRoot)
  const configName = findConfigAtCommit(repoRoot, "HEAD", relRoot)
  if (!configName) {
    throw new Error(
      "[docs-shell] versions.source: the site's config file isn't committed; snapshots are built from the committed site.",
    )
  }

  log(`versions: ${tag.tag} — building snapshot from ${sourceConfig.repo} at ${tag.commit.slice(0, 7)}`)
  const workParent = fs.mkdtempSync(path.join(a.tmpRoot, "docs-shell-"))
  const siteCheckout = path.join(workParent, "site")
  const sourceCheckout = path.join(workParent, "source")
  const siteRoot = path.join(siteCheckout, relRoot)
  const checkouts: Array<{ repo: string; dir: string; env?: NodeJS.ProcessEnv }> = []
  try {
    git(repoRoot, ["worktree", "add", "--detach", siteCheckout, "HEAD"])
    checkouts.push({ repo: repoRoot, dir: siteCheckout })
    git(source.gitDir, ["worktree", "add", "--detach", sourceCheckout, tag.commit], source.env)
    checkouts.push({ repo: source.gitDir, dir: sourceCheckout, env: source.env })

    // The installed dependencies, rather than an install per version.
    linkNodeModules(a.registryRoot, siteRoot)
    if (relRoot) linkNodeModules(repoRoot, siteCheckout)

    const command = expandSyncCommand(sourceConfig.sync, { sourceDir: sourceCheckout, siteDir: siteRoot })
    await runCommand(command, siteRoot, `sync (${tag.tag})`, {
      DOCS_SHELL_SOURCE_DIR: sourceCheckout,
      DOCS_SHELL_SITE_DIR: siteRoot,
      DOCS_SHELL_SOURCE_REF: tag.tag,
      DOCS_SHELL_SOURCE_COMMIT: tag.commit,
      DOCS_SHELL_VERSION: tag.version,
    })

    const tagLoaded = loadUserConfigFile(path.join(siteRoot, configName))
    const staging = `${entryDir}.partial`
    fs.rmSync(staging, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    await a.buildSite(tagLoaded, {
      args: a.args,
      outDir: path.join(staging, "site"),
      basePath: versionBasePath(tag.version),
      version: tag.version,
      versions: true,
      ...sourceChangelogOption(
        source,
        tag.commit,
        a.loaded.config.versions?.changelog,
        path.join(workParent, "CHANGELOG.md"),
      ),
    })

    const newMeta: CacheMeta = {
      version: tag.version,
      tag: tag.tag,
      commit: tag.commit,
      shellVersion,
      builtAt: new Date().toISOString(),
      hasRegistry: false,
      siteHash,
    }
    fs.writeFileSync(path.join(staging, CACHE_META_FILE), JSON.stringify(newMeta, null, 2) + "\n")
    fs.rmSync(entryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    fs.renameSync(staging, entryDir)
    return entryDir
  } finally {
    // Links first: deleting the checkout must never reach the real node_modules.
    unlinkNodeModules(siteRoot)
    unlinkNodeModules(siteCheckout)
    removeCheckouts(checkouts, workParent)
  }
}

interface EnsureSnapshotArgs {
  tag: VersionTag
  loaded: LoadedConfig
  registryRoot: string
  repoRoot: string
  cacheDir: string
  shellVersion: string
  args: string[]
  buildSite: BuildSite
  tmpRoot: string
}

/**
 * Return the cache entry dir holding `site/` (+ `registry/`) for `tag`,
 * building it first when missing or stale. Returns null when the tag has no
 * shell config (it predates the registry adopting the shell).
 */
async function ensureSnapshot(a: EnsureSnapshotArgs): Promise<string | null> {
  const { tag, loaded, repoRoot, cacheDir, shellVersion } = a
  const entryDir = path.join(cacheDir, `${tag.version}-${tag.commit.slice(0, 12)}`)
  const meta = readCacheMeta(entryDir)
  if (meta && meta.commit === tag.commit && meta.shellVersion === shellVersion) {
    log(`versions: ${tag.tag} — cached (${tag.commit.slice(0, 7)})`)
    return entryDir
  }

  // Registry root relative to the repo, so monorepo layouts work too.
  const relRoot = path.relative(repoRoot, a.registryRoot)
  const configName = findConfigAtCommit(repoRoot, tag.commit, relRoot)
  if (!configName) {
    log(`versions: ${tag.tag} — no registry-shell config at that tag, skipping.`)
    return null
  }

  log(`versions: ${tag.tag} — building snapshot from ${tag.commit.slice(0, 7)}`)
  const workParent = fs.mkdtempSync(path.join(a.tmpRoot, "registry-shell-"))
  const worktree = path.join(workParent, "checkout")
  try {
    git(repoRoot, ["worktree", "add", "--detach", worktree, tag.commit])
    const tagRoot = path.join(worktree, relRoot)
    const versionsConfig = loaded.config.versions ?? {}

    // 2. Dependencies.
    const install = resolveInstallCommand(versionsConfig.installCommand, tagRoot, worktree)
    if (install) await runCommand(install.command, install.cwd, `install (${tag.tag})`)

    // 3. Registry JSON. A docs-only site (registry module off at that tag)
    // has none to build unless it asks for a command explicitly.
    const tagLoaded = loadUserConfigFile(path.join(tagRoot, configName))
    const tagHasRegistry = resolveModules(tagLoaded).includes("registry")
    const registryBuild =
      versionsConfig.registryBuildCommand ?? (tagHasRegistry ? DEFAULT_REGISTRY_BUILD_COMMAND : "")
    if (registryBuild) await runCommand(registryBuild, tagRoot, `registry build (${tag.tag})`)

    // 4. Static export with the current shell, under /v/<version>.
    const staging = `${entryDir}.partial`
    fs.rmSync(staging, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    await a.buildSite(tagLoaded, {
      args: a.args,
      outDir: path.join(staging, "site"),
      basePath: versionBasePath(tag.version),
      version: tag.version,
      versions: true,
      // The current config decides where the changelog lives; the tag's
      // copy of that file is what gets rendered.
      ...changelogOption(tagLoaded.root, versionsConfig.changelog),
    })

    const registryJson = path.resolve(
      tagLoaded.root,
      tagLoaded.config.paths?.registryJson ?? "public/r",
    )
    const hasRegistry = fs.existsSync(registryJson)
    if (hasRegistry) {
      fs.cpSync(registryJson, path.join(staging, "registry"), { recursive: true })
    } else if (tagHasRegistry) {
      log(`versions: ${tag.tag} — no registry JSON at ${registryJson}; /r/v${tag.version}/ will be missing.`)
    }

    const newMeta: CacheMeta = {
      version: tag.version,
      tag: tag.tag,
      commit: tag.commit,
      shellVersion,
      builtAt: new Date().toISOString(),
      hasRegistry,
    }
    fs.writeFileSync(path.join(staging, CACHE_META_FILE), JSON.stringify(newMeta, null, 2) + "\n")
    // Swap in atomically-ish: a crash mid-build never leaves a half entry
    // that a later run would mistake for a hit.
    fs.rmSync(entryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    fs.renameSync(staging, entryDir)
    return entryDir
  } finally {
    removeCheckouts([{ repo: repoRoot, dir: worktree }], workParent)
  }
}

function readCacheMeta(entryDir: string): CacheMeta | null {
  const file = path.join(entryDir, CACHE_META_FILE)
  if (!fs.existsSync(file) || !fs.existsSync(path.join(entryDir, "site"))) return null
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as CacheMeta
  } catch {
    return null
  }
}

/** Name of the shell config file present at `commit` in `relRoot`, if any. */
function findConfigAtCommit(repoRoot: string, commit: string, relRoot: string): string | null {
  for (const name of CONFIG_FILE_CANDIDATES) {
    const spec = `${commit}:${[relRoot, name].filter(Boolean).join("/").replace(/\\/g, "/")}`
    try {
      execFileSync("git", ["cat-file", "-e", spec], { cwd: repoRoot, stdio: "ignore" })
      return name
    } catch {
      /* not at this commit */
    }
  }
  return null
}

/**
 * Pick the dependency install for a tag checkout. An explicit command
 * (even `""`, meaning skip) wins; otherwise the nearest lockfile between
 * the registry root and the checkout root decides.
 */
export function resolveInstallCommand(
  configured: string | undefined,
  tagRoot: string,
  checkoutRoot: string,
): { command: string; cwd: string } | null {
  if (configured !== undefined) {
    return configured ? { command: configured, cwd: tagRoot } : null
  }
  const lockfiles: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm install --frozen-lockfile"],
    ["bun.lock", "bun install --frozen-lockfile"],
    ["bun.lockb", "bun install --frozen-lockfile"],
    ["yarn.lock", "yarn install --frozen-lockfile"],
    ["package-lock.json", "npm ci"],
  ]
  const top = path.resolve(checkoutRoot)
  for (let dir = path.resolve(tagRoot); ; dir = path.dirname(dir)) {
    for (const [file, command] of lockfiles) {
      if (fs.existsSync(path.join(dir, file))) return { command, cwd: dir }
    }
    if (dir === top || path.dirname(dir) === dir) break
  }
  if (fs.existsSync(path.join(tagRoot, "package.json"))) {
    return { command: "npm install", cwd: tagRoot }
  }
  return null
}

function runCommand(
  command: string,
  cwd: string,
  label: string,
  extraEnv: Record<string, string> = {},
): Promise<void> {
  log(`versions: ${label}: ${command}`)
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit", env: { ...process.env, ...extraEnv } })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`[docs-shell] versions: ${label} failed (exit ${code}): ${command}`))
    })
  })
}

/**
 * Remove temporary checkouts, each from its own repository by path (not
 * `git worktree prune`, which would also drop unrelated stale worktrees of
 * a local source clone), then whatever is left of their parent folder.
 */
function removeCheckouts(
  checkouts: Array<{ repo: string; dir: string; env?: NodeJS.ProcessEnv }>,
  workParent: string,
): void {
  for (const { repo, dir, env } of checkouts) {
    try {
      execFileSync("git", ["worktree", "remove", "--force", dir], { cwd: repo, env: env ?? process.env, stdio: "ignore" })
    } catch {
      /* deleted below; git lists the entry as prunable */
    }
  }
  try {
    fs.rmSync(workParent, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (err) {
    log(`versions: couldn't remove ${workParent} (${(err as Error).message}); remove it manually.`)
  }
}


function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("git", args, {
    cwd,
    env,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function gitTopLevel(dir: string): string {
  try {
    return fs.realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim())
  } catch {
    throw new Error(
      `[docs-shell] \`versions\` needs the registry to live in a git repository (tags are read from git); ${dir} isn't one.`,
    )
  }
}

function readShellVersion(): string {
  // dist/cli/ and src/cli/ are both two levels below package.json.
  const pkgPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json")
  try {
    return (JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string }).version
  } catch {
    return "unknown"
  }
}

