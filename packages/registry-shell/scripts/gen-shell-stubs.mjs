#!/usr/bin/env node
/**
 * Writes `shell/**` re-export stubs so `@sntlr/registry-shell/shell/<path>`
 * keeps resolving now that the files live in @sntlr/docs-shell. One stub per
 * shell source file, same name and extension, e.g.
 *
 *   shell/hooks/use-controls.ts
 *     export * from "@sntlr/docs-shell/shell/hooks/use-controls"
 *
 * Inside the shell's own Next build these paths never reach the stubs:
 * next.config.ts aliases `@sntlr/registry-shell/shell` straight to the
 * engine's files (one module instance). The stubs serve every other
 * resolver: TypeScript, editors, other bundlers. Runs on `prepack`.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(here, "..")
const require = createRequire(import.meta.url)
const engineApp = path.join(path.dirname(require.resolve("@sntlr/docs-shell/package.json")), "src/next-app")
const outDir = path.join(pkgRoot, "shell")
const DIRS = ["hooks", "components", "lib", "fallback"]

fs.rmSync(outDir, { recursive: true, force: true })
let count = 0
const walk = (rel) => {
  for (const entry of fs.readdirSync(path.join(engineApp, rel), { withFileTypes: true })) {
    const entryRel = path.posix.join(rel, entry.name)
    if (entry.isDirectory()) {
      walk(entryRel)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) continue
    const source = fs.readFileSync(path.join(engineApp, entryRel), "utf8")
    const specifier = `@sntlr/docs-shell/shell/${entryRel.replace(/\.(ts|tsx)$/, "")}`
    const lines = []
    if (/^\s*["']use client["']/.test(source)) lines.push('"use client"', "")
    lines.push(`export * from "${specifier}"`)
    if (/^export default\b/m.test(source)) lines.push(`export { default } from "${specifier}"`)
    const target = path.join(outDir, entryRel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, lines.join("\n") + "\n")
    count++
  }
}
for (const dir of DIRS) if (fs.existsSync(path.join(engineApp, dir))) walk(dir)
// stderr: keeps `npm pack --json` output parseable.
console.error(`gen-shell-stubs: wrote ${count} stubs to ${path.relative(process.cwd(), outDir) || "shell"}`)
