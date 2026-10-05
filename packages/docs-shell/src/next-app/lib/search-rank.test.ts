import { describe, expect, it } from "vitest"
import { excerptFor, queryTerms, rankItems, scoreItem, type SearchItem } from "./search-rank"

const item = (over: Partial<SearchItem>): SearchItem => ({
  label: "Label",
  page: "Page",
  href: "/docs/x/",
  group: "docs",
  kind: "heading",
  text: "",
  ...over,
})

describe("scoreItem", () => {
  it("needs every term somewhere", () => {
    expect(scoreItem(item({ label: "Recovery codes" }), ["recovery", "zebra"])).toBeNull()
  })
  it("ranks label start over label, page, then body", () => {
    const terms = ["cache"]
    const start = scoreItem(item({ label: "Cache keys" }), terms)!
    const inside = scoreItem(item({ label: "Purgecache" }), terms)!
    const page = scoreItem(item({ page: "Cache guide" }), terms)!
    const body = scoreItem(item({ text: "uses the cache" }), terms)!
    expect(start).toBeGreaterThan(inside)
    expect(inside).toBeGreaterThan(page)
    expect(page).toBeGreaterThan(body)
  })
  it("rewards the whole phrase in the label", () => {
    const terms = queryTerms("recovery codes")
    expect(scoreItem(item({ label: "Recovery codes" }), terms)!).toBeGreaterThan(
      scoreItem(item({ label: "Codes for recovery" }), terms)!,
    )
  })
})

describe("excerptFor", () => {
  it("windows the text around the first match", () => {
    const text = `${"a ".repeat(40)}the WIP limit stops new cards${" b".repeat(80)}`
    const excerpt = excerptFor(text, ["wip"])!
    expect(excerpt.startsWith("…")).toBe(true)
    expect(excerpt.endsWith("…")).toBe(true)
    expect(excerpt).toContain("WIP limit")
    expect(excerpt).toMatch(/^…a /)
    expect(excerpt).toMatch(/ b…$/)
    expect(excerptFor("nothing here", ["wip"])).toBeNull()
  })
  it("starts and ends on whole words", () => {
    const text = `${"Everything about using the product, ".repeat(3)}the landing page.${" Then more words follow here".repeat(8)}`
    const excerpt = excerptFor(text, ["landing"])!
    const words = excerpt.replace(/^…|…$/g, "").split(" ")
    // First and last words are whole words of the text.
    expect(text.split(/\s+/)).toContain(words[0])
    expect(text.split(/\s+/)).toContain(words.at(-1))
    expect(excerpt).toContain("the landing page.")
  })
})

describe("rankItems", () => {
  const items = [
    item({ label: "Kanban", page: "Kanban", kind: "page", text: "Boards and cards." }),
    item({ label: "WIP limits", page: "Kanban", text: "Cap the cards in a column." }),
    item({ label: "Columns", page: "Kanban", text: "A WIP limit caps a column." }),
    item({ label: "Button", page: "Button", kind: "component", group: "components" }),
  ]
  it("orders by score and excerpts only body matches", () => {
    const hits = rankItems(items, "wip")
    expect(hits.map((h) => h.item.label)).toEqual(["WIP limits", "Columns"])
    expect(hits[0]?.excerpt).toBeNull()
    expect(hits[1]?.excerpt).toContain("WIP limit")
  })
  it("returns nothing for an empty query and honours the limit", () => {
    expect(rankItems(items, "   ")).toEqual([])
    expect(rankItems(items, "a", 2)).toHaveLength(2)
  })
})
