/**
 * Bare-render route for Playwright visual snapshots. `SnapshotPreview`
 * inside the page suppresses `PreviewCanvas` chrome via
 * `SnapshotModeProvider` so screenshots crop cleanly to the component.
 * CSS is loaded by the parent `(preview)/layout.tsx` ; this nested
 * layout just adds breathing-room padding around the component.
 */
export default function SnapshotLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="p-4 bg-background text-foreground font-sans">
      {children}
    </div>
  )
}
