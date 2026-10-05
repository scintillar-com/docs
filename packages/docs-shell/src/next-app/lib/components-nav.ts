import { registry } from "@shell/shell.config"
import type { CategoryMeta, ComponentMeta } from "./registry-adapter"

export type { CategoryMeta, ComponentMeta }

export function getAllComponents(): ComponentMeta[] {
  return registry?.getAllComponents() ?? []
}

export function getCategories(): CategoryMeta[] {
  return registry?.getCategories?.() ?? []
}

/** Configured default preview height for a component (`previewHeight`). */
export function getPreviewHeight(name: string): number | undefined {
  return registry?.getPreviewHeight?.(name)
}
