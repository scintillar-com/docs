import { SidebarLayout } from "@shell/components/sidebar-layout"
import { getAllDocs } from "@shell/lib/docs"
import { getAllComponents, getCategories } from "@shell/lib/components-nav"

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const docs = getAllDocs()
  const components = getAllComponents()
  const categories = getCategories()

  return (
    <SidebarLayout docs={docs} components={components} categories={categories}>
      {children}
    </SidebarLayout>
  )
}
