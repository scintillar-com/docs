"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { ControlEntry } from "@shell/hooks/use-controls"
import type { CameraState, CanvasPosition } from "@shell/components/preview-canvas"
import { PreviewControls } from "@shell/components/preview-controls"
import { PreviewCanvas } from "@shell/components/preview-canvas"
import { useTranslations } from "@shell/lib/i18n"

/**
 * postMessage shape used to drive iframe-level fullscreen from the
 * parent shell. PreviewLayout posts on toggle; ResizablePreview (in the
 * shell) listens, sizes the iframe wrapper to cover the shell viewport
 * (minus header), and collapses the sidebar.
 *
 * The type tag is namespaced so the listener can ignore unrelated
 * postMessage traffic (next-themes, third-party iframes, etc.).
 */
const FULLSCREEN_MESSAGE = "@sntlr/preview:fullscreen" as const

function postFullscreenToParent(value: boolean): void {
  if (typeof window === "undefined") return
  if (window.parent === window) return // not in an iframe
  window.parent.postMessage(
    { type: FULLSCREEN_MESSAGE, value } as const,
    window.location.origin,
  )
}

const SnapshotModeContext = createContext(false)

/** Wrap children in this to render PreviewLayout without the canvas chrome. */
export function SnapshotModeProvider({ children }: { children: React.ReactNode }) {
  return <SnapshotModeContext.Provider value={true}>{children}</SnapshotModeContext.Provider>
}

function useIsMobile() {
  const [mobile, setMobile] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with external matchMedia API
    setMobile(mq.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  return mobile
}

export function PreviewLayout({
  children,
  controls,
}: {
  children: React.ReactNode
  controls?: ControlEntry[]
}) {
  const isSnapshot = useContext(SnapshotModeContext)
  const hasControls = controls && controls.length > 0
  const isMobile = useIsMobile()

  const [showControls, setShowControls] = useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem("preview-controls") === "true"
  })
  // `fullscreen` is local UX state (controls toolbar icon + mobile
  // controls-toggle behavior). The actual fullscreen visual ; iframe
  // wrapper sized to cover the shell viewport ; is handled by the
  // parent shell via postMessage.
  const [fullscreen, setFullscreen] = useState(() => {
    if (typeof window === "undefined") return false
    return sessionStorage.getItem("preview-fullscreen") === "true"
  })
  const t = useTranslations()

  // Shared camera state between inline and fullscreen canvases
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 })
  const [position, setPosition] = useState<CanvasPosition>({ x: 0, y: 0 })

  // Mirror the restored-from-storage fullscreen state to the parent on
  // mount. Without this, a page-load with `preview-fullscreen=true` left
  // the iframe wrapper bounded to its inline-resize size.
  useEffect(() => {
    if (fullscreen) postFullscreenToParent(true)
    // Run only on mount; subsequent toggles are handled in
    // enter/exitFullscreen below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // In snapshot mode, render children directly — no canvas, no controls
  if (isSnapshot) {
    return <>{children}</>
  }

  const enterFullscreen = () => {
    setCamera({ x: 0, y: 0, zoom: 1 })
    setPosition({ x: 0, y: 0 })
    setFullscreen(true)
    sessionStorage.setItem("preview-fullscreen", "true")
    postFullscreenToParent(true)
  }

  function toggleControls() {
    if (isMobile) {
      if (fullscreen) {
        setShowControls((s) => {
          sessionStorage.setItem("preview-controls", String(!s))
          return !s
        })
      } else {
        setFullscreen(true)
        setShowControls(true)
        sessionStorage.setItem("preview-controls", "true")
        postFullscreenToParent(true)
      }
    } else {
      setShowControls((s) => {
        sessionStorage.setItem("preview-controls", String(!s))
        return !s
      })
    }
  }

  function exitFullscreen() {
    setCamera({ x: 0, y: 0, zoom: 1 })
    setPosition({ x: 0, y: 0 })
    setFullscreen(false)
    sessionStorage.setItem("preview-fullscreen", "false")
    if (isMobile) {
      setShowControls(false)
      sessionStorage.setItem("preview-controls", "false")
    }
    postFullscreenToParent(false)
  }

  return (
    <>
      {/* The preview always fills its iframe ; the iframe itself is
          either inline (bounded by ResizablePreview) or fullscreen
          (sized by the parent shell via postMessage). PreviewLayout
          renders the same `relative h-full` container in both modes. */}
      <div
        className="relative flex h-full w-full flex-col overflow-hidden border-y border-border bg-background"
      >
        <div className="flex-1 min-h-0 relative">
          <PreviewCanvas
            showControls={showControls}
            onToggleControls={hasControls ? toggleControls : undefined}
            fullscreen={fullscreen}
            onToggleFullscreen={fullscreen ? exitFullscreen : enterFullscreen}
            camera={camera}
            onCameraChange={setCamera}
            position={position}
            onPositionChange={setPosition}
          >
            {children}
          </PreviewCanvas>

          {/* Desktop props panel — floating card top-right */}
          {hasControls && (
            <aside
              className={`
                hidden md:flex flex-col absolute top-14 right-3 z-50 w-56 rounded-lg border border-border bg-background shadow-xl overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none
                ${showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}
              `}
              style={{ maxHeight: fullscreen ? "calc(100vh - 10rem)" : "calc(100% - 4.5rem)" }}
            >
              <div className="shrink-0 px-4 pt-4 pb-3">
                <p className="text-xs font-semibold text-foreground">
                  {t("controls.title")}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                <PreviewControls entries={controls} />
              </div>
            </aside>
          )}
        </div>

        {/* Mobile props panel — inline, pushes preview up */}
        {hasControls && (
          <div
            className="md:hidden shrink-0 border-t border-border bg-background transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none overflow-hidden flex flex-col"
            style={{ maxHeight: showControls ? "50vh" : 0 }}
          >
            <div className="shrink-0 px-4 pt-4 pb-3">
              <p className="text-xs font-semibold text-foreground">
                {t("controls.title")}
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8">
              <PreviewControls entries={controls} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
