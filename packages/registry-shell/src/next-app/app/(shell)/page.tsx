import { getAllDocs } from "@shell/lib/docs"
import HomePage from "@shell/components/homepage"

export default function Home() {
  const docs = getAllDocs()
  const firstDocSlug = docs[0]?.slug

  return <HomePage firstDocSlug={firstDocSlug} />
}
