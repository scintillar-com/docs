import { describe, expect, it } from "vitest"
import {
  compareItem,
  defaultRange,
  diffLines,
  hunkHeader,
  splitLines,
  toHunks,
  type ChangeIndex,
  type DiffOp,
} from "./changes"

/** Apply a diff's ops to rebuild both sides (a diff must round-trip). */
function sides(ops: DiffOp[]): [string[], string[]] {
  return [
    ops.filter((o) => o.type !== "add").map((o) => o.text),
    ops.filter((o) => o.type !== "remove").map((o) => o.text),
  ]
}

describe("diffLines", () => {
  it("finds a minimal diff that round-trips", () => {
    const a = ["a", "b", "c", "a", "b", "b", "a"]
    const b = ["c", "b", "a", "b", "a", "c"]
    const ops = diffLines(a, b)
    expect(sides(ops)).toEqual([a, b])
    // Myers' classic example: edit distance 5.
    expect(ops.filter((o) => o.type !== "equal")).toHaveLength(5)
  })

  it("handles empty sides and identical input", () => {
    expect(diffLines([], ["x"])).toEqual([{ type: "add", text: "x" }])
    expect(diffLines(["x"], [])).toEqual([{ type: "remove", text: "x" }])
    expect(diffLines(["x", "y"], ["x", "y"]).every((o) => o.type === "equal")).toBe(true)
  })

  it("falls back to a full replacement past the edit budget, still round-tripping", () => {
    const a = ["keep", ...Array.from({ length: 30 }, (_, i) => `old ${i}`), "end"]
    const b = ["keep", ...Array.from({ length: 30 }, (_, i) => `new ${i}`), "end"]
    const ops = diffLines(a, b, 10)
    expect(sides(ops)).toEqual([a, b])
    expect(ops[0]).toEqual({ type: "equal", text: "keep" })
    expect(ops.at(-1)).toEqual({ type: "equal", text: "end" })
  })

  it("round-trips random edits", () => {
    let seed = 7
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    for (let run = 0; run < 50; run++) {
      const a = Array.from({ length: Math.floor(rand() * 30) }, () => String(Math.floor(rand() * 5)))
      const b = a.filter(() => rand() > 0.3).map((l) => (rand() > 0.8 ? `${l}!` : l))
      expect(sides(diffLines(a, b))).toEqual([a, b])
    }
  })
})

describe("toHunks", () => {
  it("keeps 3 lines of context and merges nearby changes", () => {
    const a = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`)
    const b = [...a]
    b[4] = "changed 5"
    b[7] = "changed 8"
    b[18] = "changed 19"
    const hunks = toHunks(diffLines(a, b))
    expect(hunks.map(hunkHeader)).toEqual(["@@ -2,10 +2,10 @@", "@@ -16,5 +16,5 @@"])
    const first = hunks[0].lines
    expect(first[0]).toEqual({ type: "equal", text: "line 2", oldNo: 2, newNo: 2 })
    expect(first.find((l) => l.type === "add")).toEqual({ type: "add", text: "changed 5", newNo: 5 })
  })

  it("numbers an addition to an empty file like diff -u", () => {
    const hunks = toHunks(diffLines([], ["a", "b"]))
    expect(hunks.map(hunkHeader)).toEqual(["@@ -0,0 +1,2 @@"])
  })

  it("returns no hunks without changes", () => {
    expect(toHunks(diffLines(["a"], ["a"]))).toEqual([])
  })
})

describe("splitLines", () => {
  it("ignores the final newline and normalises CRLF", () => {
    expect(splitLines("a\r\nb\n")).toEqual(["a", "b"])
    expect(splitLines("")).toEqual([])
    expect(splitLines("a\n\n")).toEqual(["a", ""])
  })
})

// 0.1.0: absent · 0.2.0: v1 · 0.3.0: v1 · 1.0.0: v2 · 1.1.0: v2 + extra file
// 1.2.0: v1 (reverted) · latest: same as 1.2.0
const INDEX: ChangeIndex = {
  name: "button",
  versions: [
    { version: "0.1.0", files: null },
    { version: "0.2.0", files: { "button.tsx": "h1", $item: "m1" } },
    { version: "0.3.0", files: { "button.tsx": "h1", $item: "m1" } },
    { version: "1.0.0", files: { "button.tsx": "h2", $item: "m1" } },
    { version: "1.1.0", files: { "button.tsx": "h2", "util.ts": "u1", $item: "m2" } },
    { version: "1.2.0", files: { "button.tsx": "h1", $item: "m1" } },
    { version: "", files: { "button.tsx": "h1", $item: "m1" } },
  ],
  blobs: {
    h1: "export function Button() {\n  return <button />\n}\n",
    h2: "export function Button() {\n  return <button type=\"button\" />\n}\n",
    u1: "export const x = 1\n",
    m1: "{\n  \"name\": \"button\"\n}\n",
    m2: "{\n  \"name\": \"button\",\n  \"dependencies\": [\"clsx\"]\n}\n",
  },
}

describe("compareItem", () => {
  it("reports 'unchanged since' the start of the identical run", () => {
    expect(compareItem(INDEX, "0.2.0", "0.3.0")).toMatchObject({ status: "unchanged", since: "0.2.0", files: [] })
    expect(compareItem(INDEX, "1.2.0", "")).toMatchObject({ status: "unchanged", since: "1.2.0" })
  })

  it("doesn't claim 'unchanged since' across a change that was reverted", () => {
    const c = compareItem(INDEX, "0.3.0", "1.2.0")
    expect(c.status).toBe("unchanged")
    expect(c.since).toBeUndefined()
  })

  it("reports the release an item was added in", () => {
    expect(compareItem(INDEX, "0.1.0", "0.2.0")).toMatchObject({ status: "added", addedIn: "0.2.0" })
    // Comparing across several versions still names the first one it appeared in.
    const c = compareItem(INDEX, "0.1.0", "1.0.0")
    expect(c).toMatchObject({ status: "added", addedIn: "0.2.0" })
    expect(c.files.map((f) => [f.path, f.status])).toEqual([
      ["button.tsx", "added"],
      ["$item", "added"],
    ])
    // No earlier version at all.
    expect(compareItem(INDEX, null, "0.2.0")).toMatchObject({ status: "added", addedIn: "0.2.0" })
  })

  it("diffs changed, added and removed files, metadata last", () => {
    const c = compareItem(INDEX, "1.0.0", "1.1.0")
    expect(c.status).toBe("changed")
    expect(c.files.map((f) => [f.path, f.status, f.additions, f.deletions])).toEqual([
      ["util.ts", "added", 1, 0],
      ["$item", "modified", 2, 1],
    ])
    const back = compareItem(INDEX, "1.1.0", "1.2.0")
    expect(back.files.map((f) => [f.path, f.status])).toEqual([
      ["button.tsx", "modified"],
      ["util.ts", "removed"],
      ["$item", "modified"],
    ])
    expect(back.additions).toBe(2)
    expect(back.deletions).toBe(4)
  })

  it("handles removal and absence", () => {
    expect(compareItem(INDEX, "0.2.0", "0.1.0").status).toBe("removed")
    expect(compareItem(INDEX, null, "0.1.0").status).toBe("missing")
    expect(compareItem(INDEX, "9.9.9", "8.8.8").status).toBe("missing")
  })
})

describe("defaultRange", () => {
  it("compares the viewed version with the one before it", () => {
    expect(defaultRange(INDEX, "1.0.0")).toEqual({ from: "0.3.0", to: "1.0.0" })
    expect(defaultRange(INDEX, "")).toEqual({ from: "1.2.0", to: "" })
    expect(defaultRange(INDEX, "0.1.0")).toEqual({ from: null, to: "0.1.0" })
  })

  it("falls back to the newest entry for an unknown version", () => {
    expect(defaultRange(INDEX, "7.0.0")).toEqual({ from: "1.2.0", to: "" })
    expect(defaultRange({ name: "x", versions: [], blobs: {} }, "")).toBeNull()
  })
})
