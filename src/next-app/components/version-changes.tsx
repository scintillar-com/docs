"use client"

import { useEffect, useMemo, useState } from "react"
import { GitCompare } from "lucide-react"
import { Badge } from "@shell/components/shell-ui/badge"
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "@shell/components/shell-ui/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shell/components/shell-ui/select"
import { Skeleton } from "@shell/components/shell-ui/skeleton"
import { useTranslations } from "@shell/lib/i18n"
import { CURRENT_VERSION } from "@shell/lib/versions"
import {
  METADATA_FILE,
  changeIndexUrl,
  compareItem,
  defaultRange,
  hunkHeader,
  type ChangeIndex,
  type FileChange,
} from "@shell/lib/changes"

// Radix Select reserves "" for "no value": the latest site ("") and "compare
// against nothing" (null) get sentinels.
const LATEST = "__latest__"
const NONE = "__none__"

const toValue = (version: string | null) => (version === null ? NONE : version || LATEST)
const fromValue = (value: string) => (value === NONE ? null : value === LATEST ? "" : value)

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; index: ChangeIndex }

function useChangeIndex(name: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" })
  useEffect(() => {
    let active = true
    // Fetched from the site root (not this build's basePath): the index is
    // regenerated on every deploy, so old snapshots see newer releases.
    fetch(changeIndexUrl(name), { cache: "no-cache" })
      .then((r) => (r.ok ? (r.json() as Promise<ChangeIndex>) : null))
      .catch(() => null)
      .then((index) => {
        if (!active) return
        setState(
          index && Array.isArray(index.versions)
            ? { status: "ready", index }
            : { status: "missing" },
        )
      })
    return () => {
      active = false
    }
  }, [name])
  return state
}

/**
 * "Changes" tab of a component page (sites built with `versions` only):
 * a unified diff of the item's registry files between two versions,
 * defaulting to the previous version -> the one being viewed.
 */
export function VersionChanges({ name }: { name: string }) {
  const t = useTranslations()
  const state = useChangeIndex(name)

  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (state.status === "missing" || state.index.versions.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon>
          <GitCompare />
        </EmptyStateIcon>
        <EmptyStateTitle>{t("changes.noHistoryTitle")}</EmptyStateTitle>
        <EmptyStateDescription>{t("changes.noHistory")}</EmptyStateDescription>
      </EmptyState>
    )
  }
  return <ChangesView index={state.index} />
}

function ChangesView({ index }: { index: ChangeIndex }) {
  const t = useTranslations()
  const initial = useMemo(() => defaultRange(index, CURRENT_VERSION), [index])
  const [from, setFrom] = useState<string | null>(initial?.from ?? null)
  const [to, setTo] = useState<string>(initial?.to ?? "")
  const comparison = useMemo(() => compareItem(index, from, to), [index, from, to])

  const label = (version: string) => (version ? `v${version}` : t("versions.latest"))
  // Newest first in the pickers, like the header switcher.
  const options = [...index.versions].reverse()

  let summary: string
  switch (comparison.status) {
    case "unchanged":
      summary = comparison.since !== undefined
        ? t("changes.unchangedSince").replace("{version}", label(comparison.since))
        : t("changes.identical").replace("{from}", label(from ?? "")).replace("{to}", label(to))
      break
    case "added":
      summary = comparison.addedIn
        ? t("changes.addedIn").replace("{version}", label(comparison.addedIn))
        : t("changes.addedUnreleased")
      break
    case "removed":
      summary = t("changes.removedIn").replace("{version}", label(to))
      break
    case "missing":
      summary = t("changes.missing")
      break
    default:
      summary = t("changes.summary")
        .replace("{files}", String(comparison.files.length))
        .replace("{additions}", String(comparison.additions))
        .replace("{deletions}", String(comparison.deletions))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("changes.from")}</span>
        <Select value={toValue(from)} onValueChange={(v) => setFrom(fromValue(v))}>
          <SelectTrigger size="sm" aria-label={t("changes.fromLabel")} className="min-w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((v) => (
              <SelectItem key={toValue(v.version)} value={toValue(v.version)}>
                {label(v.version)}
              </SelectItem>
            ))}
            <SelectItem value={NONE}>{t("changes.nothing")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">{t("changes.to")}</span>
        <Select value={toValue(to)} onValueChange={(v) => setTo(fromValue(v) ?? "")}>
          <SelectTrigger size="sm" aria-label={t("changes.toLabel")} className="min-w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((v) => (
              <SelectItem key={toValue(v.version)} value={toValue(v.version)}>
                {label(v.version)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p role="status" className="text-sm font-medium">
        {summary}
      </p>

      {comparison.files.map((file) => (
        <FileDiff key={file.path} file={file} />
      ))}
    </div>
  )
}

const LINE_STYLES = {
  add: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  remove: "bg-destructive/10 text-red-800 dark:text-red-300",
  equal: "",
} as const

const SIGNS = { add: "+", remove: "-", equal: " " } as const

function FileDiff({ file }: { file: FileChange }) {
  const t = useTranslations()
  const title = file.path === METADATA_FILE ? t("changes.metadata") : file.path
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-xs">
        <span className="font-mono font-medium break-all">{title}</span>
        {file.status !== "modified" && (
          <Badge variant="outline">{t(`changes.file.${file.status}`)}</Badge>
        )}
        <span className="flex-1" />
        <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">+{file.additions}</span>
        <span className="font-mono tabular-nums text-red-700 dark:text-red-400">-{file.deletions}</span>
      </div>
      {/* Same surface and type as the shell's other code blocks. */}
      <pre className="overflow-x-auto bg-muted text-sm leading-6">
        <code className="grid min-w-full w-max">
          {file.hunks.map((hunk, h) => (
            <div key={h} className="contents">
              <span className="block select-none bg-primary/5 px-4 text-muted-foreground">
                {hunkHeader(hunk)}
              </span>
              {hunk.lines.map((line, i) => (
                <span key={i} className={`flex ${LINE_STYLES[line.type]}`}>
                  <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/70 tabular-nums">
                    {line.oldNo ?? ""}
                  </span>
                  <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/70 tabular-nums">
                    {line.newNo ?? ""}
                  </span>
                  <span className="w-5 shrink-0 select-none text-center" aria-hidden="true">
                    {SIGNS[line.type]}
                  </span>
                  <span className="whitespace-pre pr-4">
                    {line.type !== "equal" && (
                      <span className="sr-only">{t(`changes.line.${line.type}`)} </span>
                    )}
                    {line.text || " "}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
