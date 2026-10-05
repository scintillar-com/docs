import { flattenMarkdown, splitSections } from "./markdown.js"

/**
 * One entry of the search index: a page's opening, a heading of a page, or
 * a component. Written by the shell's build to `api/search-index*.json`.
 */
export interface SearchRecord {
  /** Heading text, page title, or component label. */
  label: string
  /** Title of the page the record is on (the label itself for a page or component). */
  page: string
  /** Where the result goes; headings link to their anchor. */
  href: string
  /**
   * Which part of the site it's in, as the header tabs name them:
   * `"docs"` (pages at the docs root), `"docs:<section dir>"`,
   * `"components"` or `"blocks"`.
   */
  group: string
  kind: "page" | "heading" | "component"
  /** Plain text matched against and excerpted in results, capped. */
  text: string
}

export interface PageRecordsInput {
  /** The page's Markdown / MDX, without frontmatter. */
  content: string
  title: string
  description?: string
  /** The page URL (`/docs/guides/start/`). Heading anchors are appended. */
  href: string
  group: string
  /** Heading levels that get their own record. Default 2–4. */
  levels?: number[]
  /** Text cap per record, in characters. Default 600. */
  maxText?: number
}

/**
 * Search records for one page: one for the page (description plus the
 * prose before its first sub-heading) and one per H2–H4 with the prose
 * under it, linking to the heading's anchor. A search for words in a
 * paragraph lands on that paragraph's heading, not the top of the page.
 *
 * Prose under deeper headings (H5, H6) stays with the heading above it;
 * a heading with no linkable text (punctuation only) folds into the page.
 */
export function pageSearchRecords({
  content,
  title,
  description,
  href,
  group,
  levels = [2, 3, 4],
  maxText = 600,
}: PageRecordsInput): SearchRecord[] {
  const { intro, sections } = splitSections(content)
  const page: SearchRecord = { label: title, page: title, href, group, kind: "page", text: "" }
  const pageText: string[] = [description ?? "", flattenMarkdown(intro)]
  const records: SearchRecord[] = [page]
  // Where the prose being read goes: the page, or the last indexed heading.
  let bucket = pageText
  const texts: Array<[SearchRecord, string[]]> = []

  for (const section of sections) {
    const body = flattenMarkdown(section.body)
    // The H1 is the page title: its prose belongs to the page record, and so
    // does a heading with no linkable text.
    if (section.level === 1 || !section.anchor) {
      bucket = pageText
      bucket.push(section.level === 1 ? "" : section.heading, body)
      continue
    }
    // Deeper headings stay with the record above them.
    if (!levels.includes(section.level)) {
      bucket.push(section.heading, body)
      continue
    }
    const record: SearchRecord = {
      label: section.heading,
      page: title,
      href: `${href}#${section.anchor}`,
      group,
      kind: "heading",
      text: "",
    }
    bucket = [body]
    texts.push([record, bucket])
    records.push(record)
  }

  page.text = cap(pageText, maxText)
  for (const [record, text] of texts) record.text = cap(text, maxText)
  return records
}

function cap(parts: string[], max: number): string {
  const text = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
  return text.length > max ? text.slice(0, max) : text
}
