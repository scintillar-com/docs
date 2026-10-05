"use client"

import { useCallback, useRef, useState, useEffect } from "react"
import { useMobileSidebar } from "@shell/components/sidebar-provider"

const STORAGE_KEY = "preview-height"
const FULLSCREEN_STORAGE_KEY = "preview-fullscreen"
const FULLSCREEN_MESSAGE = "@sntlr/preview:fullscreen"
const DEFAULT_HEIGHT_DESKTOP = 384
const DEFAULT_HEIGHT_MOBILE = 600
const MIN_HEIGHT = 200
const MAX_HEIGHT = 1000

function getDefaultHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT_DESKTOP
  return window.matchMedia("(max-width: 767px)").matches
    ? DEFAULT_HEIGHT_MOBILE
    : DEFAULT_HEIGHT_DESKTOP
}

function getStoredHeight(): number {
  if (typeof window === "undefined") return DEFAULT_HEIGHT_DESKTOP
  const stored = sessionStorage.getItem(STORAGE_KEY)
  if (stored) {
    const n = Number(stored)
    if (!isNaN(n)) return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, n))
  }
  return getDefaultHeight()
}

function getStoredFullscreen(): boolean {
  if (typeof window === "undefined") return false
  return sessionStorage.getItem(FULLSCREEN_STORAGE_KEY) === "true"
}

export function ResizablePreview({ children }: { children: React.ReactNode }) {
  const [height, setHeight] = useState(getStoredHeight)
  // Tracked in state (not just a ref) so we can flip a CSS class that
  // disables iframe pointer events while dragging — without it, the
  // cursor crossing into a child iframe interrupts the document-level
  // mousemove/mouseup handlers (events fire inside the iframe instead)
  // and the drag silently dies, especially when shrinking the preview.
  const [isDragging, setIsDragging] = useState(false)
  // The iframe drives the fullscreen toggle (button lives inside
  // PreviewCanvas, which renders inside the iframe). We listen for its
  // postMessage and size the iframe wrapper to cover the shell viewport
  // (minus the 3.5rem header) so the iframe element itself appears
  // fullscreen rather than the iframe's *contents* trying to fullscreen
  // within their bounded box.
  const [isFullscreen, setIsFullscreen] = useState(getStoredFullscreen)
  const dragging = useRef(false)
  const startY = useRef(0)
  const startH = useRef(0)
  const { setCollapsed } = useMobileSidebar()

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, String(height))
  }, [height])

  // Listen for fullscreen toggle messages from the inline preview iframe.
  // Only accept same-origin messages (paranoid — the iframe is
  // /preview/[name]/ on the same origin) so unrelated postMessage chatter
  // (next-themes, third-party widgets) can't drive the shell layout.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data
      if (
        typeof data === "object" &&
        data !== null &&
        "type" in data &&
        data.type === FULLSCREEN_MESSAGE &&
        "value" in data &&
        typeof data.value === "boolean"
      ) {
        setIsFullscreen(data.value)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // Collapse the docs/components sidebar when fullscreen is on so the
  // preview gets the whole content column. Restoring the sidebar on
  // exit is done in the same effect so the user's prior sidebar state
  // isn't clobbered if they were already collapsed for other reasons —
  // we only act on the transition.
  useEffect(() => {
    if (isFullscreen) setCollapsed(true)
    else setCollapsed(false)
  }, [isFullscreen, setCollapsed])

  // Esc exits fullscreen — handled here at the parent so we don't have
  // to round-trip through the iframe. We also clear sessionStorage so
  // a navigation away + back doesn't restore fullscreen on the next page.
  useEffect(() => {
    if (!isFullscreen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      setIsFullscreen(false)
      sessionStorage.setItem(FULLSCREEN_STORAGE_KEY, "false")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    setIsDragging(true)
    startY.current = e.clientY
    startH.current = height
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"

    function onMouseMove(ev: MouseEvent) {
      if (!dragging.current) return
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH.current + (ev.clientY - startY.current)))
      setHeight(newH)
    }

    function onMouseUp() {
      dragging.current = false
      setIsDragging(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [height])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    dragging.current = true
    setIsDragging(true)
    startY.current = e.touches[0].clientY
    startH.current = height

    function onTouchMove(ev: TouchEvent) {
      if (!dragging.current || ev.touches.length !== 1) return
      ev.preventDefault()
      const newH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startH.current + (ev.touches[0].clientY - startY.current)))
      setHeight(newH)
    }

    function onTouchEnd() {
      dragging.current = false
      setIsDragging(false)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onTouchEnd)
    }

    document.addEventListener("touchmove", onTouchMove, { passive: false })
    document.addEventListener("touchend", onTouchEnd)
  }, [height])

  return (
    <div data-resize-dragging={isDragging || undefined}>
      {/* Iframe wrapper. In fullscreen, escapes document flow and covers
          the shell viewport below the 3.5rem header. The iframe's own
          internal layout (toolbar + mobile props panel at bottom) keeps
          rendering normally — it just has the whole screen now. */}
      <div
        className={
          isFullscreen
            ? "fixed left-0 right-0 top-14 bottom-0 z-40"
            : "relative"
        }
        style={isFullscreen ? undefined : { height }}
      >
        {children}
        {/* Transparent overlay while dragging — sits on top of any iframe
            child so mousemove keeps firing on the document and the drag
            survives the cursor crossing into the iframe. The overlay's
            cursor matches the resize handle so feedback is consistent. */}
        {isDragging && (
          <div
            className="absolute inset-0 z-10 cursor-row-resize"
            aria-hidden="true"
          />
        )}
      </div>
      {/* Resize handle is meaningless when the iframe is fullscreen ;
          hide it so it can't be grabbed and so the keyboard order
          stays clean. */}
      {!isFullscreen && (
        <div
          className="h-3 md:h-2 cursor-row-resize flex items-center justify-center hover:bg-primary/10 active:bg-primary/10 transition-colors group touch-none"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          <div className="w-8 h-0.5 rounded-full bg-border group-hover:bg-primary transition-colors" />
        </div>
      )}
    </div>
  )
}
