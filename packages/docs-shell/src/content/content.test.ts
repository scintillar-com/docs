import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  copyAssets,
  docsRouteFor,
  escapeMdx,
  firstHeading,
  firstParagraph,
  flattenMarkdown,
  formatFrontmatter,
  pageSearchRecords,
  rewriteLinks,
  slugify,
  splitFrontmatter,
  splitSections,
} from "./index"

describe("slugify", () => {
  it("matches the anchors the shell has always generated", () => {
    expect(slugify("Getting started")).toBe("getting-started")
    expect(slugify("What's new in v2.1?")).toBe("whats-new-in-v21")
    expect(slugify("Props & events")).toBe("props-events")
  })
})

describe("escapeMdx", () => {
  it("escapes < and { in prose, never in code, and turns autolinks into links", () => {
    const md = [
      "Put it in `packages/<module>/` or packages/<module>/, see <https://x.dev/a>.",
      "Route {id}.",
      "```ts",
      "const a = <T,>(x: T) => ({ x })",
      "```",
    ].join("\n")
    expect(escapeMdx(md)).toBe(
      [
        "Put it in `packages/<module>/` or packages/\\<module>/, see [https://x.dev/a](https://x.dev/a).",
        "Route \\{id}.",
        "```ts",
        "const a = <T,>(x: T) => ({ x })",
        "```",
      ].join("\n"),
    )
  })
})

describe("flattenMarkdown", () => {
  it("keeps link text, drops code, tables, images and markers, undoes escapes", () => {
    const md = [
      "## A **bold** [link](./x.md) and `code`",
      "![shot](a.png)",
      "| a | b |",
      "```sh",
      "rm -rf /",
      "```",
      "- item \\<T> &amp; more",
    ].join("\n")
    expect(flattenMarkdown(md)).toBe("A bold link and code item <T> & more")
  })
})

describe("firstHeading / firstParagraph", () => {
  const md = "```sh\n# not a heading\n```\n\n# Title\n\nShort.\n\n> a quote here that is long enough\n\nThe real [opening](x.md) paragraph, long enough to count."
  it("skips code for the heading", () => {
    expect(firstHeading(md)).toBe("Title")
    expect(firstHeading("no heading")).toBeNull()
  })
  it("finds the first real paragraph and caps it", () => {
    expect(firstParagraph(md)).toBe("The real opening paragraph, long enough to count.")
    expect(firstParagraph(md, 20)).toBe("The real opening pa…")
  })
})

describe("frontmatter", () => {
  it("round-trips simple fields", () => {
    const text = formatFrontmatter({ title: 'Say "hi": now', order: 2, draft: false, skip: undefined }) + "Body"
    expect(text).toBe('---\ntitle: "Say \\"hi\\": now"\norder: 2\ndraft: false\n---\n\nBody')
    const { data, body } = splitFrontmatter("---\ntitle: 'Hello'\norder: 3\n---\n# Doc\n")
    expect(data).toEqual({ title: "Hello", order: "3" })
    expect(body).toBe("# Doc\n")
  })
  it("returns the text unchanged without frontmatter", () => {
    expect(splitFrontmatter("# Doc")).toEqual({ data: {}, body: "# Doc" })
  })
})

describe("splitSections", () => {
  it("splits at headings outside code and slugs their plain text", () => {
    const md = "Intro.\n## Using `run()`\nText.\n```sh\n# comment\n```\n### Next [step](x.md)\nMore."
    const { intro, sections } = splitSections(md)
    expect(intro).toBe("Intro.")
    expect(sections.map((s) => [s.level, s.heading, s.anchor])).toEqual([
      [2, "Using run()", "using-run"],
      [3, "Next step", "next-step"],
    ])
    expect(sections[0]?.body).toContain("# comment")
  })
})

describe("docsRouteFor", () => {
  const mappings = [
    { from: "docs/guides", to: "guides" },
    { from: "docs/guides/api", to: "reference" },
    { from: "packages/kanban/docs/use", to: "guides/kanban" },
  ]
  it("maps by the longest matching folder and keeps subfolders", () => {
    expect(docsRouteFor("docs/guides/setup/install.md", mappings)).toBe("/docs/guides/setup/install")
    expect(docsRouteFor("docs/guides/api/keys.md", mappings)).toBe("/docs/reference/keys")
    expect(docsRouteFor("packages/kanban/docs/use/boards.mdx", mappings)).toBe("/docs/guides/kanban/boards")
  })
  it("sends folder pages and folders to the folder URL", () => {
    expect(docsRouteFor("docs/guides/setup/_index.md", mappings)).toBe("/docs/guides/setup")
    expect(docsRouteFor("docs/guides/api/", mappings)).toBe("/docs/reference")
    expect(docsRouteFor("docs/guides/index.md", mappings)).toBe("/docs/guides")
  })
  it("returns null outside every mapping, and honours a custom base", () => {
    expect(docsRouteFor("docs/planning/spec.md", mappings)).toBeNull()
    expect(docsRouteFor("docs/guides/a.md", mappings, { base: "/v/2/docs" })).toBe("/v/2/docs/guides/a")
  })
})

describe("rewriteLinks", () => {
  it("resolves relative targets against the file's folder and leaves the rest", () => {
    const md = [
      "[a](../api/keys.md#create) [b](https://x.dev) [c](#local) [d](mailto:a@b.c)",
      "![img](../assets/shot.png \"Shot\") `[e](./code.md)`",
    ].join("\n")
    const seen: string[] = []
    const out = rewriteLinks(md, "docs/guides", (p, hash) => {
      seen.push(p + hash)
      if (p.endsWith(".png")) return `/docs-assets/${path.posix.basename(p)}`
      return docsRouteFor(p, [{ from: "docs", to: "" }])! + hash
    })
    expect(seen).toEqual(["docs/api/keys.md#create", "docs/assets/shot.png"])
    expect(out).toBe(
      [
        "[a](/docs/api/keys#create) [b](https://x.dev) [c](#local) [d](mailto:a@b.c)",
        "![img](/docs-assets/shot.png \"Shot\") `[e](./code.md)`",
      ].join("\n"),
    )
  })
  it("keeps a link when the resolver returns null", () => {
    expect(rewriteLinks("[x](y.md)", "docs", () => null)).toBe("[x](y.md)")
  })
})

describe("pageSearchRecords", () => {
  const content = [
    "# Caching",
    "",
    "How the cache works.",
    "",
    "## Invalidation",
    "Purge with `cache.clear()`.",
    "",
    "##### Edge case",
    "Rare detail.",
    "",
    "### !!!",
    "Unlinkable heading prose.",
    "",
    "### TTL",
    "Seconds.",
  ].join("\n")
  const records = pageSearchRecords({
    content,
    title: "Caching",
    description: "Cache docs.",
    href: "/docs/guides/caching/",
    group: "docs:guides",
  })

  it("gives the page one record and each H2-H4 its own, deep-linked", () => {
    expect(records.map((r) => [r.kind, r.label, r.href])).toEqual([
      ["page", "Caching", "/docs/guides/caching/"],
      ["heading", "Invalidation", "/docs/guides/caching/#invalidation"],
      ["heading", "TTL", "/docs/guides/caching/#ttl"],
    ])
    expect(records.every((r) => r.group === "docs:guides" && r.page === "Caching")).toBe(true)
  })

  it("puts prose with the record it belongs to", () => {
    const [page, invalidation, ttl] = records
    expect(page?.text).toBe("Cache docs. How the cache works. !!! Unlinkable heading prose.")
    expect(invalidation?.text).toBe("Purge with cache.clear(). Edge case Rare detail.")
    expect(ttl?.text).toBe("Seconds.")
  })

  it("caps the text", () => {
    const [page] = pageSearchRecords({ content: "x".repeat(50), title: "T", href: "/", group: "docs", maxText: 10 })
    expect(page?.text).toHaveLength(10)
  })
})

describe("copyAssets", () => {
  let tmp = ""
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }))

  it("copies images, flattened by default, and reports clashes", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "copy-assets-"))
    const from = path.join(tmp, "src")
    fs.mkdirSync(path.join(from, "deep"), { recursive: true })
    fs.writeFileSync(path.join(from, "a.png"), "a")
    fs.writeFileSync(path.join(from, "deep", "b.svg"), "b")
    fs.writeFileSync(path.join(from, "notes.txt"), "n")

    expect(copyAssets(from, path.join(tmp, "flat"))).toBe(2)
    expect(fs.readdirSync(path.join(tmp, "flat")).sort()).toEqual(["a.png", "b.svg"])
    expect(copyAssets(from, path.join(tmp, "tree"), { flatten: false })).toBe(2)
    expect(fs.existsSync(path.join(tmp, "tree", "deep", "b.svg"))).toBe(true)
    expect(copyAssets(path.join(tmp, "missing"), path.join(tmp, "x"))).toBe(0)

    fs.writeFileSync(path.join(from, "deep", "a.png"), "dup")
    expect(() => copyAssets(from, path.join(tmp, "clash"))).toThrow(/would both be copied/)
  })
})
