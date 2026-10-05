"use client"

import { useTranslations } from "@shell/lib/i18n"
import {
  CURRENT_VERSION,
  VERSIONS_ENABLED,
  latestReleaseHref,
  useVersionsManifest,
} from "@shell/lib/versions"

/**
 * Notice shown on frozen snapshots older (or other) than the newest
 * release: "You're viewing v0.1.0; the latest is v1.0.0". When the site
 * root isn't a release (`versions.current.label`, e.g. "develop"), the root
 * shows one too ("You're viewing develop, not yet released…") and links
 * point to the latest release's snapshot. Hidden on the latest release and
 * when the site wasn't built with `versions`.
 */
export function VersionBanner() {
  const manifest = useVersionsManifest()
  const t = useTranslations()

  if (!VERSIONS_ENABLED || !manifest?.latest) return null
  const unreleased = manifest.current?.label
  if (!CURRENT_VERSION && !unreleased) return null
  if (CURRENT_VERSION === manifest.latest) return null

  const message = CURRENT_VERSION
    ? t("versions.banner")
        .replace("{version}", `v${CURRENT_VERSION}`)
        .replace("{latest}", `v${manifest.latest}`)
    : t("versions.unreleased")
        .replace("{label}", unreleased ?? "")
        .replace("{latest}", `v${manifest.latest}`)

  return (
    <div
      role="status"
      className="border-b border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground md:px-6"
    >
      {message}{" "}
      {/* Plain anchor: each version is a different Next app, outside this
          build's basePath. */}
      <a
        href={latestReleaseHref(manifest)}
        className="font-medium text-foreground underline underline-offset-4"
      >
        {t("versions.goToLatest")}
      </a>
    </div>
  )
}
