/**
 * End-to-end check of the versioned build's orchestration against a real
 * git repo: `fixtures/versioned-registry` (repo root) is copied into a temp dir,
 * committed and tagged twice, then built. `next build` is replaced by a
 * fake `buildSite` (writing a small JSON "page" + the overlaid public/ tree)
 * so the test runs in seconds; everything else — tag discovery, worktree
 * checkout, the registry build command, caching, output layout and
 * `/versions.json` — is the real thing.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { buildRegistry, removeReleasesPage, type BuildSite, type BuildSiteOptions } from "./build.js"
import { buildEnvVars, loadUserConfigFile, type LoadedConfig } from "./shared.js"
import { changelogOption, resolveInstallCommand, runVersionedBuild } from "./versioned-build.js"
import type { ChangeIndex } from "./version-changes.js"
import { compareItem, defaultRange } from "../next-app/lib/changes"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, "../../../../fixtures/versioned-registry")
const CONFIG = "registry-shell.config.mjs"

let tmp: string

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rs-versions-test-")))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

/** git with a throwaway identity, scoped to the temp repo only. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c", "user.name=Fixture",
      "-c", "user.email=fixture@example.com",
      "-c", "commit.gpgsign=false",
      "-c", "tag.gpgsign=false",
      "-c", "core.autocrlf=false",
      ...args,
    ],
    { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim()
}

function writeHello(repo: string, text: string): void {
  fs.writeFileSync(
    path.join(repo, "components/ui/hello.tsx"),
    `export function Hello() {\n  return <span>${text}</span>\n}\n`,
  )
}

/**
 * History:
 *   v0.0.1  README only (predates the shell: no config → skipped)
 *   v0.1.0  fixture registry, hello says "Hello v0.1"
 *   v0.2.0  hello says "Hello v0.2", adds docs/extra.mdx, the `badge`
 *           item and CHANGELOG.md
 *   (HEAD)  unreleased: hello says "Hello next"
 */
function makeRepo(): string {
  const repo = path.join(tmp, "repo")
  fs.mkdirSync(repo)
  git(repo, "-c", "init.defaultBranch=main", "init", "-q")
  fs.writeFileSync(path.join(repo, "README.md"), "# before the shell\n")
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "-m", "init")
  git(repo, "tag", "v0.0.1")

  fs.cpSync(FIXTURE, repo, { recursive: true })
  fs.rmSync(path.join(repo, "public"), { recursive: true, force: true })
  writeHello(repo, "Hello v0.1")
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "-m", "0.1.0")
  git(repo, "tag", "v0.1.0")

  writeHello(repo, "Hello v0.2")
  fs.writeFileSync(path.join(repo, "content/docs/extra.mdx"), "---\ntitle: Extra\n---\n\nNew in 0.2.\n")
  fs.writeFileSync(path.join(repo, "components/ui/badge.tsx"), "export const Badge = () => null\n")
  const registry = readJson<{ items: unknown[] }>(path.join(repo, "registry.json"))
  registry.items.push({
    name: "badge",
    type: "registry:component",
    files: [{ path: "components/ui/badge.tsx", type: "registry:component" }],
  })
  fs.writeFileSync(path.join(repo, "registry.json"), JSON.stringify(registry, null, 2) + "\n")
  fs.writeFileSync(
    path.join(repo, "CHANGELOG.md"),
    "# versioned-fixture\n\n## 0.2.0\n\n### Minor Changes\n\n- abc1234: Add Badge.\n\n## 0.1.0\n\n### Major Changes\n\n- Initial release.\n",
  )
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "-m", "0.2.0")
  // Annotated, to exercise peeling to the commit.
  git(repo, "tag", "-a", "v0.2.0", "-m", "release 0.2.0")
  git(repo, "tag", "not-a-release")

  writeHello(repo, "Hello next")
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "-m", "unreleased")

  // The latest build reads the working tree's registry JSON, as a real
  // deploy would after running its own registry build.
  execFileSync(process.execPath, ["scripts/build-registry.mjs"], { cwd: repo, stdio: "ignore" })
  return repo
}

interface FakeBuild {
  root: string
  options: Omit<BuildSiteOptions, "args" | "outDir">
}

/** Stand-in for `next build`: records the call, emits a JSON "page". */
function fakeBuildSite(calls: FakeBuild[]): BuildSite {
  return async (loaded, options) => {
    const { args: _args, outDir, ...rest } = options
    calls.push({ root: loaded.root, options: rest })
    fs.rmSync(outDir, { recursive: true, force: true })
    fs.mkdirSync(outDir, { recursive: true })
    const publicDir = path.join(loaded.root, "public")
    if (fs.existsSync(publicDir)) fs.cpSync(publicDir, outDir, { recursive: true })
    const docs = fs.readdirSync(path.join(loaded.root, "content/docs")).sort()
    fs.writeFileSync(
      path.join(outDir, "index.json"),
      JSON.stringify({
        hello: fs.readFileSync(path.join(loaded.root, "components/ui/hello.tsx"), "utf-8"),
        docs,
        env: buildEnvVars(loaded, rest),
      }),
    )
  }
}

function readJson<T = Record<string, unknown>>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T
}

function load(repo: string): LoadedConfig {
  return loadUserConfigFile(path.join(repo, CONFIG))
}

// Real git worktrees + installs per tag: several seconds each on Windows,
// more when the whole suite runs in parallel.
describe("versioned build (fixture registry with two release tags)", { timeout: 60_000 }, () => {
  it("publishes latest at / and a frozen snapshot per tag", async () => {
    const repo = makeRepo()
    const calls: FakeBuild[] = []
    const manifest = await runVersionedBuild({
      loaded: load(repo),
      args: [],
      buildSite: fakeBuildSite(calls),
      shellVersion: "test-1",
      tmpRoot: tmp,
    })
    const out = path.join(repo, "out")

    // Latest: working tree content at the root, switcher on, no base path.
    const latest = readJson<{ hello: string; env: Record<string, string> }>(path.join(out, "index.json"))
    expect(latest.hello).toContain("Hello next")
    expect(latest.env.NEXT_PUBLIC_SHELL_VERSIONS).toBe("1")
    expect(latest.env.NEXT_PUBLIC_SHELL_BASE_PATH).toBeUndefined()
    expect(readJson<{ files: { content: string }[] }>(path.join(out, "r/hello.json")).files[0].content).toContain("Hello next")

    // Snapshots: each built from its tag's content, under its base path.
    for (const [version, text, docs] of [
      ["0.1.0", "Hello v0.1", ["intro.mdx"]],
      ["0.2.0", "Hello v0.2", ["extra.mdx", "intro.mdx"]],
    ] as const) {
      const page = readJson<{ hello: string; docs: string[]; env: Record<string, string> }>(
        path.join(out, "v", version, "index.json"),
      )
      expect(page.hello).toContain(text)
      expect(page.docs).toEqual(docs)
      expect(page.env.NEXT_PUBLIC_SHELL_BASE_PATH).toBe(`/v/${version}`)
      expect(page.env.NEXT_PUBLIC_SHELL_VERSION).toBe(version)
      expect(page.env.NEXT_PUBLIC_SHELL_VERSIONS).toBe("1")

      // Frozen registry JSON, produced by the tag's registry build command.
      const item = readJson<{ files: { content: string }[] }>(path.join(out, "r", `v${version}`, "hello.json"))
      expect(item.files[0].content).toContain(text)
    }

    // Releases page: only where the changelog exists (0.2.0 and later).
    expect(latest.env.SHELL_CHANGELOG_PATH).toBe(path.join(repo, "CHANGELOG.md"))
    expect(latest.env.NEXT_PUBLIC_SHELL_RELEASES).toBe("1")
    const v010 = readJson<{ env: Record<string, string> }>(path.join(out, "v/0.1.0/index.json"))
    const v020 = readJson<{ env: Record<string, string> }>(path.join(out, "v/0.2.0/index.json"))
    expect(v010.env.NEXT_PUBLIC_SHELL_RELEASES).toBeUndefined()
    expect(v010.env.SHELL_CHANGELOG_PATH).toBeUndefined()
    expect(v020.env.NEXT_PUBLIC_SHELL_RELEASES).toBe("1")
    expect(path.basename(v020.env.SHELL_CHANGELOG_PATH)).toBe("CHANGELOG.md")

    // Change history: one index per item at the site root, oldest first,
    // the latest site ("") last.
    const hello = readJson<ChangeIndex>(path.join(out, "changes/hello.json"))
    expect(hello.versions.map((v) => v.version)).toEqual(["0.1.0", "0.2.0", ""])
    const helloFile = (version: string) =>
      hello.blobs[hello.versions.find((v) => v.version === version)!.files!["components/ui/hello.tsx"]]
    expect(helloFile("0.1.0")).toContain("Hello v0.1")
    expect(helloFile("0.2.0")).toContain("Hello v0.2")
    expect(helloFile("")).toContain("Hello next")
    const helloDiff = compareItem(hello, "0.1.0", "0.2.0")
    expect(helloDiff.status).toBe("changed")
    expect(helloDiff.files.map((f) => [f.path, f.additions, f.deletions])).toEqual([
      ["components/ui/hello.tsx", 1, 1],
    ])

    const badge = readJson<ChangeIndex>(path.join(out, "changes/badge.json"))
    expect(badge.versions.map((v) => v.files === null)).toEqual([true, false, false])
    // Viewing 0.2.0: new in that release. Viewing latest: unchanged since.
    expect(compareItem(badge, "0.1.0", "0.2.0")).toMatchObject({ status: "added", addedIn: "0.2.0" })
    const latestRange = defaultRange(badge, "")!
    expect(latestRange).toEqual({ from: "0.2.0", to: "" })
    expect(compareItem(badge, latestRange.from, latestRange.to)).toMatchObject({
      status: "unchanged",
      since: "0.2.0",
    })
    // Identical content is stored once.
    expect(Object.keys(badge.blobs)).toHaveLength(2)

    // v0.0.1 has no shell config and `not-a-release` no version: neither is published.
    expect(fs.existsSync(path.join(out, "v/0.0.1"))).toBe(false)

    // Manifest.
    const onDisk = readJson(path.join(out, "versions.json"))
    expect(onDisk).toEqual(manifest)
    expect(manifest.latest).toBe("0.2.0")
    expect(manifest.versions.map((v) => [v.version, v.tag, v.isLatest, v.path, v.registry])).toEqual([
      ["0.2.0", "v0.2.0", true, "/v/0.2.0/", "/r/v0.2.0/"],
      ["0.1.0", "v0.1.0", false, "/v/0.1.0/", "/r/v0.1.0/"],
    ])
    expect(manifest.versions[0].commit).toBe(git(repo, "rev-parse", "v0.2.0^{commit}"))
    expect(manifest.versions[1].commit).toBe(git(repo, "rev-parse", "v0.1.0^{commit}"))
    expect(manifest.versions[0].date).not.toBe("")

    // Latest + two snapshots; temp checkouts cleaned up, git bookkeeping pruned.
    expect(calls).toHaveLength(3)
    expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1)
    expect(fs.readdirSync(tmp).filter((d) => d.startsWith("registry-shell-"))).toEqual([])
    // The user's checkout is untouched (build output aside).
    expect(git(repo, "status", "--porcelain", "--untracked-files=no")).toBe("")
  })

  it("reuses cached snapshots and only rebuilds latest plus new tags", async () => {
    const repo = makeRepo()
    const run = async (shellVersion: string) => {
      const calls: FakeBuild[] = []
      await runVersionedBuild({
        loaded: load(repo),
        args: [],
        buildSite: fakeBuildSite(calls),
        shellVersion,
        tmpRoot: tmp,
      })
      return calls
    }

    expect(await run("test-1")).toHaveLength(3)

    // Same tags, same shell: only latest is rebuilt; output is complete.
    const second = await run("test-1")
    expect(second).toHaveLength(1)
    expect(second[0].options.basePath).toBeUndefined()
    expect(readJson<{ hello: string }>(path.join(repo, "out/v/0.1.0/index.json")).hello).toContain("Hello v0.1")
    expect(fs.existsSync(path.join(repo, "out/r/v0.2.0/hello.json"))).toBe(true)

    // A new release: latest + that tag only.
    writeHello(repo, "Hello v0.3")
    git(repo, "commit", "-q", "-am", "0.3.0")
    git(repo, "tag", "v0.3.0")
    const third = await run("test-1")
    expect(third.map((c) => c.options.version ?? "latest")).toEqual(["latest", "0.3.0"])
    expect(readJson<{ latest: string }>(path.join(repo, "out/versions.json")).latest).toBe("0.3.0")

    // Upgrading the shell rebuilds every snapshot once.
    expect(await run("test-2")).toHaveLength(4)
  })

  it("honours a custom tag glob and cache dir", async () => {
    const repo = makeRepo()
    const loaded = load(repo)
    loaded.config.versions = {
      ...loaded.config.versions,
      tags: "v0.1.*",
      cacheDir: ".snapshots",
    }
    const calls: FakeBuild[] = []
    const manifest = await runVersionedBuild({
      loaded,
      args: [],
      buildSite: fakeBuildSite(calls),
      shellVersion: "test-1",
      tmpRoot: tmp,
    })
    expect(manifest.versions.map((v) => v.version)).toEqual(["0.1.0"])
    expect(fs.readdirSync(path.join(repo, ".snapshots"))).toEqual([
      `0.1.0-${git(repo, "rev-parse", "v0.1.0^{commit}").slice(0, 12)}`,
    ])
  })
})

describe("versions absent (default)", () => {
  it("builds exactly the single latest site, as before versioning", async () => {
    const repo = makeRepo()
    const loaded = load(repo)
    delete loaded.config.versions
    const calls: FakeBuild[] = []
    let seenOptions: BuildSiteOptions | undefined
    const build: BuildSite = async (l, options) => {
      seenOptions = options
      await fakeBuildSite(calls)(l, options)
    }

    await buildRegistry(loaded, ["--debug"], build)

    expect(calls).toHaveLength(1)
    expect(seenOptions).toEqual({ args: ["--debug"], outDir: path.join(repo, "out") })
    expect(fs.existsSync(path.join(repo, "out/versions.json"))).toBe(false)
    expect(fs.existsSync(path.join(repo, "out/v"))).toBe(false)
    // No change history and no changelog handed to the build, even though
    // the repo has a CHANGELOG.md.
    expect(fs.existsSync(path.join(repo, "out/changes"))).toBe(false)
    expect(fs.existsSync(path.join(repo, "CHANGELOG.md"))).toBe(true)
    // No worktree was created, no cache written.
    expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1)
    expect(fs.existsSync(path.join(repo, "node_modules"))).toBe(false)
  })

  it("adds no env vars beyond today's set", () => {
    const repo = makeRepo()
    const env = buildEnvVars(load(repo))
    expect(Object.keys(env).filter((k) => /VERSION|BASE_PATH|CHANGELOG|RELEASES/.test(k))).toEqual([])
    expect(buildEnvVars(load(repo), {})).toEqual(env)
  })

  it("leaves next.config without a basePath", async () => {
    const previous = process.env.NEXT_PUBLIC_SHELL_BASE_PATH
    try {
      delete process.env.NEXT_PUBLIC_SHELL_BASE_PATH
      vi.resetModules()
      const plain = (await import("../next-app/next.config")).default
      expect("basePath" in plain).toBe(false)

      process.env.NEXT_PUBLIC_SHELL_BASE_PATH = "/v/1.0.0"
      vi.resetModules()
      const snapshot = (await import("../next-app/next.config")).default
      expect(snapshot.basePath).toBe("/v/1.0.0")
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SHELL_BASE_PATH
      else process.env.NEXT_PUBLIC_SHELL_BASE_PATH = previous
    }
  })
})

describe("releases page", () => {
  it("resolves the changelog only when the file exists, \"\" disabling it", () => {
    fs.writeFileSync(path.join(tmp, "CHANGELOG.md"), "# x\n")
    fs.mkdirSync(path.join(tmp, "docs"))
    fs.writeFileSync(path.join(tmp, "docs/HISTORY.md"), "# x\n")
    expect(changelogOption(tmp, undefined)).toEqual({ changelog: path.join(tmp, "CHANGELOG.md") })
    expect(changelogOption(tmp, "docs/HISTORY.md")).toEqual({ changelog: path.join(tmp, "docs/HISTORY.md") })
    expect(changelogOption(tmp, "missing.md")).toEqual({})
    expect(changelogOption(tmp, "docs")).toEqual({})
    expect(changelogOption(tmp, "")).toEqual({})
  })

  it("forwards the changelog to the Next app only when given", () => {
    const env = buildEnvVars(null, { changelog: "/x/CHANGELOG.md" })
    expect(env.SHELL_CHANGELOG_PATH).toBe("/x/CHANGELOG.md")
    expect(env.NEXT_PUBLIC_SHELL_RELEASES).toBe("1")
    expect(buildEnvVars(null, { versions: true }).NEXT_PUBLIC_SHELL_RELEASES).toBeUndefined()
  })

  it("drops the prerendered 404 of /releases from builds without a changelog", () => {
    fs.mkdirSync(path.join(tmp, "releases"))
    fs.writeFileSync(path.join(tmp, "releases/index.html"), "404")
    fs.writeFileSync(path.join(tmp, "releases.txt"), "rsc")
    fs.writeFileSync(path.join(tmp, "index.html"), "home")
    removeReleasesPage(tmp)
    expect(fs.readdirSync(tmp)).toEqual(["index.html"])
  })
})

describe("resolveInstallCommand", () => {
  it("uses an explicit command, where an empty one means skip", () => {
    expect(resolveInstallCommand("make deps", tmp, tmp)).toEqual({ command: "make deps", cwd: tmp })
    expect(resolveInstallCommand("", tmp, tmp)).toBeNull()
  })

  it("detects the package manager from the nearest lockfile up to the checkout root", () => {
    const pkg = path.join(tmp, "packages/ui")
    fs.mkdirSync(pkg, { recursive: true })
    fs.writeFileSync(path.join(pkg, "package.json"), "{}")
    expect(resolveInstallCommand(undefined, pkg, tmp)).toEqual({ command: "npm install", cwd: pkg })
    fs.writeFileSync(path.join(tmp, "pnpm-lock.yaml"), "")
    expect(resolveInstallCommand(undefined, pkg, tmp)).toEqual({
      command: "pnpm install --frozen-lockfile",
      cwd: tmp,
    })
    fs.writeFileSync(path.join(pkg, "package-lock.json"), "{}")
    expect(resolveInstallCommand(undefined, pkg, tmp)).toEqual({ command: "npm ci", cwd: pkg })
  })

  it("skips when there is nothing to install", () => {
    expect(resolveInstallCommand(undefined, tmp, tmp)).toBeNull()
  })
})
