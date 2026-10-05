import { describe, expect, it } from "vitest"
import type { DocMeta } from "./registry-adapter"
import { buildSections, buildTree, buildTrees, firstDocSlug, sectionOf, titleCase, type DocNode } from "./docs-tree"

const doc = (slug: string, title: string, order = 999, extra: Partial<DocMeta> = {}): DocMeta => ({
  slug,
  title,
  description: "",
  order,
  titles: { en: title },
  ...extra,
})

/** Compact shape for assertions: "doc:slug" or "folder:label[...children]". */
const shape = (nodes: DocNode[]): unknown[] =>
  nodes.map((n) =>
    n.kind === "doc" ? `doc:${n.doc.slug}` : { [`folder:${n.label}${n.index ? "*" : ""}`]: shape(n.children) },
  )

describe("titleCase / sectionOf", () => {
  it("title-cases folder names", () => {
    expect(titleCase("user-guide")).toBe("User Guide")
    expect(titleCase("api_reference")).toBe("Api Reference")
  })

  it("derives a section from the slug when a page doesn't say", () => {
    expect(sectionOf(doc("intro", "Intro"))).toBe("")
    expect(sectionOf(doc("guides/start", "Start"))).toBe("guides")
    expect(sectionOf(doc("guides", "Guides", 1, { section: "guides" }))).toBe("guides")
  })
})

describe("buildSections", () => {
  const docs = [doc("intro", "Intro"), doc("guides/a", "A"), doc("api/b", "B"), doc("zeta/c", "C")]

  it("lists declared sections in config order, then discovered ones alphabetically", () => {
    const sections = buildSections(docs, [{ dir: "guides", label: "User guide", icon: "Rocket" }, { dir: "empty" }])
    expect(sections.map((s) => [s.dir, s.label, s.icon, s.order])).toEqual([
      ["guides", "User guide", "Rocket", 0],
      ["api", "Api", "BookOpen", 1],
      ["zeta", "Zeta", "BookOpen", 2],
    ])
  })

  it("has no sections for a flat docs folder", () => {
    expect(buildSections([doc("intro", "Intro"), doc("guide", "Guide")])).toEqual([])
  })
})

describe("buildTree", () => {
  it("nests folders, lifts a folder's _index out of its children, sorts by order then title", () => {
    const docs = [
      doc("guides", "Guides", 1, { section: "guides" }),
      doc("guides/zeta", "Zeta", 1),
      doc("guides/alpha", "Alpha", 1),
      doc("guides/advanced", "Advanced", 0, { section: "guides" }),
      doc("guides/advanced/caching", "Caching", 2),
      doc("guides/advanced/auth", "Auth", 1),
      doc("guides/misc/notes", "Notes"),
    ]
    expect(shape(buildTree(docs, "guides"))).toEqual([
      { "folder:Advanced*": ["doc:guides/advanced/auth", "doc:guides/advanced/caching"] },
      "doc:guides/alpha",
      "doc:guides/zeta",
      // No _index: titled from the folder name, sorted last (order 999).
      { "folder:Misc": ["doc:guides/misc/notes"] },
    ])
  })

  it("keeps root pages in the root tree only", () => {
    const docs = [doc("intro", "Intro", 1), doc("faq", "FAQ", 2), doc("guides/start", "Start")]
    expect(shape(buildTree(docs, ""))).toEqual(["doc:intro", "doc:faq"])
    const trees = buildTrees(docs, buildSections(docs))
    expect(Object.keys(trees).sort()).toEqual(["", "guides"])
    expect(shape(trees.guides)).toEqual(["doc:guides/start"])
  })
})

describe("firstDocSlug", () => {
  it("returns the first page in sidebar order, a folder page included", () => {
    const docs = [doc("guides/advanced", "Advanced", 0, { section: "guides" }), doc("guides/advanced/x", "X"), doc("guides/b", "B", 5)]
    expect(firstDocSlug(buildTree(docs, "guides"))).toBe("guides/advanced")
    const noIndex = [doc("guides/deep/x", "X"), doc("guides/b", "B", 5)]
    expect(firstDocSlug(buildTree(noIndex, "guides"))).toBe("guides/b")
    expect(firstDocSlug([])).toBeUndefined()
  })
})
