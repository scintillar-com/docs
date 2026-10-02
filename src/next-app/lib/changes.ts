/**
 * Client side of the "Changes" tab: compares a registry item between two
 * versions using the build-time index at `/changes/<name>.json` (written by
 * src/cli/version-changes.ts), and produces a unified line diff.
 *
 * The index holds every version's file hashes plus each distinct content
 * once, so any pair of versions can be compared after a single fetch, and
 * "unchanged since" / "added in" are answered from the hashes alone.
 * Everything here is pure; the component only fetches and renders.
 */

/** Mirrors `ChangeIndex` in src/cli/version-changes.ts (the file this reads). */
export interface ChangeIndex {
  name: string
  /** Oldest first. `version: ""` is the latest site (working tree). `files: null` = item absent. */
  versions: Array<{ version: string; files: Record<string, string> | null }>
  blobs: Record<string, string>
}

/** Pseudo file path of the item's metadata (dependencies, targets...). */
export const METADATA_FILE = "$item"

/** Always at the site root, whatever the current build's base path. */
export function changeIndexUrl(name: string): string {
  return `/changes/${encodeURIComponent(name)}.json`
}

// -- Line diff ------------------------------------------------------------

export type DiffOpType = "equal" | "add" | "remove"

export interface DiffOp {
  type: DiffOpType
  text: string
}

export interface DiffLine extends DiffOp {
  /** 1-based line number in the old text (absent for additions). */
  oldNo?: number
  /** 1-based line number in the new text (absent for removals). */
  newNo?: number
}

export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

/** Split into lines; a trailing newline doesn't produce an empty last line. */
export function splitLines(text: string): string[] {
  if (text === "") return []
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

/**
 * Beyond this many edits the changed middle is shown as a full replacement
 * instead of a minimal diff, which keeps a rewritten 10k-line file from
 * costing quadratic memory in the browser.
 */
export const MAX_EDIT_DISTANCE = 2000

/** Minimal line diff (Myers' O(ND) algorithm) between `a` and `b`. */
export function diffLines(a: string[], b: string[], maxEdits = MAX_EDIT_DISTANCE): DiffOp[] {
  // Common prefix / suffix are cheap and usually most of the file.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const equal = (text: string): DiffOp => ({ type: "equal", text })
  return [
    ...a.slice(0, start).map(equal),
    ...myers(a.slice(start, endA), b.slice(start, endB), maxEdits),
    ...a.slice(endA).map(equal),
  ]
}

function myers(a: string[], b: string[], maxEdits: number): DiffOp[] {
  const n = a.length
  const m = b.length
  const replaceAll = (): DiffOp[] => [
    ...a.map((text): DiffOp => ({ type: "remove", text })),
    ...b.map((text): DiffOp => ({ type: "add", text })),
  ]
  if (n === 0 || m === 0) return replaceAll()

  const max = Math.min(n + m, maxEdits)
  const offset = max + 1
  // v[offset + k] = furthest x reached on diagonal k; trace[d] = v before step d.
  let v = new Int32Array(2 * max + 3)
  const trace: Int32Array[] = []
  let found = -1

  outer: for (let d = 0; d <= max; d++) {
    trace.push(v)
    v = v.slice()
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
          ? v[offset + k + 1]
          : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        found = d
        break outer
      }
    }
  }
  if (found < 0) return replaceAll()

  // Walk the trace backwards from (n, m) to (0, 0).
  const ops: DiffOp[] = []
  let x = n
  let y = m
  for (let d = found; d >= 0; d--) {
    const prev = trace[d]
    const k = x - y
    const prevK =
      k === -d || (k !== d && prev[offset + k - 1] < prev[offset + k + 1]) ? k + 1 : k - 1
    const prevX = prev[offset + prevK]
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", text: a[x - 1] })
      x--
      y--
    }
    if (d > 0) {
      if (x === prevX) ops.push({ type: "add", text: b[y - 1] })
      else ops.push({ type: "remove", text: a[x - 1] })
    }
    x = prevX
    y = prevY
  }
  return ops.reverse()
}

/** Group a diff into unified-diff hunks with `context` unchanged lines around changes. */
export function toHunks(ops: DiffOp[], context = 3): Hunk[] {
  // Number every line first.
  const lines: DiffLine[] = []
  let oldNo = 0
  let newNo = 0
  for (const op of ops) {
    if (op.type === "equal") lines.push({ ...op, oldNo: ++oldNo, newNo: ++newNo })
    else if (op.type === "remove") lines.push({ ...op, oldNo: ++oldNo })
    else lines.push({ ...op, newNo: ++newNo })
  }

  // Ranges of lines to show: every change widened by `context`, merged when
  // they touch.
  const ranges: Array<[number, number]> = []
  lines.forEach((line, i) => {
    if (line.type === "equal") return
    const from = Math.max(0, i - context)
    const to = Math.min(lines.length, i + context + 1)
    const last = ranges[ranges.length - 1]
    if (last && from <= last[1]) last[1] = Math.max(last[1], to)
    else ranges.push([from, to])
  })

  return ranges.map(([from, to]) => {
    const slice = lines.slice(from, to)
    const before = lines.slice(0, from)
    const oldBefore = before.filter((l) => l.type !== "add").length
    const newBefore = before.filter((l) => l.type !== "remove").length
    const oldLines = slice.filter((l) => l.type !== "add").length
    const newLines = slice.filter((l) => l.type !== "remove").length
    return {
      oldStart: oldLines > 0 ? oldBefore + 1 : oldBefore,
      oldLines,
      newStart: newLines > 0 ? newBefore + 1 : newBefore,
      newLines,
      lines: slice,
    }
  })
}

/** `@@ -1,4 +1,5 @@` header of a hunk. */
export function hunkHeader(h: Hunk): string {
  return `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`
}

// -- Version comparison ---------------------------------------------------

export type FileStatus = "added" | "removed" | "modified"

export interface FileChange {
  path: string
  status: FileStatus
  additions: number
  deletions: number
  hunks: Hunk[]
}

export type ComparisonStatus =
  /** Same content in both versions. */
  | "unchanged"
  | "changed"
  /** Absent in `from`, present in `to`. */
  | "added"
  /** Present in `from`, absent in `to`. */
  | "removed"
  /** Absent in both (or unknown versions). */
  | "missing"

export interface Comparison {
  status: ComparisonStatus
  /**
   * "unchanged": first version of the unbroken run of identical content
   * that ends at `to` and covers `from` ("Unchanged since vX"). Absent when
   * the content changed in between and changed back.
   */
  since?: string
  /** "added": first version of the unbroken run of presence ending at `to`. */
  addedIn?: string
  files: FileChange[]
  additions: number
  deletions: number
}

type FileMap = Record<string, string> | null

function entryIndex(index: ChangeIndex, version: string | null): number {
  if (version === null) return -1
  return index.versions.findIndex((v) => v.version === version)
}

function sameFiles(a: FileMap, b: FileMap): boolean {
  if (!a || !b) return a === b
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((k) => a[k] === b[k])
}

/** Position of the first entry of the unbroken run ending at `i` where `pred` holds. */
function runStart(index: ChangeIndex, i: number, pred: (files: FileMap) => boolean): number {
  let start = i
  while (start > 0 && pred(index.versions[start - 1].files)) start--
  return start
}

/** Real files in listing order, then the metadata pseudo file. */
function orderedPaths(a: FileMap, b: FileMap): string[] {
  const paths = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])]
  return [
    ...paths.filter((p) => p !== METADATA_FILE),
    ...paths.filter((p) => p === METADATA_FILE),
  ]
}

/**
 * Compare the item between two versions of the index (`""` = latest site).
 * `from: null` compares against nothing, e.g. for the very first release.
 */
export function compareItem(
  index: ChangeIndex,
  from: string | null,
  to: string,
  context = 3,
): Comparison {
  const fromIdx = entryIndex(index, from)
  const toIdx = entryIndex(index, to)
  const before: FileMap = fromIdx >= 0 ? index.versions[fromIdx].files : null
  const after: FileMap = toIdx >= 0 ? index.versions[toIdx].files : null

  const files: FileChange[] = []
  for (const filePath of orderedPaths(before, after)) {
    const oldHash = before?.[filePath]
    const newHash = after?.[filePath]
    if (oldHash === newHash) continue
    const ops = diffLines(
      splitLines(oldHash ? index.blobs[oldHash] ?? "" : ""),
      splitLines(newHash ? index.blobs[newHash] ?? "" : ""),
    )
    files.push({
      path: filePath,
      status: !oldHash ? "added" : !newHash ? "removed" : "modified",
      additions: ops.filter((o) => o.type === "add").length,
      deletions: ops.filter((o) => o.type === "remove").length,
      hunks: toHunks(ops, context),
    })
  }
  const additions = files.reduce((sum, f) => sum + f.additions, 0)
  const deletions = files.reduce((sum, f) => sum + f.deletions, 0)
  const result = { files, additions, deletions }

  if (!before && !after) return { status: "missing", ...result }
  if (!before) {
    const start = runStart(index, toIdx, (f) => f !== null)
    return { status: "added", addedIn: index.versions[start].version, ...result }
  }
  if (!after) return { status: "removed", ...result }
  if (files.length === 0) {
    const start = runStart(index, toIdx, (f) => sameFiles(f, after))
    const covers = fromIdx >= start && fromIdx <= toIdx
    return {
      status: "unchanged",
      ...(covers ? { since: index.versions[start].version } : {}),
      ...result,
    }
  }
  return { status: "changed", ...result }
}

/**
 * Pair shown when the tab opens: the version being viewed against the one
 * before it. An unknown current version falls back to the newest entry.
 */
export function defaultRange(
  index: ChangeIndex,
  current: string,
): { from: string | null; to: string } | null {
  if (index.versions.length === 0) return null
  let toIdx = entryIndex(index, current)
  if (toIdx < 0) toIdx = index.versions.length - 1
  return {
    from: toIdx > 0 ? index.versions[toIdx - 1].version : null,
    to: index.versions[toIdx].version,
  }
}
