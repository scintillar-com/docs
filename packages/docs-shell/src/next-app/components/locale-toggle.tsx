"use client"

import { useLocale } from "@shell/lib/i18n"
import { Button } from "@shell/components/shell-ui/button"
import { getShellLocales } from "@shell/lib/locales"

const LOCALES = getShellLocales()

/**
 * Cycles the UI locale through the configured set. Hidden entirely when the
 * shell is in single-locale mode (the toggle would be a no-op).
 */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale()

  if (LOCALES.length < 2) return null

  const next = () => {
    const i = LOCALES.indexOf(locale)
    const nextIdx = (i + 1) % LOCALES.length
    setLocale(LOCALES[nextIdx])
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={next}
      aria-label="Cycle language"
      className="text-xs font-semibold"
    >
      {locale.toUpperCase()}
    </Button>
  )
}
