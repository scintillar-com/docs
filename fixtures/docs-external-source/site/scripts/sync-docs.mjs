// Stand-in for a real sync script: copies the source's docs/*.md into
// content/docs/*.mdx (title from the first heading) and records the ref it
// was given, so the test can check what reached the script.
import fs from "node:fs"
import path from "node:path"

const sourceDir = process.argv[2]
if (!sourceDir) throw new Error("usage: sync-docs.mjs <sourceDir>")
const out = path.join(process.cwd(), "content", "docs")
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
for (const file of fs.readdirSync(path.join(sourceDir, "docs")).sort()) {
  if (!file.endsWith(".md")) continue
  const md = fs.readFileSync(path.join(sourceDir, "docs", file), "utf-8")
  const title = md.match(/^#\s+(.+)$/m)?.[1] ?? file
  fs.writeFileSync(path.join(out, file.replace(/\.md$/, ".mdx")), `---\ntitle: ${JSON.stringify(title)}\n---\n\n${md}`)
}
fs.writeFileSync(
  path.join(out, "_source.json"),
  JSON.stringify({
    ref: process.env.DOCS_SHELL_SOURCE_REF,
    commit: process.env.DOCS_SHELL_SOURCE_COMMIT,
    version: process.env.DOCS_SHELL_VERSION,
    sourceDir: process.env.DOCS_SHELL_SOURCE_DIR,
    siteDir: process.env.DOCS_SHELL_SITE_DIR,
  }),
)
