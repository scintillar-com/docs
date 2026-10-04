"use client"

import { HeroCard } from "@/registry/new-york/blocks/hero-card/hero-card"
import { PreviewLayout } from "@sntlr/registry-shell/shell/components/preview-layout"

export function HeroCardPreview() {
  return (
    <PreviewLayout>
      <HeroCard />
    </PreviewLayout>
  )
}
