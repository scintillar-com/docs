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
import { beginPublicOverlay } from "./fs-safe.js"
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

  // Steps 1-2: Overlay user's public/ onto shell's public/ (user files win),
  // remembering the pristine state so it can be restored (see fs-safe.ts).
  const restorePublic = beginPublicOverlay(shellPublic, userPublic)

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
      if (!envOptions.changelog) removeReleasesPage(outDir)
      // Remove the build output from inside node_modules so it doesn't
      // accumulate stale copies across releases.
      fs.rmSync(src, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      console.log(`[registry-shell] Static build ready at ${outDir}`)
    }
  } finally {
    // Step 6: Restore shell's public/ (remove overlay) and process.env.
    restorePublic()
    restoreEnv()
  }
}

/**
 * The `/releases` route always exists in the Next app but only means
 * something on versioned builds with a changelog; elsewhere it prerenders
 * as a 404. Drop that output so such builds publish exactly the pages they
 * did before the route existed.
 */
export function removeReleasesPage(outDir: string): void {
  for (const entry of ["releases", "releases.html", "releases.txt"]) {
    fs.rmSync(path.join(outDir, entry), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
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

// Kept exported for callers that imported them from here before fs-safe.ts.
export { restoreDir, snapshotDir } from "./fs-safe.js"
