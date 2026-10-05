import { describe, expect, it } from "vitest"
import { groupComponentsByCategory, UNCATEGORIZED_SLUG } from "./sidebar-groups"
import type { ComponentMeta } from "./registry-adapter"

const comp = (name: string, categories?: string[]): ComponentMeta => ({
  name,
  label: name.charAt(0).toUpperCase() + name.slice(1),
  kind: "component",
  ...(categories ? { categories } : {}),
})

// Sorted by label, as the default adapter returns them.
const components = [
  comp("accordion", ["Layout"]),
  comp("badge", ["Primitives"]),
  comp("button", ["Primitives"]),
  comp("card", ["Layout"]),
  comp("chart", ["Data"]),
  comp("hello"),
  comp("input", ["Primitives", "Forms"]),
  comp("zebra"),
]

describe("groupComponentsByCategory", () => {
  it("keeps the config's category order, not alphabetical", () => {
    const categories = [{ label: "Primitives" }, { label: "Layout" }, { label: "Data" }]
    const groups = groupComponentsByCategory(components, categories, "Base")
    expect(groups.map((g) => g.label)).toEqual(["Primitives", "Layout", "Data", "Base"])
  })

  it("puts the Base group last even when its label sorts first", () => {
    const categories = [{ label: "Zeta" }, { label: "Primitives" }]
    const withZeta = [...components, comp("zz", ["Zeta"])]
    // "Autres" (a translated Base heading) would sort before both.
    const groups = groupComponentsByCategory(withZeta, categories, "Autres")
    expect(groups.map((g) => g.label)).toEqual(["Zeta", "Primitives", "Autres"])
    expect(groups.at(-1)?.slug).toBe(UNCATEGORIZED_SLUG)
  })

  it("keeps the incoming (alphabetical) item order inside a group", () => {
    const groups = groupComponentsByCategory(components, [{ label: "Primitives" }], "Base")
    expect(groups[0].components.map((c) => c.name)).toEqual(["badge", "button", "input"])
    expect(groups[1].components.map((c) => c.name)).toEqual(["hello", "zebra"])
  })

  it("lists a component in every category it belongs to", () => {
    const groups = groupComponentsByCategory(
      components,
      [{ label: "Forms" }, { label: "Primitives" }],
      "Base",
    )
    expect(groups[0].components.map((c) => c.name)).toEqual(["input"])
    expect(groups[1].components.map((c) => c.name)).toContain("input")
  })

  it("drops empty categories and omits Base when everything is categorized", () => {
    const categorized = components.filter((c) => c.categories)
    const groups = groupComponentsByCategory(
      categorized,
      [{ label: "Empty" }, { label: "Layout" }],
      "Base",
    )
    expect(groups.map((g) => g.label)).toEqual(["Layout"])
  })

  it("uses the category label as slug and a stable slug for Base", () => {
    const groups = groupComponentsByCategory(components, [{ label: "Layout" }], "Basis")
    expect(groups.map((g) => g.slug)).toEqual(["Layout", UNCATEGORIZED_SLUG])
  })
})
