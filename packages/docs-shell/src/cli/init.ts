/**
 * `docs-shell init` / `registry-shell init` — scaffold the config file in the
 * current directory and add `shell` / `shell:build` scripts to the project's
 * package.json. The binary that runs decides the file name and template: a
 * documentation site (`docs-shell.config.ts`) or a component registry
 * (`registry-shell.config.ts`).
 */
import fs from "node:fs"
import path from "node:path"
import { CLI_NAME } from "./cli-name.js"

const DOCS_TEMPLATE = `import { defineConfig } from "@sntlr/docs-shell"

export default defineConfig({
  branding: {
    siteName: "My Docs",
    shortName: "Docs",
    // siteUrl: "https://docs.example.com",
    // description: "What these docs cover.",
    // github: { owner: "my-org", repo: "my-repo" },
  },

  // Pages are the .mdx files in content/docs/ (frontmatter: title,
  // description, order). Translations sit next to their page as
  // <slug>.<locale>.mdx; list the locales to show the language toggle:
  // defaultLocale: "en",
  // locales: ["en", "fr"],

  // paths: {
  //   docs: "content/docs",
  //   // Your own CSS (fonts, token overrides), imported after the shell's.
  //   // globalCss: "./styles/theme.css",
  // },
})
`

const REGISTRY_TEMPLATE = `import { defineConfig } from "@sntlr/registry-shell"

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
  const configName = `${CLI_NAME}.config.ts`
  const configPath = path.join(cwd, configName)

  if (fs.existsSync(configPath)) {
    console.log(`[docs-shell] Config already exists: ${configPath}`)
  } else {
    fs.writeFileSync(configPath, CLI_NAME === "registry-shell" ? REGISTRY_TEMPLATE : DOCS_TEMPLATE, "utf-8")
    console.log(`[docs-shell] Wrote ${configPath}`)
  }

  // Add "shell" scripts to package.json if missing.
  const pkgPath = path.join(cwd, "package.json")
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>
    pkg.scripts = (pkg.scripts as Record<string, string> | undefined) ?? {}
    const scripts = pkg.scripts as Record<string, string>
    let changed = false
    if (!scripts.shell) {
      scripts.shell = `${CLI_NAME} dev`
      changed = true
    }
    if (!scripts["shell:build"]) {
      scripts["shell:build"] = `${CLI_NAME} build`
      changed = true
    }
    if (changed) {
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8")
      console.log(`[docs-shell] Added "shell" / "shell:build" scripts to package.json`)
    }
  } else {
    console.log(
      `[docs-shell] No package.json found — skipped script injection. Run \`npm init\` first.`,
    )
  }

  console.log(
    `\nNext steps:\n  1. Edit ${configName} (branding at minimum)\n  2. Run: npm run shell`,
  )
}
