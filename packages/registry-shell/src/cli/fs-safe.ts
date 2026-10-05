import fs from "node:fs"
import path from "node:path"

/**
 * File writes into the shell's own directory.
 *
 * When the shell is installed with pnpm, its files are hard links into the
 * content-addressable store shared by every project on the machine. Writing
 * into an existing file in place (`writeFileSync`, `copyFileSync`,
 * `cpSync({ force: true })`) changes the store copy, and with it the shell
 * of every other project using the same version. Removing the file first
 * breaks the link, so only this install's copy changes.
 */

/** Write `data` to `target`, replacing the file instead of writing into it. */
export function writeFileFresh(target: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.rmSync(target, { force: true, maxRetries: 5, retryDelay: 200 })
  fs.writeFileSync(target, data)
}

/** Copy every file under `srcDir` onto `destDir` (src wins), replacing files. */
export function overlayDir(srcDir: string, destDir: string): void {
  if (!fs.existsSync(srcDir)) return
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name)
    const dest = path.join(destDir, entry.name)
    if (entry.isDirectory()) {
      overlayDir(src, dest)
    } else if (entry.isFile()) {
      fs.mkdirSync(destDir, { recursive: true })
      fs.rmSync(dest, { force: true, maxRetries: 5, retryDelay: 200 })
      fs.copyFileSync(src, dest)
    }
  }
}

/** Relative path → contents of every file under `dir`. */
export function snapshotDir(dir: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>()
  if (!fs.existsSync(dir)) return files
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const entryRel = path.join(rel, entry.name)
      if (entry.isDirectory()) walk(entryRel)
      else files.set(entryRel, fs.readFileSync(path.join(dir, entryRel)))
    }
  }
  walk("")
  return files
}

/**
 * Bring `dir` back to the state captured by `snapshotDir`: delete files
 * the overlay added (and directories left empty by that), and restore the
 * shell's own files the overlay replaced (e.g. a user `favicon.ico`).
 */
export function restoreDir(dir: string, pristine: Map<string, Buffer>): void {
  if (!fs.existsSync(dir)) return
  const current = snapshotDir(dir)
  for (const [rel, contents] of current) {
    const original = pristine.get(rel)
    if (!original) {
      fs.rmSync(path.join(dir, rel), { force: true, maxRetries: 5, retryDelay: 200 })
    } else if (!original.equals(contents)) {
      writeFileFresh(path.join(dir, rel), original)
    }
  }
  // Files the overlay deleted can't exist (it only adds or replaces), but a
  // crashed run may have left a shell file missing: put it back.
  for (const [rel, original] of pristine) {
    if (!current.has(rel)) writeFileFresh(path.join(dir, rel), original)
  }
  const keepDirs = new Set<string>()
  for (const rel of pristine.keys()) {
    for (let d = path.dirname(rel); d !== "." && d !== ""; d = path.dirname(d)) keepDirs.add(d)
  }
  const prune = (rel: string): void => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const entryRel = path.join(rel, entry.name)
      prune(entryRel)
      if (!keepDirs.has(entryRel) && fs.readdirSync(path.join(dir, entryRel)).length === 0) {
        fs.rmSync(path.join(dir, entryRel), { recursive: true, force: true })
      }
    }
  }
  prune("")
}

/** Name of the manifest that remembers the shell's pristine public/ while an overlay is active. */
export const PUBLIC_MANIFEST = ".registry-shell-public.json"

function readManifest(file: string): Map<string, Buffer> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, string>
    return new Map(Object.entries(raw).map(([rel, b64]) => [rel, Buffer.from(b64, "base64")]))
  } catch {
    return null
  }
}

/**
 * Overlay the user's `public/` onto the shell's `public/` (user files win)
 * and return a function that undoes it.
 *
 * The shell's pristine `public/` is saved to a manifest next to it first, so
 * a run that never got to restore (a crash, a killed terminal) is cleaned up
 * at the start of the next `dev` or `build` instead of leaking one site's
 * files into the next.
 */
export function beginPublicOverlay(shellPublic: string, userPublic: string): () => void {
  const manifest = path.join(path.dirname(shellPublic), PUBLIC_MANIFEST)
  const leftover = fs.existsSync(manifest) ? readManifest(manifest) : null
  if (leftover) restoreDir(shellPublic, leftover)

  const pristine = snapshotDir(shellPublic)
  const encoded: Record<string, string> = {}
  for (const [rel, buf] of pristine) encoded[rel] = buf.toString("base64")
  writeFileFresh(manifest, JSON.stringify(encoded))

  overlayDir(userPublic, shellPublic)

  let restored = false
  return () => {
    if (restored) return
    restored = true
    restoreDir(shellPublic, pristine)
    fs.rmSync(manifest, { force: true })
  }
}
