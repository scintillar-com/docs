"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@shell/components/shell-ui/tabs"
import { PropsTable } from "@shell/components/props-table"
import { A11yInfo } from "@shell/components/a11y-info"
import { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription } from "@shell/components/shell-ui/empty-state"
import { TestInfo } from "@shell/components/test-info"
import { useTranslations } from "@shell/lib/i18n"
import { branding } from "@shell/lib/branding"
import { CURRENT_VERSION, VERSIONS_ENABLED } from "@shell/lib/versions"
import { VersionChanges } from "@shell/components/version-changes"
import { FileText, Link as LinkIcon } from "lucide-react"

const DEFAULT_INSTALL_TEMPLATE = "npx shadcn@latest add {siteUrl}/r/{name}.json"

function renderInstallCommand(name: string): string {
  let template = process.env.NEXT_PUBLIC_SHELL_INSTALL_CMD ?? DEFAULT_INSTALL_TEMPLATE
  // Frozen snapshots install from their own registry JSON (/r/v<version>/).
  if (CURRENT_VERSION) template = template.replace("/r/{name}", `/r/v${CURRENT_VERSION}/{name}`)
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{siteUrl\}/g, branding.siteUrl.replace(/\/$/, ""))
}

interface ComponentTabsProps {
  name: string
  source: string | null
}

interface TocEntry {
  id: string
  text: string
  level: number
}

function useTocFromContent(containerRef: React.RefObject<HTMLDivElement | null>, activeTab: string) {
  const [entries, setEntries] = useState<TocEntry[]>([])

  const scan = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const headings = el.querySelectorAll<HTMLHeadingElement>("h3[id], h4[id]")
    const items: TocEntry[] = []
    headings.forEach((h) => {
      items.push({
        id: h.id,
        text: h.textContent ?? "",
        level: h.tagName === "H3" ? 3 : 4,
      })
    })
    setEntries(items)
  }, [containerRef])

  useEffect(() => {
    // Small delay to let tab content render
    const t = setTimeout(scan, 50)
    return () => clearTimeout(t)
  }, [activeTab, scan])

  return entries
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-lg font-semibold group relative scroll-mt-20">
      {children}
      <a
        href={`#${id}`}
        onClick={(e) => {
          e.preventDefault()
          history.replaceState(null, "", `#${id}`)
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
        className="inline-flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        aria-label={`Link to ${typeof children === "string" ? children : "section"}`}
      >
        <LinkIcon className="size-3.5" />
      </a>
    </h3>
  )
}

const tabs = [
  { value: "install", labelKey: "tabs.install" as const },
  { value: "docs", labelKey: "tabs.documentation" as const },
  { value: "guidelines", labelKey: "tabs.guidelines" as const },
  { value: "a11y", labelKey: "tabs.accessibility" as const },
  { value: "tests", labelKey: "tabs.tests" as const },
  // Diff between versions; only on sites built with `versions`.
  ...(VERSIONS_ENABLED ? [{ value: "changes", labelKey: "tabs.changes" as const }] : []),
]

export function ComponentTabs({ name, source }: ComponentTabsProps) {
  const [activeTab, setActiveTab] = useState("install")
  const contentRef = useRef<HTMLDivElement>(null)
  const tabsScrollRef = useRef<HTMLDivElement>(null)
  const tocEntries = useTocFromContent(contentRef, activeTab)
  const t = useTranslations()

  // Keep the active tab visible when the tab row scrolls (narrow screens).
  // Only the row scrolls horizontally; the page never moves.
  useEffect(() => {
    const row = tabsScrollRef.current
    const active = row?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    if (!row || !active) return
    const left = active.offsetLeft - row.offsetLeft
    const right = left + active.offsetWidth
    if (left < row.scrollLeft) row.scrollTo({ left: left - 8, behavior: "smooth" })
    else if (right > row.scrollLeft + row.clientWidth)
      row.scrollTo({ left: right - row.clientWidth + 8, behavior: "smooth" })
  }, [activeTab])

  return (
    <div className="flex justify-center gap-8">
      <div ref={contentRef} className="flex-1 min-w-0 xl:max-w-225">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="sticky top-14 md:top-14 z-10 bg-background border-b border-border pt-4 md:pt-8 -mx-1 px-1">
            {/* Narrow screens can't fit every tab: scroll them sideways instead
                of widening the page. pb-2/-mb-2 leave room for the active
                underline (drawn below each trigger) without moving the border. */}
            <div
              ref={tabsScrollRef}
              className="-mb-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <TabsList variant="line" className="w-max min-w-full justify-start *:shrink-0">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {t(tab.labelKey)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <TabsContent value="install" className="px-2 mt-6">
            <div className="space-y-6">
              <div>
                <SectionHeading id="installation">
                  {t("component.installation")}
                </SectionHeading>
                <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                  <code>{renderInstallCommand(name)}</code>
                </pre>
              </div>

              {source && (
                <div>
                  <SectionHeading id="source">
                    {t("component.source")}
                  </SectionHeading>
                  <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm">
                    <code>{source}</code>
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="docs" className="px-2 mt-6">
            <div className="space-y-6">
              <SectionHeading id="props-behavior">
                {t("component.propsBehavior")}
              </SectionHeading>
              <PropsTable name={name} />
            </div>
          </TabsContent>

          <TabsContent value="guidelines" className="px-2 mt-6">
            <div className="space-y-4">
              <SectionHeading id="guidelines">
                {t("tabs.guidelines")}
              </SectionHeading>
              <EmptyState>
                <EmptyStateIcon><FileText /></EmptyStateIcon>
                <EmptyStateTitle>{t("tabs.guidelines")}</EmptyStateTitle>
                <EmptyStateDescription>{t("component.guidelinesPlaceholder")}</EmptyStateDescription>
              </EmptyState>
            </div>
          </TabsContent>

          <TabsContent value="a11y" className="px-2 mt-6">
            <div className="space-y-4">
              <SectionHeading id="accessibility">
                {t("tabs.accessibility")}
              </SectionHeading>
              <A11yInfo name={name} />
            </div>
          </TabsContent>

          <TabsContent value="tests" className="px-2 mt-6">
            <div className="space-y-4">
              <SectionHeading id="tests">
                {t("tabs.tests")}
              </SectionHeading>
              <TestInfo name={name} />
            </div>
          </TabsContent>

          {VERSIONS_ENABLED && (
            <TabsContent value="changes" className="px-2 mt-6">
              <div className="space-y-4">
                <SectionHeading id="changes">
                  {t("tabs.changes")}
                </SectionHeading>
                {activeTab === "changes" && <VersionChanges name={name} />}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* TOC column — space always reserved at xl+ to avoid layout shift when
          switching tabs; inner nav only renders when there are headings. */}
      <div className="hidden xl:block w-44 shrink-0">
        {tocEntries.length > 0 && (
          <nav aria-label={t("toc.title")} className="sticky top-16 pt-20">
            <p className="text-xs font-semibold text-foreground mb-2" aria-hidden="true">
              {t("toc.title")}
            </p>
            <ul role="list" className="space-y-0.5">
              {tocEntries.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      const el = document.getElementById(entry.id)
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "start" })
                        history.replaceState(null, "", `#${entry.id}`)
                      }
                    }}
                    className={`block text-xs px-2 py-1 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 ${
                      entry.level === 4 ? "pl-4" : ""
                    }`}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}
