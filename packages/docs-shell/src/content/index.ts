/**
 * `@sntlr/docs-shell/content`: helpers for preparing a site's
 * `content/docs`, typically from Markdown kept in another repository
 * (a sync script), and the record format of the search index.
 *
 *   import { escapeMdx, rewriteLinks, docsRouteFor } from "@sntlr/docs-shell/content"
 */
export {
  slugify,
  mapProse,
  escapeMdx,
  flattenMarkdown,
  firstHeading,
  firstParagraph,
  splitFrontmatter,
  formatFrontmatter,
  splitSections,
  type MarkdownSection,
} from "./markdown.js"
export {
  docsRouteFor,
  rewriteLinks,
  type DocsMapping,
  type DocsRouteOptions,
  type LinkResolver,
} from "./links.js"
export { pageSearchRecords, type SearchRecord, type PageRecordsInput } from "./search.js"
export { copyAssets, type CopyAssetsOptions } from "./assets.js"
