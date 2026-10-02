"use client"

import { usePathname } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shell/components/shell-ui/select"
import { useTranslations } from "@shell/lib/i18n"
import {
  CURRENT_VERSION,
  VERSIONS_ENABLED,
  switchTargets,
  useVersionsManifest,
} from "@shell/lib/versions"

// Radix Select reserves "" for "no value", so latest gets a sentinel.
const LATEST = "__latest__"

/**
 * Header dropdown listing the latest site plus every frozen release (from
 * `/versions.json`). Picking one keeps the current page when it exists in
 * that version, else lands on its home. Renders nothing unless the site was
 * built with `versions` and at least one release snapshot exists.
 */
export function VersionSwitcher() {
  const manifest = useVersionsManifest()
  const pathname = usePathname()
  const t = useTranslations()

  if (!VERSIONS_ENABLED || !manifest || manifest.versions.length === 0) return null

  const onChange = async (value: string) => {
    const target = value === LATEST ? "" : value
    if (target === CURRENT_VERSION) return
    const { candidate, home } = switchTargets(target, pathname ?? "/")
    let destination = home
    if (candidate) {
      try {
        const res = await fetch(candidate, { method: "HEAD" })
        if (res.ok) destination = candidate
      } catch {
        /* offline or blocked: fall back to the version's home */
      }
    }
    // Each version is its own Next app, so this is a full navigation.
    window.location.assign(destination)
  }

  return (
    <Select value={CURRENT_VERSION || LATEST} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        aria-label={t("versions.label")}
        className="h-8 gap-1 px-2.5 text-xs font-medium"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={LATEST}>{t("versions.latest")}</SelectItem>
        {manifest.versions.map((v) => (
          <SelectItem key={v.version} value={v.version}>
            v{v.version}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
