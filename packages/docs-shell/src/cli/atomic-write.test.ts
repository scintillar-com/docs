import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { tempPathFor, writeFileAtomic, writeFileAtomicSync } from "./atomic-write.js"

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-shell-atomic-"))
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

const leftovers = () => fs.readdirSync(dir).filter((f) => f.endsWith(".tmp"))

describe("tempPathFor", () => {
  it("is a unique hidden sibling of the target", () => {
    const target = path.join(dir, "manifest.json")
    const a = tempPathFor(target)
    const b = tempPathFor(target)
    expect(path.dirname(a)).toBe(dir)
    expect(path.basename(a)).toMatch(/^\.manifest\.json\..+\.tmp$/)
    expect(a).not.toBe(b)
  })
})

describe("writeFileAtomic", () => {
  it("creates and replaces the file, leaving no temp files", async () => {
    const file = path.join(dir, "a.json")
    await writeFileAtomic(file, '{"v":1}')
    expect(fs.readFileSync(file, "utf-8")).toBe('{"v":1}')
    await writeFileAtomic(file, '{"v":2}', "utf-8")
    expect(fs.readFileSync(file, "utf-8")).toBe('{"v":2}')
    expect(leftovers()).toEqual([])
  })

  // Windows refuses to rename over a file another handle has open (EPERM),
  // so with a reader hammering the file the helper falls back to an
  // in-place write there. In-process callers get their guarantee from the
  // queue in next-manifest-writes.ts instead (tested there).
  it.skipIf(process.platform === "win32")(
    "never exposes an empty or partial file to concurrent readers",
    async () => {
      const file = path.join(dir, "prerender-manifest.json")
      const big = (n: number) => JSON.stringify({ n, routes: "x".repeat(200_000) })
      await writeFileAtomic(file, big(0))

      let stop = false
      const failures: string[] = []
      const reader = (async () => {
        while (!stop) {
          const raw = await fs.promises.readFile(file, "utf-8")
          try {
            JSON.parse(raw)
          } catch {
            failures.push(`len=${raw.length}`)
          }
        }
      })()
      await Promise.all(Array.from({ length: 40 }, (_, i) => writeFileAtomic(file, big(i + 1))))
      stop = true
      await reader

      expect(failures).toEqual([])
      expect(() => JSON.parse(fs.readFileSync(file, "utf-8"))).not.toThrow()
      expect(leftovers()).toEqual([])
    },
  )

  it("uses the injected writeFile for the temp file", async () => {
    const file = path.join(dir, "b.json")
    const impl = vi.fn(fs.promises.writeFile)
    await writeFileAtomic(file, "{}", undefined, impl)
    expect(impl).toHaveBeenCalledTimes(1)
    expect(impl.mock.calls[0][0]).not.toBe(file)
    expect(fs.readFileSync(file, "utf-8")).toBe("{}")
  })

  it("falls back to an in-place write when the target stays locked", async () => {
    const file = path.join(dir, "c.json")
    fs.writeFileSync(file, "old")
    const eperm = Object.assign(new Error("locked"), { code: "EPERM" })
    vi.spyOn(fs.promises, "rename").mockRejectedValue(eperm)
    await writeFileAtomic(file, "new")
    expect(fs.readFileSync(file, "utf-8")).toBe("new")
    expect(leftovers()).toEqual([])
  })

  it("rethrows non-retryable rename errors and cleans up", async () => {
    const file = path.join(dir, "d.json")
    const enoent = Object.assign(new Error("gone"), { code: "ENOENT" })
    vi.spyOn(fs.promises, "rename").mockRejectedValue(enoent)
    await expect(writeFileAtomic(file, "x")).rejects.toThrow("gone")
    expect(leftovers()).toEqual([])
  })
})

describe("writeFileAtomicSync", () => {
  it("writes and replaces the file, leaving no temp files", () => {
    const file = path.join(dir, "e.json")
    writeFileAtomicSync(file, "one", "utf-8")
    writeFileAtomicSync(file, "two", "utf-8")
    expect(fs.readFileSync(file, "utf-8")).toBe("two")
    expect(leftovers()).toEqual([])
  })

  it("retries a transiently locked rename", () => {
    const file = path.join(dir, "f.json")
    const real = fs.renameSync
    let calls = 0
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (++calls < 3) throw Object.assign(new Error("busy"), { code: "EBUSY" })
      return real(from, to)
    })
    writeFileAtomicSync(file, "ok")
    expect(calls).toBe(3)
    expect(fs.readFileSync(file, "utf-8")).toBe("ok")
    expect(leftovers()).toEqual([])
  })

  it("throws when the directory doesn't exist", () => {
    expect(() => writeFileAtomicSync(path.join(dir, "missing", "g.json"), "x")).toThrow()
  })
})
