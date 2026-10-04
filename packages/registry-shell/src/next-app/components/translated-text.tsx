"use client"

import { useTranslations } from "@shell/lib/i18n"

export function TranslatedText({ k }: { k: Parameters<ReturnType<typeof useTranslations>>[0] }) {
  const t = useTranslations()
  return <>{t(k)}</>
}
