"use client"

import type { ReactNode } from "react"
import { ExternalLink } from "lucide-react"
import { Badge } from "@shell/components/shell-ui/badge"
import { useTranslations } from "@shell/lib/i18n"
import type { BumpType } from "@shell/lib/changelog"
import { CURRENT_VERSION, useVersionsManifest } from "@shell/lib/versions"

export interface RenderedRelease {
  heading: string
  version: string | null
  anchor: string
  bumps: BumpType[]
  /** Server-rendered markdown body. */
  content: ReactNode
}

/**
 * The Releases page body. Release notes come from the changelog baked into
 * this build; which of those versions have a published snapshot (and which
 * one is the newest) comes from `/versions.json` at runtime, like the
 * header switcher, so old cached snapshots link to and flag releases made
 * after them correctly. Versions without a snapshot get no docs link.
 */
export function ReleasesList({
  releases,
  intro,
}: {
  releases: RenderedRelease[]
  intro: ReactNode
}) {
  const t = useTranslations()
  const manifest = useVersionsManifest()
  const published = new Map((manifest?.versions ?? []).map((v) => [v.version, v]))

  return (
    <div className="mx-auto py-10 px-4 md:px-8 w-full max-w-300 flex justify-center gap-8">
      <div className="hidden xl:block w-44 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0 xl:max-w-225">
        <h1 className="text-3xl font-bold tracking-tight">{t("releases.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("releases.description")}</p>
        {intro && <div className="prose prose-zinc dark:prose-invert mt-6 max-w-none">{intro}</div>}

        {releases.length === 0 && (
          <p className="mt-10 text-sm text-muted-foreground">{t("releases.empty")}</p>
        )}

        <div className="mt-10 space-y-12">
          {releases.map((release) => {
            const entry = release.version ? published.get(release.version) : undefined
            const isLatest = Boolean(release.version && manifest?.latest === release.version)
            const isCurrent = Boolean(release.version && release.version === CURRENT_VERSION)
            return (
              <section key={release.anchor} aria-labelledby={release.anchor} className="scroll-mt-20">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3">
                  <h2 id={release.anchor} className="scroll-mt-20 text-2xl font-semibold tracking-tight">
                    <a href={`#${release.anchor}`} className="hover:underline underline-offset-4">
                      {release.version ? `v${release.version}` : release.heading}
                    </a>
                  </h2>
                  {isLatest && <Badge>{t("releases.latest")}</Badge>}
                  {isCurrent && <Badge variant="secondary">{t("releases.viewing")}</Badge>}
                  {release.bumps.map((bump) => (
                    <Badge key={bump} variant="outline">
                      {t(`releases.bump.${bump}`)}
                    </Badge>
                  ))}
                  <span className="flex-1" />
                  {entry?.date && (
                    <time dateTime={entry.date} className="text-xs text-muted-foreground">
                      {entry.date.slice(0, 10)}
                    </time>
                  )}
                  {/* Plain anchor: each version is its own Next app, outside
                      this build's basePath. */}
                  {entry && (
                    <a
                      href={entry.path}
                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4"
                    >
                      {t("releases.viewDocs").replace("{version}", `v${entry.version}`)}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
                {release.content ? (
                  <div className="prose prose-zinc dark:prose-invert mt-4 max-w-none">{release.content}</div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">{t("releases.noNotes")}</p>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {/* Right rail mirrors the docs TOC: jump to a release. */}
      <div className="hidden xl:block w-44 shrink-0">
        {releases.length > 1 && (
          <nav aria-label={t("releases.jumpTo")} className="sticky top-20">
            <p className="text-xs font-semibold text-foreground mb-2" aria-hidden="true">
              {t("releases.jumpTo")}
            </p>
            <ul role="list" className="space-y-0.5">
              {releases.map((release) => (
                <li key={release.anchor}>
                  <a
                    href={`#${release.anchor}`}
                    className="block text-xs px-2 py-1 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  >
                    {release.version ? `v${release.version}` : release.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
