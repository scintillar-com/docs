import type { Metadata } from "next"
import { fontSans, fontMono } from "@shell/lib/fonts"
import { ThemeProvider } from "@shell/components/theme-provider"
import { ThemeOverridesScript } from "@shell/components/theme-overrides-script"
import { ThemeOverridesSync } from "@shell/components/theme-overrides-sync"
import { getShellThemePanel } from "@shell/lib/theme-panel"
import { I18nProvider } from "@shell/lib/i18n"
import { registry } from "@shell/shell.config"
import { getShellDefaultLocale, getShellLocales } from "@shell/lib/locales"
import "./preview.css"

/**
 * Root layout for the (preview) route group — sibling of (shell)/layout.tsx
 * via Next App Router's "multiple root layouts" feature (route groups with
 * their own html/body).
 *
 * Why a separate root: previews need to render in an environment that
 * mirrors what a downstream consumer sees, not what the shell sees. The
 * (shell) root injects Header / Sidebar / NavigationProgress / custom
 * scrollbar / html font-size clamp / docs-prose helpers / marquee &
 * bento animation classes ; all of those leak into inline previews and
 * caused real "the preview looks different from my app" confusion.
 *
 * This layout is deliberately minimal:
 *  - html / body shell only
 *  - ThemeProvider so light/dark sync via shared localStorage works
 *  - I18nProvider so registry-extra translations resolve
 *  - No `globals.css` — `(preview)/preview-snapshot/preview.css` (loaded
 *    by the nested SnapshotLayout) is the deliberate consumer-equivalent
 *    subset of the shell's CSS.
 *
 * Preview pages target this root by living under `app/(preview)/...`.
 * The inline `/components/[name]` page on the (shell) side renders these
 * preview routes via an iframe so the visual is identical and
 * shell-chrome rules cannot leak in.
 */

export const metadata: Metadata = {
  // Iframes don't surface this title to the user, but keep it for
  // discoverability when the route is opened directly (Playwright,
  // debugging).
  title: "Preview",
  robots: { index: false, follow: false },
}

const shellLocales = getShellLocales()
const shellDefaultLocale = getShellDefaultLocale() || "en"
// Null unless the registry opts into the theme panel (see lib/theme-panel).
const themePanel = getShellThemePanel()

export default function PreviewRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} antialiased`}
      >
        {themePanel && <ThemeOverridesScript controls={themePanel.controls} />}
        <ThemeProvider>
          {themePanel && <ThemeOverridesSync controls={themePanel.controls} />}
          <I18nProvider
            extraTranslations={registry?.extraTranslations}
            defaultLocale={shellDefaultLocale}
            availableLocales={shellLocales}
          >
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
