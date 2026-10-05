"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Crosshair, SlidersHorizontal, Maximize, X } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"

const DOT_SPACING = 24
const DOT_RADIUS = 1
const PROXIMITY_RADIUS = 120
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

export interface CameraState {
  x: number
  y: number
  zoom: number
}

export interface CanvasPosition {
  x: number
  y: number
}

export function PreviewCanvas({
  children,
  showControls,
  onToggleControls,
  fullscreen,
  onToggleFullscreen,
  camera: cameraProp,
  onCameraChange,
  position: posProp,
  onPositionChange,
}: {
  children: ReactNode
  showControls?: boolean
  onToggleControls?: () => void
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  camera?: CameraState
  onCameraChange?: (camera: CameraState) => void
  position?: CanvasPosition
  onPositionChange?: (pos: CanvasPosition) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // Use controlled state if provided, otherwise internal
  const [internalCamera, setInternalCamera] = useState({ x: 0, y: 0, zoom: 1 })
  const [internalPos, setInternalPos] = useState({ x: 0, y: 0 })
  const camera = cameraProp ?? internalCamera
  const pos = posProp ?? internalPos
  const cameraRef = useRef(camera)
  const posRef = useRef(pos)
  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => { posRef.current = pos }, [pos])

  const setCamera: React.Dispatch<React.SetStateAction<CameraState>> = useCallback((v) => {
    const next = typeof v === "function" ? v(cameraRef.current) : v
    if (onCameraChange) onCameraChange(next)
    else setInternalCamera(next)
  }, [onCameraChange])

  const setPos: React.Dispatch<React.SetStateAction<CanvasPosition>> = useCallback((v) => {
    const next = typeof v === "function" ? v(posRef.current) : v
    if (onPositionChange) onPositionChange(next)
    else setInternalPos(next)
  }, [onPositionChange])

  const mouseRef = useRef({ x: -1000, y: -1000 })
  const dragging = useRef<"pan" | "move" | null>(null)
  const dragStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 })

  // Draw dot grid — use a ref so the rAF loop always calls the latest version
  const drawDotsRef = useRef<() => void>(() => {})

  const drawDots = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, rect.width, rect.height)

    const { x: camX, y: camY, zoom } = camera
    // Keep spacing constant in screen space — never denser than base
    const spacing = DOT_SPACING
    const mx = mouseRef.current.x
    const my = mouseRef.current.y

    // Offset for panning (dots scroll with camera)
    const offsetX = ((camX * zoom) % spacing + spacing) % spacing
    const offsetY = ((camY * zoom) % spacing + spacing) % spacing

    const isDark = document.documentElement.classList.contains("dark")
    const dotColor = isDark ? "255,255,255" : "0,0,0"
    const dotRadius = Math.max(DOT_RADIUS, DOT_RADIUS * zoom)

    for (let x = offsetX - spacing; x < rect.width + spacing; x += spacing) {
      for (
        let y = offsetY - spacing;
        y < rect.height + spacing;
        y += spacing
      ) {
        const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2)
        const proximity = Math.max(0, 1 - dist / PROXIMITY_RADIUS)
        const alpha = 0.08 + proximity * 0.35
        ctx.fillStyle = `rgba(${dotColor}, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    animRef.current = requestAnimationFrame(() => drawDotsRef.current())
  }, [camera])

  useEffect(() => {
    drawDotsRef.current = drawDots
  }, [drawDots])

  useEffect(() => {
    animRef.current = requestAnimationFrame(() => drawDotsRef.current())
    return () => cancelAnimationFrame(animRef.current)
  }, [drawDots])

  // Track mouse for dot proximity
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }

      if (dragging.current === "pan") {
        const dx = (e.clientX - dragStart.current.mx) / camera.zoom
        const dy = (e.clientY - dragStart.current.my) / camera.zoom
        setCamera((c) => ({
          ...c,
          x: dragStart.current.cx + dx,
          y: dragStart.current.cy + dy,
        }))
      } else if (dragging.current === "move") {
        const dx = (e.clientX - dragStart.current.mx) / camera.zoom
        const dy = (e.clientY - dragStart.current.my) / camera.zoom
        setPos({
          x: dragStart.current.cx + dx,
          y: dragStart.current.cy + dy,
        })
      }
    },
    [camera.zoom, setCamera, setPos]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on background (canvas) clicks
      if (e.target === canvasRef.current) {
        dragging.current = "pan"
        dragStart.current = {
          mx: e.clientX,
          my: e.clientY,
          cx: camera.x,
          cy: camera.y,
        }
        e.preventDefault()
      }
    },
    [camera.x, camera.y]
  )

  const componentWrapperRef = useRef<HTMLDivElement>(null)

  const onComponentMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start move-drag when clicking the wrapper itself (the padding
      // area), not on interactive children inside the component.
      if (e.target !== componentWrapperRef.current) return

      dragging.current = "move"
      dragStart.current = {
        mx: e.clientX,
        my: e.clientY,
        cx: pos.x,
        cy: pos.y,
      }
      e.stopPropagation()
      e.preventDefault()
    },
    [pos.x, pos.y]
  )

  const onMouseUp = useCallback(() => {
    dragging.current = null
  }, [])

  const onMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 }
    dragging.current = null
  }, [])

  // Pinch zoom on touch devices
  const lastTouchDist = useRef<number | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (lastTouchDist.current !== null) {
          const delta = (dist - lastTouchDist.current) * 0.005
          setCamera((c) => ({
            ...c,
            zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom + delta)),
          }))
        }
        lastTouchDist.current = dist
      }
    }
    function handleTouchEnd() { lastTouchDist.current = null }
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd)
    return () => {
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
    }
  }, [setCamera])

  // Native wheel listener with { passive: false } to actually prevent page scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setCamera((c) => ({
        ...c,
        zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, c.zoom + delta)),
      }))
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [setCamera])

  const recenter = useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 })
    setPos({ x: 0, y: 0 })
  }, [setCamera, setPos])

  const zoomIn = useCallback(() => {
    setCamera((c) => ({
      ...c,
      zoom: Math.min(MAX_ZOOM, c.zoom + ZOOM_STEP),
    }))
  }, [setCamera])

  const zoomOut = useCallback(() => {
    setCamera((c) => ({
      ...c,
      zoom: Math.max(MIN_ZOOM, c.zoom - ZOOM_STEP),
    }))
  }, [setCamera])

  return (
    <div className={
      fullscreen
        ? "relative w-full h-full select-none"
        : "relative w-full h-full overflow-hidden select-none"
    }>
      <div
        ref={containerRef}
        tabIndex={0}
        className="absolute inset-0 cursor-grab active:cursor-grabbing outline-none"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onKeyDown={(e) => {
          // Don't intercept arrows when an input/textarea/contenteditable is focused
          const tag = (e.target as HTMLElement).tagName
          const editable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable
          if (editable) return

          const PAN_STEP = 20
          if (e.key === "ArrowUp") { e.preventDefault(); setCamera((c) => ({ ...c, y: c.y + PAN_STEP })) }
          else if (e.key === "ArrowDown") { e.preventDefault(); setCamera((c) => ({ ...c, y: c.y - PAN_STEP })) }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setCamera((c) => ({ ...c, x: c.x + PAN_STEP })) }
          else if (e.key === "ArrowRight") { e.preventDefault(); setCamera((c) => ({ ...c, x: c.x - PAN_STEP })) }
          else if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomIn() }
          else if (e.key === "-") { e.preventDefault(); zoomOut() }
          else if (e.key === "0") { e.preventDefault(); recenter() }
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0" />

        {/* Component layer */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${camera.x * camera.zoom}px, ${camera.y * camera.zoom}px) scale(${camera.zoom})`,
            transformOrigin: "center",
          }}
        >
          {/* Move handle — fills the entire transform layer, behind the component */}
          <div
            ref={componentWrapperRef}
            className="absolute inset-0 pointer-events-auto cursor-move"
            onMouseDown={onComponentMouseDown}
          />
          {/* Component — sits above the move handle, uses its own cursors */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              className="pointer-events-auto cursor-default"
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar — top-right: recenter + props toggle + fullscreen */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 bg-background/80 backdrop-blur-sm border rounded-md p-0.5 pointer-events-auto z-10">
        <Button variant="ghost" size="icon-xs" className="max-md:min-h-11 max-md:min-w-11" onClick={recenter} aria-label="Recenter">
          <Crosshair />
        </Button>
        <Button
          variant={showControls && onToggleControls ? "default" : "ghost"}
          size="icon-xs"
          className="max-md:min-h-11 max-md:min-w-11"
          onClick={onToggleControls}
          disabled={!onToggleControls}
          aria-label="Toggle controls"
        >
          <SlidersHorizontal />
        </Button>
        <Button variant="ghost" size="icon-xs" className="max-md:min-h-11 max-md:min-w-11" onClick={onToggleFullscreen} aria-label="Toggle fullscreen">
          {fullscreen ? <X /> : <Maximize />}
        </Button>
      </div>
    </div>
  )
}
