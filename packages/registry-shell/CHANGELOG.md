# @sntlr/registry-shell

## 2.8.2

### Patch Changes

- `registry-shell dev`: fix intermittent 500s ("Unexpected end of JSON
  input") on the first requests to `/preview/<name>` and
  `/preview-snapshot/<name>` of a fresh dev server, worst with several
  requests at once (parallel Playwright workers). Next's dev server rewrites
  `.next/prerender-manifest.json` non-atomically when it first resolves
  `generateStaticParams` for a route, and concurrent requests read it
  mid-write or interleave writes. The CLI now preloads a small hook into the
  Next process that serializes reads and writes of the `.next/*-manifest.json`
  files and writes them atomically (temp file + rename). Set
  `REGISTRY_SHELL_ATOMIC_MANIFESTS=0` to turn it off. The shell's own search
  index and mode stamp are also written atomically now.
- `/preview-snapshot/<name>`: fix a hydration mismatch for previews that use
  `React.useId` (Radix ids, SVG gradient ids). The snapshot page rendered the
  registry's `next/dynamic` preview map from a Client Component, where the
  lazy import suspends during SSR and shifts the ids. It now renders the
  preview from a Server Component, like `/preview/<name>`.
- `/preview/<name>`: fix a hydration mismatch when the visitor had left the
  preview fullscreen or with its controls open. The saved state was read
  from sessionStorage during the first render; it is now restored right
  after hydration.
- `/components/<name>`: fix a hydration mismatch on the inline preview's
  height on phones, and for visitors who had resized or fullscreened a
  preview. The height came from `matchMedia` and sessionStorage during the
  first render. The default height (384px, 600px on phones) is now set in
  CSS, and a saved height or fullscreen is restored right after hydration.
- Header: the section tabs no longer overlap the actions at tablet widths.
- Fonts are self-hosted with `next/font/local` instead of `next/font/google`,
  so `next build` no longer fetches Google Fonts and can't fail on a bad
  response or without network. Same families, CSS variables (`--font-sans`,
  `--font-mono`) and weights; the latin-subset woff2 files and their OFL
  licences ship in the package (about 70 KB).

## 2.8.1

### Patch Changes

- Same features as 2.8.0, which never reached npm: its release commit left
  `pnpm-lock.yaml` with the old internal pin, so the publish workflow's
  `--frozen-lockfile` install failed. `pnpm release` now updates the lockfile
  with the bumped pin, and gains `--no-tag` for releasing through a pull
  request.

## 2.8.0

Not published to npm (see 2.8.1).

### Minor Changes

- The shell is split into two packages that share one version.
  `@sntlr/docs-shell` is the engine, with its own `docs-shell` bin and
  `docs-shell.config.*`. `@sntlr/registry-shell` is a preset that turns on
  the component registry. Its bin, `registry-shell.config.ts` and
  `@sntlr/registry-shell/shell/*` imports work as before.
- Docs-only sites: the docs source is separate from the registry adapter
  (custom adapters keep working through a shim), sites without a registry
  get a docs homepage, and registry routes are only compiled when the
  registry is on.
- Nested docs: folders at any depth, with `_index` or `index` pages at the
  folder's URL. Top-level folders become sections, with a header tab, a
  sidebar block and a homepage card, and can be configured with
  `sections: [{ dir, label, icon }]`. Flat URLs are unchanged.
- The sidebar is recursive, remembers which folders are open, and can be
  resized from 180 to 520px (at most 40% of the window).
- Translations as `<name>.<locale>.mdx` next to the page, and locales
  beyond English and French.
- Search: one result per page intro and per H2 to H4 heading, linking to
  the heading. One index per locale, a ranked dialog with a filter per
  section, and links to a `#section` that scroll to it.
- New `@sntlr/docs-shell/content` export with helpers for sync scripts:
  `slugify`, `escapeMdx`, `rewriteLinks`, `docsRouteFor`, frontmatter
  helpers, `copyAssets` and `pageSearchRecords`.
- Versions built from another repository's tags with `versions.source`
  (`repo`, `sync`, `syncOutputs`, `tokenEnv`, `ref`). Each tag's build is
  cached by source commit, site files and shell version. Also
  `versions.minVersion`, and `versions.current.label` to label the root
  build (for example "develop") with a banner and a switcher entry.

### Patch Changes

- Site titles come from `branding` instead of a hard-coded "UI Registry".
- The site's `public/` folder is overlaid onto the shell's safely, and
  restored after the build or dev server stops, even after a crash.
- `dev` builds the search index.
- Headings with inline code get anchors.

## 2.7.0

### Minor Changes

- Add `previewHeight` to the config: a default height in pixels for the
  inline preview of specific components (`previewHeight: { "data-table": 640 }`),
  clamped to 200..1000. A height the visitor sets with the resize handle is
  still kept for the browser tab, and only a dragged height is persisted now,
  so visiting one component no longer pins the next one to its height.

### Patch Changes

- Preview canvas: a plain mouse wheel over the component now scrolls it
  (scroll areas, lists, `overflow-auto` boxes). Zoom with Ctrl/Cmd + wheel,
  a trackpad pinch, or the wheel over the empty canvas.
- Preview canvas: arrow, `+`, `-` and `0` shortcuts no longer fire when focus
  is inside an interactive element of the component (inputs, buttons,
  sliders, tabs, menus, listboxes, grids, trees...) or when the component
  already handled the key. Arrow keys on a slider move the slider.
- Preview canvas: a preview whose root is `w-full` now takes the canvas width
  instead of collapsing to its content width. Narrower previews stay centred.
- Sidebar: category groups follow the order of the `categories` keys in the
  config instead of being sorted alphabetically; the "Base" group of
  uncategorized components is always last.
- Sidebar: fix a hydration mismatch when a category group was collapsed in
  a previous visit. Groups render open on the server and on the first client
  render, then apply the saved state.
