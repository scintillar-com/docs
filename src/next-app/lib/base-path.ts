/**
 * Next.js `basePath` of this build. Empty for the regular (latest) site;
 * `/v/<version>` for a frozen snapshot produced by the versioned build.
 *
 * `next/link` and `useRouter` apply the base path on their own, but raw
 * URLs don't: `fetch()`, `<iframe src>`, plain `<a href>`, `next/image`
 * `src` and metadata icons. Route those through `withBasePath`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_SHELL_BASE_PATH ?? ""

/** Prefix a root-relative URL with the base path; anything else is returned as-is. */
export function withBasePath(url: string, basePath: string = BASE_PATH): string {
  if (!basePath || !url.startsWith("/") || url.startsWith("//")) return url
  if (url === basePath || url.startsWith(`${basePath}/`)) return url
  return `${basePath}${url}`
}
