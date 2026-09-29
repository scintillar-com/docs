import type { Metadata } from "next"
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "@shell/components/theme-provider"
import { ThemeOverridesScript } from "@shell/components/theme-overrides-script"
import { getShellThemePanel } from "@shell/lib/theme-panel"
import { I18nProvider } from "@shell/lib/i18n"
import { SidebarProvider } from "@shell/components/sidebar-provider"
import { Header } from "@shell/components/header"
import { A11yProvider } from "@shell/components/a11y-provider"
import { NavigationProgress } from "@shell/components/navigation-progress"
import { NavDataProvider } from "@shell/components/nav-data-provider"
import { GlobalMobileSidebar } from "@shell/components/global-mobile-sidebar"
import { getAllDocs } from "@shell/lib/docs"
import { getAllComponents, getCategories } from "@shell/lib/components-nav"
import { getGithubStars } from "@shell/lib/github"
import { branding } from "@shell/lib/branding"
import { registry } from "@shell/registry.config"
import { getShellDefaultLocale, getShellLocales } from "@shell/lib/locales"
import "../globals.css"

const shellLocales = getShellLocales()
const shellDefaultLocale = getShellDefaultLocale() || "en"
// Null unless the registry opts into the theme panel (see lib/theme-panel).
const themePanel = getShellThemePanel()

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
})

const spaceMono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
})

const description = branding.description || `${branding.siteName} component registry.`

export const metadata: Metadata = {
  title: branding.siteName,
  description,
  metadataBase: branding.siteUrl ? new URL(branding.siteUrl) : undefined,
  openGraph: {
    title: branding.siteName,
    description,
    siteName: branding.siteName,
    url: branding.siteUrl || undefined,
    images: branding.ogImage ? [{ url: branding.ogImage }] : undefined,
    type: "website",
  },
  twitter: {
    card: branding.ogImage ? "summary_large_image" : "summary",
    title: branding.siteName,
    description,
    site: branding.twitterHandle ? `@${branding.twitterHandle}` : undefined,
    images: branding.ogImage ? [branding.ogImage] : undefined,
  },
  icons: {
    icon: [
      { url: branding.faviconDark, type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
      { url: branding.faviconLight, type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      { url: branding.faviconIco, sizes: "48x48" },
    ],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const docs = getAllDocs()
  const components = getAllComponents()
  const categories = getCategories()
  // Server-side, revalidates hourly. Returns null on failure → header shows
  // the GitHub icon without a count.
  const githubStars = await getGithubStars()

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} antialiased`}
      >
        {themePanel && <ThemeOverridesScript controls={themePanel.controls} />}
        <ThemeProvider>
          <I18nProvider
            extraTranslations={registry?.extraTranslations}
            defaultLocale={shellDefaultLocale}
            availableLocales={shellLocales}
          >
            <NavDataProvider docs={docs} components={components}>
              <SidebarProvider>
                <NavigationProgress />
                <A11yProvider />
                <Header githubStars={githubStars} />
                {/* Mobile-only sidebar mounted here so the hamburger menu works
                    on every page (including the homepage). Per-section layouts
                    still mount their own desktop-only Sidebar via SidebarLayout. */}
                <GlobalMobileSidebar docs={docs} components={components} categories={categories} />
                {children}
              </SidebarProvider>
            </NavDataProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
