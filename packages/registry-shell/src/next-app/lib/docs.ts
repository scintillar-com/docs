import { docs } from "@shell/shell.config"
import type { DocMeta } from "./registry-adapter"

export type { DocMeta }

export function getAllDocs(): DocMeta[] {
  return docs.getAllDocs()
}

export function getDocBySlug(slug: string, locale?: string) {
  return docs.getDocBySlug(slug, locale)
}

export function getDocAllLocales(slug: string): Record<string, string> {
  return docs.getDocAllLocales(slug)
}
