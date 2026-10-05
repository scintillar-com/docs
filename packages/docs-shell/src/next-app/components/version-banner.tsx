"use client"

import { useTranslations } from "@shell/lib/i18n"
import { CURRENT_VERSION, VERSIONS_ENABLED, useVersionsManifest } from "@shell/lib/versions"

/**
 * Notice shown on frozen snapshots older (or other) than the newest
 * release: "You're viewing v0.1.0; the latest is v1.0.0". Hidden on the
 * latest site, on the latest release's own snapshot, and when the site
 * wasn't built with `versions`.
 */
export function VersionBanner() {
  const manifest = useVersionsManifest()
  const t = useTranslations()

  if (!VERSIONS_ENABLED || !CURRENT_VERSION) return null
  if (!manifest?.latest || manifest.latest === CURRENT_VERSION) return null

  const message = t("versions.banner")
    .replace("{version}", `v${CURRENT_VERSION}`)
    .replace("{latest}", `v${manifest.latest}`)

  return (
    <div
      role="status"
      className="border-b border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground md:px-6"
    >
      {message}{" "}
      {/* Plain anchor: the latest site is a different Next app at the root,
          outside this snapshot's basePath. */}
      <a href="/" className="font-medium text-foreground underline underline-offset-4">
        {t("versions.goToLatest")}
      </a>
    </div>
  )
}
