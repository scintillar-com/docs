import { registry } from "@shell/registry.config"
import type { CategoryMeta, ComponentMeta } from "./registry-adapter"

export type { CategoryMeta, ComponentMeta }

export function getAllComponents(): ComponentMeta[] {
  return registry?.getAllComponents() ?? []
}

export function getCategories(): CategoryMeta[] {
  return registry?.getCategories?.() ?? []
}
