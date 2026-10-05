"use client"

import { cn } from "@shell/lib/utils"

/** A fixed overlay backdrop for modals, drawers, and floating panels. */
function Backdrop({
  /** Additional CSS classes. */
  className,
  /** Whether the backdrop starts below the header (top: 3.5rem). */
  belowHeader = false,
  ...props
}: React.ComponentProps<"div"> & {
  /** Whether the backdrop starts below the header. */
  belowHeader?: boolean
}) {
  return (
    <div
      data-slot="backdrop"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 bg-black/40 dark:bg-black/60 transition-opacity duration-150 motion-reduce:transition-none",
        belowHeader ? "top-14" : "top-0",
        className
      )}
      {...props}
    />
  )
}

export { Backdrop }
