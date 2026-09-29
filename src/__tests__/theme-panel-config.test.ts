import { afterEach, describe, expect, it, vi } from "vitest"
import { buildEnvVars } from "../cli/shared"
import {
  compareVersions,
  getShellThemePanel,
  isThemePanelEnabled,
  resolveThemePanelConfig,
} from "../next-app/lib/theme-panel"
import type { ShellConfig } from "../define-config"

const branding = { siteName: "Test UI", shortName: "UI" }
const loaded = (config: Partial<ShellConfig>) => ({
  configPath: "/tmp/registry-shell.config.ts",
  root: "/tmp",
  config: { branding, ...config } as ShellConfig,
})

describe("themePanel config forwarding (CLI)", () => {
  it("sets no env var when themePanel is absent", () => {
    const env = buildEnvVars(loaded({}))
    expect(env).not.toHaveProperty("NEXT_PUBLIC_SHELL_THEME_PANEL")
  })

  it("forwards themePanel as JSON", () => {
    const env = buildEnvVars(loaded({ themePanel: { since: "1.0.0", controls: ["mode", "tint"] } }))
    expect(JSON.parse(env.NEXT_PUBLIC_SHELL_THEME_PANEL)).toEqual({
      since: "1.0.0",
      controls: ["mode", "tint"],
    })
  })

  it("forwards an empty themePanel object (enabled with defaults)", () => {
    const env = buildEnvVars(loaded({ themePanel: {} }))
    expect(resolveThemePanelConfig(env.NEXT_PUBLIC_SHELL_THEME_PANEL)).toEqual({
      since: null,
      controls: ["mode", "primary", "tint"],
    })
  })
})

describe("resolveThemePanelConfig", () => {
  it("returns null when not configured or unparseable", () => {
    expect(resolveThemePanelConfig(undefined)).toBeNull()
    expect(resolveThemePanelConfig(null)).toBeNull()
    expect(resolveThemePanelConfig("")).toBeNull()
    expect(resolveThemePanelConfig("not json")).toBeNull()
    expect(resolveThemePanelConfig("[]")).toBeNull()
    expect(resolveThemePanelConfig("true")).toBeNull()
  })

  it("defaults to all controls", () => {
    expect(resolveThemePanelConfig({})).toEqual({ since: null, controls: ["mode", "primary", "tint"] })
    expect(resolveThemePanelConfig({ controls: [] })?.controls).toEqual(["mode", "primary", "tint"])
  })

  it("keeps the given order, drops unknown and duplicate controls", () => {
    const raw = JSON.stringify({ controls: ["tint", "radius", "mode", "tint"] })
    expect(resolveThemePanelConfig(raw)?.controls).toEqual(["tint", "mode"])
  })

  it("normalises since and ignores invalid values", () => {
    expect(resolveThemePanelConfig({ since: "v1.2.0" })?.since).toBe("1.2.0")
    expect(resolveThemePanelConfig({ since: "latest" })?.since).toBeNull()
  })
})

describe("compareVersions", () => {
  it("orders semver-ish versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0)
    expect(compareVersions("v1.0.0", "1.0")).toBe(0)
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0)
    expect(compareVersions("0.1.0", "1.0.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0)
    expect(compareVersions("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0)
    expect(compareVersions("nope", "1.0.0")).toBeNull()
  })
})

describe("isThemePanelEnabled (versioning hook)", () => {
  const withSince = resolveThemePanelConfig({ since: "1.0.0" })
  const noSince = resolveThemePanelConfig({})

  it("is off without config", () => {
    expect(isThemePanelEnabled(null, "2.0.0")).toBe(false)
    expect(isThemePanelEnabled(null, null)).toBe(false)
  })

  it("is on without since, or without a known version", () => {
    expect(isThemePanelEnabled(noSince, "0.1.0")).toBe(true)
    expect(isThemePanelEnabled(withSince, null)).toBe(true)
    expect(isThemePanelEnabled(withSince, undefined)).toBe(true)
  })

  it("gates on version >= since", () => {
    expect(isThemePanelEnabled(withSince, "0.1.0")).toBe(false)
    expect(isThemePanelEnabled(withSince, "v1.0.0")).toBe(true)
    expect(isThemePanelEnabled(withSince, "1.2.3")).toBe(true)
    expect(isThemePanelEnabled(withSince, "1.0.0-beta.1")).toBe(false)
  })

  it("keeps the panel on for an unparseable version", () => {
    expect(isThemePanelEnabled(withSince, "main")).toBe(true)
  })
})

describe("getShellThemePanel (env)", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("is null when the CLI set nothing", () => {
    vi.stubEnv("NEXT_PUBLIC_SHELL_THEME_PANEL", "")
    expect(getShellThemePanel()).toBeNull()
  })

  it("reads the config and the docs version", () => {
    vi.stubEnv("NEXT_PUBLIC_SHELL_THEME_PANEL", JSON.stringify({ since: "1.0.0" }))
    vi.stubEnv("NEXT_PUBLIC_SHELL_DOCS_VERSION", "")
    expect(getShellThemePanel()?.controls).toEqual(["mode", "primary", "tint"])
    vi.stubEnv("NEXT_PUBLIC_SHELL_DOCS_VERSION", "0.1.0")
    expect(getShellThemePanel()).toBeNull()
    vi.stubEnv("NEXT_PUBLIC_SHELL_DOCS_VERSION", "1.0.0")
    expect(getShellThemePanel()).not.toBeNull()
  })
})
