import { registry } from "@shell/registry.config"
import type { DocMeta } from "./registry-adapter"

export type { DocMeta }

export function getAllDocs(): DocMeta[] {
  return registry?.getAllDocs() ?? []
}

export function getDocBySlug(slug: string, locale?: string) {
  return registry?.getDocBySlug(slug, locale) ?? null
}

export function getDocAllLocales(slug: string): Record<string, string> {
  return registry?.getDocAllLocales(slug) ?? {}
}
