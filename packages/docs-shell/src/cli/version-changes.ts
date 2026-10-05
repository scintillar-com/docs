/**
 * Per-component change history for the versioned build's "Changes" tab.
 *
 * After every snapshot is in place, `runVersionedBuild` reads each version's
 * registry JSON (the same files published under `/r/v<version>/`, plus the
 * working tree's for the latest site) and writes one index per registry
 * item to `/changes/<name>.json` at the SITE ROOT:
 *
 *   {
 *     "name": "button",
 *     "versions": [                         // oldest first; "" = latest site
 *       { "version": "0.1.0", "files": null },          // item absent
 *       { "version": "1.0.0", "files": { "components/ui/button.tsx": "<hash>", "$item": "<hash>" } },
 *       { "version": "",      "files": { ... } }
 *     ],
 *     "blobs": { "<hash>": "<file content>" }            // each distinct content once
 *   }
 *
 * `files` maps each registry file path to a content hash; the `$item` entry
 * is the item's metadata (everything but file contents: dependencies,
 * registryDependencies, cssVars, file targets...) as pretty JSON, so a
 * dependency bump shows up as a change too. Contents are deduplicated, so
 * an item that never changes costs one copy of its files whatever the
 * number of releases.
 *
 * The browser diffs whichever two versions the reader picks (see
 * `next-app/lib/changes.ts`). Like `/versions.json`, the index lives at the
 * root and is regenerated on every deploy, so cached snapshots of old
 * versions still see later releases.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

export const CHANGES_DIR = "changes"
/** Pseudo file path holding an item's metadata. */
export const METADATA_FILE = "$item"

/** Mirrored by `ChangeIndex` in src/next-app/lib/changes.ts. */
export interface ChangeIndex {
  name: string
  versions: Array<{ version: string; files: Record<string, string> | null }>
  blobs: Record<string, string>
}

/** One version's registry JSON directory. `version: ""` = the latest site. */
export interface RegistrySource {
  version: string
  dir: string
}

/**
 * Registry item → `{ path: content }`, including the `$item` metadata
 * pseudo file. Null when the JSON isn't a registry item (e.g. the
 * `registry.json` index `shadcn build` also writes).
 */
export function normaliseItem(item: unknown): Record<string, string> | null {
  if (!item || typeof item !== "object") return null
  const record = item as Record<string, unknown>
  if (!Array.isArray(record.files)) return null

  const files: Record<string, string> = {}
  const fileMeta: unknown[] = []
  record.files.forEach((file, i) => {
    if (!file || typeof file !== "object") return
    const { content, ...meta } = file as Record<string, unknown>
    fileMeta.push(meta)
    const filePath = typeof meta.path === "string" && meta.path ? meta.path : `file-${i + 1}`
    if (typeof content === "string") files[filePath] = normaliseNewlines(content)
  })

  // `$schema` is boilerplate that changes with the tooling, not the item.
  const { $schema: _schema, files: _files, ...rest } = record
  files[METADATA_FILE] = JSON.stringify({ ...rest, files: fileMeta }, null, 2) + "\n"
  return files
}

function normaliseNewlines(text: string): string {
  return text.replace(/\r\n?/g, "\n")
}

/** Items of one registry JSON dir (top level only; frozen `v*` subdirs are skipped). */
export function readRegistryItems(dir: string): Map<string, Record<string, string>> {
  const items = new Map<string, Record<string, string>>()
  if (!fs.existsSync(dir)) return items
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue
    let json: unknown
    try {
      json = JSON.parse(fs.readFileSync(path.join(dir, entry.name), "utf-8"))
    } catch {
      continue
    }
    const files = normaliseItem(json)
    if (files) items.set(entry.name.slice(0, -".json".length), files)
  }
  return items
}

export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16)
}

/**
 * Build one index per item found in any source. `sources` must be ordered
 * oldest first (the latest site, if included, last).
 */
export function buildChangeIndexes(
  sources: Array<{ version: string; items: Map<string, Record<string, string>> }>,
): ChangeIndex[] {
  const names = new Set<string>()
  for (const s of sources) for (const name of s.items.keys()) names.add(name)

  return [...names].sort().map((name) => {
    const blobs: Record<string, string> = {}
    const versions = sources.map(({ version, items }) => {
      const files = items.get(name)
      if (!files) return { version, files: null }
      const hashed: Record<string, string> = {}
      for (const [filePath, content] of Object.entries(files)) {
        const hash = hashContent(content)
        blobs[hash] = content
        hashed[filePath] = hash
      }
      return { version, files: hashed }
    })
    return { name, versions, blobs }
  })
}

/** Read every source and write `<outDir>/changes/<name>.json`. Returns the item count. */
export function writeChangeIndexes(outDir: string, sources: RegistrySource[]): number {
  const indexes = buildChangeIndexes(
    sources
      .filter((s) => fs.existsSync(s.dir))
      .map((s) => ({ version: s.version, items: readRegistryItems(s.dir) })),
  )
  const dir = path.join(outDir, CHANGES_DIR)
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  if (indexes.length === 0) return 0
  fs.mkdirSync(dir, { recursive: true })
  for (const index of indexes) {
    fs.writeFileSync(path.join(dir, `${index.name}.json`), JSON.stringify(index) + "\n", "utf-8")
  }
  return indexes.length
}
