import { mapProse } from "./markdown.js"

/** A source folder (repo-relative) and the docs path it is published under. */
export interface DocsMapping {
  /** Repo-relative folder, e.g. `"docs/guides"` or `"packages/kanban/docs/use"`. */
  from: string
  /** Path under `/docs/` it lands at, e.g. `"guides"` or `"guides/kanban"`. `""` for the root. */
  to: string
}

export interface DocsRouteOptions {
  /** URL prefix of the docs pages. Default `"/docs"`. */
  base?: string
  /** File extensions that are pages. Default `[".md", ".mdx"]`. */
  extensions?: string[]
}

const FOLDER_INDEX = new Set(["_index", "index"])

/**
 * The site URL of a repo-relative path (a page or a folder), or `null` when
 * no mapping covers it. The **longest** matching `from` wins, so a nested
 * mapping (`docs/guides/api` → `reference`) beats its parent
 * (`docs/guides` → `guides`). The rest of the path is kept, so a page in a
 * subfolder of a mapped folder keeps its place in the tree. A folder's
 * `_index` / `index` page answers at the folder's URL, like on the site.
 *
 *   docsRouteFor("docs/guides/setup/install.md", [{ from: "docs/guides", to: "guides" }])
 *   // → "/docs/guides/setup/install"
 */
export function docsRouteFor(
  repoPath: string,
  mappings: DocsMapping[],
  { base = "/docs", extensions = [".md", ".mdx"] }: DocsRouteOptions = {},
): string | null {
  const clean = normalize(repoPath).replace(/\/$/, "")
  const ext = extensions.find((e) => clean.toLowerCase().endsWith(e))
  let dir = clean
  let name: string | null = null
  if (ext) {
    const slash = clean.lastIndexOf("/")
    dir = slash >= 0 ? clean.slice(0, slash) : ""
    name = clean.slice(slash + 1, clean.length - ext.length)
  }

  let best: DocsMapping | null = null
  for (const m of mappings) {
    const from = normalize(m.from).replace(/\/$/, "")
    const covers = from === "" || dir === from || dir.startsWith(`${from}/`)
    if (covers && (best === null || from.length > normalize(best.from).replace(/\/$/, "").length)) {
      best = m
    }
  }
  if (!best) return null

  const from = normalize(best.from).replace(/\/$/, "")
  const rest = from === "" ? dir : dir.slice(from.length).replace(/^\//, "")
  const parts = [best.to, rest, name && !FOLDER_INDEX.has(name) ? name : ""]
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
  return parts.length > 0 ? `${base}/${parts.join("/")}` : base
}

/**
 * What a link target becomes: a new URL, or `null` to leave the link as is.
 * `repoPath` is the target resolved against the linking file's folder,
 * repo-relative (`../api/keys.md` from `docs/guides` → `docs/api/keys.md`).
 */
export type LinkResolver = (repoPath: string, hash: string) => string | null

/**
 * Rewrites the relative Markdown links of a document (`[text](../x.md)`,
 * images included) through `resolve`. Absolute URLs, `mailto:` and
 * same-page `#anchors` are left alone, and so is anything inside code.
 *
 *   rewriteLinks(md, "docs/guides", (p, hash) => {
 *     const route = docsRouteFor(p, mappings)
 *     return route ? route + hash : `https://github.com/org/repo/blob/${ref}/${p}${hash}`
 *   })
 */
export function rewriteLinks(md: string, fromDir: string, resolve: LinkResolver): string {
  return mapProse(md, (chunk) =>
    chunk.replace(/\]\(([^)\s]+?)(#[^)\s]*)?(\s+"[^"]*")?\)/g, (whole, target: string, hash = "", title = "") => {
      if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) return whole
      const repoPath = target.startsWith("/")
        ? normalize(target.slice(1))
        : normalize(`${fromDir}/${target}`)
      const next = resolve(repoPath, hash)
      return next === null ? whole : `](${next}${title})`
    }),
  )
}

/** POSIX-style path with `.` and `..` resolved; never starts with `./` or `/`. */
function normalize(p: string): string {
  const out: string[] = []
  for (const part of p.replace(/\\/g, "/").split("/")) {
    if (part === "" || part === ".") continue
    if (part === "..") out.pop()
    else out.push(part)
  }
  return out.join("/") + (/[\\/]$/.test(p) && out.length > 0 ? "/" : "")
}
