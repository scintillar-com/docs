"use client"

import * as React from "react"
import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "@shell/lib/utils"

/** A visual divider between content sections. */
function Separator({
  /** Additional CSS classes to apply to the separator. */
  className,
  /** The orientation of the separator. @default "horizontal" */
  orientation = "horizontal",
  /** Whether the separator is purely decorative (hidden from assistive technology). @default true */
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
