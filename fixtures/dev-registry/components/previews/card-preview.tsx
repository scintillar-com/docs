"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useControls } from "@sntlr/registry-shell/shell/hooks/use-controls"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function CardPreview() {
  const { values, entries } = useControls({
    title: { type: "text", default: "Card title" },
    description: {
      type: "text",
      default:
        "Card is a layout primitive; wraps content in a bordered, shadowed surface.",
    },
  })

  return (
    <PreviewLayout controls={entries}>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>{values.title || "Card"}</CardTitle>
          <CardDescription>{values.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Exercises card, card-foreground, border, and shadow tokens in the
            active theme.
          </p>
        </CardContent>
      </Card>
    </PreviewLayout>
  )
}
