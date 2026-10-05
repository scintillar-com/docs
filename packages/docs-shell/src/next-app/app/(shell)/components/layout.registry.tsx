import { SidebarLayout } from "@shell/components/sidebar-layout"

// The sidebar reads its navigation data from the root layout's NavDataProvider.
export default function ComponentsLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout>{children}</SidebarLayout>
}
