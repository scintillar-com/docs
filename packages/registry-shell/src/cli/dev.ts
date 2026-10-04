/**
 * `registry-shell dev` — run `next dev` against the user's project.
 *
 * Dev mode runs Next in its normal dynamic-rendering mode (so hot reload
 * / live MDX / interactive previews all work). The `output: "export"`
 * config only affects `next build`, so dev behaves identically to pre-v2.
 *
 * We still overlay the user's `public/` onto the shell's bundled `public/`
 * before starting Next, so dynamic registry assets (`/r/*.json`,
 * `/a11y/*.json`, `/props/*.json`, `/tests/*.json`, `/api/search-index.json`,
 * plus any user-custom static files) are served the same way they will be
 * in a production build. Note: changes to the user's `public/` during a
 * dev session require a restart to refresh the overlay.
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
} from "./shared.js"
import { generateSearchIndex } from "./generate-search-index.js"

export async function run(args: string[]): Promise<void> {
  const loaded = loadUserConfig()
  if (loaded) {
    console.log(`[registry-shell] Using config: ${loaded.configPath}`)
  } else {
    console.log(`[registry-shell] No registry-shell.config.ts found — running in shell-only mode.`)
  }

  clearStaleNextCacheIfModeChanged(loaded)
  writeUserSourcesCss(loaded)

  const shellNextApp = nextAppDir()

  // Overlay user's public/ onto shell's public/ so dev-mode URLs match
  // what production will serve statically. Skipped in shell-only mode.
  if (loaded) {
    overlayUserPublic(loaded.root, shellNextApp)
    try {
      await generateSearchIndex(loaded, path.join(shellNextApp, "public"))
    } catch (err) {
      console.warn(
        `[registry-shell] search-index generation failed: ${(err as Error).message}`,
      )
    }
  }

  const env = { ...process.env, ...buildEnvVars(loaded) }
  const portArgs = loaded?.config.port ? ["-p", String(loaded.config.port)] : []
  // Webpack by default. Turbopack currently can't compile files reached via
  // the `@user/*` cross-project aliases — it treats them as native Node ESM
  // and crashes on `next/dynamic`. Set UI_SHELL_TURBOPACK=1 to opt in once
  // Turbopack supports this (track https://github.com/vercel/next.js).
  const turbopackArgs = process.env.UI_SHELL_TURBOPACK ? ["--turbopack"] : []
  const child = spawn(
    process.execPath,
    [NEXT_BIN, "dev", shellNextApp, ...turbopackArgs, ...portArgs, ...args],
    { stdio: "inherit", env },
  )

  child.on("exit", (code) => process.exit(code ?? 0))
}

function overlayUserPublic(userRoot: string, shellNextApp: string): void {
  const userPublic = path.join(userRoot, "public")
  const shellPublic = path.join(shellNextApp, "public")
  if (!fs.existsSync(userPublic)) return
  for (const entry of fs.readdirSync(userPublic)) {
    const src = path.join(userPublic, entry)
    const dest = path.join(shellPublic, entry)
    fs.cpSync(src, dest, { recursive: true, force: true })
  }
}
