import { describe, expect, it } from "vitest"
import {
  THEME_OVERRIDES_MESSAGE,
  THEME_OVERRIDES_STORAGE_KEY,
  applyThemeOverrides,
  buildThemeCss,
  clampTint,
  formatTint,
  isThemeOverridesMessage,
  normalizeHex,
  parseStoredOverrides,
  sanitizeOverrides,
  themeOverridesInitScript,
} from "../next-app/lib/theme-overrides"

function fakeRoot() {
  const props = new Map<string, string>()
  return {
    props,
    style: {
      setProperty: (name: string, value: string | null) => {
        props.set(name, String(value))
      },
      removeProperty: (name: string) => {
        const had = props.get(name) ?? ""
        props.delete(name)
        return had
      },
    },
  }
}

describe("normalizeHex", () => {
  it("accepts 3 and 6 digit hex with or without #", () => {
    expect(normalizeHex("#3B82F6")).toBe("#3b82f6")
    expect(normalizeHex("3b82f6")).toBe("#3b82f6")
    expect(normalizeHex(" #abc ")).toBe("#aabbcc")
  })

  it("rejects anything else", () => {
    for (const bad of ["", "#", "#12345", "#1234567", "red", "#ggg000", "oklch(0.5 0.1 200)"]) {
      expect(normalizeHex(bad)).toBeNull()
    }
  })
})

describe("clampTint / formatTint", () => {
  it("clamps to 0..2 and snaps to 0.05", () => {
    expect(clampTint(-1)).toBe(0)
    expect(clampTint(5)).toBe(2)
    expect(clampTint(1.234)).toBe(1.25)
    expect(clampTint(0.1 + 0.2)).toBe(0.3)
    expect(clampTint(Number.NaN)).toBeNull()
    expect(clampTint(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("formats without trailing zeros", () => {
    expect(formatTint(1)).toBe("1")
    expect(formatTint(1.25)).toBe("1.25")
    expect(formatTint(0.5)).toBe("0.5")
  })
})

describe("sanitizeOverrides / parseStoredOverrides", () => {
  it("keeps valid values only", () => {
    expect(sanitizeOverrides({ primary: "#ABC", tint: 3, extra: 1 })).toEqual({ primary: "#aabbcc", tint: 2 })
    expect(sanitizeOverrides({ primary: "blue", tint: "1" })).toEqual({})
    expect(sanitizeOverrides(null)).toEqual({})
  })

  it("drops values for disabled controls", () => {
    expect(sanitizeOverrides({ primary: "#000000", tint: 1 }, ["mode", "tint"])).toEqual({ tint: 1 })
  })

  it("treats corrupt storage as no overrides", () => {
    expect(parseStoredOverrides(null)).toEqual({})
    expect(parseStoredOverrides("{oops")).toEqual({})
    expect(parseStoredOverrides(JSON.stringify({ primary: "#112233" }))).toEqual({ primary: "#112233" })
  })
})

describe("applyThemeOverrides", () => {
  it("sets and removes the custom properties", () => {
    const root = fakeRoot()
    applyThemeOverrides(root, { primary: "#112233", tint: 1.5 })
    expect(Object.fromEntries(root.props)).toEqual({ "--primary": "#112233", "--surface-tint": "1.5" })
    applyThemeOverrides(root, { tint: 0 })
    expect(Object.fromEntries(root.props)).toEqual({ "--surface-tint": "0" })
    applyThemeOverrides(root, {})
    expect(root.props.size).toBe(0)
  })
})

describe("buildThemeCss", () => {
  it("outputs the resulting :root variables", () => {
    expect(buildThemeCss({ primary: "#3b82f6", tint: 1.25 })).toBe(
      ":root {\n  --primary: #3b82f6;\n  --surface-tint: 1.25;\n}\n",
    )
  })

  it("omits unknown or disabled values", () => {
    expect(buildThemeCss({ primary: null, tint: 1 })).toBe(":root {\n  --surface-tint: 1;\n}\n")
    expect(buildThemeCss({ primary: "#000000" })).toBe(":root {\n  --primary: #000000;\n}\n")
  })
})

describe("themeOverridesInitScript", () => {
  function run(script: string, stored: string | null, throwOnRead = false) {
    const root = fakeRoot()
    const fakeWindow = {
      localStorage: {
        getItem: (key: string) => {
          if (throwOnRead) throw new Error("SecurityError")
          return key === THEME_OVERRIDES_STORAGE_KEY ? stored : null
        },
      },
    }
    const fakeDocument = { documentElement: root }
    new Function("window", "document", script)(fakeWindow, fakeDocument)
    return Object.fromEntries(root.props)
  }

  const all = ["mode", "primary", "tint"] as const

  it("applies stored overrides before paint", () => {
    expect(run(themeOverridesInitScript(all), JSON.stringify({ primary: "#112233", tint: 0.5 }))).toEqual({
      "--primary": "#112233",
      "--surface-tint": "0.5",
    })
  })

  it("ignores invalid values, disabled controls and storage errors", () => {
    expect(run(themeOverridesInitScript(all), JSON.stringify({ primary: "red", tint: 9 }))).toEqual({})
    expect(run(themeOverridesInitScript(["tint"]), JSON.stringify({ primary: "#112233", tint: 1 }))).toEqual({
      "--surface-tint": "1",
    })
    expect(run(themeOverridesInitScript(["primary"]), "{oops")).toEqual({})
    expect(run(themeOverridesInitScript(["primary"]), null, true)).toEqual({})
  })
})

describe("isThemeOverridesMessage", () => {
  it("recognises the sync message only", () => {
    expect(isThemeOverridesMessage({ type: THEME_OVERRIDES_MESSAGE, overrides: {} })).toBe(true)
    expect(isThemeOverridesMessage({ type: "other", overrides: {} })).toBe(false)
    expect(isThemeOverridesMessage(THEME_OVERRIDES_MESSAGE)).toBe(false)
    expect(isThemeOverridesMessage(null)).toBe(false)
  })
})
