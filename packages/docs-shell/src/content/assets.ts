import fs from "node:fs"
import path from "node:path"

export interface CopyAssetsOptions {
  /** Which files to copy. Default: images (png, jpg, jpeg, gif, svg, webp, avif). */
  filter?: (file: string) => boolean
  /**
   * Copy every file into `to` directly (default), so a page links to
   * `/<prefix>/<file name>` whatever folder it sits in, or keep the
   * subfolders (`false`). Flattening needs unique file names: a clash throws.
   */
  flatten?: boolean
}

const IMAGE = /\.(png|jpe?g|gif|svg|webp|avif)$/i

/**
 * Copies a source repository's doc assets into the site's `public/`
 * folder (e.g. `docs/assets` → `public/docs-assets`). Returns the number of
 * files copied; a missing source folder copies nothing. Existing files are
 * replaced (removed first, so a hardlinked copy is never written through).
 */
export function copyAssets(from: string, to: string, options: CopyAssetsOptions = {}): number {
  const { filter = (f: string) => IMAGE.test(f), flatten = true } = options
  if (!fs.existsSync(from)) return 0
  const seen = new Map<string, string>()
  let copied = 0

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(abs)
        continue
      }
      if (!entry.isFile() || !filter(abs)) continue
      const rel = flatten ? entry.name : path.relative(from, abs)
      const clash = seen.get(rel)
      if (clash) throw new Error(`copyAssets: ${abs} and ${clash} would both be copied to ${rel}`)
      seen.set(rel, abs)
      const dest = path.join(to, rel)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.rmSync(dest, { force: true })
      fs.copyFileSync(abs, dest)
      copied++
    }
  }
  walk(from)
  return copied
}
