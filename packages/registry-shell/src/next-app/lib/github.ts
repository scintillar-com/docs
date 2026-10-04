import { branding } from "@shell/lib/branding"

export const GITHUB_URL = branding.github
  ? `https://github.com/${branding.github.owner}/${branding.github.repo}`
  : ""

interface RepoResponse {
  stargazers_count?: number
}

/**
 * Server-side fetch of the repository star count with a 1-hour Next.js
 * revalidation window. Returns `null` when no GitHub config is set, when
 * the registry opted out of stars, or on any API failure so callers can
 * render the bare icon without throwing.
 */
export async function getGithubStars(): Promise<number | null> {
  const gh = branding.github
  if (!gh || gh.showStars === false) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github+json" },
    })
    if (!res.ok) return null
    const data = (await res.json()) as RepoResponse
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null
  } catch {
    return null
  }
}

/** Compact star count: 1234 → "1.2k", 12345 → "12k", anything < 1000 stays as-is. */
export function formatStarCount(count: number): string {
  if (count < 1000) return String(count)
  if (count < 10000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return `${Math.round(count / 1000)}k`
}
