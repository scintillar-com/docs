"use client"

import { useEffect, useState } from "react"
import { withBasePath } from "@shell/lib/base-path"
import { CheckCircle2, XCircle, FlaskConical, Eye, Keyboard, Gauge, Shield } from "lucide-react"
import { Badge } from "@shell/components/shell-ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@shell/components/shell-ui/accordion"
import {
  EmptyState,
  EmptyStateIcon,
  EmptyStateDescription,
} from "@shell/components/shell-ui/empty-state"
import { useTranslations } from "@shell/lib/i18n"

interface TestFile {
  file: string
  type: string
  tests: string[]
}

interface TestReport {
  component: string
  hasUnitTests: boolean
  hasInteractionTests: boolean
  hasVisualTests: boolean
  hasA11yTests: boolean
  hasPerformanceTests: boolean
  hasProps: boolean
  hasA11yDocs: boolean
  hasPreview: boolean
  testFiles: TestFile[]
  totalTests: number
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  unit: FlaskConical,
  interaction: Keyboard,
  visual: Eye,
  a11y: Shield,
  performance: Gauge,
}

function CheckItem({ passed, label }: { passed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckCircle2 className="size-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="size-4 text-muted-foreground/40 shrink-0" />
      )}
      <span className={passed ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  )
}

export function TestInfo({ name }: { name: string }) {
  const [report, setReport] = useState<TestReport | null>(null)
  const [error, setError] = useState(false)
  const t = useTranslations()

  useEffect(() => {
    fetch(withBasePath(`/tests/${name}.json`))
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setReport)
      .catch(() => setError(true))
  }, [name])

  if (error) {
    return (
      <EmptyState>
        <EmptyStateIcon><FlaskConical /></EmptyStateIcon>
        <EmptyStateDescription>{t("component.testsPlaceholder")}</EmptyStateDescription>
      </EmptyState>
    )
  }

  if (!report) {
    return <p className="text-sm text-muted-foreground" role="status">{t("a11y.loading")}</p>
  }

  const hasAnyTests = report.totalTests > 0

  return (
    <div className="space-y-6">
      {/* Health overview */}
      <div className="space-y-3">
        <h4 id="test-health" className="text-base font-semibold">{t("tests.health")}</h4>
        <div className="grid grid-cols-2 gap-2">
          <CheckItem passed={report.hasProps} label={t("tests.propsDocs")} />
          <CheckItem passed={report.hasA11yDocs} label={t("tests.a11yDocs")} />
          <CheckItem passed={report.hasPreview} label={t("tests.preview")} />
          <CheckItem passed={report.hasUnitTests} label={t("tests.unit")} />
          <CheckItem passed={report.hasInteractionTests} label={t("tests.interaction")} />
          <CheckItem passed={report.hasVisualTests} label={t("tests.visual")} />
          <CheckItem passed={report.hasA11yTests} label={t("tests.accessibility")} />
          <CheckItem passed={report.hasPerformanceTests} label={t("tests.performance")} />
        </div>
      </div>

      {hasAnyTests && (
        <div className="space-y-3">
          <h4 id="test-coverage" className="text-base font-semibold">
            {t("tests.tests")}
            <Badge variant="secondary" className="ml-2">{report.totalTests}</Badge>
          </h4>

          <Accordion type="multiple" defaultValue={report.testFiles.map((f) => f.type)}>
            {report.testFiles.map((tf) => {
              const Icon = typeIcons[tf.type] ?? FlaskConical

              return (
                <AccordionItem key={tf.file} value={tf.type}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{t(`tests.${tf.type}` as string)}</span>
                      <Badge variant="outline" className="text-[10px]">{tf.tests.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground font-mono mb-2">{tf.file}</p>
                    <ul className="space-y-1">
                      {tf.tests.map((test, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <CheckCircle2 className="size-3 text-green-500 shrink-0" />
                          {test}
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </div>
      )}

      {!hasAnyTests && (
        <EmptyState>
          <EmptyStateIcon><FlaskConical /></EmptyStateIcon>
          <EmptyStateDescription>{t("component.testsPlaceholder")}</EmptyStateDescription>
        </EmptyState>
      )}
    </div>
  )
}
