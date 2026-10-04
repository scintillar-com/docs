import { createElement, Fragment, type ComponentType, type ReactNode } from "react"
import dynamic from "next/dynamic"
import type { PreviewLoader } from "@sntlr/registry-shell/shell/lib/registry-adapter"

const map: Record<string, ComponentType> = {
  badge: dynamic(() => import("./badge-preview").then((m) => m.BadgePreview)),
  button: dynamic(() => import("./button-preview").then((m) => m.ButtonPreview)),
  card: dynamic(() => import("./card-preview").then((m) => m.CardPreview)),
  hello: dynamic(() => import("./hello-preview").then((m) => m.HelloPreview)),
  "hero-card": dynamic(() =>
    import("./hero-card-preview").then((m) => m.HeroCardPreview)
  ),
  input: dynamic(() => import("./input-preview").then((m) => m.InputPreview)),
}

function Preview({ name, fallback = null }: { name: string; fallback?: ReactNode }) {
  const Component = map[name]
  if (Component) return createElement(Component)
  return createElement(Fragment, null, fallback)
}

export const previewLoader: PreviewLoader = {
  Preview,
  load: (name) => map[name] ?? null,
  names: () => Object.keys(map),
}
