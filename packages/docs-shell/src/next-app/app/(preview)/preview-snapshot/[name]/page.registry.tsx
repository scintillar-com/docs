import { notFound } from "next/navigation"
import { getAllComponents } from "@shell/lib/components-nav"
import { SnapshotPreview } from "@shell/components/snapshot-preview"

export function generateStaticParams() {
  return getAllComponents().map((comp) => ({ name: comp.name }))
}

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const comp = getAllComponents().find((c) => c.name === name)

  if (!comp) notFound()

  return <SnapshotPreview name={name} />
}
