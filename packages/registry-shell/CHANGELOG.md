# @sntlr/registry-shell

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
