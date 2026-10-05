import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PUBLIC_MANIFEST, beginPublicOverlay, overlayDir, writeFileFresh } from "./fs-safe"

let tmp: string
const read = (...p: string[]) => fs.readFileSync(path.join(tmp, ...p), "utf-8")
const write = (rel: string, data: string) => {
  fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true })
  fs.writeFileSync(path.join(tmp, rel), data)
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-safe-"))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe("writeFileFresh", () => {
  it("replaces a hard-linked file without changing the other link", () => {
    write("store/favicon.ico", "shell")
    fs.linkSync(path.join(tmp, "store/favicon.ico"), path.join(tmp, "install.ico"))
    writeFileFresh(path.join(tmp, "install.ico"), "user")
    expect(read("install.ico")).toBe("user")
    expect(read("store/favicon.ico")).toBe("shell")
  })

  it("creates missing parent directories", () => {
    writeFileFresh(path.join(tmp, "a/b/c.txt"), "x")
    expect(read("a/b/c.txt")).toBe("x")
  })
})

describe("overlayDir", () => {
  it("copies nested files over the destination without touching hard links", () => {
    write("store/favicon.ico", "shell")
    write("shell/keep.txt", "keep")
    fs.linkSync(path.join(tmp, "store/favicon.ico"), path.join(tmp, "shell/favicon.ico"))
    write("user/favicon.ico", "user")
    write("user/r/button.json", "{}")
    overlayDir(path.join(tmp, "user"), path.join(tmp, "shell"))
    expect(read("shell/favicon.ico")).toBe("user")
    expect(read("shell/r/button.json")).toBe("{}")
    expect(read("shell/keep.txt")).toBe("keep")
    expect(read("store/favicon.ico")).toBe("shell")
  })

  it("does nothing when the source doesn't exist", () => {
    write("shell/keep.txt", "keep")
    overlayDir(path.join(tmp, "missing"), path.join(tmp, "shell"))
    expect(fs.readdirSync(path.join(tmp, "shell"))).toEqual(["keep.txt"])
  })
})

describe("beginPublicOverlay", () => {
  const shellPublic = () => path.join(tmp, "app/public")
  const userPublic = () => path.join(tmp, "site/public")
  const manifest = () => path.join(tmp, "app", PUBLIC_MANIFEST)

  beforeEach(() => {
    write("app/public/favicon.ico", "shell")
    write("app/public/logo.svg", "logo")
    write("site/public/favicon.ico", "user")
    write("site/public/r/button.json", "{}")
  })

  it("overlays, then restores the shell's files exactly", () => {
    const restore = beginPublicOverlay(shellPublic(), userPublic())
    expect(read("app/public/favicon.ico")).toBe("user")
    expect(read("app/public/r/button.json")).toBe("{}")
    expect(fs.existsSync(manifest())).toBe(true)

    restore()
    expect(read("app/public/favicon.ico")).toBe("shell")
    expect(read("app/public/logo.svg")).toBe("logo")
    expect(fs.existsSync(path.join(shellPublic(), "r"))).toBe(false)
    expect(fs.existsSync(manifest())).toBe(false)
  })

  it("is safe to call restore twice", () => {
    const restore = beginPublicOverlay(shellPublic(), userPublic())
    restore()
    restore()
    expect(read("app/public/favicon.ico")).toBe("shell")
  })

  it("cleans up after a run that never restored", () => {
    // First run overlays and "crashes" (restore never called).
    beginPublicOverlay(shellPublic(), userPublic())
    expect(read("app/public/favicon.ico")).toBe("user")

    // The next run, for a different site, must not inherit the first one's files.
    fs.rmSync(path.join(tmp, "site"), { recursive: true })
    write("other/public/other.txt", "other")
    const restore = beginPublicOverlay(shellPublic(), path.join(tmp, "other/public"))
    expect(read("app/public/favicon.ico")).toBe("shell")
    expect(fs.existsSync(path.join(shellPublic(), "r"))).toBe(false)
    expect(read("app/public/other.txt")).toBe("other")

    restore()
    expect(fs.readdirSync(shellPublic()).sort()).toEqual(["favicon.ico", "logo.svg"])
  })

  it("works when the site has no public/ folder", () => {
    const restore = beginPublicOverlay(shellPublic(), path.join(tmp, "nowhere"))
    restore()
    expect(fs.readdirSync(shellPublic()).sort()).toEqual(["favicon.ico", "logo.svg"])
  })
})
