import { SnapshotModeProvider } from "@shell/components/preview-layout"
import { previewLoader } from "@shell/lib/preview-loader"

const { Preview } = previewLoader

/**
 * Renders a component preview without the PreviewCanvas chrome.
 * The preview components still use PreviewLayout internally, but this page
 * provides a clean, minimal container for Playwright screenshots.
 *
 * Usage: /preview-snapshot/{component-name}
 *
 * Deliberately a Server Component, like the `/preview/[name]` page: the
 * user's `Preview` (a map of `next/dynamic` imports) has to run on the
 * server side of the RSC boundary. Rendered from a Client Component
 * instead, each `dynamic()` becomes a `React.lazy` that suspends during
 * SSR but not in the same place on hydration, so the tree-position part
 * of every `React.useId()` in the preview (Radix ids, SVG gradient ids)
 * differs between server and client and React reports a hydration
 * mismatch. `SnapshotModeProvider` is a Client Component and takes the
 * server-rendered preview as children.
 */
export function SnapshotPreview({ name }: { name: string }) {
  return (
    <SnapshotModeProvider>
      <div data-snapshot-target className="inline-block">
        <Preview
          name={name}
          fallback={
            <p className="text-sm text-muted-foreground">No preview for {name}</p>
          }
        />
      </div>
    </SnapshotModeProvider>
  )
}
