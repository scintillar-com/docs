/**
 * The shell's homepage rendered at `/`. Three states:
 *   - Registry has components or blocks → generic index listing them.
 *   - Docs but no components/blocks → documentation index (docs-only site).
 *   - No config at all → terse "no registry wired" placeholder pointing at
 *     the shell's documentation site.
 */
import Link from "next/link"
import { getAllComponents } from "@shell/lib/components-nav"
import { getAllDocs, getDocsNav, type DocMeta } from "@shell/lib/docs"
import { firstDocSlug as firstSlugOf } from "@shell/lib/docs-tree"
import type { HomePageProps } from "@shell/lib/registry-adapter"
import { registry } from "@shell/shell.config"
import { branding } from "@shell/lib/branding"
import { TranslatedText } from "@shell/components/translated-text"

export default function HomePage({ firstDocSlug }: HomePageProps) {
  // The placeholder is for shell-only mode (no registry-shell.config.ts
  // found). A configured-but-empty registry falls through to the main
  // layout, which renders "0 components" honestly — blocks and docs are
  // optional surfaces, so their counters hide when zero.
  if (!registry) return <NoRegistryPlaceholder />

  const items = getAllComponents()
  const docs = getAllDocs()
  const components = items.filter((c) => c.kind === "component")
  const blocks = items.filter((c) => c.kind === "block")

  // A docs-only site (no components, no blocks) gets a documentation index
  // instead of a "0 components" registry summary.
  if (items.length === 0 && docs.length > 0) return <DocsHome docs={docs} />

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="outline-none max-w-5xl mx-auto px-4 md:px-8 py-12"
    >
      <section className="mb-12">
        <h1 className="text-3xl font-bold">Registry</h1>
        <p className="mt-2 text-muted-foreground">
          {/* Components are the core artifact — always shown, even at zero.
           *  Blocks and docs are optional surfaces; omit them from the
           *  summary line when the registry doesn't ship any, so a
           *  component-only registry doesn't advertise empty categories. */}
          {components.length} component{components.length === 1 ? "" : "s"}
          {blocks.length > 0 && (
            <>
              , {blocks.length} block{blocks.length === 1 ? "" : "s"}
            </>
          )}
          {docs.length > 0 && (
            <>
              , {docs.length} doc{docs.length === 1 ? "" : "s"}
            </>
          )}
        </p>
        {firstDocSlug && (
          <Link
            href={`/docs/${firstDocSlug}`}
            className="mt-4 inline-block text-sm underline underline-offset-4"
          >
            Browse documentation →
          </Link>
        )}
      </section>

      {components.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-4">Components</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {components.map((c) => (
              <li key={c.name}>
                <Link className="hover:underline" href={`/components/${c.name}`}>
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {blocks.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Blocks</h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {blocks.map((b) => (
              <li key={b.name}>
                <Link className="hover:underline" href={`/components/${b.name}`}>
                  {b.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

/**
 * Homepage of a docs-only site: the site's name and description from its
 * config, a link to the first page, and every page with its description.
 */
function DocsHome({ docs }: { docs: DocMeta[] }) {
  const { sections, trees } = getDocsNav()
  // Root-level pages in sidebar order (all pages, for a flat docs folder).
  const rootDocs = (trees[""] ?? []).flatMap((n) => (n.kind === "doc" ? [n.doc] : []))
  const start = firstSlugOf(trees[""] ?? []) ?? sections[0]?.firstSlug ?? docs[0].slug

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`outline-none mx-auto px-4 md:px-8 py-12 ${sections.length > 0 ? "max-w-5xl" : "max-w-3xl"}`}
    >
      <section className="mb-10">
        <h1 className="text-3xl font-bold">{branding.siteName}</h1>
        {branding.description && (
          <p className="mt-2 text-muted-foreground max-w-2xl">{branding.description}</p>
        )}
        <Link
          href={`/docs/${start}`}
          className="mt-4 inline-block text-sm underline underline-offset-4"
        >
          <TranslatedText k="home.startReading" /> →
        </Link>
      </section>

      {/* One card per docs section (top-level folder), linking to its own
          page or its first page; the section page's description, if any. */}
      {sections.length > 0 && (
        <section className="mb-10">
          <ul className="grid gap-4 sm:grid-cols-2">
            {sections.map((section) => {
              const index = docs.find((d) => d.slug === section.dir)
              if (!section.firstSlug) return null
              return (
                <li key={section.dir}>
                  <Link
                    href={`/docs/${section.firstSlug}`}
                    className="block h-full rounded-lg border border-border p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
                  >
                    <h2 className="font-semibold">{section.label}</h2>
                    {index?.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{index.description}</p>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {rootDocs.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">
            <TranslatedText k="home.pages" />
          </h2>
          <ul className="divide-y divide-border border-y border-border">
            {rootDocs.map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={`/docs/${doc.slug}`}
                  className="block py-3 hover:bg-accent/40 transition-colors px-2 -mx-2 rounded-md"
                >
                  <span className="font-medium">{doc.title}</span>
                  {doc.description && (
                    <span className="block text-sm text-muted-foreground mt-0.5">
                      {doc.description}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

/**
 * Shown when the shell boots with no config AND no content. Zero external
 * dependencies (no fetches, no dynamic content) — if a consumer ever sees
 * this, they're either running `registry-shell dev` in a blank directory
 * or they're mid-setup.
 */
function NoRegistryPlaceholder() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="outline-none max-w-xl mx-auto px-6 py-24 text-center"
    >
      <h1 className="text-2xl font-semibold">No registry wired</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Add a{" "}
        <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
          registry-shell.config.ts
        </code>{" "}
        to this project and restart the dev server.
      </p>
      <p className="mt-8 text-xs text-muted-foreground">
        Setup guide:{" "}
        <a
          href="https://github.com/scintillar-com/registry-shell"
          className="underline underline-offset-4 hover:text-foreground"
          target="_blank"
          rel="noopener noreferrer"
        >
          scintillar-com/registry-shell
        </a>
      </p>
    </main>
  )
}
