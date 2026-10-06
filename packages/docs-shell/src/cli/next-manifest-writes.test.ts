import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createKeyedQueue,
  installAtomicManifestWrites,
  isNextManifestPath,
} from "./next-manifest-writes.js"

describe("isNextManifestPath", () => {
  it("matches top-level .next manifests on both separators", () => {
    expect(isNextManifestPath("/app/.next/prerender-manifest.json")).toBe(true)
    expect(isNextManifestPath(path.win32.join("C:/app/.next/routes-manifest.json"))).toBe(true)
  })

  it("ignores everything else", () => {
    expect(isNextManifestPath("/app/.next/server/app-paths-manifest.json")).toBe(false)
    expect(isNextManifestPath("/app/.next/prerender-manifest.json.tmp")).toBe(false)
    expect(isNextManifestPath("/app/public/r/button.json")).toBe(false)
    expect(isNextManifestPath("/app/next/prerender-manifest.json")).toBe(false)
    expect(isNextManifestPath(Buffer.from("/app/.next/prerender-manifest.json"))).toBe(false)
    expect(isNextManifestPath(3)).toBe(false)
  })
})

describe("installAtomicManifestWrites", () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  function fakePromises() {
    const writeFile = vi.fn(fs.promises.writeFile)
    const readFile = vi.fn(fs.promises.readFile)
    // A private copy of the API, so the real fs.promises stays unpatched.
    const promises = { ...fs.promises, writeFile, readFile } as typeof fs.promises
    return { promises, writeFile, readFile }
  }

  it("routes manifest writes through a temp file + rename", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-shell-manifest-"))
    const nextDir = path.join(dir, ".next")
    fs.mkdirSync(nextDir)
    const file = path.join(nextDir, "prerender-manifest.json")
    const { promises, writeFile } = fakePromises()
    installAtomicManifestWrites(promises)

    await promises.writeFile(file, '{"routes":{}}')

    expect(fs.readFileSync(file, "utf-8")).toBe('{"routes":{}}')
    // The original writeFile only ever saw the temp path.
    expect(writeFile).toHaveBeenCalledTimes(1)
    expect(writeFile.mock.calls[0][0]).not.toBe(file)
    expect(fs.readdirSync(nextDir)).toEqual(["prerender-manifest.json"])
  })

  it("passes other writes (and appends) straight through", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-shell-manifest-"))
    const other = path.join(dir, "other.json")
    const { promises, writeFile } = fakePromises()
    installAtomicManifestWrites(promises)

    await promises.writeFile(other, "{}")
    expect(writeFile).toHaveBeenLastCalledWith(other, "{}", undefined)

    fs.mkdirSync(path.join(dir, ".next"))
    const manifest = path.join(dir, ".next", "routes-manifest.json")
    await promises.writeFile(manifest, "a", { flag: "a" })
    expect(writeFile).toHaveBeenLastCalledWith(manifest, "a", { flag: "a" })
  })

  it("never lets a read see a half-written manifest", async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-shell-manifest-"))
    fs.mkdirSync(path.join(dir, ".next"))
    const file = path.join(dir, ".next", "prerender-manifest.json")
    const body = (n: number) => JSON.stringify({ n, routes: "x".repeat(100_000) })
    fs.writeFileSync(file, body(0))
    const { promises } = fakePromises()
    installAtomicManifestWrites(promises)

    // Next's read-modify-write, many at once (the cold-start burst).
    const failures: string[] = []
    await Promise.all(
      Array.from({ length: 30 }, async (_, i) => {
        const raw = String(await promises.readFile(file, "utf8"))
        try {
          JSON.parse(raw)
        } catch {
          failures.push(`len=${raw.length}`)
        }
        await promises.writeFile(file, body(i + 1))
      }),
    )

    expect(failures).toEqual([])
    expect(() => JSON.parse(fs.readFileSync(file, "utf-8"))).not.toThrow()
    expect(fs.readdirSync(path.join(dir, ".next"))).toEqual(["prerender-manifest.json"])
  })

  it("is idempotent", () => {
    const { promises } = fakePromises()
    installAtomicManifestWrites(promises)
    const once = promises.writeFile
    installAtomicManifestWrites(promises)
    expect(promises.writeFile).toBe(once)
  })
})

describe("createKeyedQueue", () => {
  it("runs operations on the same key one at a time, in order", async () => {
    const run = createKeyedQueue()
    const log: string[] = []
    const op = (name: string, ms: number) => () =>
      new Promise<string>((resolve) => {
        log.push(`start ${name}`)
        setTimeout(() => {
          log.push(`end ${name}`)
          resolve(name)
        }, ms)
      })
    const results = await Promise.all([run("a", op("1", 20)), run("a", op("2", 1)), run("b", op("3", 1))])
    expect(results).toEqual(["1", "2", "3"])
    // Key "b" doesn't wait for key "a"; "2" waits for "1".
    expect(log.indexOf("end 1")).toBeLessThan(log.indexOf("start 2"))
    expect(log.indexOf("start 3")).toBeLessThan(log.indexOf("end 1"))
  })

  it("keeps going after a failed operation", async () => {
    const run = createKeyedQueue()
    const failed = run("a", () => Promise.reject(new Error("boom")))
    const next = run("a", () => Promise.resolve("ok"))
    await expect(failed).rejects.toThrow("boom")
    await expect(next).resolves.toBe("ok")
  })
})
