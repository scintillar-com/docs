"use client"

import { useCallback, useEffect, useState } from "react"
import { withBasePath } from "@shell/lib/base-path"
import { PartyPopper } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shell/components/shell-ui/table"
import { Badge } from "@shell/components/shell-ui/badge"
import { Checkbox } from "@shell/components/shell-ui/checkbox"
import { EmptyState, EmptyStateDescription } from "@shell/components/shell-ui/empty-state"
import { Kbd } from "@shell/components/shell-ui/kbd"
import { Separator } from "@shell/components/shell-ui/separator"
import { useTranslations } from "@shell/lib/i18n"

interface A11yData {
  component: string
  wcag: string
  standard: string
  element: string
  role: string
  delegatesTo: string | null
  description: string
  keyboard: { key: string; action: string }[]
  focus: {
    visible: boolean
    trapped: boolean
    notes: string
  }
  screenReader: {
    announcements: string[]
    notes: string | null
  }
  contrast: {
    text: string
    ui: string
  }
  motion: {
    reducedMotion: string
  }
  consumerResponsibilities: string[]
}

function formatKey(key: string): string {
  return key
    .replace(/Arrow Left/g, "⇦")
    .replace(/Arrow Right/g, "⇨")
    .replace(/Arrow Up/g, "⇧")
    .replace(/Arrow Down/g, "⇩")
    .replace(/Arrow /g, "")
    .replace(/\bLeft\b/g, "⇦")
    .replace(/\bRight\b/g, "⇨")
    .replace(/\bUp\b/g, "⇧")
    .replace(/\bDown\b/g, "⇩")
}

/** Render a key string as one or more Kbd elements, splitting on / and + */
function renderKeys(key: string) {
  const formatted = formatKey(key)
  // Split compound keys like "Enter/Space" or "Shift+Arrow"
  const parts = formatted.split(/\s*[/]\s*/)
  return parts.map((part, i) => (
    <span key={i} className="inline-flex items-center gap-1">
      {i > 0 && <span className="text-muted-foreground mx-0.5">/</span>}
      {part.split(/\s*\+\s*/).map((k, j) => (
        <span key={j} className="inline-flex items-center gap-0.5">
          {j > 0 && <span className="text-muted-foreground">+</span>}
          <Kbd>{k.trim()}</Kbd>
        </span>
      ))}
    </span>
  ))
}

export function A11yInfo({ name }: { name: string }) {
  const [data, setData] = useState<A11yData | null>(null)
  const [error, setError] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [dismissed, setDismissed] = useState(false)
  const t = useTranslations()

  const toggleCheck = useCallback((i: number) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
    setDismissed(false)
  }, [])

  const allChecked = data ? data.consumerResponsibilities.length > 0 && checked.size === data.consumerResponsibilities.length : false
  const [fading, setFading] = useState(false)

  // Auto-dismiss celebration after 2 seconds
  useEffect(() => {
    if (allChecked && !dismissed) {
      const fadeTimer = setTimeout(() => setFading(true), 1500)
      const dismissTimer = setTimeout(() => { setDismissed(true); setFading(false) }, 2000)
      return () => { clearTimeout(fadeTimer); clearTimeout(dismissTimer) }
    }
  }, [allChecked, dismissed])

  useEffect(() => {
    fetch(withBasePath(`/a11y/${name}.json`))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setData)
      .catch(() => setError(true))
  }, [name])

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("component.a11yPlaceholder")}
      </p>
    )
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {t("a11y.loading")}
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overview */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">WCAG {data.wcag}</Badge>
          <Badge variant="outline">{data.standard}</Badge>
          {data.delegatesTo && (
            <Badge variant="secondary">{data.delegatesTo}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{data.description}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("a11y.element")} <code className="bg-muted px-1 rounded">&lt;{data.element}&gt;</code>
          </span>
          <span>
            {t("a11y.role")} <code className="bg-muted px-1 rounded">{data.role}</code>
          </span>
        </div>
      </div>

      <Separator />

      {/* Developer checklist — actionable, shown first */}
      <div className="space-y-3">
        <h4 id="a11y-consumer" className="text-base font-semibold">
          {t("a11y.devChecklist")}
        </h4>
        {allChecked && !dismissed ? (
          <div className={`rounded-lg border border-primary/30 bg-primary/5 p-6 text-center space-y-3 transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}>
            <PartyPopper className="size-8 text-primary mx-auto" />
            <p className="text-sm font-semibold text-foreground">{t("a11y.checklistComplete")}</p>
            <p className="text-sm text-muted-foreground">{t("a11y.checklistCompleteDesc")}</p>
            <Button variant="outline" size="sm" onClick={() => setDismissed(true)}>
              {t("a11y.checklistDismiss")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {data.consumerResponsibilities.map((r, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
                <Checkbox
                  id={`a11y-check-${i}`}
                  className="shrink-0 mt-0.5"
                  checked={checked.has(i)}
                  onCheckedChange={() => toggleCheck(i)}
                />
                <label htmlFor={`a11y-check-${i}`} className="text-sm cursor-pointer leading-snug">{r}</label>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Keyboard interactions */}
      <div className="space-y-3">
        <h4 id="a11y-keyboard" className="text-base font-semibold">
          {t("a11y.keyboard")}
        </h4>
        {data.keyboard.length === 0 || (data.keyboard.length === 1 && data.keyboard[0].key === "N/A") ? (
          <EmptyState>
            <EmptyStateDescription>
              {data.keyboard.length === 1 ? data.keyboard[0].action : t("a11y.noKeyboard")}
            </EmptyStateDescription>
          </EmptyState>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t("a11y.key")}</TableHead>
                  <TableHead>{t("a11y.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.keyboard.map((k, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap align-top">
                      <span className="inline-flex items-center gap-1">
                        {renderKeys(k.key)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{k.action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Separator />

      {/* Focus management */}
      <div className="space-y-3">
        <h4 id="a11y-focus" className="text-base font-semibold">
          {t("a11y.focus")}
        </h4>
        <div className="flex gap-3">
          <Badge variant={data.focus.visible ? "default" : "destructive"}>
            {data.focus.visible ? t("a11y.focusVisible") : t("a11y.noFocusVisible")}
          </Badge>
          <Badge variant={data.focus.trapped ? "default" : "outline"}>
            {data.focus.trapped ? t("a11y.focusTrapped") : t("a11y.noFocusTrap")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{data.focus.notes}</p>
      </div>

      <Separator />

      {/* Screen reader */}
      <div className="space-y-3">
        <h4 id="a11y-screenreader" className="text-base font-semibold">
          {t("a11y.screenReader")}
        </h4>
        <ul className="space-y-1.5 list-disc list-inside">
          {data.screenReader.announcements.map((a, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {a}
            </li>
          ))}
        </ul>
        {data.screenReader.notes && (
          <p className="text-sm text-muted-foreground italic">
            {data.screenReader.notes}
          </p>
        )}
      </div>

      <Separator />

      {/* Contrast & Motion */}
      <div className="space-y-3">
        <h4 id="a11y-contrast" className="text-base font-semibold">
          {t("a11y.colorMotion")}
        </h4>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <span className="font-medium">{t("a11y.text")}</span>
          <span className="text-muted-foreground">{data.contrast.text}</span>
          <span className="font-medium">{t("a11y.ui")}</span>
          <span className="text-muted-foreground">{data.contrast.ui}</span>
          <span className="font-medium">{t("a11y.motionLabel")}</span>
          <span className="text-muted-foreground">{data.motion.reducedMotion}</span>
        </div>
      </div>

    </div>
  )
}
