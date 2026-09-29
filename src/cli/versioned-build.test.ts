/**
 * End-to-end check of the versioned build's orchestration against a real
 * git repo: `test-fixtures/versioned-registry` is copied into a temp dir,
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
import { buildRegistry, type BuildSite, type BuildSiteOptions } from "./build.js"
import { buildEnvVars, loadUserConfigFile, type LoadedConfig } from "./shared.js"
import { resolveInstallCommand, runVersionedBuild } from "./versioned-build.js"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, "../../test-fixtures/versioned-registry")
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
 *   v0.2.0  hello says "Hello v0.2", adds docs/extra.mdx
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

describe("versioned build (fixture registry with two release tags)", () => {
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
    // No worktree was created, no cache written.
    expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1)
    expect(fs.existsSync(path.join(repo, "node_modules"))).toBe(false)
  })

  it("adds no env vars beyond today's set", () => {
    const repo = makeRepo()
    const env = buildEnvVars(load(repo))
    expect(Object.keys(env).filter((k) => /VERSION|BASE_PATH/.test(k))).toEqual([])
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
