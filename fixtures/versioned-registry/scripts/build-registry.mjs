// Minimal stand-in for `shadcn build`: inlines each registry.json item's
// files into public/r/<name>.json. Keeps the versioned-build fixture free of
// network access and dependency installs.
import fs from "node:fs"
import path from "node:path"

const registry = JSON.parse(fs.readFileSync("registry.json", "utf-8"))
const outDir = path.join("public", "r")
fs.mkdirSync(outDir, { recursive: true })
for (const item of registry.items) {
  const files = item.files.map((f) => ({
    ...f,
    content: fs.readFileSync(f.path, "utf-8"),
  }))
  const json = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    ...item,
    files,
  }
  fs.writeFileSync(path.join(outDir, `${item.name}.json`), JSON.stringify(json, null, 2) + "\n")
}
console.log(`[fixture] built ${registry.items.length} registry item(s)`)
