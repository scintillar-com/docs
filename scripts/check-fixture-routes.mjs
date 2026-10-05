#!/usr/bin/env node
/**
 * Builds each fixture with the real CLI and compares the pages it produced
 * with the fixture's committed `routes.txt`. Catches a module's routes
 * leaking into a site that doesn't use it (docs-basic must have no
 * /components or /preview pages) and routes disappearing from one that does.
 *
 *   pnpm test:fixtures             # build and compare (needs `pnpm build` first)
 *   pnpm test:fixtures --update    # rewrite routes.txt from the current output
 *   pnpm test:fixtures docs-basic  # only some fixtures
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const engineCli = path.join(root, "packages/docs-shell/dist/cli/index.js")
// Each fixture is built through the CLI its users run: the docs site with
// `docs-shell`, the registry through the `registry-shell` preset's bin.
const FIXTURE_CLI = {
  "docs-basic": engineCli,
  "docs-nested": engineCli,
  "dev-registry": path.join(root, "packages/registry-shell/bin/registry-shell.js"),
}
const FIXTURES = Object.keys(FIXTURE_CLI)

const args = process.argv.slice(2)
const update = args.includes("--update")
const only = args.filter((a) => !a.startsWith("--"))
const fixtures = only.length ? FIXTURES.filter((f) => only.includes(f)) : FIXTURES

if (!fs.existsSync(engineCli)) {
  console.error("check-fixture-routes: CLI not built; run `pnpm build` first.")
  process.exit(1)
}

/** Every built page, as a route: out/docs/intro/index.html -> /docs/intro/ */
function routes(outDir) {
  const found = []
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(outDir, rel), { withFileTypes: true })) {
      const entryRel = path.posix.join(rel, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "_next") walk(entryRel)
      } else if (entry.name === "index.html") {
        found.push("/" + (rel ? rel + "/" : ""))
      }
    }
  }
  walk("")
  return found.sort()
}

let failed = false
for (const name of fixtures) {
  const dir = path.join(root, "fixtures", name)
  const env = { ...process.env }
  // The CLI decides the modules from the fixture; don't let a stray shell
  // variable decide for it.
  delete env.SHELL_MODULES
  console.log(`check-fixture-routes: building ${name}…`)
  const build = spawnSync(process.execPath, [FIXTURE_CLI[name], "build"], { cwd: dir, env, encoding: "utf8" })
  if (build.status !== 0) {
    console.error(build.stdout.slice(-3000), build.stderr.slice(-3000))
    console.error(`check-fixture-routes: ${name} failed to build`)
    failed = true
    continue
  }

  const actual = routes(path.join(dir, "out"))
  const snapFile = path.join(dir, "routes.txt")
  if (update) {
    fs.writeFileSync(snapFile, actual.join("\n") + "\n")
    console.log(`check-fixture-routes: ${name}: wrote ${actual.length} routes`)
    continue
  }
  if (!fs.existsSync(snapFile)) {
    console.error(`check-fixture-routes: ${name}: no routes.txt; run with --update`)
    failed = true
    continue
  }
  const expected = fs.readFileSync(snapFile, "utf8").split(/\r?\n/).filter(Boolean)
  const missing = expected.filter((r) => !actual.includes(r))
  const extra = actual.filter((r) => !expected.includes(r))
  if (missing.length || extra.length) {
    failed = true
    console.error(`check-fixture-routes: ${name}: routes changed`)
    for (const r of missing) console.error(`  - ${r}`)
    for (const r of extra) console.error(`  + ${r}`)
  } else {
    console.log(`check-fixture-routes: ${name}: ${actual.length} routes match`)
  }
}
process.exit(failed ? 1 : 0)
