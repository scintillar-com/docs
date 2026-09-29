/**
 * Server component: pre-render each locale's MDX into a fully-resolved
 * React tree using `compileMDX` from `next-mdx-remote/rsc`. Awaiting
 * `compileMDX` yields plain React nodes (no async-component JSX, no
 * client-side eval), which the client wrapper then picks from by locale.
 *
 * Why this shape (not the previous `serialize` + client-side `MDXRemote`):
 *
 *  - The earlier shape stored `<MDXRemote ... />` async-component JSX in a
 *    plain object prop and passed it to a "use client" component, which
 *    tripped Next 15.5's dev-mode RSC serializer on owner-stacks
 *    instrumentation ("Cannot read properties of undefined (reading
 *    'recentlyCreatedOwnerStacks')").
 *  - The follow-up shape (server `serialize` → client `MDXRemote` from the
 *    legacy `next-mdx-remote` package) fixed dev but broke `output: "export"`
 *    prerender, because the legacy `MDXRemote` runs `useState` during SSR
 *    and that React reference resolved to null in the static export pass
 *    ("Cannot read properties of null (reading 'useState')").
 *
 * Awaiting `compileMDX` server-side returns a serializable React tree, so
 * the client component never has to evaluate MDX; both dev RSC + static
 * export prerender are happy. The package stays in `serverExternalPackages`
 * (see next.config.ts) so its `new Function()` jsx-runtime injection
 * resolves against the same React the rest of the runtime uses.
 */
import { compileMDX } from "next-mdx-remote/rsc"
import remarkGfm from "remark-gfm"
import { mdxHeadings } from "@shell/components/heading-anchor"
import { LocalizedMdxClient } from "@shell/components/localized-mdx-client"
import { BASE_PATH, withBasePath } from "@shell/lib/base-path"

// MDX links render as plain <a>, which Next does not prefix with basePath.
// Only swapped in for versioned snapshots, so regular builds are unchanged.
const mdxComponents = BASE_PATH
  ? {
      ...mdxHeadings,
      a: (props: React.ComponentProps<"a">) => (
        <a {...props} href={props.href ? withBasePath(props.href) : props.href} />
      ),
    }
  : mdxHeadings

const mdxOptions = {
  mdxOptions: { remarkPlugins: [remarkGfm] },
}

export async function LocalizedMdx({
  locales,
}: {
  locales: Record<string, string>
}) {
  const entries = await Promise.all(
    Object.entries(locales).map(async ([loc, source]) => {
      const { content } = await compileMDX({
        source,
        options: mdxOptions,
        components: mdxComponents,
      })
      return [loc, content] as const
    }),
  )
  return <LocalizedMdxClient rendered={Object.fromEntries(entries)} />
}
