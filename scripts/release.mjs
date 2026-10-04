#!/usr/bin/env node
/**
 * Bumps every publishable package in packages/* to the same version, then
 * commits "X.Y.Z" and tags "vX.Y.Z", like `npm version` did when the
 * package lived at the repo root (`npm version` skips the commit and tag
 * for a package that isn't at the git root).
 *
 *   pnpm release patch|minor|major      # 2.6.1 -> 2.6.2 / 2.7.0 / 3.0.0
 *   pnpm release 2.7.0-rc.1             # explicit version
 *   git push origin main --follow-tags  # the v* tag triggers publish.yml
 */
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
const fail = (msg) => {
  console.error(`release: ${msg}`)
  process.exit(1)
}

const arg = process.argv[2]
if (!arg) fail("usage: pnpm release <patch|minor|major|x.y.z[-pre]>")

if (git("status", "--porcelain")) fail("working tree is not clean; commit or stash first")

const pkgFiles = fs
  .readdirSync(path.join(root, "packages"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => path.join(root, "packages", d.name, "package.json"))
  .filter((f) => fs.existsSync(f))
  .filter((f) => !JSON.parse(fs.readFileSync(f, "utf8")).private)
if (pkgFiles.length === 0) fail("no publishable packages found in packages/*")

const current = JSON.parse(fs.readFileSync(pkgFiles[0], "utf8")).version
for (const f of pkgFiles) {
  const v = JSON.parse(fs.readFileSync(f, "utf8")).version
  if (v !== current) fail(`packages are out of sync (${path.relative(root, f)} is ${v}, expected ${current})`)
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/
function bump(version, kind) {
  const m = SEMVER.exec(version)
  if (!m) fail(`current version ${version} is not semver`)
  const [maj, min, pat] = m.slice(1, 4).map(Number)
  const pre = Boolean(m[4])
  // A prerelease bumps to its own release first (2.7.0-rc.1 + patch = 2.7.0), as npm does.
  if (kind === "major") return pre && min === 0 && pat === 0 ? `${maj}.0.0` : `${maj + 1}.0.0`
  if (kind === "minor") return pre && pat === 0 ? `${maj}.${min}.0` : `${maj}.${min + 1}.0`
  return pre ? `${maj}.${min}.${pat}` : `${maj}.${min}.${pat + 1}`
}

const next = ["patch", "minor", "major"].includes(arg) ? bump(current, arg) : arg
if (!SEMVER.test(next)) fail(`"${next}" is not a valid version`)
if (git("tag", "--list", `v${next}`)) fail(`tag v${next} already exists`)

for (const f of pkgFiles) {
  const raw = fs.readFileSync(f, "utf8")
  // Only touch the "version" field, so formatting and line endings stay as they are.
  const updated = raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`)
  fs.writeFileSync(f, updated)
  git("add", path.relative(root, f))
}

git("commit", "-m", next)
git("tag", `v${next}`)
console.log(`release: ${current} -> ${next} (${pkgFiles.length} package${pkgFiles.length > 1 ? "s" : ""}), tagged v${next}`)
console.log("release: push with `git push origin main --follow-tags`")
