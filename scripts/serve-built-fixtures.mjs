#!/usr/bin/env node
/**
 * Builds fixtures one after the other (builds share the shell's own folder,
 * so they can't run in parallel), then serves each static export on its
 * port. For Playwright's `webServer`, which starts its servers in parallel.
 *
 *   node scripts/serve-built-fixtures.mjs docs-basic:3120 docs-nested:3121
 */
import { spawn, spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const cli = path.join(root, "packages/docs-shell/dist/cli/index.js")
const pairs = process.argv.slice(2).map((arg) => {
  const [name, port] = arg.split(":")
  if (!name || !port) throw new Error(`expected <fixture>:<port>, got "${arg}"`)
  return { name, port, dir: path.join(root, "fixtures", name) }
})

for (const { name, dir } of pairs) {
  console.log(`serve-built-fixtures: building ${name}…`)
  const env = { ...process.env }
  delete env.SHELL_MODULES
  const build = spawnSync(process.execPath, [cli, "build"], { cwd: dir, env, stdio: "inherit" })
  if (build.status !== 0) {
    console.error(`serve-built-fixtures: ${name} failed to build`)
    process.exit(1)
  }
}

const servers = pairs.map(({ dir, port }) =>
  spawn(process.execPath, [path.join(root, "scripts/serve-static.mjs"), path.join(dir, "out"), port], {
    stdio: "inherit",
  }),
)
const stop = () => {
  for (const s of servers) s.kill()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
