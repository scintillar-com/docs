"use client"

import { useEffect, useRef, useState } from "react"
import { useLocale, useTranslations } from "@shell/lib/i18n"

export function A11yProvider() {
  const { locale } = useLocale()
  const t = useTranslations()
  const [announcement, setAnnouncement] = useState("")
  const prevLocale = useRef(locale)

  // Sync lang attribute with locale
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  // Announce locale change
  useEffect(() => {
    if (prevLocale.current !== locale) {
      prevLocale.current = locale
      // eslint-disable-next-line react-hooks/set-state-in-effect -- announce locale change to screen readers
      setAnnouncement(locale === "fr" ? "Langue changée en français" : "Language changed to English")
      const timer = setTimeout(() => setAnnouncement(""), 3000)
      return () => clearTimeout(timer)
    }
  }, [locale])

  return (
    <>
      <a href="#main-content" className="skip-nav">
        {t("a11y.skipToContent")}
      </a>
      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  )
}
