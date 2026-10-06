# @sntlr/registry-shell

## Unreleased

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
- Fonts are self-hosted with `next/font/local` instead of `next/font/google`,
  so `next build` no longer fetches Google Fonts and can't fail on a bad
  response or without network. Same families, CSS variables (`--font-sans`,
  `--font-mono`) and weights; the latin-subset woff2 files and their OFL
  licences ship in the package (about 70 KB).

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
