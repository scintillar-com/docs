"use client"

import type { ReactNode } from "react"
import { useLocale } from "@shell/lib/i18n"

/**
 * Client wrapper that picks one of the already-resolved React trees the
 * server-side `LocalizedMdx` produced via `compileMDX`. There is no MDX
 * eval on the client; the heading-anchor components were already wired in
 * during the server compile and their event handlers (history push,
 * smooth-scroll, clipboard copy) hydrate normally.
 */
export function LocalizedMdxClient({
  rendered,
}: {
  rendered: Record<string, ReactNode>
}) {
  const { locale } = useLocale()
  const active = rendered[locale] ?? rendered.en ?? Object.values(rendered)[0]
  if (!active) return null
  return <>{active}</>
}
