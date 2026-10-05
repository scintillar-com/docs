/**
 * Versions taken from another repository (`versions.source`): getting the
 * source repository, reading files at a tag, running the site's sync
 * command, and the site half of the snapshot cache key. The orchestration
 * lives in `versioned-build.ts`.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { execFileSync } from "node:child_process"

/** A source repository ready for `git tag`, `git show` and `git worktree`. */
export interface PreparedSource {
  /** Repository to run git in (a local clone, or the cached bare clone). */
  gitDir: string
  /** Environment for git commands against it (auth header, no prompts). */
  env: NodeJS.ProcessEnv
}

/** A URL or scp-style address (`git@host:org/repo`), as opposed to a local path. */
export function isRemoteRepo(repo: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(repo) || /^[\w.-]+@[\w.-]+:/.test(repo)
}

/**
 * Environment for git against the source: never prompt for credentials (a
 * private repository without a token fails at once instead of hanging the
 * build), and, with `tokenEnv`, send the token as an HTTP header through
 * `GIT_CONFIG_*` variables, so it is neither on a command line nor in a
 * file.
 */
export function sourceGitEnv(
  tokenEnv: string | undefined,
  base: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base, GIT_TERMINAL_PROMPT: "0" }
  if (!tokenEnv) return env
  const token = base[tokenEnv]
  if (!token) {
    throw new Error(
      `[docs-shell] versions.source.tokenEnv is "${tokenEnv}" but that environment variable is empty or unset.`,
    )
  }
  const index = Number(base.GIT_CONFIG_COUNT ?? 0) || 0
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64")
  env.GIT_CONFIG_COUNT = String(index + 1)
  env[`GIT_CONFIG_KEY_${index}`] = "http.extraHeader"
  env[`GIT_CONFIG_VALUE_${index}`] = `Authorization: Basic ${basic}`
  return env
}

/**
 * Make the source repository available. A local path is used as it is; a
 * URL is cloned once into `<cacheDir>/source.git` (bare, file contents
 * fetched only when a tag is checked out), then fetched on each build so
 * new and moved tags are seen.
 */
export function prepareSource(
  repo: string,
  configRoot: string,
  cacheDir: string,
  tokenEnv: string | undefined,
): PreparedSource {
  const env = sourceGitEnv(tokenEnv)
  if (!isRemoteRepo(repo)) {
    const local = path.resolve(configRoot, repo)
    if (!fs.existsSync(local)) {
      throw new Error(`[docs-shell] versions.source.repo: ${local} doesn't exist.`)
    }
    try {
      git(local, ["rev-parse", "--git-dir"], env)
    } catch {
      throw new Error(`[docs-shell] versions.source.repo: ${local} isn't a git repository.`)
    }
    return { gitDir: local, env }
  }

  const gitDir = path.join(cacheDir, "source.git")
  const marker = path.join(gitDir, "docs-shell-source.txt")
  const fail = (err: unknown, action: string): never => {
    const detail = (err as { stderr?: Buffer | string }).stderr?.toString().trim() || (err as Error).message
    throw new Error(
      `[docs-shell] versions.source: couldn't ${action} ${repo}.` +
        (tokenEnv
          ? ""
          : " If the repository is private, give a read token through versions.source.tokenEnv.") +
        `\n${detail}`,
    )
  }
  // A cache from another repo (the config changed) is dropped, not reused.
  if (fs.existsSync(gitDir) && readText(marker) !== repo) {
    fs.rmSync(gitDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
  if (!fs.existsSync(gitDir)) {
    fs.mkdirSync(path.dirname(gitDir), { recursive: true })
    try {
      git(path.dirname(gitDir), ["clone", "--bare", "--filter=blob:none", "--quiet", repo, gitDir], env)
    } catch (err) {
      fs.rmSync(gitDir, { recursive: true, force: true })
      fail(err, "clone")
    }
    fs.writeFileSync(marker, repo)
  } else {
    try {
      // Branches mirrored, tags forced (a moved tag must be seen), stale
      // ones pruned.
      git(
        gitDir,
        ["fetch", "--quiet", "--force", "--prune", "--prune-tags", "--tags", "origin", "+refs/heads/*:refs/heads/*"],
        env,
      )
    } catch (err) {
      fail(err, "fetch")
    }
  }
  return { gitDir, env }
}

/** A file's content at `commit` in the source, or null when it isn't there. */
export function readFileAtCommit(
  source: PreparedSource,
  commit: string,
  relPath: string,
): string | null {
  try {
    return git(source.gitDir, ["show", `${commit}:${relPath.replace(/\\/g, "/").replace(/^\.\//, "")}`], source.env)
  } catch {
    return null
  }
}

/** The commit `ref` points at in the source, or null. */
export function resolveRef(source: PreparedSource, ref: string): string | null {
  try {
    return git(source.gitDir, ["rev-parse", "--verify", `${ref}^{commit}`], source.env).trim()
  } catch {
    return null
  }
}

/**
 * The site's half of the snapshot cache key: a hash of the committed files
 * under the site folder (`git ls-tree` at HEAD, so contents by blob id),
 * leaving out what the sync writes. Editing the theme, the config or the
 * sync script changes it; syncing new pages into the docs folder doesn't.
 */
export function siteInputsHash(repoRoot: string, siteRel: string, excludeRel: string[]): string {
  const prefix = siteRel ? `${toPosix(siteRel)}/` : ""
  const excluded = excludeRel
    .map((p) => toPosix(path.posix.normalize(toPosix(p))).replace(/\/$/, ""))
    .filter((p) => p && p !== ".")
    .map((p) => `${prefix}${p}`)
  const listing = git(repoRoot, ["ls-tree", "-r", "--full-tree", "HEAD", ...(siteRel ? ["--", toPosix(siteRel)] : [])])
  const kept = listing
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      const file = line.slice(line.indexOf("\t") + 1)
      return !excluded.some((p) => file === p || file.startsWith(`${p}/`))
    })
  return crypto.createHash("sha256").update(kept.join("\n")).digest("hex").slice(0, 16)
}

/** `sync` with `{sourceDir}` / `{siteDir}` replaced by quoted paths. */
export function expandSyncCommand(command: string, dirs: { sourceDir: string; siteDir: string }): string {
  const quote = (p: string) => `"${p.replace(/"/g, '\\"')}"`
  return command
    .replace(/\{sourceDir\}/g, quote(dirs.sourceDir))
    .replace(/\{siteDir\}/g, quote(dirs.siteDir))
}

/**
 * Point `dir/node_modules` at the installed one, so a site checkout builds
 * without installing anything (a junction on Windows: no admin rights
 * needed). Does nothing when `from` has no `node_modules`.
 */
export function linkNodeModules(from: string, dir: string): void {
  const target = path.join(from, "node_modules")
  const link = path.join(dir, "node_modules")
  if (!fs.existsSync(target) || fs.existsSync(link)) return
  fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir")
}

/**
 * Remove a link made by {@link linkNodeModules}, before the checkout is
 * deleted: removing the link itself, never what it points at (deleting the
 * checkout recursively must not reach into the real `node_modules`).
 */
export function unlinkNodeModules(dir: string): void {
  const link = path.join(dir, "node_modules")
  let stat: fs.Stats
  try {
    stat = fs.lstatSync(link)
  } catch {
    return
  }
  if (stat.isSymbolicLink()) fs.unlinkSync(link)
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync("git", args, { cwd, env, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] })
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf-8").trim()
  } catch {
    return null
  }
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/")
}
