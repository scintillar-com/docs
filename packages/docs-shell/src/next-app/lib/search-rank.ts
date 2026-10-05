/**
 * Ranking for the search dialog. Pure, so it is tested on its own
 * (search-rank.test.ts) and the dialog only renders.
 *
 * Done here rather than by cmdk's fuzzy matcher: cmdk scores one `value`
 * string per item, and putting a section's prose in it makes every long
 * section match everything. Here a heading hit outranks a body hit.
 */

/** A record of `api/search-index*.json` (see `SearchRecord` in content/search.ts). */
export interface SearchItem {
  label: string
  page: string
  href: string
  /** `"docs"`, `"docs:<section dir>"`, `"components"` or `"blocks"`. */
  group: string
  kind: "page" | "heading" | "component"
  text: string
}

export interface SearchHit {
  item: SearchItem
  score: number
  /** Text around the first match, when the query matched the body. */
  excerpt: string | null
}

/** Lowercased query words; accents are kept (they're matched as typed). */
export function queryTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Score one record, or `null` when some term appears nowhere in it (every
 * term must match). Where a term matches decides the weight: start of the
 * label, then anywhere in the label, the page title, the body.
 */
export function scoreItem(item: SearchItem, terms: string[]): number | null {
  const label = item.label.toLowerCase()
  const page = item.page.toLowerCase()
  const text = item.text.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (label.startsWith(term) || label.includes(` ${term}`)) score += 12
    else if (label.includes(term)) score += 8
    else if (page.includes(term)) score += 4
    else if (text.includes(term)) score += 2
    else return null
  }
  // The whole phrase in the label beats the same words scattered.
  if (terms.length > 1 && label.includes(terms.join(" "))) score += 6
  // A page (or component) is a better landing than one of its sections
  // when both match equally.
  if (item.kind !== "heading") score += 1
  return score
}

/** About 160 characters of body text around the first matching term. */
export function excerptFor(text: string, terms: string[]): string | null {
  if (!text) return null
  const lower = text.toLowerCase()
  let at = -1
  for (const term of terms) {
    const i = lower.indexOf(term)
    if (i >= 0 && (at === -1 || i < at)) at = i
  }
  if (at === -1) return null
  // Widen to whole words, so the excerpt doesn't start or end mid-word.
  let start = Math.max(0, at - 40)
  if (start > 0) {
    const space = text.lastIndexOf(" ", start)
    start = space >= 0 && at - space <= 60 ? space + 1 : start
  }
  let end = Math.min(text.length, at + 120)
  if (end < text.length) {
    const space = text.indexOf(" ", end)
    end = space >= 0 && space - end <= 20 ? space : end
  }
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
}

/**
 * The best `limit` matches for `query`, best first (ties by label). The
 * excerpt is only kept when the label and page title don't already show
 * the match.
 */
export function rankItems(items: SearchItem[], query: string, limit = 40): SearchHit[] {
  const terms = queryTerms(query)
  if (terms.length === 0) return []
  const hits: SearchHit[] = []
  for (const item of items) {
    const score = scoreItem(item, terms)
    if (score === null) continue
    const shown = `${item.label} ${item.page}`.toLowerCase()
    const excerpt = terms.every((t) => shown.includes(t)) ? null : excerptFor(item.text, terms)
    hits.push({ item, score, excerpt })
  }
  return hits
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
}
