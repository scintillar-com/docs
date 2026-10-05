/**
 * Client-safe branding. Populated by the CLI via NEXT_PUBLIC_SHELL_* env vars
 * that Next.js inlines at build time. Values fall back to sensible defaults
 * when no config is wired, so client code never crashes.
 */
import type { BrandingConfig, GithubConfig } from "@shell/lib/registry-adapter"
import { withBasePath } from "@shell/lib/base-path"

const DEFAULT_BRANDING = {
  siteName: "UI Registry",
  shortName: "UI",
  siteUrl: "",
  description: "",
  ogImage: "",
  twitterHandle: "",
  logoAlt: "UI",
  faviconDark: "/favicon_dark.svg",
  faviconLight: "/favicon_light.svg",
  faviconIco: "/favicon.ico",
} as const

// Next.js only inlines *literal* `process.env.NEXT_PUBLIC_*` references into
// client bundles. A computed key (`process.env[`NEXT_PUBLIC_SHELL_${key}`]`)
// worked on the server but read `undefined` in the browser, so client
// components (the header) rendered the defaults and hydration failed (React
// #418) on any site whose branding differed from them. Keep every key spelled
// out here.
const ENV: Record<string, string | undefined> = {
  SITE_NAME: process.env.NEXT_PUBLIC_SHELL_SITE_NAME,
  SHORT_NAME: process.env.NEXT_PUBLIC_SHELL_SHORT_NAME,
  SITE_URL: process.env.NEXT_PUBLIC_SHELL_SITE_URL,
  DESCRIPTION: process.env.NEXT_PUBLIC_SHELL_DESCRIPTION,
  OG_IMAGE: process.env.NEXT_PUBLIC_SHELL_OG_IMAGE,
  TWITTER_HANDLE: process.env.NEXT_PUBLIC_SHELL_TWITTER_HANDLE,
  GITHUB_OWNER: process.env.NEXT_PUBLIC_SHELL_GITHUB_OWNER,
  GITHUB_REPO: process.env.NEXT_PUBLIC_SHELL_GITHUB_REPO,
  GITHUB_LABEL: process.env.NEXT_PUBLIC_SHELL_GITHUB_LABEL,
  GITHUB_SHOW_STARS: process.env.NEXT_PUBLIC_SHELL_GITHUB_SHOW_STARS,
  LOGO_ALT: process.env.NEXT_PUBLIC_SHELL_LOGO_ALT,
  FAVICON_DARK: process.env.NEXT_PUBLIC_SHELL_FAVICON_DARK,
  FAVICON_LIGHT: process.env.NEXT_PUBLIC_SHELL_FAVICON_LIGHT,
  FAVICON_ICO: process.env.NEXT_PUBLIC_SHELL_FAVICON_ICO,
}

function pick(key: keyof typeof ENV & string, fallback: string): string {
  const value = ENV[key]
  return value && value.length > 0 ? value : fallback
}

const githubOwner = pick("GITHUB_OWNER", "")
const githubRepo = pick("GITHUB_REPO", "")
const github: GithubConfig | undefined =
  githubOwner && githubRepo
    ? {
        owner: githubOwner,
        repo: githubRepo,
        label: pick("GITHUB_LABEL", "Github"),
        showStars: process.env.NEXT_PUBLIC_SHELL_GITHUB_SHOW_STARS !== "false",
      }
    : undefined

export const branding: Required<Omit<BrandingConfig, "github">> & {
  github: GithubConfig | undefined
} = {
  siteName: pick("SITE_NAME", DEFAULT_BRANDING.siteName),
  shortName: pick("SHORT_NAME", DEFAULT_BRANDING.shortName),
  siteUrl: pick("SITE_URL", DEFAULT_BRANDING.siteUrl),
  description: pick("DESCRIPTION", DEFAULT_BRANDING.description),
  ogImage: pick("OG_IMAGE", DEFAULT_BRANDING.ogImage),
  twitterHandle: pick("TWITTER_HANDLE", DEFAULT_BRANDING.twitterHandle),
  github,
  logoAlt: pick("LOGO_ALT", DEFAULT_BRANDING.logoAlt),
  // Favicons are raw public/ URLs (metadata icons, next/image src), which
  // Next does not prefix with basePath: do it here for versioned snapshots.
  faviconDark: withBasePath(pick("FAVICON_DARK", DEFAULT_BRANDING.faviconDark)),
  faviconLight: withBasePath(pick("FAVICON_LIGHT", DEFAULT_BRANDING.faviconLight)),
  faviconIco: withBasePath(pick("FAVICON_ICO", DEFAULT_BRANDING.faviconIco)),
}

/** Browser-tab title for an inner page: "<page> - <site name>". */
export function pageTitle(title: string): string {
  return `${title} - ${branding.siteName}`
}
