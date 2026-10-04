import fs from "node:fs"
import { notFound } from "next/navigation"
import { compileMDX } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"
import { ReleasesList, type RenderedRelease } from "@shell/components/releases-list"
import { parseChangelog, releaseAnchor } from "@shell/lib/changelog"
import { BASE_PATH, withBasePath } from "@shell/lib/base-path"

/**
 * Releases page of sites built with `versions`: the registry's changelog
 * (`versions.changelog`, default `CHANGELOG.md`), one section per release.
 * The CLI passes the file as SHELL_CHANGELOG_PATH only when it exists; any
 * other build prerenders a 404 here and the CLI drops that output (see
 * `removeReleasesPage` in src/cli/build.ts).
 */
export const metadata = { title: "Releases - UI Registry" }

// Plain markdown, not MDX: changelog entries are free text where `<` and
// `{` are common and must not be parsed as JSX. Links are rebased like
// the docs' MDX links on versioned snapshots.
const mdComponents = BASE_PATH
  ? {
      a: (props: React.ComponentProps<"a">) => (
        <a {...props} href={props.href ? withBasePath(props.href) : props.href} />
      ),
    }
  : undefined

function render(markdown: string) {
  return compileMDX({
    source: markdown,
    options: { mdxOptions: { format: "md", remarkPlugins: [remarkGfm] } },
    components: mdComponents,
  }).then((r) => r.content)
}

function readChangelog(): string | null {
  const file = process.env.SHELL_CHANGELOG_PATH
  if (!file) return null
  try {
    return fs.readFileSync(file, "utf-8")
  } catch {
    return null
  }
}

export default async function ReleasesPage() {
  const source = readChangelog()
  if (source === null) notFound()

  const changelog = parseChangelog(source)
  const releases: RenderedRelease[] = await Promise.all(
    changelog.releases.map(async (release) => ({
      heading: release.heading,
      version: release.version,
      anchor: releaseAnchor(release),
      bumps: release.bumps,
      content: release.body ? await render(release.body) : null,
    })),
  )
  const intro = changelog.intro ? await render(changelog.intro) : null

  return <ReleasesList releases={releases} intro={intro} />
}
