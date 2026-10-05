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
 *      the user's checkout besides git's worktree bookkeeping, pruned after).
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
import {
  DEFAULT_TAG_GLOB,
  VERSIONS_MANIFEST_FILE,
  buildManifest,
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
}

const log = (msg: string) => console.log(`[registry-shell] ${msg}`)

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
  const { tags, skipped } = listVersionTags(loaded.root, glob)
  if (skipped.length > 0) {
    log(`versions: ignoring tags without a usable semver: ${skipped.join(", ")}`)
  }
  if (tags.length === 0) {
    const shallow = git(repoRoot, ["rev-parse", "--is-shallow-repository"]).trim() === "true"
    log(
      `versions: no tag matches "${glob}"` +
        (shallow
          ? " — this is a shallow clone, fetch tags first (e.g. `git fetch --tags --unshallow`)."
          : "; only the latest site will be published."),
    )
  } else {
    log(`versions: ${tags.map((t) => t.tag).join(", ")}`)
  }

  // 1. Latest, at the site root.
  await buildSite(loaded, {
    args,
    outDir,
    versions: true,
    ...changelogOption(loaded.root, versionsConfig.changelog),
  })

  // 2. One frozen snapshot per tag (cache hit or fresh build).
  const published: VersionTag[] = []
  const registryDirs = new Map<string, string>()
  for (const tag of tags) {
    const entryDir = await ensureSnapshot({
      tag,
      loaded,
      registryRoot,
      repoRoot,
      cacheDir,
      shellVersion,
      args,
      buildSite,
      tmpRoot: options.tmpRoot ?? os.tmpdir(),
    })
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
  const manifest = buildManifest(published)
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
  if (!resolveModules(loaded).includes("registry")) return manifest
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
    removeWorktree(repoRoot, workParent)
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

function runCommand(command: string, cwd: string, label: string): Promise<void> {
  log(`versions: ${label}: ${command}`)
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit", env: process.env })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`[registry-shell] versions: ${label} failed (exit ${code}): ${command}`))
    })
  })
}

function removeWorktree(repoRoot: string, workParent: string): void {
  // Delete the files ourselves (retries cope with Windows file locks), then
  // let git drop its bookkeeping for the now-missing worktree.
  try {
    fs.rmSync(workParent, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (err) {
    log(`versions: couldn't remove ${workParent} (${(err as Error).message}); remove it manually.`)
  }
  try {
    git(repoRoot, ["worktree", "prune"])
  } catch {
    /* best effort */
  }
}

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

function gitTopLevel(dir: string): string {
  try {
    return fs.realpathSync(git(dir, ["rev-parse", "--show-toplevel"]).trim())
  } catch {
    throw new Error(
      `[registry-shell] \`versions\` needs the registry to live in a git repository (tags are read from git); ${dir} isn't one.`,
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

