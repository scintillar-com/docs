/**
 * The shell's homepage rendered at `/`. Two states:
 *   - Registry has content → generic index listing components/blocks/docs.
 *   - Registry empty / absent → terse "no registry wired" placeholder
 *     pointing at the shell's documentation site.
 */
import Link from "next/link"
import { getAllComponents } from "@shell/lib/components-nav"
import { getAllDocs } from "@shell/lib/docs"
import type { HomePageProps } from "@shell/lib/registry-adapter"
import { registry } from "@shell/registry.config"

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
