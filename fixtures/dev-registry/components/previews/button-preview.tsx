"use client"

import { Button } from "@/components/ui/button"
import { useControls } from "@sntlr/registry-shell/shell/hooks/use-controls"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function ButtonPreview() {
  const { values, entries } = useControls({
    variant: {
      type: "select",
      options: ["default", "outline", "ghost"],
      default: "default",
    },
    label: { type: "text", default: "Click me" },
    disabled: { type: "boolean", default: false },
  })

  return (
    <PreviewLayout controls={entries}>
      <Button variant={values.variant as "default"} disabled={values.disabled}>
        {values.label || "Button"}
      </Button>
    </PreviewLayout>
  )
}
