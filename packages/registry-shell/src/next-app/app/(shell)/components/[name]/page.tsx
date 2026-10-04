import { notFound } from "next/navigation"
import { getAllComponents } from "@shell/lib/components-nav"
import { registry } from "@shell/registry.config"
import { ComponentPreview } from "@shell/components/component-preview"
import { ComponentTabs } from "@shell/components/component-tabs"
import { TranslatedText } from "@shell/components/translated-text"
import { ResizablePreview } from "@shell/components/resizable-preview"
import { ComponentBreadcrumb } from "@shell/components/component-breadcrumb"

export function generateStaticParams() {
  return getAllComponents().map((comp) => ({ name: comp.name }))
}

export function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return params.then(({ name }) => {
    const comp = getAllComponents().find((c) => c.name === name)
    if (!comp) return {}
    return {
      title: `${comp.label} - UI Registry`,
    }
  })
}

export default async function ComponentPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const comp = getAllComponents().find((c) => c.name === name)

  if (!comp) notFound()

  const source = registry?.getComponentSource(name) ?? null

  return (
    <div>
      {/* Component header — sticky on desktop, breadcrumb on mobile when scrolled */}
      <ComponentBreadcrumb name={comp.label}>
        <div className="sticky top-14 z-20 bg-background border-b border-border max-md:static max-md:border-b-0">
          <div className="mx-auto px-4 md:px-8 py-4 max-md:py-3">
            <h1 className="text-2xl max-md:text-xl font-bold">{comp.label}</h1>
            <p className="text-sm text-muted-foreground max-md:hidden">
              <TranslatedText k="component.subtitle" />
            </p>
          </div>
        </div>
      </ComponentBreadcrumb>

      {/* Resizable preview area */}
      <ResizablePreview>
        <ComponentPreview name={name} />
      </ResizablePreview>

      {/* Tabs with reserved TOC column on the right. Content clamps to 900px on xl. */}
      <div className="mx-auto px-4 md:px-8 pb-8 w-full">
        <ComponentTabs name={name} source={source} />
      </div>
    </div>
  )
}
