/**
 * `registry-shell build` — produces a Next.js static export tree in
 * `<user-project>/out/`.
 *
 * Pipeline (one `buildSite` call):
 *   1. Overlay user's public/ onto the shell's bundled public/ (so Next
 *      sees user's registry manifests at /r/*.json, /a11y/*.json, etc.).
 *   2. Run build-time generators that write derived JSON into the merged
 *      public/ — currently just `api/search-index.json`.
 *   3. Run `next build` with `output: "export"` (set in next.config.ts).
 *      Next writes static HTML/JS/CSS to `<shell>/out/`.
 *   4. Copy `<shell>/out/` → the target out dir.
 *   5. Restore shell's public/ to its pre-build state (remove anything we
 *      added in step 1/2, put back anything we overwrote) so repeated builds
 *      — and the several builds of a versioned run — are idempotent.
 *
 * With `versions` set in the config, `versioned-build.ts` calls
 * `buildSite` once for latest and once per (uncached) release tag.
 */
import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import {
  NEXT_BIN,
  buildEnvVars,
  clearStaleNextCacheIfModeChanged,
  loadUserConfig,
  nextAppDir,
  writeUserSourcesCss,
  type BuildEnvOptions,
  type LoadedConfig,
} from "./shared.js"
import { generateSearchIndex } from "./generate-search-index.js"

export async function run(args: string[]): Promise<void> {
  const loaded = loadUserConfig()
  if (!loaded) {
    console.error(
      "[registry-shell] No registry-shell.config.ts found — `build` requires a registry.",
    )
    process.exit(1)
  }

  try {
    await buildRegistry(loaded, args)
  } catch (err) {
    if (err instanceof BuildExitError) process.exit(err.code)
    throw err
  }
  process.exit(0)
}

/**
 * Build everything `registry-shell build` publishes into `<root>/out/`.
 * Without `versions` in the config this is exactly one `buildSite` call,
 * the same single latest site as before versioning existed.
 */
export async function buildRegistry(
  loaded: LoadedConfig,
  args: string[],
  build: BuildSite = buildSite,
): Promise<void> {
  if (loaded.config.versions) {
    const { runVersionedBuild } = await import("./versioned-build.js")
    await runVersionedBuild({ loaded, args, buildSite: build })
  } else {
    await build(loaded, { args, outDir: path.resolve(loaded.root, "out") })
  }
}

/** `next build` exited non-zero; carries its exit code up to `run`. */
export class BuildExitError extends Error {
  constructor(public readonly code: number) {
    super(`[registry-shell] next build exited with code ${code}`)
  }
}

export interface BuildSiteOptions extends BuildEnvOptions {
  /** Extra args forwarded to `next build`. */
  args: string[]
  /** Where the finished static export is copied (replaced if present). */
  outDir: string
}

export type BuildSite = (loaded: LoadedConfig, options: BuildSiteOptions) => Promise<void>

/**
 * Build one static site for `loaded` into `options.outDir`. Rejects with a
 * `BuildExitError` when `next build` fails. `process.env` is restored on
 * return so consecutive builds (versioned mode) don't leak each other's
 * NEXT_PUBLIC_* values.
 */
export const buildSite: BuildSite = async (loaded, options) => {
  const { args, outDir, ...envOptions } = options

  clearStaleNextCacheIfModeChanged(loaded)
  writeUserSourcesCss(loaded)

  const shellNextApp = nextAppDir()
  const shellPublic = path.join(shellNextApp, "public")
  const userPublic = path.join(loaded.root, "public")

  // Step 1: Snapshot shell's public/ before overlay so we can restore it.
  const pristine = snapshotDir(shellPublic)

  // Step 2: Overlay user's public/ onto shell's public/ (user files win).
  if (fs.existsSync(userPublic)) {
    for (const entry of fs.readdirSync(userPublic)) {
      const src = path.join(userPublic, entry)
      const dest = path.join(shellPublic, entry)
      fs.cpSync(src, dest, { recursive: true, force: true })
    }
  }

  // Apply the shell env vars to THIS process so build-time generators can
  // call `loadResolvedConfig()` (which reads USER_REGISTRY_ROOT etc.).
  // The same env is also forwarded to the spawn child below.
  const shellEnv = buildEnvVars(loaded, envOptions)
  const env = { ...process.env, ...shellEnv }
  const restoreEnv = applyEnv(shellEnv)

  try {
    // Step 3: Pre-build generators (writes into shell's public/ so Next picks up).
    try {
      await generateSearchIndex(loaded, shellPublic)
    } catch (err) {
      console.warn(
        `[registry-shell] search-index generation failed: ${(err as Error).message}`,
      )
    }

    // Step 4: next build (static export — writes to <shellNextApp>/out/).
    const code = await new Promise<number>((resolve, reject) => {
      const buildChild = spawn(
        process.execPath,
        [NEXT_BIN, "build", shellNextApp, ...args],
        { stdio: "inherit", env },
      )
      buildChild.on("error", reject)
      buildChild.on("exit", (c) => resolve(c ?? 1))
    })
    if (code !== 0) throw new BuildExitError(code)

    // Step 5: Copy out/ to the target.
    const src = path.join(shellNextApp, "out")
    if (fs.existsSync(src)) {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      }
      fs.mkdirSync(path.dirname(outDir), { recursive: true })
      fs.cpSync(src, outDir, { recursive: true })
      // Remove the build output from inside node_modules so it doesn't
      // accumulate stale copies across releases.
      fs.rmSync(src, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      console.log(`[registry-shell] Static build ready at ${outDir}`)
    }
  } finally {
    // Step 6: Restore shell's public/ (remove overlay) and process.env.
    restoreDir(shellPublic, pristine)
    restoreEnv()
  }
}

/** Set env vars on process.env; returns a function that undoes it. */
function applyEnv(vars: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key])
    process.env[key] = value
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

/** Relative path → contents of every file under `dir`. */
export function snapshotDir(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  if (!fs.existsSync(dir)) return files
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const entryRel = path.join(rel, entry.name)
      if (entry.isDirectory()) walk(entryRel)
      else files.set(entryRel, fs.readFileSync(path.join(dir, entryRel)))
    }
  }
  walk("")
  return files
}

/**
 * Bring `dir` back to the state captured by `snapshotDir`: delete files
 * the overlay added (and directories left empty by that), and rewrite the
 * shell's own files the overlay replaced (e.g. a user `favicon.ico`).
 * Runs on both success and failure paths.
 */
export function restoreDir(dir: string, pristine: Map<string, Buffer>): void {
  if (!fs.existsSync(dir)) return
  const current = snapshotDir(dir)
  for (const [rel, contents] of current) {
    const original = pristine.get(rel)
    if (!original) {
      fs.rmSync(path.join(dir, rel), { force: true, maxRetries: 5, retryDelay: 200 })
    } else if (!original.equals(contents)) {
      fs.writeFileSync(path.join(dir, rel), original)
    }
  }
  const keepDirs = new Set<string>()
  for (const rel of pristine.keys()) {
    for (let d = path.dirname(rel); d !== "." && d !== ""; d = path.dirname(d)) keepDirs.add(d)
  }
  const prune = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const entryRel = path.join(rel, entry.name)
      prune(entryRel)
      if (!keepDirs.has(entryRel) && fs.readdirSync(path.join(dir, entryRel)).length === 0) {
        fs.rmSync(path.join(dir, entryRel), { recursive: true, force: true })
      }
    }
  }
  prune("")
}
