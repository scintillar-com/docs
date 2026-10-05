/**
 * Versions taken from another repository (`versions.source`), against real
 * git repos: `fixtures/docs-external-source/{site,source}` are copied into
 * two temp repos and the source is tagged. `next build` is replaced by a
 * fake `buildSite` that records what each build saw; checkouts, the sync
 * command, caching, changelogs and `/versions.json` are the real thing.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { BuildSite } from "./build.js"
import { loadUserConfigFile, type LoadedConfig } from "./shared.js"
import { runVersionedBuild } from "./versioned-build.js"
import {
  expandSyncCommand,
  isRemoteRepo,
  linkNodeModules,
  sourceGitEnv,
  unlinkNodeModules,
} from "./version-source.js"
import type { VersionsManifest } from "./versions.js"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(HERE, "../../../../fixtures/docs-external-source")
const CONFIG = "docs-shell.config.mjs"
/** A bare environment for the git helpers (Next types NODE_ENV as required). */
const bareEnv = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv

let tmp: string

beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ds-source-test-")))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

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

function commitAll(repo: string, message: string): void {
  git(repo, "add", "-A")
  git(repo, "commit", "-q", "-m", message)
}

/**
 * Source history:
 *   v0.9.0, v1.0.0  intro "Version one."           (v0.9.0 is below minVersion)
 *   v1.1.0          + docs/guide.md, changelog 1.1.0 (annotated tag)
 *   v-next          a tag matching the glob with no version (ignored)
 *   (main)          unreleased work, changelog "1.2.0 (unreleased)"
 */
function makeSource(): string {
  const repo = path.join(tmp, "source")
  fs.cpSync(path.join(FIXTURE, "source"), repo, { recursive: true })
  git(repo, "-c", "init.defaultBranch=main", "init", "-q")
  commitAll(repo, "1.0.0")
  git(repo, "tag", "v0.9.0")
  git(repo, "tag", "v1.0.0")

  fs.writeFileSync(path.join(repo, "docs/intro.md"), "# Intro\n\nVersion one point one.\n")
  fs.writeFileSync(path.join(repo, "docs/guide.md"), "# Guide\n\nNew in 1.1.\n")
  fs.appendFileSync(path.join(repo, "CHANGELOG.md"), "\n## 1.1.0\n\n### Minor Changes\n\n- Add the guide.\n")
  commitAll(repo, "1.1.0")
  git(repo, "tag", "-a", "v1.1.0", "-m", "release 1.1.0")
  git(repo, "tag", "v-next")

  fs.appendFileSync(path.join(repo, "CHANGELOG.md"), "\n## 1.2.0 (unreleased)\n")
  fs.writeFileSync(path.join(repo, "docs/intro.md"), "# Intro\n\nUnreleased text.\n")
  commitAll(repo, "work in progress")
  return repo
}

function makeSite(configure?: (config: string) => string): string {
  const repo = path.join(tmp, "site")
  fs.cpSync(path.join(FIXTURE, "site"), repo, { recursive: true })
  if (configure) {
    const file = path.join(repo, CONFIG)
    fs.writeFileSync(file, configure(fs.readFileSync(file, "utf-8")))
  }
  git(repo, "-c", "init.defaultBranch=main", "init", "-q")
  commitAll(repo, "site")
  return repo
}

interface Seen {
  root: string
  basePath?: string
  version?: string
  docs: Record<string, string>
  changelog: string | null
}

/** Stand-in for `next build`: records the pages and changelog it was given. */
function fakeBuildSite(calls: Seen[]): BuildSite {
  return async (loaded, options) => {
    const docsDir = path.join(loaded.root, "content/docs")
    const docs: Record<string, string> = {}
    for (const f of fs.readdirSync(docsDir).sort()) docs[f] = fs.readFileSync(path.join(docsDir, f), "utf-8")
    const seen: Seen = {
      root: loaded.root,
      basePath: options.basePath,
      version: options.version,
      docs,
      changelog: options.changelog ? fs.readFileSync(options.changelog, "utf-8") : null,
    }
    calls.push(seen)
    fs.rmSync(options.outDir, { recursive: true, force: true })
    fs.mkdirSync(options.outDir, { recursive: true })
    fs.writeFileSync(path.join(options.outDir, "index.json"), JSON.stringify(seen))
  }
}

function load(site: string): LoadedConfig {
  return loadUserConfigFile(path.join(site, CONFIG))
}

async function build(site: string, calls: Seen[]): Promise<VersionsManifest> {
  return runVersionedBuild({
    loaded: load(site),
    args: [],
    buildSite: fakeBuildSite(calls),
    shellVersion: "test",
    tmpRoot: path.join(tmp, "work"),
  })
}

const readSeen = (site: string, version: string): Seen =>
  JSON.parse(fs.readFileSync(path.join(site, "out/v", version, "index.json"), "utf-8")) as Seen

const minVersion = (c: string) => c.replace("current: {", 'minVersion: "1.0.0",\n    current: {')

describe("versions from another repository", { timeout: 90_000 }, () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(tmp, "work"))
  })

  it("builds a snapshot per source tag from the committed site plus the synced pages", async () => {
    const source = makeSource()
    const site = makeSite(minVersion)
    // The real node_modules, which the snapshot checkouts link to.
    fs.mkdirSync(path.join(site, "node_modules"))
    fs.writeFileSync(path.join(site, "node_modules", "keep.txt"), "installed")

    const calls: Seen[] = []
    const manifest = await build(site, calls)

    // Root: the site's own (develop) pages, the source's changelog at HEAD.
    expect(calls[0]?.root).toBe(fs.realpathSync(site))
    expect(calls[0]?.basePath).toBeUndefined()
    expect(calls[0]?.docs["intro.mdx"]).toContain("Develop: synced from the main branch.")
    expect(calls[0]?.changelog).toContain("1.2.0 (unreleased)")

    // One snapshot per tag at or above minVersion, with the tag's pages.
    expect(calls.slice(1).map((c) => c.version)).toEqual(["1.1.0", "1.0.0"])
    const v11 = readSeen(site, "1.1.0")
    expect(Object.keys(v11.docs)).toEqual(["_source.json", "guide.mdx", "intro.mdx"])
    expect(v11.docs["intro.mdx"]).toContain("Version one point one.")
    expect(v11.basePath).toBe("/v/1.1.0")
    expect(v11.changelog).toContain("## 1.1.0")
    expect(v11.changelog).not.toContain("1.2.0")
    const v10 = readSeen(site, "1.0.0")
    expect(Object.keys(v10.docs)).toEqual(["_source.json", "intro.mdx"])
    expect(v10.changelog).not.toContain("1.1.0")

    // The sync got the tag, its commit and the checkout paths.
    const ref = JSON.parse(v11.docs["_source.json"]!) as Record<string, string>
    expect(ref.ref).toBe("v1.1.0")
    expect(ref.version).toBe("1.1.0")
    expect(ref.commit).toBe(git(source, "rev-parse", "v1.1.0^{commit}"))
    expect(ref.siteDir).not.toBe(site)

    expect(manifest.latest).toBe("1.1.0")
    expect(manifest.current).toEqual({ label: "develop" })
    expect(manifest.versions.map((v) => [v.version, v.source])).toEqual([
      ["1.1.0", { repo: "../source", ref: "v1.1.0", commit: ref.commit }],
      ["1.0.0", { repo: "../source", ref: "v1.0.0", commit: git(source, "rev-parse", "v1.0.0") }],
    ])
    expect(JSON.parse(fs.readFileSync(path.join(site, "out/versions.json"), "utf-8"))).toEqual(manifest)

    // Nothing left behind: no checkouts, the user's tree and node_modules intact.
    expect(git(site, "worktree", "list").split("\n")).toHaveLength(1)
    expect(git(source, "worktree", "list").split("\n")).toHaveLength(1)
    expect(fs.readdirSync(path.join(tmp, "work"))).toEqual([])
    expect(fs.readFileSync(path.join(site, "node_modules", "keep.txt"), "utf-8")).toBe("installed")
    expect(fs.readFileSync(path.join(site, "content/docs/intro.mdx"), "utf-8")).toContain("Develop")
    // The site's working tree is untouched (out/ and node_modules/ are ignored).
    expect(git(site, "status", "--porcelain")).toBe("")
  })

  it("rebuilds only what changed: a moved tag or new site files, not newly synced pages", async () => {
    const source = makeSource()
    const site = makeSite(minVersion)
    await build(site, [])

    // New develop pages synced into the site: snapshots stay cached.
    fs.writeFileSync(path.join(site, "content/docs/new.mdx"), "---\ntitle: New\n---\n\nNew.\n")
    commitAll(site, "sync develop")
    let calls: Seen[] = []
    await build(site, calls)
    expect(calls.map((c) => c.version)).toEqual([undefined])

    // A moved tag rebuilds that version only.
    git(source, "tag", "-f", "-a", "v1.1.0", "-m", "moved", "main")
    calls = []
    await build(site, calls)
    expect(calls.map((c) => c.version)).toEqual([undefined, "1.1.0"])
    expect(readSeen(site, "1.1.0").docs["intro.mdx"]).toContain("Unreleased text.")

    // A theme change rebuilds every version.
    fs.writeFileSync(path.join(site, "styles/theme.css"), ":root { --primary: #e11d48; }\n")
    commitAll(site, "theme")
    calls = []
    await build(site, calls)
    expect(calls.map((c) => c.version)).toEqual([undefined, "1.1.0", "1.0.0"])
  })

  it("clones a repository given by URL into the cache, and fetches new tags", async () => {
    const source = makeSource()
    const url = pathToFileURL(source).href
    const site = makeSite((c) => minVersion(c).replace('repo: "../source"', `repo: ${JSON.stringify(url)}`))

    const manifest = await build(site, [])
    expect(manifest.versions.map((v) => v.version)).toEqual(["1.1.0", "1.0.0"])
    expect(manifest.versions[0]?.source?.repo).toBe(url)
    const cached = path.join(site, "node_modules/.cache/registry-shell/versions/source.git")
    expect(fs.existsSync(cached)).toBe(true)

    git(source, "tag", "v1.2.0")
    const calls: Seen[] = []
    const next = await build(site, calls)
    expect(next.latest).toBe("1.2.0")
    expect(calls.map((c) => c.version)).toEqual([undefined, "1.2.0"])
  })

  it("fails clearly without a committed config, or with an empty token variable", async () => {
    makeSource()
    const site = makeSite()
    // On disk (so it loads) but not committed.
    git(site, "rm", "-q", "--cached", CONFIG)
    git(site, "commit", "-q", "-m", "untrack config")
    await expect(build(site, [])).rejects.toThrow(/config file isn't committed/)

    expect(() => sourceGitEnv("DOCS_SHELL_TEST_MISSING_TOKEN", bareEnv({}))).toThrow(/empty or unset/)
  })
})

describe("version-source helpers", () => {
  it("tells URLs from local paths", () => {
    expect(isRemoteRepo("https://github.com/org/app.git")).toBe(true)
    expect(isRemoteRepo("git@github.com:org/app.git")).toBe(true)
    expect(isRemoteRepo("file:///c/repos/app")).toBe(true)
    expect(isRemoteRepo("../app")).toBe(false)
    expect(isRemoteRepo("C:\\repos\\app")).toBe(false)
  })

  it("passes a token as a git config header, appended to existing ones", () => {
    const env = sourceGitEnv("TOKEN", bareEnv({ TOKEN: "s3cret", GIT_CONFIG_COUNT: "1" }))
    expect(env.GIT_TERMINAL_PROMPT).toBe("0")
    expect(env.GIT_CONFIG_COUNT).toBe("2")
    expect(env.GIT_CONFIG_KEY_1).toBe("http.extraHeader")
    expect(env.GIT_CONFIG_VALUE_1).toBe(
      `Authorization: Basic ${Buffer.from("x-access-token:s3cret").toString("base64")}`,
    )
    expect(sourceGitEnv(undefined, bareEnv({})).GIT_CONFIG_COUNT).toBeUndefined()
  })

  it("quotes the checkout paths in the sync command", () => {
    expect(expandSyncCommand("node sync.mjs --source {sourceDir} --out {siteDir}/content", {
      sourceDir: "/tmp/a b/source",
      siteDir: "/tmp/a b/site",
    })).toBe('node sync.mjs --source "/tmp/a b/source" --out "/tmp/a b/site"/content')
  })

  it("links node_modules and unlinks it without touching the target", () => {
    const from = path.join(tmp, "from")
    const into = path.join(tmp, "into")
    fs.mkdirSync(path.join(from, "node_modules", "pkg"), { recursive: true })
    fs.writeFileSync(path.join(from, "node_modules", "pkg", "index.js"), "x")
    fs.mkdirSync(into)
    linkNodeModules(from, into)
    expect(fs.readFileSync(path.join(into, "node_modules", "pkg", "index.js"), "utf-8")).toBe("x")
    unlinkNodeModules(into)
    expect(fs.existsSync(path.join(into, "node_modules"))).toBe(false)
    expect(fs.existsSync(path.join(from, "node_modules", "pkg", "index.js"))).toBe(true)
  })
})
