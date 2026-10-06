"use client"

import { useId } from "react"
import { Hello } from "@/components/ui/hello"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function HelloPreview() {
  // `useId` exercises server/client tree parity on the preview routes: any
  // difference in the component tree above the preview changes the id and
  // React reports a hydration mismatch (see
  // packages/registry-shell/tests/preview-hydration.spec.ts).
  const id = useId()
  return (
    <PreviewLayout>
      <div data-testid="hello-preview" data-use-id={id} className="text-center">
        <Hello name="smoke-test" />
      </div>
    </PreviewLayout>
  )
}
