import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ResolvedShellConfig } from "../config-loader"
import { createFsDocsSource } from "./fs-docs-source"

let tmp: string
const page = (rel: string, frontmatter: Record<string, unknown>, body = "Body") => {
  const file = path.join(tmp, "docs", rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join("\n")
  fs.writeFileSync(file, `---\n${fm}\n---\n${body}\n`)
}
const source = (opts: { multilocale?: boolean; defaultLocale?: string } = {}) =>
  createFsDocsSource({
    paths: { docs: path.join(tmp, "docs") },
    multilocale: opts.multilocale ?? false,
    defaultLocale: opts.defaultLocale ?? "",
  } as unknown as ResolvedShellConfig)

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fs-docs-"))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe("single-folder layout", () => {
  it("lists pages sorted by order, then slug", () => {
    page("b.mdx", { title: "B", order: 2 })
    page("a.mdx", { title: "A", order: 2 })
    page("intro.mdx", { title: "Intro", order: 1, description: "Start here" })
    page("misc.mdx", { title: "Misc" })
    const docs = source().getAllDocs()
    expect(docs.map((d) => d.slug)).toEqual(["intro", "a", "b", "misc"])
    expect(docs[0]).toMatchObject({ title: "Intro", description: "Start here", order: 1, titles: { en: "Intro" } })
    expect(docs[3].order).toBe(999)
  })

  it("accepts a quoted order and falls back to the slug as title", () => {
    page("late.mdx", { order: "5" })
    page("early.mdx", { order: 1 })
    const docs = source().getAllDocs()
    expect(docs.map((d) => [d.slug, d.order, d.title])).toEqual([
      ["early", 1, "early"],
      ["late", 5, "late"],
    ])
  })

  it("treats <slug>.<locale>.mdx as a translation of an existing page", () => {
    page("intro.mdx", { title: "Getting started" }, "Hello")
    page("intro.fr.mdx", { title: "Démarrage" }, "Bonjour")
    const src = source()
    const docs = src.getAllDocs()
    expect(docs.map((d) => d.slug)).toEqual(["intro"])
    expect(docs[0].titles).toEqual({ en: "Getting started", fr: "Démarrage" })
    expect(src.getDocBySlug("intro", "fr")?.content.trim()).toBe("Bonjour")
    expect(src.getDocBySlug("intro", "fr")?.meta.title).toBe("Démarrage")
    expect(src.getDocBySlug("intro", "de")?.content.trim()).toBe("Hello")
    expect(Object.keys(src.getDocAllLocales("intro")).sort()).toEqual(["en", "fr"])
  })

  it("keeps a dotted page name as its own page when no base page exists", () => {
    page("v1.2-notes.mdx", { title: "1.2 notes" })
    page("release.fr.mdx", { title: "Version" })
    const docs = source().getAllDocs()
    expect(docs.map((d) => d.slug).sort()).toEqual(["release.fr", "v1.2-notes"])
  })

  it("treats <slug>.<baseLocale>.mdx as a page, not a translation", () => {
    page("intro.mdx", { title: "Intro" })
    page("intro.en.mdx", { title: "Intro EN" })
    expect(source().getAllDocs().map((d) => d.slug).sort()).toEqual(["intro", "intro.en"])
  })

  it("keys the base file by the configured default locale", () => {
    page("intro.mdx", { title: "Démarrage" })
    page("intro.en.mdx", { title: "Getting started" })
    const src = source({ defaultLocale: "fr" })
    expect(src.getAllDocs()[0].titles).toEqual({ fr: "Démarrage", en: "Getting started" })
    expect(Object.keys(src.getDocAllLocales("intro")).sort()).toEqual(["en", "fr"])
  })

  it("returns nothing for unknown slugs or a missing docs folder", () => {
    expect(source().getAllDocs()).toEqual([])
    expect(source().getDocBySlug("nope")).toBeNull()
    expect(source().getDocAllLocales("nope")).toEqual({})
  })
})

describe("locale-folder layout", () => {
  it("lists the default locale's pages with titles from every locale", () => {
    page("en/intro.mdx", { title: "Intro", order: 1 }, "Hello")
    page("en/guide.mdx", { title: "Guide", order: 2 })
    page("fr/intro.mdx", { title: "Introduction" }, "Bonjour")
    page("fr/only-fr.mdx", { title: "Seulement FR" })
    const src = source({ multilocale: true, defaultLocale: "en" })
    const docs = src.getAllDocs()
    expect(docs.map((d) => d.slug)).toEqual(["intro", "guide"])
    expect(docs[0].titles).toEqual({ en: "Intro", fr: "Introduction" })
    expect(src.getDocBySlug("intro", "fr")?.content.trim()).toBe("Bonjour")
    expect(src.getDocBySlug("guide", "fr")?.meta.title).toBe("Guide")
    expect(src.getDocAllLocales("intro")).toEqual({ en: "Hello\n", fr: "Bonjour\n" })
  })

  it("also accepts <slug>.<locale>.mdx next to the page, folder wins on conflict", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    page("en/intro.mdx", { title: "Intro" }, "Hello")
    page("en/intro.de.mdx", { title: "Einführung" }, "Hallo")
    page("en/intro.fr.mdx", { title: "Variant FR" }, "Variante")
    page("fr/intro.mdx", { title: "Dossier FR" }, "Dossier")
    const src = source({ multilocale: true, defaultLocale: "en" })
    expect(src.getAllDocs()[0].titles).toEqual({ en: "Intro", de: "Einführung", fr: "Dossier FR" })
    expect(src.getDocBySlug("intro", "fr")?.content.trim()).toBe("Dossier")
    expect(src.getDocBySlug("intro", "de")?.content.trim()).toBe("Hallo")
    expect(warn).toHaveBeenCalledOnce()
  })
})
