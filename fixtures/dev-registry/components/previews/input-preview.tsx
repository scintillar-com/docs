"use client"

import { Input } from "@/components/ui/input"
import { useControls } from "@sntlr/registry-shell/shell/hooks/use-controls"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function InputPreview() {
  const { values, entries } = useControls({
    placeholder: { type: "text", default: "Email address" },
    disabled: { type: "boolean", default: false },
  })

  return (
    <PreviewLayout controls={entries}>
      <div className="w-full max-w-sm">
        <Input placeholder={values.placeholder} disabled={values.disabled} />
      </div>
    </PreviewLayout>
  )
}
