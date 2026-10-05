import { describe, expect, it } from "vitest"
import { mergeDicts } from "./i18n"

describe("mergeDicts", () => {
  it("keeps the built-in dictionaries when there are no extras", () => {
    const merged = mergeDicts()
    expect(merged.en["search.placeholder"]).toBeTruthy()
    expect(merged.fr["search.placeholder"]).toBeTruthy()
  })

  it("overrides built-in keys and adds new ones per locale", () => {
    const merged = mergeDicts({ en: { "search.placeholder": "Find…", "custom.key": "Custom" } })
    expect(merged.en["search.placeholder"]).toBe("Find…")
    expect(merged.en["custom.key"]).toBe("Custom")
    // Other locales keep their built-in value.
    expect(merged.fr["search.placeholder"]).not.toBe("Find…")
  })

  it("keeps extra translations for locales the shell doesn't ship", () => {
    const merged = mergeDicts({ es: { "search.placeholder": "Buscar…" }, de: { "custom.key": "Eigen" } })
    expect(merged.es["search.placeholder"]).toBe("Buscar…")
    expect(merged.de["custom.key"]).toBe("Eigen")
    expect(merged.en["search.placeholder"]).toBeTruthy()
  })

  it("doesn't mutate the built-in dictionaries", () => {
    mergeDicts({ en: { "search.placeholder": "Changed" } })
    expect(mergeDicts().en["search.placeholder"]).not.toBe("Changed")
  })
})
