/**
 * `registry-shell init` — scaffold `registry-shell.config.ts` in the current
 * directory and add a `shell` script to the project's package.json.
 */
import fs from "node:fs"
import path from "node:path"

const TEMPLATE = `import { defineConfig } from "@sntlr/registry-shell"

export default defineConfig({
  branding: {
    siteName: "My UI",
    shortName: "UI",
    // siteUrl: "https://ui.example.com",
    // github: { owner: "my-org", repo: "my-ui" },
  },

  // All path overrides are optional — these are the defaults:
  // paths: {
  //   components: "components/ui",
  //   blocks: "registry/new-york/blocks",
  //   previews: "components/previews/index.ts",
  //   docs: "content/docs",
  //   registryJson: "public/r",
  //   skipBlocks: [],
  //   // Optional: your own global CSS (brand fonts, token overrides,
  //   // extra @source directives). Imported after the shell's globals so
  //   // your :root { --primary: ... } wins the cascade.
  //   // globalCss: "./styles/theme.css",
  // },
})
`

export async function run(_args: string[]): Promise<void> {
  const cwd = process.cwd()
  const configPath = path.join(cwd, "registry-shell.config.ts")

  if (fs.existsSync(configPath)) {
    console.log(`[registry-shell] Config already exists: ${configPath}`)
  } else {
    fs.writeFileSync(configPath, TEMPLATE, "utf-8")
    console.log(`[registry-shell] Wrote ${configPath}`)
  }

  // Add "shell" script to package.json if missing.
  const pkgPath = path.join(cwd, "package.json")
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>
    pkg.scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
    const scripts = pkg.scripts as Record<string, string>
    let changed = false
    if (!scripts.shell) {
      scripts.shell = "registry-shell dev"
      changed = true
    }
    if (!scripts["shell:build"]) {
      scripts["shell:build"] = "registry-shell build"
      changed = true
    }
    if (changed) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
      console.log(`[registry-shell] Added "shell" / "shell:build" scripts to package.json`)
    }
  } else {
    console.log(
      `[registry-shell] No package.json found — skipped script injection. Run \`npm init\` first.`,
    )
  }

  console.log(
    `\nNext steps:\n  1. Edit registry-shell.config.ts (branding at minimum)\n  2. Run: npm run shell`,
  )
}
