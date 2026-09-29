import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@shell/components/shell-ui/button"
import { ThemeToggle } from "@shell/components/theme-toggle"
import { I18nProvider } from "@shell/lib/i18n"
import { resolveThemePanelConfig } from "@shell/lib/theme-panel"

/** Verbatim copy of the header toggle from before the theme panel existed. */
function ToggleBeforeThemePanel() {
  const { setTheme, resolvedTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}

describe("ThemeToggle", () => {
  it("renders exactly today's sun/moon toggle when themePanel is absent", () => {
    const expected = renderToStaticMarkup(<ToggleBeforeThemePanel />)
    expect(renderToStaticMarkup(<ThemeToggle panel={null} />)).toBe(expected)
    // Default path: the test env has no NEXT_PUBLIC_SHELL_THEME_PANEL.
    expect(renderToStaticMarkup(<ThemeToggle />)).toBe(expected)
  })

  it("renders a popover trigger when themePanel is set", () => {
    const panel = resolveThemePanelConfig({ since: "1.0.0" })
    const html = renderToStaticMarkup(
      <I18nProvider>
        <ThemeToggle panel={panel} />
      </I18nProvider>,
    )
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-label="Theme settings"')
    expect(html).not.toContain("Toggle theme")
  })
})
