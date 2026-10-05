import { withBasePath } from "@shell/lib/base-path"

/**
 * Inline component preview, rendered as an iframe targeting the
 * `(preview)/preview/[name]/` route. The iframe boots its own Next root
 * layout (sibling route group) which loads only `preview.css` —
 * Tailwind base + theme tokens + shadcn base layer — so previews
 * render the way a downstream consumer's app would, not the way the
 * (shell) chrome paints (custom scrollbar, html font-size clamp, prose
 * helpers, marquee/bento classes, etc.).
 *
 * Distinct from the sibling `/preview-snapshot/[name]/` route which
 * suppresses `PreviewCanvas` chrome for Playwright crops; this iframe
 * keeps the canvas (dot grid, centering, recenter / fullscreen toolbar,
 * pan + zoom) so the inline preview matches what users had pre-iframe.
 *
 * Theme + locale sync across the boundary is automatic: the iframe is
 * same-origin, so `next-themes`' localStorage and the i18n cookie are
 * shared. `<html>` `.dark` is applied by the iframe's own ThemeProvider
 * before paint via the same blocking script the parent uses.
 */
export function ComponentPreview({ name }: { name: string }) {
  return (
    <iframe
      data-component-preview-iframe
      // Trailing slash matches `next.config.ts`'s `trailingSlash: true`
      // so static export's emitted `index.html` is hit directly without
      // a 308 hop.
      src={withBasePath(`/preview/${name}/`)}
      title={`${name} preview`}
      // Layout host (`ResizablePreview`) sets the actual height; the
      // iframe stretches to fill.
      className="h-full w-full border-0 bg-transparent"
      // No third-party origins ; relax sandbox just enough to let
      // hydration + interactive primitives run.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  )
}
