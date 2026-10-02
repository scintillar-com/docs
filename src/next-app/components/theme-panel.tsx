"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Check, Copy, Monitor, Moon, RotateCcw, Sun } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"
import { Input } from "@shell/components/shell-ui/input"
import { Separator } from "@shell/components/shell-ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@shell/components/shell-ui/popover"
import { useTranslations } from "@shell/lib/i18n"
import type { ResolvedThemePanelConfig } from "@shell/lib/theme-panel"
import {
  PRIMARY_VAR,
  THEME_OVERRIDES_STORAGE_KEY,
  TINT_FALLBACK,
  TINT_MAX,
  TINT_MIN,
  TINT_STEP,
  TINT_VAR,
  applyThemeOverrides,
  buildThemeCss,
  clampTint,
  cssColorToHex,
  formatTint,
  isThemeOverridesRequest,
  keepThemeOverrides,
  normalizeHex,
  parseStoredOverrides,
  postOverrides,
  postOverridesToPreviewFrames,
  readStoredOverrides,
  readThemeDefault,
  writeStoredOverrides,
  type ThemeOverrides,
} from "@shell/lib/theme-overrides"

interface ThemeDefaults {
  /** The theme's own `--primary` as hex, or null when unknown. */
  primary: string | null
  /** The theme's own `--surface-tint`, or TINT_FALLBACK. */
  tint: number
}

function readDefaults(): ThemeDefaults {
  const root = document.documentElement
  const tint = clampTint(Number.parseFloat(readThemeDefault(root, TINT_VAR)))
  return {
    primary: cssColorToHex(readThemeDefault(root, PRIMARY_VAR)),
    tint: tint ?? TINT_FALLBACK,
  }
}

/**
 * Header theme button + popover, used when the registry sets `themePanel`.
 * Mode goes through next-themes (already synced to preview iframes via
 * localStorage). Primary and tint are inline custom properties on `<html>`,
 * persisted and mirrored into the preview iframes; see lib/theme-overrides.
 */
export function ThemePanel({ config }: { config: ResolvedThemePanelConfig }) {
  const t = useTranslations()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { controls } = config
  const baseId = useId()

  const [open, setOpen] = useState(false)
  // The popover content only renders client-side after opening, so reading
  // storage in the initializer can't cause a hydration mismatch.
  const [overrides, setOverrides] = useState<ThemeOverrides>(() =>
    typeof window === "undefined" ? {} : readStoredOverrides(controls),
  )
  const [defaults, setDefaults] = useState<ThemeDefaults>({ primary: null, tint: TINT_FALLBACK })
  const [hexDraft, setHexDraft] = useState("")
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle")
  const overridesRef = useRef(overrides)
  const cssFallbackRef = useRef<HTMLTextAreaElement>(null)

  const effectivePrimary = overrides.primary ?? defaults.primary
  const effectiveTint = overrides.tint ?? defaults.tint

  const commit = useCallback((next: ThemeOverrides) => {
    overridesRef.current = next
    setOverrides(next)
    setCopyState("idle")
    applyThemeOverrides(document.documentElement, next)
    writeStoredOverrides(next)
    // Storage events already reach same-origin iframes; posting as well
    // covers browsers where storage is blocked.
    postOverridesToPreviewFrames(next)
  }, [])

  // The inline init script applied the saved overrides before paint, but a
  // client re-render of the root layout can reset <html>'s attributes;
  // re-apply once mounted and whenever that happens.
  useEffect(() => {
    const root = document.documentElement
    applyThemeOverrides(root, overridesRef.current)
    return keepThemeOverrides(root, () => overridesRef.current)
  }, [])

  // Answer preview iframes asking for the current overrides on boot, and
  // follow changes made in other tabs.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin || !isThemeOverridesRequest(e.data)) return
      postOverrides(e.source as Window | null, overridesRef.current)
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_OVERRIDES_STORAGE_KEY && e.key !== null) return
      const next =
        e.key === null ? readStoredOverrides(controls) : parseStoredOverrides(e.newValue, controls)
      overridesRef.current = next
      setOverrides(next)
      applyThemeOverrides(document.documentElement, next)
    }
    window.addEventListener("message", onMessage)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener("message", onMessage)
      window.removeEventListener("storage", onStorage)
    }
  }, [controls])

  // The theme's own values depend on light/dark: re-read them while open,
  // after next-themes has swapped the class.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const next = readDefaults()
      setDefaults(next)
      setHexDraft(overridesRef.current.primary ?? next.primary ?? "")
    })
    return () => cancelAnimationFrame(frame)
  }, [open, resolvedTheme])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setCopyState("idle")
  }

  const setPrimary = (hex: string) => {
    setHexDraft(hex)
    commit({ ...overridesRef.current, primary: hex })
  }

  const onHexChange = (value: string) => {
    setHexDraft(value)
    const hex = normalizeHex(value)
    if (hex) commit({ ...overridesRef.current, primary: hex })
  }

  const resetPrimary = () => {
    const { primary: _drop, ...rest } = overridesRef.current
    commit(rest)
    setHexDraft(defaults.primary ?? "")
  }

  const setTint = (value: number) => {
    const tint = clampTint(value)
    if (tint !== null) commit({ ...overridesRef.current, tint })
  }

  const resetTint = () => {
    const { tint: _drop, ...rest } = overridesRef.current
    commit(rest)
  }

  const resetAll = () => {
    commit({})
    setHexDraft(defaults.primary ?? "")
  }

  const css = buildThemeCss({
    primary: controls.includes("primary") ? effectivePrimary : null,
    tint: controls.includes("tint") ? effectiveTint : null,
  })

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(css)
      setCopyState("copied")
    } catch {
      setCopyState("failed")
      requestAnimationFrame(() => {
        cssFallbackRef.current?.focus()
        cssFallbackRef.current?.select()
      })
    }
  }

  const hexInvalid = hexDraft.trim() !== "" && normalizeHex(hexDraft) === null
  const hasOverrides = overrides.primary !== undefined || overrides.tint !== undefined
  const hasCssControls = controls.includes("primary") || controls.includes("tint")

  const ids = {
    title: `${baseId}-title`,
    description: `${baseId}-description`,
    mode: `${baseId}-mode`,
    primary: `${baseId}-primary`,
    primaryError: `${baseId}-primary-error`,
    tint: `${baseId}-tint`,
    css: `${baseId}-css`,
  }

  const modes = [
    { id: "light", label: t("settings.light"), icon: Sun },
    { id: "dark", label: t("settings.dark"), icon: Moon },
    { id: "system", label: t("settings.system"), icon: Monitor },
  ] as const

  const sections = controls.map((control) => {
    if (control === "mode") {
      return (
        <div key="mode" role="group" aria-labelledby={ids.mode} className="space-y-2">
          <h3 id={ids.mode} className="text-xs font-medium text-muted-foreground">
            {t("themePanel.mode")}
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {modes.map((opt) => (
              <Button
                key={opt.id}
                type="button"
                variant={theme === opt.id ? "default" : "outline"}
                size="sm"
                aria-pressed={theme === opt.id}
                onClick={() => setTheme(opt.id)}
                className="h-8 px-2 text-xs max-md:min-h-11"
              >
                <opt.icon className="size-3.5" aria-hidden />
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )
    }

    if (control === "primary") {
      return (
        <div key="primary" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={ids.primary} className="text-xs font-medium text-muted-foreground">
              {t("themePanel.primary")}
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={resetPrimary}
              disabled={overrides.primary === undefined}
              aria-label={t("themePanel.resetPrimary")}
              title={t("themePanel.resetPrimary")}
              className="max-md:min-h-11 max-md:min-w-11"
            >
              <RotateCcw aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={effectivePrimary ?? "#000000"}
              onChange={(e) => setPrimary(e.target.value)}
              aria-label={t("themePanel.primarySwatch")}
              className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
            <Input
              id={ids.primary}
              value={hexDraft}
              onChange={(e) => onHexChange(e.target.value)}
              onBlur={() => {
                if (hexInvalid || hexDraft.trim() === "") setHexDraft(effectivePrimary ?? "")
              }}
              placeholder="#3b82f6"
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              maxLength={7}
              aria-invalid={hexInvalid || undefined}
              aria-describedby={hexInvalid ? ids.primaryError : undefined}
              className="h-9 font-mono"
            />
          </div>
          {hexInvalid && (
            <p id={ids.primaryError} className="text-xs text-destructive">
              {t("themePanel.primaryInvalid")}
            </p>
          )}
        </div>
      )
    }

    return (
      <div key="tint" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={ids.tint} className="text-xs font-medium text-muted-foreground">
            {t("themePanel.tint")}
          </label>
          <div className="flex items-center gap-1">
            {/* Visual readout only; the slider exposes its value to assistive tech. */}
            <span aria-hidden className="font-mono text-xs tabular-nums">
              {formatTint(effectiveTint)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={resetTint}
              disabled={overrides.tint === undefined}
              aria-label={t("themePanel.resetTint")}
              title={t("themePanel.resetTint")}
              className="max-md:min-h-11 max-md:min-w-11"
            >
              <RotateCcw aria-hidden />
            </Button>
          </div>
        </div>
        <input
          id={ids.tint}
          type="range"
          min={TINT_MIN}
          max={TINT_MAX}
          step={TINT_STEP}
          value={effectiveTint}
          onChange={(e) => setTint(Number(e.target.value))}
          className="h-6 w-full cursor-pointer accent-primary max-md:h-11"
        />
      </div>
    )
  })

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("themePanel.trigger")}>
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
        data-theme-panel
        className="w-80 space-y-4"
      >
        <div className="space-y-1">
          <h2 id={ids.title} className="text-sm font-semibold">
            {t("themePanel.title")}
          </h2>
          <p id={ids.description} className="text-xs text-muted-foreground">
            {t("themePanel.description")}
          </p>
        </div>

        {sections}

        {hasCssControls && (
          <>
            <Separator />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetAll}
                disabled={!hasOverrides}
                className="max-md:min-h-11"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                {t("themePanel.resetAll")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyCss}
                className="max-md:min-h-11"
              >
                {copyState === "copied" ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <Copy className="size-3.5" aria-hidden />
                )}
                {t("themePanel.copyCss")}
              </Button>
            </div>
            <p role="status" aria-live="polite" className="text-xs text-muted-foreground empty:hidden">
              {copyState === "copied"
                ? t("themePanel.copied")
                : copyState === "failed"
                  ? t("themePanel.copyFailed")
                  : ""}
            </p>
            {copyState === "failed" && (
              <textarea
                ref={cssFallbackRef}
                id={ids.css}
                readOnly
                value={css}
                aria-label={t("themePanel.cssLabel")}
                rows={css.split("\n").length}
                className="w-full resize-none rounded-md border border-input bg-muted/50 p-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
