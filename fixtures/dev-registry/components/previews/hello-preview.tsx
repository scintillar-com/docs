"use client"

import { Hello } from "@/components/ui/hello"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function HelloPreview() {
  return (
    <PreviewLayout>
      <div data-testid="hello-preview" className="text-center">
        <Hello name="smoke-test" />
      </div>
    </PreviewLayout>
  )
}
