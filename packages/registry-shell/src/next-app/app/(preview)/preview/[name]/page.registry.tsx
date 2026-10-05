import { notFound } from "next/navigation"
import { getAllComponents } from "@shell/lib/components-nav"
import { previewLoader } from "@shell/lib/preview-loader"

const { Preview } = previewLoader

/**
 * Iframe-targeted preview for the inline `/components/[name]` page.
 *
 * Renders the user's preview through the normal `PreviewLayout`
 * pipeline ; that means `PreviewCanvas` (dot grid + centering + pan/zoom
 * + recenter / fullscreen toolbar) wraps the component, exactly as it
 * did before previews moved into iframes.
 *
 * Distinct from the sibling `/preview-snapshot/[name]/` route which uses
 * `SnapshotModeProvider` to suppress the canvas for Playwright visual
 * snapshots ; both routes share the (preview) root layout and its
 * minimal `preview.css` (Tailwind base + theme tokens + shadcn base
 * layer) so isolation from shell chrome is identical.
 */
export function generateStaticParams() {
  return getAllComponents().map((comp) => ({ name: comp.name }))
}

export default async function IframePreviewPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const comp = getAllComponents().find((c) => c.name === name)
  if (!comp) notFound()

  return (
    <div className="fixed inset-0">
      <Preview
        name={name}
        fallback={
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No preview for {name}
          </div>
        }
      />
    </div>
  )
}
