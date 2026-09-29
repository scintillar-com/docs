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

function pick(key: string, fallback: string): string {
  const value = process.env[`NEXT_PUBLIC_SHELL_${key}`]
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
