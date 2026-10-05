"use client"

import { SnapshotModeProvider } from "@shell/components/preview-layout"
import { previewLoader } from "@shell/lib/preview-loader"

const { Preview } = previewLoader

/**
 * Renders a component preview without the PreviewCanvas chrome.
 * The preview components still use PreviewLayout internally, but this page
 * provides a clean, minimal container for Playwright screenshots.
 *
 * Usage: /preview-snapshot/{component-name}
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
