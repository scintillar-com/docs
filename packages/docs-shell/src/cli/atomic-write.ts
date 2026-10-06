/**
 * Atomic file writes: write the full content to a temp file in the same
 * directory, then `rename` it over the target. A concurrent reader sees
 * either the old file or the new one, never an empty or half-written file
 * (which is what `fs.writeFile` exposes between its truncate and its write).
 *
 * The temp file lives next to the target so the rename stays on one
 * filesystem. On Windows, `rename` over a file another process holds open
 * without delete-sharing (antivirus, indexers) fails with EPERM/EACCES/EBUSY
 * for a moment, so the rename is retried briefly. If it still fails, the
 * content is written in place: that loses the atomicity but never loses the
 * write, which matches what callers had before.
 */
import fs from "node:fs"
import path from "node:path"

type WriteData = Parameters<typeof fs.promises.writeFile>[1]
type WriteOptions = Parameters<typeof fs.promises.writeFile>[2]
type WriteFileAsync = typeof fs.promises.writeFile

const RETRYABLE = new Set(["EPERM", "EACCES", "EBUSY"])
const RENAME_ATTEMPTS = 6
const RENAME_DELAY_MS = 25

let counter = 0

/** Unique sibling temp path for `file`. Exported for tests. */
export function tempPathFor(file: string): string {
  counter = (counter + 1) % 1_000_000
  const rand = Math.random().toString(36).slice(2, 8)
  return path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${counter}.${rand}.tmp`,
  )
}

function isRetryable(err: unknown): boolean {
  return RETRYABLE.has((err as NodeJS.ErrnoException)?.code ?? "")
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Async atomic write. `writeFileImpl` lets the dev preload pass the
 * original, un-patched `fs.promises.writeFile`.
 */
export async function writeFileAtomic(
  file: string,
  data: WriteData,
  options?: WriteOptions,
  writeFileImpl: WriteFileAsync = fs.promises.writeFile,
): Promise<void> {
  const tmp = tempPathFor(file)
  try {
    await writeFileImpl(tmp, data, options)
  } catch (err) {
    await fs.promises.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
  for (let attempt = 1; ; attempt++) {
    try {
      await fs.promises.rename(tmp, file)
      return
    } catch (err) {
      if (isRetryable(err) && attempt < RENAME_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, RENAME_DELAY_MS * attempt))
        continue
      }
      await fs.promises.rm(tmp, { force: true }).catch(() => {})
      if (!isRetryable(err)) throw err
      // Target stayed locked: fall back to a plain (non-atomic) write.
      await writeFileImpl(file, data, options)
      return
    }
  }
}

/** Sync atomic write, same contract as `fs.writeFileSync`. */
export function writeFileAtomicSync(
  file: string,
  data: string | NodeJS.ArrayBufferView,
  options?: fs.WriteFileOptions,
): void {
  const tmp = tempPathFor(file)
  try {
    fs.writeFileSync(tmp, data, options)
  } catch (err) {
    fs.rmSync(tmp, { force: true })
    throw err
  }
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(tmp, file)
      return
    } catch (err) {
      if (isRetryable(err) && attempt < RENAME_ATTEMPTS) {
        sleepSync(RENAME_DELAY_MS * attempt)
        continue
      }
      fs.rmSync(tmp, { force: true })
      if (!isRetryable(err)) throw err
      // Remove before writing, like fs-safe's writeFileFresh: a file in the
      // shell's own directory may be a hard link into the pnpm store.
      fs.rmSync(file, { force: true, maxRetries: 5, retryDelay: 200 })
      fs.writeFileSync(file, data, options)
      return
    }
  }
}

