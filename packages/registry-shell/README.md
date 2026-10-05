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
  // categories: { Forms: ["input", "select"], Layout: ["card"] },
  // previewHeight: { "data-table": 640 }, // optional, see "Component pages"
})
```

The only required field is `branding`. Everything else follows shadcn
conventions out of the box.

### Component pages

**Sidebar categories.** `categories` groups components into collapsible
sections of the Components sidebar. Sections appear in the order you
declare the keys; components not listed anywhere go into a final "Base"
section (heading translatable via the `sidebar.base` key in
`extraTranslations`). Inside a section, components are sorted by label.

**Preview height.** Each component page shows its preview in a resizable
box, 384px tall by default (600px on phones). `previewHeight` sets a
different starting height per component, in pixels, keyed by component
name:

```ts
previewHeight: {
  "data-table": 640,
  calendar: 520,
},
```

Values are clamped to the resize range (200 to 1000). Once a visitor
drags the resize handle, their height is kept for the rest of the browser
tab and wins over the configured one.

**Interacting with a preview.** The preview sits on a pan/zoom canvas.
Scrolling over the component scrolls it (lists, scroll areas); scrolling
over the empty canvas, Ctrl/Cmd + scroll or a trackpad pinch zooms. Arrow
keys pan, `+` / `-` zoom and `0` recenters, except while focus is in one of
the component's inputs or widgets (sliders, tabs, menus, listboxes...). A
preview whose root is `w-full` takes the canvas width; narrower ones stay
centred.

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
With `versions` on, each snapshot is compared to `since`; the latest
site always shows the panel.

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

## Versioned docs and registry

Opt in with `versions` to publish a frozen, browsable copy of every release
next to the latest site:

```ts
// registry-shell.config.ts
export default defineConfig({
  branding: { ... },
  versions: {
    // All optional — these are the defaults:
    // tags: "v*",                                           // git tag glob
    // cacheDir: "node_modules/.cache/registry-shell/versions",
    // registryBuildCommand: "npx shadcn build",
    // installCommand: <detected from the lockfile>,
    // changelog: "CHANGELOG.md",                            // Releases page source
  },
})
```

`registry-shell build` then produces:

| URL                     | Content                                               |
|-------------------------|-------------------------------------------------------|
| `/`                     | Latest site, built from the working tree (as before)  |
| `/r/<name>.json`        | Latest registry JSON                                  |
| `/v/<version>/`         | Frozen site of each matching tag                      |
| `/r/v<version>/<name>.json` | Frozen registry JSON of each matching tag         |
| `/versions.json`        | Manifest: `{ latest, versions: [{ version, tag, commit, date, isLatest, path, registry }] }` |
| `/changes/<name>.json`  | Change history of each registry item, read by the "Changes" tab |
| `/releases/`            | Releases page, when the changelog exists (also `/v/<version>/releases/`) |

So `npx shadcn add https://ui.example.com/r/v1.0.0/button.json` keeps
installing exactly what shipped in 1.0.0, and each snapshot's install tab
points at its own `/r/v<version>/` URLs.

The header gets a version switcher (it keeps the current page when it
exists in the target version, otherwise opens that version's home), and
every version other than the newest release shows a banner linking back to
the latest site. Both read `/versions.json` at runtime, so an older
snapshot always knows about newer releases.

**How snapshots are built.** The version is the trailing semver of the tag
name (`v1.2.0`, `my-ui@1.2.0`); tags without one are ignored, and the
newest stable version is "latest". For each tag the shell checks out the
tag's commit in a temporary `git worktree`, installs its dependencies, runs
`registryBuildCommand`, then builds that checkout's components, docs,
previews and config with the **current** shell under the `/v/<version>`
base path. Tags that predate your shell config are skipped; any other
failure fails the build (narrow `tags` to exclude a tag that can't be
built).

**Caching.** A built snapshot is stored in `cacheDir`, keyed by version and
tag commit, so a deploy only rebuilds latest plus new tags. Entries also
record the shell version: upgrading `@sntlr/registry-shell` rebuilds every
snapshot once so old versions pick up shell fixes (their content stays
frozen). Keep `cacheDir` in a location your CI persists between builds.

**CI notes.** Tags must be present in the clone: many CI checkouts are
shallow and tagless (e.g. GitHub Actions' `actions/checkout` needs
`fetch-depth: 0`; elsewhere run `git fetch --tags --unshallow` first). The
build logs a hint when a shallow clone has no matching tag.

**Releases page.** When `changelog` (default `CHANGELOG.md`, relative to
the config; `""` turns it off) exists, `/releases` renders it, linked from
the Documentation sidebar. The expected format is the one
[changesets](https://github.com/changesets/changesets) writes: one
`## <version>` section per release (newest first) with `### Major Changes`
/ `### Minor Changes` / `### Patch Changes` lists. Any `## ` heading
containing a semver works (`## v1.2.0`, `## [1.2.0] - 2026-09-29`);
entries are rendered as plain Markdown (GFM), not MDX. Each section is
tagged with its kinds of change, marks the newest release, and links to
that version's docs when a snapshot of it is published (both read from
`/versions.json` at runtime). Each snapshot renders the changelog as it
was at its tag; tags without the file get no Releases page.

**Changes tab.** Component pages get a "Changes" tab with a unified diff of
the item's registry files between two versions, defaulting to the
previous version → the one being viewed (on the latest site, the newest
release → the working tree). Readers can pick any two versions. When
nothing changed it says "Unchanged since v1.0.0"; when the item didn't
exist in the older version, "Added in v1.1.0". The diff covers every file
of the registry item plus its metadata (dependencies,
`registryDependencies`, file targets, `cssVars`...), so a dependency bump
shows up too.

The history is computed at build time from each version's registry JSON
(the files published under `/r/v<version>/`, plus the working tree's for
latest) and written to `/changes/<name>.json` at the site root: every
version's file hashes plus each distinct file content once, so one fetch
lets the browser diff any pair of versions. Like `/versions.json`, it is
regenerated on every deploy, so cached snapshots of older versions know
about later releases.

Without `versions`, the build output is exactly the single latest site:
no Releases page, no Changes tab, no `/changes/`.

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
