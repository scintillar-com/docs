import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ShellConfig } from "../define-config"
import { buildEnvVars, resolveSiteHeader, type LoadedConfig } from "./shared"

let root: string
const loaded = (config: Partial<ShellConfig> = {}): LoadedConfig =>
  ({
    configPath: path.join(root, "docs-shell.config.ts"),
    root,
    config: { branding: { siteName: "Test", shortName: "T" }, ...config },
  }) as LoadedConfig

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "site-header-"))
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe("resolveSiteHeader", () => {
  it("is null when the site keeps the shell's header", () => {
    expect(resolveSiteHeader(null)).toBeNull()
    expect(resolveSiteHeader(loaded())).toBeNull()
  })

  it("resolves the site's header relative to the config", () => {
    fs.mkdirSync(path.join(root, "components"))
    fs.writeFileSync(path.join(root, "components/header.tsx"), "")
    expect(resolveSiteHeader(loaded({ components: { header: "./components/header.tsx" } }))).toBe(
      path.join(root, "components/header.tsx"),
    )
  })

  it("falls back to the shell's header, with a warning, when the file is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(resolveSiteHeader(loaded({ components: { header: "./missing.tsx" } }))).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("components.header"))
  })
})

describe("buildEnvVars", () => {
  it("forwards the site header and the mobile menu tools", () => {
    fs.writeFileSync(path.join(root, "header.tsx"), "")
    const env = buildEnvVars(loaded({ components: { header: "header.tsx" }, mobileMenu: { tools: true } }))
    expect(env.USER_HEADER_PATH).toBe(path.join(root, "header.tsx"))
    expect(env.NEXT_PUBLIC_SHELL_MOBILE_TOOLS).toBe("1")
  })

  it("sets neither by default", () => {
    const env = buildEnvVars(loaded())
    expect(env).not.toHaveProperty("USER_HEADER_PATH")
    expect(env).not.toHaveProperty("NEXT_PUBLIC_SHELL_MOBILE_TOOLS")
  })
})
