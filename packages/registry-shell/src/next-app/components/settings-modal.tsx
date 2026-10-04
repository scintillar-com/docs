"use client"

import { useState } from "react"
import { Settings, Sun, Moon, Monitor, Globe } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@shell/components/shell-ui/button"
import { Separator } from "@shell/components/shell-ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shell/components/shell-ui/dialog"
import { useLocale, useTranslations, type Locale } from "@shell/lib/i18n"

export function SettingsButton() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useLocale()
  const t = useTranslations()

  const themes = [
    { id: "light" as const, label: t("settings.light"), icon: Sun },
    { id: "dark" as const, label: t("settings.dark"), icon: Moon },
    { id: "system" as const, label: t("settings.system"), icon: Monitor },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("settings.title")}
          className="md:hidden"
        >
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-md:max-w-full! max-md:h-full max-md:rounded-none max-md:border-0">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sun className="size-4" />
              {t("settings.theme")}
            </h3>
            <div className="flex gap-2">
              {themes.map((opt) => (
                <Button
                  key={opt.id}
                  variant={theme === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(opt.id)}
                  className="flex-1"
                >
                  <opt.icon className="size-3.5 mr-1.5" />
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Language */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="size-4" />
              {t("settings.language")}
            </h3>
            <div className="flex gap-2">
              {([
                { id: "en" as Locale, label: "English" },
                { id: "fr" as Locale, label: "Français" },
              ]).map((lang) => (
                <Button
                  key={lang.id}
                  variant={locale === lang.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLocale(lang.id)}
                  className="flex-1"
                >
                  {lang.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
