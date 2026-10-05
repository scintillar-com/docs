/**
 * Markdown helpers shared by the shell (heading anchors, the search index)
 * and by sites that sync Markdown from another repository into
 * `content/docs` (`@sntlr/docs-shell/content`). Pure string functions: no
 * file system, no React.
 *
 * Keep this file free of imports: the Next app imports it directly (for
 * `slugify`), and Next can't resolve the `./x.js` specifiers the compiled
 * package needs, which the other files here use.
 */

/**
 * The anchor id of a heading, from its plain text. The shell's MDX headings
 * and the search index both use this, so a search result's `#anchor` lands
 * on the heading it names. Changing it changes every heading URL.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
}

/**
 * Runs `fn` over the prose of a document only, leaving fenced code blocks
 * and inline code spans as they are: a code sample is exactly where `<Foo>`
 * and `{bar}` must stay literal.
 */
export function mapProse(md: string, fn: (chunk: string) => string): string {
  return md
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part
      return part
        .split(/(`[^`\n]*`)/g)
        .map((inner, j) => (j % 2 === 1 ? inner : fn(inner)))
        .join("")
    })
    .join("")
}

/**
 * Plain Markdown → valid MDX. MDX reads `<` as JSX and `{` as an expression,
 * while plain Markdown uses both literally (`packages/<module>/`, `{id}`).
 * Autolinks (`<https://x>`) become explicit links, then every remaining `<`
 * and `{` in prose is escaped. Code is left alone.
 *
 * Escaping all of them, rather than sparing what looks like an HTML tag, is
 * deliberate: for Markdown with no inline HTML, guessing `<module>` from
 * `<br>` fails on exactly the ambiguous cases that break a build.
 */
export function escapeMdx(md: string): string {
  return mapProse(md, (chunk) =>
    chunk
      .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, (_m, url: string) => `[${url}](${url})`)
      .replace(/</g, "\\<")
      .replace(/\{/g, "\\{"),
  )
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

/**
 * Markdown → one line of plain text, for matching and for excerpts.
 * Deliberately lossy: code blocks, tables and images go entirely, links
 * keep their text, emphasis and heading markers are stripped, and the
 * `\<` / `\{` escapes of {@link escapeMdx} are undone.
 */
export function flattenMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(?<!\\)<\/?[A-Za-z][^>\n]*>/g, " ") // HTML / JSX tags, not escaped `\<T>`
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[`*_#~]/g, "")
    .replace(/\\([<{}>[\]*_`#\\])/g, "$1")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim()
}

/** The text of the first `# Heading`, or `null`. Headings in code are ignored. */
export function firstHeading(md: string): string | null {
  for (const line of proseLines(md)) {
    const m = line.match(/^#\s+(.+?)\s*#*\s*$/)
    if (m) return m[1] ?? null
  }
  return null
}

/**
 * The first real paragraph after the H1, as plain text: a page's natural
 * description. Skips headings, code, quotes, lists, tables and fragments
 * shorter than 20 characters; cut at `max` characters with an ellipsis.
 */
export function firstParagraph(md: string, max = 200): string {
  const body = md.replace(/^#\s+.+?\s*$/m, "")
  for (const block of body.split(/\n\s*\n/)) {
    const text = block.trim()
    if (!text || /^(#|```|~~~|>|[-*+]\s|\||\d+\.\s|<)/.test(text)) continue
    const flat = flattenMarkdown(text)
    if (flat.length < 20) continue
    return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
  }
  return ""
}

/**
 * A document's frontmatter as flat `key: value` strings, plus the body
 * after it. Minimal on purpose (one line per key, quotes trimmed, no
 * nesting): enough for `title`, `description` and `order` on Markdown that
 * mostly has none. For real YAML, use `gray-matter`.
 */
export function splitFrontmatter(text: string): {
  data: Record<string, string>
  body: string
} {
  const m = text.match(/^---[^\n]*\r?\n([\s\S]*?)\r?\n---[^\n]*(?:\r?\n|$)/)
  if (!m) return { data: {}, body: text }
  const data: Record<string, string> = {}
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (kv) data[kv[1] as string] = (kv[2] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2")
  }
  return { data, body: text.slice(m[0].length) }
}

/**
 * A frontmatter block for `fields`, followed by a blank line. Strings are
 * JSON-quoted (valid YAML, safe for colons and quotes); numbers and
 * booleans are written bare; `undefined` fields are skipped.
 */
export function formatFrontmatter(
  fields: Record<string, string | number | boolean | undefined>,
): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => (typeof v === "string" ? `${k}: ${JSON.stringify(v)}` : `${k}: ${v}`))
  return `---\n${lines.join("\n")}\n---\n\n`
}

/** One heading and the prose under it, up to the next heading of any level. */
export interface MarkdownSection {
  level: number
  /** Heading as plain text. */
  heading: string
  /** {@link slugify} of the heading: its anchor id on the rendered page. */
  anchor: string
  /** The Markdown under the heading. */
  body: string
}

/**
 * Splits a document at its ATX headings (`#` … `######`), ignoring lines
 * inside fenced code (a `# comment` in a shell sample is not a heading).
 * `intro` is the Markdown before the first heading.
 */
export function splitSections(md: string): { intro: string; sections: MarkdownSection[] } {
  const sections: MarkdownSection[] = []
  const intro: string[] = []
  let current: { level: number; heading: string; lines: string[] } | null = null
  const flush = () => {
    if (!current) return
    const heading = flattenMarkdown(current.heading)
    sections.push({
      level: current.level,
      heading,
      anchor: slugify(heading),
      body: current.lines.join("\n"),
    })
  }

  let fence: string | null = null
  for (const line of md.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(```|~~~)/)?.[1]
    if (marker && (fence === null || fence === marker)) fence = fence === null ? marker : null
    const heading = fence === null && !marker ? line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/) : null
    if (heading) {
      flush()
      current = { level: (heading[1] ?? "").length, heading: heading[2] ?? "", lines: [] }
    } else if (current) {
      current.lines.push(line)
    } else {
      intro.push(line)
    }
  }
  flush()
  return { intro: intro.join("\n"), sections }
}

/** The lines of `md` outside fenced code blocks. */
function proseLines(md: string): string[] {
  const out: string[] = []
  let fence: string | null = null
  for (const line of md.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(```|~~~)/)?.[1]
    if (marker && (fence === null || fence === marker)) {
      fence = fence === null ? marker : null
      continue
    }
    if (fence === null) out.push(line)
  }
  return out
}
