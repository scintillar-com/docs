/**
 * Makes Next's own reads and writes of the top-level `.next/*-manifest.json`
 * files safe under concurrency. Installed by `next-dev-preload.ts`, which
 * `registry-shell dev` loads into the `next dev` process tree with
 * `node --import`.
 *
 * Why: in dev, Next resolves `generateStaticParams` per dynamic route on its
 * first request and then does a read-modify-write of
 * `.next/prerender-manifest.json` with plain `fs.promises.readFile` +
 * `writeFile` (next/dist/server/dev/next-dev-server.js, Next 15.5). The
 * shell's preview routes all use `generateStaticParams` (required by
 * `output: "export"`), so on a cold server, concurrent first requests to
 * `/preview/<a>` and `/preview-snapshot/<b>` overlap: one request reads the
 * manifest while another has just truncated it, `JSON.parse("")` throws
 * "Unexpected end of JSON input" and that request renders a 500. Two
 * overlapping writes can also interleave and leave the file corrupt for
 * the rest of the session ("Unexpected non-whitespace character after
 * JSON").
 *
 * Two layers:
 *  - Within the process (where Next does all of this), reads and writes of
 *    the same manifest are serialized, so a read never overlaps a write and
 *    writes never interleave. This also matters on Windows, where renaming
 *    over a file that a reader has open fails with EPERM.
 *  - Writes go to a temp file + rename, so a reader in another process sees
 *    the old or the new file, never a truncated one.
 *
 * Scope is deliberately narrow: only `fs.promises.readFile` / `writeFile`
 * with a string path to `<...>/.next/<name>-manifest.json`. Everything else
 * passes through untouched.
 */
import fs from "node:fs"
import path from "node:path"
import { writeFileAtomic } from "./atomic-write.js"

/** True for top-level Next dist manifests, e.g. `.next/prerender-manifest.json`. */
export function isNextManifestPath(file: unknown): file is string {
  return typeof file === "string" && /[\\/]\.next[\\/][^\\/]+-manifest\.json$/.test(file)
}

type ReadFileAsync = typeof fs.promises.readFile
type WriteFileAsync = typeof fs.promises.writeFile
type LooseReadFile = (file: unknown, options?: unknown) => Promise<unknown>

/** Per-key FIFO: each operation starts once the previous one has settled. */
export function createKeyedQueue() {
  const tails = new Map<string, Promise<unknown>>()
  return function run<T>(key: string, op: () => Promise<T>): Promise<T> {
    const prev = tails.get(key) ?? Promise.resolve()
    const result = prev.then(op, op)
    const tail = result.catch(() => {})
    tails.set(key, tail)
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key)
    })
    return result
  }
}

const PATCHED = Symbol.for("registry-shell.atomic-manifest-writes")

/** Patch `promises.readFile` / `promises.writeFile`. Idempotent. */
export function installAtomicManifestWrites(promises: typeof fs.promises = fs.promises): void {
  const holder = promises as typeof fs.promises & { [PATCHED]?: true }
  if (holder[PATCHED]) return
  const originalRead = promises.readFile.bind(promises) as LooseReadFile
  const originalWrite: WriteFileAsync = promises.writeFile.bind(promises)
  const queue = createKeyedQueue()
  // Windows paths are case-insensitive and may mix separators.
  const keyOf = (file: string) => path.resolve(file).toLowerCase()

  const readFile = ((file: unknown, options?: unknown) => {
    if (!isNextManifestPath(file)) return originalRead(file, options)
    return queue(keyOf(file), () => originalRead(file, options))
  }) as ReadFileAsync

  const writeFile = ((file, data, options) => {
    const flag =
      typeof options === "object" && options !== null && "flag" in options
        ? options.flag
        : undefined
    if (!isNextManifestPath(file) || (flag !== undefined && flag !== "w")) {
      return originalWrite(file, data, options)
    }
    return queue(keyOf(file), () => writeFileAtomic(file, data, options, originalWrite))
  }) as WriteFileAsync

  promises.readFile = readFile
  promises.writeFile = writeFile
  holder[PATCHED] = true
}
