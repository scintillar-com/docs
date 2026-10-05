"use client"

import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@shell/lib/utils"

type Orientation = "horizontal" | "vertical"

// A `horizontal` grip lies flat and is grabbed to drag up / down (a top or
// bottom edge → `ns-resize`); a `vertical` grip stands up and is grabbed to
// drag left / right (a side edge → `col-resize`).
const CURSOR: Record<Orientation, string> = {
  horizontal: "cursor-ns-resize",
  vertical: "cursor-col-resize",
}

const GRIP_SIZE: Record<Orientation, string> = {
  horizontal: "h-1 w-8",
  vertical: "h-8 w-1",
}

export type DragHandleProps = {
  orientation: Orientation
  /** Force the grip visible — pass the caller's "drag underway" state. */
  active?: boolean
  /**
   * Tint the whole hit-area strip on hover and while active, not just show the
   * grip. Reads well on a long edge like the sidebar's rail, where a
   * full-height highlight advertises the grab zone.
   */
  highlight?: boolean
} & ComponentPropsWithoutRef<"div">

/**
 * The chip-style grab affordance for a resizable edge.
 *
 * Used for the docs sidebar's resizable right edge: the grip reveals on
 * hover (always visible on touch screens) and stays while dragging.
 *
 * Renders the interactive hit area only; the caller positions and sizes it
 * (`absolute right-0 top-0 h-full w-1.5`) and wires the pointer handlers,
 * which are forwarded here.
 */
export function DragHandle({
  orientation,
  active = false,
  highlight = false,
  className,
  ...props
}: DragHandleProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "group flex touch-none select-none items-center justify-center",
        CURSOR[orientation],
        highlight && "transition-colors hover:bg-muted-foreground/20",
        highlight && active && "bg-muted-foreground/20",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          // An opaque neutral grip : a translucent fill washes out over the
          // tinted highlight rail, so `color-mix` bakes the same soft tone
          // into a solid colour. The opacity utilities drive only the reveal.
          "rounded-full bg-[color-mix(in_oklab,var(--muted-foreground)_50%,var(--background))] transition-opacity",
          GRIP_SIZE[orientation],
          "opacity-0 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100",
          active && "opacity-100",
        )}
      />
    </div>
  )
}
