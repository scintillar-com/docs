import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ShellConfig } from "../define-config"
import { resolveModules, type LoadedConfig } from "./shared"

let root: string
const loaded = (config: Partial<ShellConfig> = {}): LoadedConfig =>
  ({
    configPath: path.join(root, "registry-shell.config.ts"),
    root,
    config: { branding: { siteName: "Test", shortName: "T" }, ...config },
  }) as LoadedConfig
const touch = (rel: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), "")
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "modules-"))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe("resolveModules", () => {
  it("enables nothing in shell-only mode", () => {
    expect(resolveModules(null)).toEqual([])
  })

  it("leaves the registry off for a docs-only site", () => {
    touch("content/docs/intro.mdx")
    expect(resolveModules(loaded())).toEqual([])
  })

  it("turns the registry on when components exist", () => {
    touch("components/ui/button.tsx")
    expect(resolveModules(loaded())).toEqual(["registry"])
  })

  it("ignores a components folder without .tsx files", () => {
    touch("components/ui/README.md")
    expect(resolveModules(loaded())).toEqual([])
  })

  it("turns the registry on when blocks exist, at a custom path too", () => {
    touch("src/blocks/login/login.tsx")
    expect(resolveModules(loaded({ paths: { blocks: "src/blocks" } }))).toEqual(["registry"])
  })

  it("turns the registry on for a custom adapter", () => {
    expect(resolveModules(loaded({ adapter: "./adapter.ts" }))).toEqual(["registry"])
  })

  it("follows an explicit setting over detection", () => {
    touch("components/ui/button.tsx")
    expect(resolveModules(loaded({ modules: { registry: false } }))).toEqual([])
    expect(resolveModules(loaded({ modules: { registry: true } }))).toEqual(["registry"])
  })
})
