import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  METADATA_FILE,
  buildChangeIndexes,
  hashContent,
  normaliseItem,
  readRegistryItems,
  writeChangeIndexes,
  type ChangeIndex,
} from "./version-changes.js"

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rs-changes-test-"))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

const item = (content: string, extra: Record<string, unknown> = {}) => ({
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "button",
  type: "registry:ui",
  files: [{ path: "registry/ui/button.tsx", type: "registry:ui", content }],
  ...extra,
})

function writeItem(dir: string, name: string, json: unknown): void {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(json))
}

describe("normaliseItem", () => {
  it("maps files to contents and adds the metadata pseudo file", () => {
    const files = normaliseItem(item("a\r\nb\r\n", { dependencies: ["clsx"] }))!
    expect(files["registry/ui/button.tsx"]).toBe("a\nb\n")
    const meta = JSON.parse(files[METADATA_FILE])
    expect(meta).toEqual({
      name: "button",
      type: "registry:ui",
      dependencies: ["clsx"],
      files: [{ path: "registry/ui/button.tsx", type: "registry:ui" }],
    })
  })

  it("rejects JSON that isn't a registry item", () => {
    expect(normaliseItem({ name: "x", items: [] })).toBeNull()
    expect(normaliseItem(null)).toBeNull()
    expect(normaliseItem("text")).toBeNull()
  })
})

describe("readRegistryItems", () => {
  it("reads top-level items only, skipping the index, junk and v* subdirs", () => {
    writeItem(tmp, "button", item("x"))
    writeItem(tmp, "registry", { name: "reg", items: [] })
    fs.writeFileSync(path.join(tmp, "broken.json"), "{")
    writeItem(path.join(tmp, "v1.0.0"), "old", item("y"))
    expect([...readRegistryItems(tmp).keys()]).toEqual(["button"])
    expect(readRegistryItems(path.join(tmp, "missing")).size).toBe(0)
  })
})

describe("buildChangeIndexes / writeChangeIndexes", () => {
  it("records every version (absent = null) and stores each content once", () => {
    const [button, card] = buildChangeIndexes([
      { version: "1.0.0", items: new Map([["button", { "b.tsx": "v1" }]]) },
      { version: "1.1.0", items: new Map([["button", { "b.tsx": "v1" }], ["card", { "c.tsx": "c" }]]) },
      { version: "", items: new Map([["button", { "b.tsx": "v2" }], ["card", { "c.tsx": "c" }]]) },
    ])
    expect(button.name).toBe("button")
    expect(button.versions).toEqual([
      { version: "1.0.0", files: { "b.tsx": hashContent("v1") } },
      { version: "1.1.0", files: { "b.tsx": hashContent("v1") } },
      { version: "", files: { "b.tsx": hashContent("v2") } },
    ])
    expect(Object.values(button.blobs).sort()).toEqual(["v1", "v2"])
    expect(card.versions[0]).toEqual({ version: "1.0.0", files: null })
  })

  it("writes /changes/<name>.json and skips missing sources", () => {
    writeItem(path.join(tmp, "a"), "button", item("one"))
    writeItem(path.join(tmp, "b"), "button", item("two"))
    const out = path.join(tmp, "out")
    fs.mkdirSync(path.join(out, "changes"), { recursive: true })
    fs.writeFileSync(path.join(out, "changes/stale.json"), "{}")

    const count = writeChangeIndexes(out, [
      { version: "1.0.0", dir: path.join(tmp, "a") },
      { version: "1.1.0", dir: path.join(tmp, "nope") },
      { version: "", dir: path.join(tmp, "b") },
    ])
    expect(count).toBe(1)
    expect(fs.readdirSync(path.join(out, "changes"))).toEqual(["button.json"])
    const index = JSON.parse(fs.readFileSync(path.join(out, "changes/button.json"), "utf-8")) as ChangeIndex
    expect(index.versions.map((v) => v.version)).toEqual(["1.0.0", ""])
  })
})
