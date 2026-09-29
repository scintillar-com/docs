# @sntlr/registry-shell

A generic Next.js viewer for shadcn-compatible component registries. Drop a
single config file into your registry project, run one command, and get a
full components + blocks + docs site on `localhost:3000` — no wiring, no
shell code to fork.

## Quickstart

```bash
cd my-registry/
npm install -D @sntlr/registry-shell
npx registry-shell init      # scaffolds registry-shell.config.ts + scripts
npm run shell                # boots the shell against your project
```

Visit <http://localhost:3000> — you'll see your components, blocks, and MDX
docs rendered with the shell's chrome (sidebar, topbar, locale toggle, dark
mode, install command, preview + source tabs).

## Configuration

Edit `registry-shell.config.ts` at the root of your registry:

```ts
import { defineConfig } from "@sntlr/registry-shell"

export default defineConfig({
  branding: {
    siteName: "My UI",
    shortName: "UI",
    siteUrl: "https://ui.example.com",
    github: { owner: "my-org", repo: "my-ui" },
  },

  // All path overrides are optional — these are the defaults:
  // paths: {
  //   components:   "components/ui",
  //   blocks:       "registry/new-york/blocks",
  //   previews:     "components/previews/index.ts",
  //   docs:         "content/docs",
  //   registryJson: "public/r",
  //   globalCss:    "./styles/theme.css",  // optional, see "Custom CSS"
  //   buildOutput:  ".next",                // optional, override if `.next` collides
  // },

  // themePanel: { since: "1.0.0" },   // optional, see "Theme panel"
})
```

The only required field is `branding`. Everything else follows shadcn
conventions out of the box.

## How it works

The shell is a published Next.js app. The CLI (`registry-shell`) resolves
the bundled app inside `node_modules/@sntlr/registry-shell`, injects
environment variables pointing at your project (`USER_REGISTRY_ROOT`,
`USER_CONFIG_PATH`), and spawns `next dev` / `next build` / `next start`
against it.

A convention-based adapter inside the shell reads your filesystem at server
startup: `components/ui/*.tsx` for components, `registry/new-york/blocks/*/`
for blocks, `content/docs/*.mdx` for docs, `public/r/*.json` for the
shadcn-compatible registry JSON. Everything is pull-based — the shell never
writes to your project (except a `.next` build cache inside its own install
location).

Previews are imported from your project's `components/previews/index.ts` via
a Next.js alias, so `next/dynamic()` with string-literal paths keeps working.
The shell's `/` route always renders a built-in component/block listing —
for a branded marketing landing, host it on a separate site.

## Commands

| Command                  | What it does                                        |
|--------------------------|-----------------------------------------------------|
| `registry-shell init`    | Scaffold `registry-shell.config.ts` + npm scripts   |
| `registry-shell dev`     | Dev server on `localhost:3000`                      |
| `registry-shell build`   | Static export → `./out/` (deploy anywhere)          |

If your registry has no config file, the shell runs in "shell-only" mode and
renders its built-in getting-started docs so you can preview the chrome
before wiring anything up.

## Custom CSS / theme tokens

To add brand fonts, override design tokens, or register extra
Tailwind `@source` scan paths, set `paths.globalCss` to a `.css` file in
your project:

```css
/* styles/theme.css */
@font-face {
  font-family: "Brand Sans";
  src: url("/fonts/brand-sans.woff2") format("woff2");
}

/* Override the shell's primary color (light + dark) */
:root { --primary: oklch(0.6 0.2 280); }
.dark { --primary: oklch(0.75 0.18 280); }

/* Scan an extra directory for Tailwind utilities */
@source "../content/marketing";
```

The file is `@import`ed at the very end of the shell's `globals.css`, so
your `:root` token redefinitions win the cascade against the shell's
defaults. Edits require a CLI restart to pick up (the CSS path is resolved
at boot); the file's contents are hot-reloaded as usual.

## Theme panel

Off by default. Set `themePanel` to turn the header's sun/moon button into a
small theme panel, so visitors can try your theme with their own brand color
before installing it:

```ts
export default defineConfig({
  branding: { /* ... */ },
  themePanel: {
    since: "1.0.0",                        // optional, see below
    controls: ["mode", "primary", "tint"], // optional, this is the default
  },
})
```

The panel has:

- **Mode**: light, dark or system (the same setting the plain toggle changes).
- **Primary color**: a color swatch and a hex input. Sets `--primary`.
- **Surface tint**: a slider from 0 to 2 (step 0.05) with a reset. Sets
  `--surface-tint`.
- **Copy CSS**: copies the resulting variables, ready to paste into your
  app's theme file:

  ```css
  :root {
    --primary: #3b82f6;
    --surface-tint: 1.25;
  }
  ```

  Values you didn't change are copied as the theme defines them. If the
  clipboard is unavailable, the CSS is shown in a text box to copy by hand.

The panel writes `--primary` and `--surface-tint` as inline custom
properties on `<html>`, so they win over `:root` and `.dark` and apply in
both modes. It's meant for themes that derive their surfaces from those two
variables (for example with CSS relative colors); with a theme that ignores
`--surface-tint`, only the primary color changes.

Changes apply live to the docs and to the component preview iframes, and
are saved in the visitor's browser (localStorage, key
`registry-shell:theme-overrides`); a reload applies them before first
paint. Previews follow through shared storage events and, where storage is
blocked, same-origin `postMessage`. "Reset all" goes back to your theme.

`controls` picks which sections appear, in order. Unknown entries are
ignored; an empty list means all three.

`since` is for versioned docs: versions older than `since` keep the plain
toggle (their theme predates the variables the panel sets). On an
unversioned site, `since` has no effect and the panel is always on.
Versioned builds tell the shell which version they render through
`NEXT_PUBLIC_SHELL_DOCS_VERSION` (see `isThemePanelEnabled` in
`src/next-app/lib/theme-panel.ts`).

## Advanced: custom adapters

For non-convention registries (database-backed metadata, non-MDX docs, etc.)
point `adapter` at a TypeScript module:

```ts
// registry-shell.config.ts
export default defineConfig({
  branding: { ... },
  adapter: "./custom-adapter",
})
```

```ts
// custom-adapter.ts
import type { ResolvedShellConfig } from "@sntlr/registry-shell"

export default function (_resolved: ResolvedShellConfig) {
  return {
    // Override only the methods you need — the rest fall through to the
    // convention-based defaults.
    getAllComponents: () => [
      { name: "my-button", label: "Button", kind: "component" as const },
    ],
  }
}
```

The factory is called once at server startup with the resolved config. It
may return any subset of the adapter interface; omitted methods use the
defaults.

## Requirements

- Node.js ≥ 18.18
- Your project uses Next.js 15 conventions (or at least its `public/`,
  `components/`, `content/` layout — the shell doesn't care if you use
  Next.js itself).

## Deploying

`registry-shell build` produces a **pure static export** under `./out/` —
HTML, JS, CSS, and JSON files with no server runtime required. Same
deployment model as Storybook, Docusaurus, MkDocs, etc.

Deploy `out/` to anything that serves static files:

- **Vercel** — push the repo, Vercel auto-detects Next.js with
  `output: "export"` and serves `out/` from its edge CDN. No custom
  build command, no Output Directory override. Just push.
- **Netlify** — `netlify.toml` with `publish = "out"`.
- **GitHub Pages** — upload `out/` as the Pages artifact.
- **S3 / CloudFront** — `aws s3 sync out/ s3://your-bucket/`.
- **Local / self-host** — `npx serve out/` or any static file server.

The shadcn URL contract is preserved: `https://your-domain/r/button.json`
serves the same bytes consumers' `npx shadcn add` commands expect.

> v1.x users: the shell previously produced a serverful Next.js build
> that needed Vercel's `@vercel/next` integration. v2.0 switched to
> static export to sidestep an entire class of file-tracing issues
> when the shell's Next app lives inside `node_modules`. The trade-off
> is no runtime SSR / no API routes — registries that need those
> patterns aren't served by this shell.

## Releasing

Publishing is tag-triggered via GitHub Actions. To cut a release:

```bash
npm version patch          # or minor / major — bumps package.json, commits, tags
git push --follow-tags     # pushes the commit + the new tag together
```

The push of `v*` fires `.github/workflows/publish.yml`, which reruns lint +
type-check + tests, verifies the tag matches `package.json`'s version, and
publishes to npm with provenance. Requires an `NPM_TOKEN` secret in the
repo (npm automation token with write access to the `@sntlr` scope).

Every push to `main` and every PR also runs `.github/workflows/test.yml`
(lint, type-check, build, unit tests) — that's the gate the release
workflow leans on, so green there means a tag push will publish cleanly.

## License

MIT
